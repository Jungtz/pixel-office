import React, { useEffect, useRef, useState } from 'react';
import type { LLMConfig } from '../services/aiAgent';
import type { AgentCharacter, ChatMessage, VoteMode, VoteOption, VoteSession } from '../game/types';
import {
  BINARY_OPTIONS,
  buildTallyText,
  collectVotes,
  fetchConclusion,
  fetchOptionsSuggestion,
  parseCustomOptions,
  resolveRuling,
} from '../services/voteService';
import { soundManager } from '../services/sound';
import { Vote as VoteIcon, X, Sparkles, Loader2 } from 'lucide-react';

interface VoteModalProps {
  isOpen: boolean;
  /** 議案預設值（當前主題） */
  topic: string;
  agents: AgentCharacter[];
  llmConfig: LLMConfig;
  contextMessages: ChatMessage[];
  /** 主持人（定案結論用，不投票） */
  hostName: string;
  /** 收集開始（App 插入🗳️系統訊息＋暫停自主循環用） */
  onStart?: (voteTopic: string, voterIds: string[]) => void;
  /** 收集中止／失敗回到 setup（App 清除投票旗標＋思考泡泡＋⚠️訊息用） */
  onAbort?: (reason: 'cancelled' | 'failed') => void;
  onComplete: (session: VoteSession) => void;
  onClose: () => void;
}

const MODE_TABS: { id: VoteMode; label: string; hint: string }[] = [
  { id: 'binary', label: '二元表決', hint: '贊成議案原文／反對議案原文' },
  { id: 'multi', label: '多選方案', hint: 'A／B／C 選一' },
  { id: 'open', label: '開放討論', hint: '無正解，只總結' },
];

/** 模糊議案：是否／該不該類問句用二元表決易漂移（贊成全出或部分執行分不清） */
export function isAmbiguousBinaryTopic(topic: string): boolean {
  return /(是否|該不該|要不要|能不能|好不好)/.test(topic);
}

/**
 * 投票發起＋逐票收集（Concurrency = 2，附進度條）
 * 主席（使用者扮演角）不投票，AI 不代投真人。
 */
