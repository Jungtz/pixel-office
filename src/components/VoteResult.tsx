import React from 'react';
import type { VoteSession } from '../game/types';
import { countVotes, voteChoiceLabel } from '../services/voteService';
import { soundManager } from '../services/sound';
import { Megaphone, X, Gavel } from 'lucide-react';

interface VoteResultProps {
  session: VoteSession | null;
  /** 平票待裁決時：主席點選最終選項（不算票，只定結論） */
  onRuling: (updated: VoteSession) => void;
  onClose: () => void;
}

const RULING_LABEL: Record<string, string> = {
  passed: '表決通過',
  rejected: '表決否決',
  tied: '平票待主席裁決',
  concluded: '已有結論',
};

const MODE_LABEL: Record<string, string> = {
  binary: '二元表決',
  multi: '多選方案',
  open: '開放討論',
};

function choiceEmoji(choiceId: string | null): string {
  if (choiceId === null) return '💬';
  if (choiceId === 'yes') return '⭕';
  if (choiceId === 'no') return '❌';
  if (choiceId === 'abstain') return '⚪';
  return '🔹';
}

/**
 * 表決結果：定案結論三段（過程→結論→深入）＋長條計票＋逐人理由。
 * 平票顯示主席裁定鈕，裁決不計票只定結論。
 */
export const VoteResult: React.FC<VoteResultProps> = ({ session, onRuling, onClose }) => {
  if (!session) return null;

  const pending = session.status === 'pending_ruling';
  const counts = countVotes(session.records);
  const total = session.records.length;
  const barRows = session.mode === 'open'
    ? []
    : session.options.map(o => ({ id: o.id, label: voteChoiceLabel(session.options, o.id), n: counts.get(o.id) || 0 }));

  const handleRule = (choiceId: string) => {
    soundManager.playFanfareSound();
    // 二元用動作語句（照案通過／否決暫緩），多選用「採用＋選項名」
    const verdict = session.mode === 'binary'
      ? (choiceId === 'yes' ? '照案通過' : '否決暫緩')
      : `採用「${voteChoiceLabel(session.options, choiceId)}」`;
    const base = session.conclusion || '';
    const updated: VoteSession = {
      ...session,
      status: 'done',
      winnerOptionId: session.mode === 'multi' ? choiceId : session.winnerOptionId,
      ruling: session.mode === 'binary'
        ? (choiceId === 'yes' ? 'passed' : choiceId === 'no' ? 'rejected' : 'concluded')
        : 'concluded',
      conclusion: `主席裁決：${verdict}。${base}`.slice(0, 500),
    };
    onRuling(updated);
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 10000,
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
              <Megaphone className="w-5 h-5 text-amber-400" />
              表決結果・{MODE_LABEL[session.mode] || session.mode}
            </h1>
            <p className="text-slate-300 text-sm mt-1 font-mono">議案：{session.topic}</p>
            {session.ruling && (
              <p className={`text-xs mt-1 font-mono font-bold ${pending ? 'text-red-400' : 'text-emerald-400'}`}>
                {RULING_LABEL[session.ruling] || session.ruling}
                {session.mode === 'multi' && session.winnerOptionId && !pending
                  ? `・獲勝：${voteChoiceLabel(session.options, session.winnerOptionId)}`
                  : ''}
              </p>
            )}
          </div>

          {/* 定案結論三段 */}
          <div className="flex flex-col gap-2 bg-slate-900/90 border border-slate-800 p-4 rounded">
            {session.process && (
              <div className="text-xs font-sans text-slate-300 leading-relaxed">
                <span className="font-mono font-bold text-amber-400">【討論過程】</span>{session.process}
              </div>
            )}
            {session.conclusion && (
              <div className="text-xs font-sans text-slate-100 leading-relaxed">
                <span className="font-mono font-bold text-emerald-400">【定案結論】</span>{session.conclusion}
              </div>
            )}
            {session.followups && session.followups.length > 0 && (
              <div className="text-xs font-sans text-slate-400 leading-relaxed">
                <span className="font-mono font-bold text-sky-400">【建議深入】</span>
                {session.followups.join('；')}
              </div>
            )}
          </div>

          {/* 長條計票 */}
          {barRows.length > 0 && (
            <div className="flex flex-col gap-2">
              {barRows.map(row => {
                const pct = total > 0 ? Math.round((row.n / total) * 100) : 0;
                return (
                  <div key={row.id} className="flex items-center gap-2">
                    <span className="w-16 text-xs font-mono text-slate-300 text-right flex-shrink-0">
                      {choiceEmoji(row.id)} {row.label}
                    </span>
                    <div className="flex-1 h-4 bg-slate-800 rounded overflow-hidden border border-slate-700">
                      <div
                        className={`h-full transition-all ${row.id === 'abstain' ? 'bg-slate-500' : 'bg-amber-400'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-14 text-xs font-mono text-slate-400 flex-shrink-0">
                      {row.n} 票（{pct}%）
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* 逐人表態 */}
          <div className="flex flex-col gap-1.5 max-h-44 overflow-y-auto pr-1">
            {session.records.map(r => (
              <p key={`${r.agentId}-${r.agentName}`} className="text-[11px] font-mono text-slate-400">
                <span className="text-amber-300 font-bold">
                  {choiceEmoji(r.choiceId)} {r.agentName}（{r.role}）
                </span>
                {r.choiceId !== null && (
                  <span className="text-slate-200"> 投給 {voteChoiceLabel(session.options, r.choiceId)}</span>
                )}
                {r.reason && <span>：{r.reason}</span>}
              </p>
            ))}
          </div>

          {/* 主席裁決（平票時） */}
          {pending && (
            <div className="flex flex-col gap-2 bg-red-950/30 border border-red-800/50 p-3 rounded">
              <span className="text-xs font-mono font-bold text-red-300 flex items-center gap-1.5">
                <Gavel className="w-4 h-4" /> 平票待主席裁決（只定結論，不算票）
              </span>
              <div className="flex flex-wrap gap-2">
                {session.options.filter(o => o.id !== 'abstain').map(o => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => handleRule(o.id)}
                    className="px-3 py-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs font-mono rounded border border-amber-500 transition"
                  >
                    裁定：{o.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end border-t border-slate-800 pt-4">
            <button
              type="button"
              onClick={() => {
                soundManager.playSelectSound();
                onClose();
              }}
              className="px-4 py-2 text-xs font-mono text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded transition flex items-center gap-1.5"
            >
              <X className="w-4 h-4" /> 關閉（結果已存檔）
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
