import React, { useEffect, useState, useRef } from 'react';
import { ChatMessage, AgentCharacter } from '../game/types';
import { ROLE_CONFIGS } from '../services/roles';
import { soundManager } from '../services/sound';
import { MessageSquare, ChevronRight, Send, Loader2 } from 'lucide-react';

interface DialogueBoxProps {
  message: ChatMessage | null;
  userTurn?: AgentCharacter | null;
  onUserReply?: (text: string) => void;
  onNext?: () => void;
  onClose?: () => void;
  isBusy?: boolean;
  nextLabel?: string;
  autoAdvanceMs?: number;
  aiTakeover?: boolean;
  onToggleAiTakeover?: () => void;
  isPaused?: boolean;
}

const ROLE_SHORT_CODES: Record<string, string> = {
  PM: 'PM',
  RD: 'RD',
  QA: 'QA',
  UIUX: 'UI',
  AD: 'AD',
  INTERN: 'IN',
  BOSS: 'BO'
};

export const DialogueBox: React.FC<DialogueBoxProps> = ({
  message,
  userTurn,
  onUserReply,
  onNext,
  onClose,
  isBusy,
  nextLabel,
  autoAdvanceMs,
  aiTakeover,
  onToggleAiTakeover,
  isPaused
}) => {
  const [displayedText, setDisplayedText] = useState('');
  const [isFinished, setIsFinished] = useState(false);
  const [userInput, setUserInput] = useState('');
  const [countdown, setCountdown] = useState<number>(0);
  const autoAdvanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!message) {
      setDisplayedText('');
      setIsFinished(false);
      return;
    }

    setDisplayedText('');
    setIsFinished(false);

    const fullText = (message.text || '').trim();
    let currentIdx = 0;

    const timer = setInterval(() => {
      currentIdx++;
      if (currentIdx <= fullText.length) {
        setDisplayedText(fullText.slice(0, currentIdx));
        if (currentIdx % 2 === 0) {
          soundManager.playTextBleep(650);
        }
      } else {
        setIsFinished(true);
        clearInterval(timer);
      }
    }, 35);

    return () => clearInterval(timer);
  }, [message]);

  useEffect(() => {
    if (userTurn) {
      setUserInput('');
    }
  }, [userTurn]);

  useEffect(() => {
    if (isFinished && onNext && autoAdvanceMs && autoAdvanceMs > 0 && !isBusy && !isPaused) {
      const seconds = Math.ceil(autoAdvanceMs / 1000);
      setCountdown(seconds);

      countdownTimer.current = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) return 0;
          return prev - 1;
        });
      }, 1000);

      autoAdvanceTimer.current = setTimeout(() => {
        soundManager.playSelectSound();
        onNext();
      }, autoAdvanceMs);
    } else {
      setCountdown(0);
    }
    return () => {
      if (autoAdvanceTimer.current) {
        clearTimeout(autoAdvanceTimer.current);
        autoAdvanceTimer.current = null;
      }
      if (countdownTimer.current) {
        clearInterval(countdownTimer.current);
        countdownTimer.current = null;
      }
    };
  }, [isFinished, onNext, autoAdvanceMs, isBusy, isPaused]);

  useEffect(() => {
    return () => {
      if (autoAdvanceTimer.current) {
        clearTimeout(autoAdvanceTimer.current);
      }
    };
  }, []);

  if (userTurn) {
    const roleConfig = ROLE_CONFIGS[userTurn.role];

    const handleSubmit = () => {
      const trimmed = userInput.trim();
      if (!trimmed) return;
      soundManager.playSelectSound();
      onUserReply?.(trimmed);
      setUserInput('');
    };

    return (
      <div
        style={{
          position: 'fixed',
          bottom: '24px',
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-end',
          pointerEvents: 'none',
          zIndex: 60
        }}
      >
        <div
          className="w-[90%] max-w-3xl animate-fade-in"
          style={{ pointerEvents: 'auto' }}
        >
          <div className="bg-slate-900 border-4 border-emerald-400 p-1 shadow-2xl rounded-sm">
            <div className="bg-slate-950 border-2 border-emerald-500/60 p-4 md:p-5 relative flex flex-col md:flex-row gap-4 items-start">
              <div className="flex-shrink-0 flex flex-row md:flex-col items-center gap-2">
                <div
                  className="w-12 h-12 rounded border-2 border-emerald-400 flex items-center justify-center font-bold text-base text-white shadow font-mono"
                  style={{ backgroundColor: roleConfig?.avatarColor || '#10b981' }}
                >
                  {ROLE_SHORT_CODES[userTurn.role] || userTurn.role}
                </div>
                <div className="text-[11px] font-sans text-emerald-300 font-bold px-2 py-0.5 bg-slate-900 border border-emerald-500/40 rounded text-center whitespace-nowrap">
                  你的回合
                </div>
              </div>

              <div className="flex-1 w-full flex flex-col gap-3">
                <div className="flex items-center justify-between pb-1 border-b border-slate-800">
                  <span className="text-emerald-400 font-bold text-sm md:text-base flex items-center gap-1.5 font-mono">
                    <MessageSquare className="w-4 h-4" />
                    {userTurn.name} <span className="text-xs text-slate-400 font-normal">({roleConfig?.title})</span>
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={userInput}
                    onChange={e => setUserInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); }}
                    placeholder="輸入你的回應..."
                    maxLength={200}
                    autoFocus
                    className="flex-1 bg-slate-900 border border-emerald-500/40 rounded px-3 py-2 text-sm text-slate-100 font-sans outline-none focus:border-emerald-400 placeholder-slate-600"
                  />
                  <button
                    onClick={handleSubmit}
                    disabled={!userInput.trim()}
                    className="px-4 py-2 text-xs font-mono text-slate-950 font-bold bg-emerald-400 hover:bg-emerald-300 border border-emerald-500 rounded flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                    <Send className="w-3.5 h-3.5" /> 送出
                  </button>
                  <button
                    onClick={() => onClose?.()}
                    className="px-3 py-2 text-xs font-mono text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded transition"
                  >
                    跳過
                  </button>
                  {onToggleAiTakeover && (
                    <button
                      onClick={() => {
                        soundManager.playSelectSound();
                        onToggleAiTakeover();
                      }}
                      className="px-3 py-2 text-xs font-mono text-amber-400 hover:text-amber-300 bg-slate-900 hover:bg-slate-800 border border-amber-600/40 rounded transition whitespace-nowrap"
                      title="讓 AI 幫你扮演這個角色"
                    >
                      {aiTakeover ? '✕ 取消接管' : '🤖 AI 接管'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!message) return null;

  const roleConfig = ROLE_CONFIGS[message.speakerRole];

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '24px',
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-end',
        pointerEvents: 'none',
        zIndex: 60
      }}

    >
      <div
        className="w-[90%] max-w-3xl animate-fade-in"
        style={{ pointerEvents: 'auto' }}
      >
        {/* 勇者鬥惡龍經典復古深藍金邊對話框 */}
        <div className="bg-slate-900 border-4 border-amber-400 p-1 shadow-2xl rounded-sm">
          <div className="bg-slate-950 border-2 border-amber-500/60 p-4 md:p-5 relative flex flex-col md:flex-row gap-4 items-start">
            
            {/* 角色視覺 Badge */}
            <div className="flex-shrink-0 flex flex-row md:flex-col items-center gap-2">
              <div
                className="w-12 h-12 rounded border-2 border-amber-400 flex items-center justify-center font-bold text-base text-white shadow font-mono"
                style={{ backgroundColor: roleConfig?.avatarColor || '#3b82f6' }}
              >
                {ROLE_SHORT_CODES[message.speakerRole] || message.speakerRole}
              </div>
              <div className="text-[11px] font-sans text-amber-300 font-bold px-2 py-0.5 bg-slate-900 border border-amber-500/40 rounded text-center whitespace-nowrap">
                {roleConfig?.title || message.speakerName}
              </div>
            </div>

            {/* 對話內文 */}
            <div className="flex-1 w-full flex flex-col justify-between min-h-[70px]">
              <div>
                <div className="flex items-center justify-between mb-1 pb-1 border-b border-slate-800">
                  <span className="text-amber-400 font-bold text-sm md:text-base flex items-center gap-1.5 font-mono">
                    <MessageSquare className="w-4 h-4" />
                    {message.speakerName} <span className="text-xs text-slate-400 font-normal">({roleConfig?.title})</span>
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">{message.timestamp}</span>
                </div>
                <p className="text-slate-100 font-medium leading-relaxed tracking-wide text-sm md:text-base font-sans mt-2 min-h-[40px]">
                  {displayedText}
                  {!isFinished && <span className="inline-block w-2 h-4 bg-amber-400 ml-1 animate-pulse" />}
                </p>
              </div>

              {/* 下一句 / 關閉按鈕 */}
              <div className="flex justify-end gap-2 mt-3 pt-2 border-t border-slate-800/80">
                {onClose && (
                  <button
                    onClick={() => {
                      soundManager.playSelectSound();
                      onClose();
                    }}
                    className="px-3 py-1 text-xs font-mono text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded transition"
                  >
                    關閉 [Esc]
                  </button>
                )}

                {onNext && isFinished && (
                  <button
                    onClick={() => {
                      soundManager.playSelectSound();
                      onNext();
                    }}
                    disabled={isBusy}
                    className="px-4 py-1 text-xs font-mono text-slate-950 font-bold bg-amber-400 hover:bg-amber-300 border border-amber-500 rounded flex items-center gap-1 animate-bounce disabled:opacity-60 disabled:cursor-wait disabled:animate-none"
                  >
                    {isBusy ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        AI 回應中…
                      </>
                    ) : (
                      <>
                        {nextLabel || '下一步'}
                        {countdown > 0 && (
                          <span className="text-[10px] text-slate-600 ml-0.5">({countdown}s)</span>
                        )}
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* DQ 復古三角小指標 */}
            {isFinished && (
              <div className="absolute bottom-2 right-3 text-amber-400 animate-pulse text-xs font-mono">
                ▼
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
