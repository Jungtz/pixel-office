import React, { useState, useEffect } from 'react';
import type { LLMConfig } from '../services/aiAgent';
import {
  fetchChatLogList,
  fetchChatLogDetail,
  summarizeChatLog,
  distinctSpeakers,
  type ChatLogMeta,
  type ChatLogDetail,
  type ResumedSession
} from '../services/chatLogService';
import { soundManager } from '../services/sound';
import { FolderOpen, History, RefreshCw, X, Play } from 'lucide-react';

interface ResumeModalProps {
  isOpen: boolean;
  llmConfig: LLMConfig;
  /** true = 從遊戲畫面開啟（會取代當前對話），false = 從 SetupModal 開啟 */
  inGame: boolean;
  onClose: () => void;
  onConfirm: (session: ResumedSession) => void;
}

export const ResumeModal: React.FC<ResumeModalProps> = ({
  isOpen,
  llmConfig,
  inGame,
  onClose,
  onConfirm
}) => {
  const [logs, setLogs] = useState<ChatLogMeta[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<ChatLogDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [topicDraft, setTopicDraft] = useState('');
  const [summary, setSummary] = useState('');
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryMocked, setSummaryMocked] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setListLoading(true);
    setListError('');
    setSelected(null);
    setDetail(null);
    setTopicDraft('');
    setSummary('');
    fetchChatLogList()
      .then(list => {
        if (!cancelled) setLogs(list);
      })
      .catch((err: Error) => {
        if (!cancelled) setListError(err.message || '讀取歷史列表失敗');
      })
      .finally(() => {
        if (!cancelled) setListLoading(false);
      });
    return () => { cancelled = true; };
  }, [isOpen]);

  if (!isOpen) return null;

  const runSummary = async (target: ChatLogDetail, topic: string) => {
    setSummaryLoading(true);
    try {
      const { summary: text, mocked } = await summarizeChatLog(llmConfig, topic, target.messages);
      setSummary(text);
      setSummaryMocked(mocked);
    } catch {
      setSummary('摘要產生失敗，將僅使用最近訊息接續。');
      setSummaryMocked(true);
    } finally {
      setSummaryLoading(false);
    }
  };

  const handleSelect = async (filename: string) => {
    soundManager.playSelectSound();
    setSelected(filename);
    setDetail(null);
    setDetailError('');
    setTopicDraft('');
    setSummary('');
    setDetailLoading(true);
    try {
      const loaded = await fetchChatLogDetail(filename);
      setDetail(loaded);
      setDetailLoading(false);
      const topic = loaded.topic || '';
      setTopicDraft(topic);
      await runSummary(loaded, topic);
    } catch (err) {
      setDetailLoading(false);
      setDetailError(err instanceof Error ? err.message : '讀取歷史檔案失敗');
    }
  };

  const speakerCount = detail ? distinctSpeakers(detail.messages).length : 0;
  const canConfirm = detail !== null && !detailLoading && !summaryLoading && topicDraft.trim() !== '';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canConfirm || !detail || !selected) return;
    soundManager.playFanfareSound();
    onConfirm({
      filename: selected,
      topic: topicDraft.trim(),
      startedAt: detail.startedAt,
      messages: detail.messages,
      summary: summary.trim()
    });
  };

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
        backdropFilter: 'blur(8px)'
      }}
    >
      <div
        className="bg-slate-900 border-4 border-amber-400 max-w-2xl w-full p-1 rounded-sm shadow-2xl animate-scale-up"
        style={{ maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}
      >
        <div
          className="bg-slate-950 border-2 border-amber-500/60 p-5 md:p-6 flex flex-col gap-4 overflow-y-auto"
          style={{ maxHeight: 'calc(92vh - 8px)' }}
        >
          <div className="text-center border-b border-slate-800 pb-4">
            <h1 className="text-xl font-bold text-amber-400 font-mono flex items-center justify-center gap-2 tracking-wider">
              <FolderOpen className="w-5 h-5 text-amber-400" />
              接續歷史討論
            </h1>
            <p className="text-slate-400 text-xs mt-1 font-mono">
              選一份 chat-logs 紀錄，自動備份舊檔後覆寫同一檔繼續聊（摘要＋最近 8 則餵給 AI）
            </p>
            {inGame && (
              <p className="text-red-400 text-xs mt-1 font-mono">
                ⚠️ 載入將取代目前的對話與陣容，接續後全員由 AI 驅動
              </p>
            )}
          </div>

          {listLoading && (
            <div className="flex items-center gap-2 text-xs font-mono text-amber-400 animate-pulse">
              <div className="w-3 h-3 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
              <span>讀取歷史列表…</span>
            </div>
          )}
          {listError && (
            <div className="text-xs font-mono text-red-400 bg-red-950/40 border border-red-800/50 rounded px-3 py-2">
              {listError}
            </div>
          )}
          {!listLoading && !listError && logs.length === 0 && (
            <div className="text-center text-slate-500 text-xs py-8 font-mono">
              尚無歷史紀錄（chat-logs/ 是空的，先開一場冒險吧）。
            </div>
          )}

          {logs.length > 0 && (
            <div className="flex flex-col gap-2 max-h-44 overflow-y-auto pr-1">
              {logs.map(log => (
                <button
                  key={log.filename}
                  type="button"
                  onClick={() => handleSelect(log.filename)}
                  className={`text-left px-3 py-2 rounded border transition flex items-center gap-2 ${
                    selected === log.filename
                      ? 'bg-amber-400/10 border-amber-400 text-amber-200'
                      : 'bg-slate-900 border-slate-800 hover:border-slate-600 text-slate-200'
                  }`}
                >
                  <History className="w-4 h-4 text-amber-400 flex-shrink-0" />
                  <span className="flex-1 min-w-0">
                    <span className="block text-xs font-bold font-mono truncate">{log.topic || log.filename}</span>
                    <span className="block text-[10px] font-mono text-slate-500">
                      {log.count} 則{log.lastUpdated ? `・${log.lastUpdated}` : ''}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}

          {detailLoading && (
            <div className="flex items-center gap-2 text-xs font-mono text-amber-400 animate-pulse">
              <div className="w-3 h-3 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
              <span>載入歷史內容…</span>
            </div>
          )}
          {detailError && (
            <div className="text-xs font-mono text-red-400 bg-red-950/40 border border-red-800/50 rounded px-3 py-2">
              {detailError}
            </div>
          )}

          {detail && (
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <label className="flex flex-col gap-1.5 text-xs font-mono text-slate-400">
                接續主題（{detail.messages.length} 則・{speakerCount} 人）
                <input
                  type="text"
                  value={topicDraft}
                  onChange={e => setTopicDraft(e.target.value)}
                  maxLength={60}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-amber-300 font-mono focus:outline-none focus:border-amber-400"
                />
              </label>

              <div className="bg-slate-900/80 border border-slate-800 rounded p-3 flex flex-col gap-1.5 max-h-32 overflow-y-auto">
                {detail.messages.slice(-3).map((m, i) => (
                  <p key={i} className="text-[11px] font-mono text-slate-400 truncate">
                    <span className="text-amber-300 font-bold">{m.speakerName}</span>：{m.text}
                  </p>
                ))}
              </div>

              <label className="flex flex-col gap-1.5 text-xs font-mono text-slate-400">
                <span className="flex items-center justify-between">
                  <span>前情提要{summaryMocked ? '（摘錄版）' : '（AI 版）'}</span>
                  <button
                    type="button"
                    disabled={summaryLoading}
                    onClick={() => runSummary(detail, topicDraft.trim() || detail.topic)}
                    className="flex items-center gap-1 text-amber-400 hover:text-amber-300 disabled:opacity-40 text-[11px]"
                  >
                    <RefreshCw className={`w-3 h-3 ${summaryLoading ? 'animate-spin' : ''}`} />
                    {summaryLoading ? '生成中…' : '重新生成'}
                  </button>
                </span>
                <textarea
                  value={summary}
                  onChange={e => setSummary(e.target.value)}
                  rows={4}
                  maxLength={2000}
                  placeholder={summaryLoading ? 'AI 正在濃縮歷史…' : '前情提要'}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-xs text-slate-200 font-sans focus:outline-none focus:border-amber-400 resize-y"
                />
              </label>

              <div className="flex items-center justify-between border-t border-slate-800 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    soundManager.playSelectSound();
                    onClose();
                  }}
                  className="px-4 py-2 text-xs font-mono text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded transition flex items-center gap-1.5"
                >
                  <X className="w-4 h-4" /> 取消
                </button>
                <button
                  type="submit"
                  disabled={!canConfirm}
                  className="px-6 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold font-mono text-sm rounded border border-amber-500 shadow-lg transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Play className="w-4 h-4 fill-slate-950" /> 備份並接續討論
                </button>
              </div>
            </form>
          )}

          {!detail && !detailLoading && (
            <div className="flex justify-end border-t border-slate-800 pt-4">
              <button
                type="button"
                onClick={() => {
                  soundManager.playSelectSound();
                  onClose();
                }}
                className="px-4 py-2 text-xs font-mono text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded transition"
              >
                關閉
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