export const VoteModal: React.FC<VoteModalProps> = ({
  isOpen,
  topic,
  agents,
  llmConfig,
  contextMessages,
  hostName,
  onStart,
  onAbort,
  onComplete,
  onClose,
}) => {
  const eligible = agents.filter(a => !a.isUser);
  const [voteTopic, setVoteTopic] = useState(topic);
  const [mode, setMode] = useState<VoteMode>('binary');
  const [optionsText, setOptionsText] = useState('方案A\n方案B\n方案C');
  const [selectedIds, setSelectedIds] = useState<string[]>(eligible.map(a => a.id));
  const [phase, setPhase] = useState<'setup' | 'collecting'>('setup');
  const [progress, setProgress] = useState({ name: '', done: 0, total: 0 });
  const [suggesting, setSuggesting] = useState(false);
  const [concluding, setConcluding] = useState(false);
  const [error, setError] = useState('');
  const cancelRef = useRef(false);
  const contextRef = useRef<ChatMessage[]>(contextMessages);
  contextRef.current = contextMessages;
  const abortRef = useRef(onAbort);
  abortRef.current = onAbort;

  useEffect(() => {
    if (!isOpen) return;
    cancelRef.current = false;
    setVoteTopic(topic);
    setMode('binary');
    setSelectedIds(agents.filter(a => !a.isUser).map(a => a.id));
    setPhase('setup');
    setProgress({ name: '', done: 0, total: 0 });
    setConcluding(false);
    setError('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  const toggleVoter = (id: string) => {
    soundManager.playSelectSound();
    setSelectedIds(prev => (prev.includes(id) ? prev.filter(v => v !== id) : [...prev, id]));
  };

  const handleSuggest = async () => {
    const trimmed = voteTopic.trim();
    if (!trimmed || suggesting) return;
    soundManager.playSelectSound();
    setSuggesting(true);
    setError('');
    try {
      const list = await fetchOptionsSuggestion(llmConfig, trimmed);
      if (list) {
        setOptionsText(list.join('\n'));
      } else {
        setError('AI 建議選項失敗，請手填候選方案。');
      }
    } finally {
      setSuggesting(false);
    }
  };

  const handleCancelCollecting = () => {
    cancelRef.current = true;
  };

  const handleClose = () => {
    cancelRef.current = true;
    soundManager.playSelectSound();
    onClose();
  };

  const handleStart = async () => {
    const trimmed = voteTopic.trim();
    if (!trimmed) {
      setError('請輸入議案。');
      return;
    }
    const voters = agents.filter(a => selectedIds.includes(a.id) && !a.isUser);
    if (voters.length === 0) {
      setError('至少選一位投票人（主席不投票）。');
      return;
    }
    let options: VoteOption[];
    if (mode === 'binary') {
      options = [...BINARY_OPTIONS];
    } else if (mode === 'multi') {
      const parsed = parseCustomOptions(optionsText);
      if (parsed.length < 2) {
        setError('多選至少需要 2 個候選方案（一行一個）。');
        return;
      }
      options = [...parsed.map((label, i) => ({ id: `opt${i + 1}`, label })), { id: 'abstain', label: '棄權' }];
    } else {
      options = [];
    }

    soundManager.playFanfareSound();
    setError('');
    setPhase('collecting');
    setProgress({ name: voters[0].name, done: 0, total: voters.length });
    cancelRef.current = false;
    onStart?.(trimmed, voters.map(v => v.id));

    try {
      const records = await collectVotes({
        config: llmConfig,
        voters,
        voteTopic: trimmed,
        mode,
        options,
        contextMessages: contextRef.current,
        onProgress: (current, done, total) => setProgress({ name: current.name, done, total }),
        shouldAbort: () => cancelRef.current,
      });
      setConcluding(true);
      setProgress(p => ({ ...p, name: `主持人 ${hostName || '主席'} 撰寫結論中…` }));
      const contextText = contextRef.current
        .slice(-10)
        .map(m => `[${m.speakerName}] ${m.text}`.slice(0, 200))
        .join('\n')
        .slice(0, 2000);
      const tallyText = buildTallyText(records, options);
      const { process, conclusion, followups } = await fetchConclusion(
        llmConfig,
        hostName || '主席',
        trimmed,
        tallyText,
        contextText,
        records,
        mode,
        options
      );
      const { winnerOptionId, ruling, status } = resolveRuling(mode, records);
      const now = new Date();
      const session: VoteSession = {
        id: `vote_${Date.now()}`,
        topic: trimmed,
        mode,
        options,
        records,
        process,
        conclusion,
        followups,
        winnerOptionId,
        ruling,
        status,
        createdAt: now.toLocaleString('zh-TW'),
      };
      onComplete(session);
    } catch (err) {
      if ((err as Error).message === 'vote-aborted') {
        setPhase('setup');
        setConcluding(false);
        abortRef.current?.('cancelled');
        return;
      }
      console.warn('[Vote] 收集失敗:', err);
      setError('投票收集中斷，請重試。');
      setPhase('setup');
      setConcluding(false);
      abortRef.current?.('failed');
    }
  };

  const collecting = phase === 'collecting';
  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(2, 6, 23, 0.85)',
        backdropFilter: 'blur(8px)',
      }}
    >
      <div
        className="bg-slate-900 border-4 border-amber-400 max-w-2xl w-full p-1 rounded-sm shadow-2xl animate-scale-up"
        style={{ maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}
      >
        <div
          className="bg-slate-950 border-2 border-amber-500/60 p-6 flex flex-col gap-4 overflow-y-auto"
          style={{ maxHeight: 'calc(92vh - 8px)' }}
        >
          <div className="text-center border-b border-slate-800 pb-4">
            <h1 className="text-xl font-bold text-amber-400 font-mono flex items-center justify-center gap-2 tracking-wider">
              <VoteIcon className="w-5 h-5 text-amber-400" />
              發起投票表決
            </h1>
            <p className="text-slate-400 text-xs mt-1 font-mono">
              主席不投票・逐票收集（並行 2）・平票由主席裁決
            </p>
          </div>

          {collecting ? (
            <div className="flex flex-col gap-3 bg-slate-900/90 border border-slate-800 p-4 rounded">
              <p className="text-sm font-mono text-amber-300">
                {concluding
                  ? progress.name
                  : `正在收集 ${progress.name} 表態… (${Math.min(progress.done + 1, progress.total)}/${progress.total})`}
              </p>
              <div className="w-full h-3 bg-slate-800 rounded overflow-hidden border border-slate-700">
                <div
                  className="h-full bg-amber-400 transition-all"
                  style={{ width: concluding ? '100%' : `${pct}%` }}
                />
              </div>
              <p className="text-[11px] font-mono text-slate-500">
                {concluding ? '彙整票數並撰寫定案結論…' : '真人 LLM 逐票回覆較慢，請稍候（可中止）。'}
              </p>
              {!concluding && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleCancelCollecting}
                    className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono rounded border border-slate-700"
                  >
                    中止收集
                  </button>
                </div>
              )}
              {concluding && (
                <div className="flex items-center gap-2 text-xs font-mono text-amber-400 animate-pulse">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>主持人撰寫結論中…</span>
                </div>
              )}
            </div>
          ) : (
            <>
              <label className="flex flex-col gap-1.5 text-xs font-mono text-slate-400">
                議案（預設當前主題）
                <input
                  type="text"
                  value={voteTopic}
                  onChange={e => setVoteTopic(e.target.value)}
                  maxLength={60}
                  placeholder="請輸入表決議案…"
                  className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-amber-300 font-mono focus:outline-none focus:border-amber-400"
                />
              </label>

              <div className="flex flex-col gap-2">
                <span className="text-xs font-mono font-bold text-amber-400">表決模式</span>
                <div className="grid grid-cols-3 gap-2">
                  {MODE_TABS.map(t => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        soundManager.playSelectSound();
                        setMode(t.id);
                      }}
                      className={`px-2 py-2 rounded border text-xs font-mono transition ${
                        mode === t.id
                          ? 'bg-amber-400/10 border-amber-400 text-amber-200 font-bold'
                          : 'bg-slate-900 border-slate-800 hover:border-slate-600 text-slate-300'
                      }`}
                    >
                      <span className="block">{t.label}</span>
                      <span className="block text-[10px] text-slate-500 mt-0.5">{t.hint}</span>
                    </button>
                  ))}
                </div>
              </div>

              {mode === 'binary' && isAmbiguousBinaryTopic(voteTopic) && (
                <div className="text-xs font-mono text-amber-300 bg-amber-950/40 border border-amber-800/50 rounded px-3 py-2 flex items-center justify-between gap-2">
                  <span>議案為是否類問句，二元表決易把部分執行誤記為全案通過，建議轉多選。</span>
                  <button
                    type="button"
                    onClick={() => {
                      soundManager.playSelectSound();
                      setMode('multi');
                      void handleSuggest();
                    }}
                    disabled={suggesting || !voteTopic.trim()}
                    className="shrink-0 px-2.5 py-1 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold rounded disabled:opacity-40"
                  >
                    轉多選＋AI建議
                  </button>
                </div>
              )}

              {mode === 'binary' && (
                <p className="text-[11px] font-mono text-slate-500">
                  贊成＝贊成議案原文並照案執行；反對＝反對議案原文（維持現狀或僅部分執行）。
                </p>
              )}

              {mode === 'multi' && (
                <div className="flex flex-col gap-2 bg-slate-900/90 border border-slate-800 p-3 rounded">
                  <span className="text-xs font-mono font-bold text-amber-400 flex items-center justify-between">
                    <span>候選方案（一行一個，2～4 項）</span>
                    <button
                      type="button"
                      onClick={handleSuggest}
                      disabled={suggesting || !voteTopic.trim()}
                      className="flex items-center gap-1 text-amber-400 hover:text-amber-300 disabled:opacity-40 text-[11px]"
                    >
                      <Sparkles className="w-3 h-3" />
                      {suggesting ? '建議中…' : 'AI 建議選項'}
                    </button>
                  </span>
                  <textarea
                    value={optionsText}
                    onChange={e => setOptionsText(e.target.value)}
                    rows={3}
                    maxLength={200}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-slate-100 font-sans focus:outline-none focus:border-amber-400 resize-y"
                  />
                </div>
              )}

              <div className="flex flex-col gap-2">
                <span className="text-xs font-mono font-bold text-amber-400">
                  投票人（{selectedIds.length}/{eligible.length}・使用者不投票）
                </span>
                {eligible.length === 0 ? (
                  <p className="text-xs font-mono text-red-400">無可投票 AI 成員（全員為使用者扮演）。</p>
                ) : (
                  <div className="flex flex-wrap gap-2 max-h-28 overflow-y-auto">
                    {eligible.map(a => {
                      const active = selectedIds.includes(a.id);
                      return (
                        <button
                          key={a.id}
                          type="button"
                          onClick={() => toggleVoter(a.id)}
                          className={`px-2.5 py-1 rounded border text-xs font-mono transition ${
                            active
                              ? 'bg-amber-400/10 border-amber-400 text-amber-200'
                              : 'bg-slate-900 border-slate-800 text-slate-500'
                          }`}
                        >
                          {a.name}（{a.role}）
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {error && (
                <div className="text-xs font-mono text-red-400 bg-red-950/40 border border-red-800/50 rounded px-3 py-2">
                  {error}
                </div>
              )}

              <div className="flex items-center justify-between border-t border-slate-800 pt-4">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 py-2 text-xs font-mono text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded transition flex items-center gap-1.5"
                >
                  <X className="w-4 h-4" /> 取消
                </button>
                <button
                  type="button"
                  onClick={handleStart}
                  disabled={eligible.length === 0}
                  className="px-6 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold font-mono text-sm rounded border border-amber-500 shadow-lg transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <VoteIcon className="w-4 h-4" /> 開始逐票收集
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
