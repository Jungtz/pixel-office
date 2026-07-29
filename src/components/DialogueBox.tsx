import React, { useEffect, useState } from 'react';
import { ChatMessage } from '../game/types';
import { ROLE_CONFIGS } from '../services/roles';
import { soundManager } from '../services/sound';
import { MessageSquare, ChevronRight } from 'lucide-react';

interface DialogueBoxProps {
  message: ChatMessage | null;
  onNext?: () => void;
  onClose?: () => void;
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
  onNext,
  onClose
}) => {
  const [displayedText, setDisplayedText] = useState('');
  const [isFinished, setIsFinished] = useState(false);

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
                    className="px-4 py-1 text-xs font-mono text-slate-950 font-bold bg-amber-400 hover:bg-amber-300 border border-amber-500 rounded flex items-center gap-1 animate-bounce"
                  >
                    下一步 <ChevronRight className="w-3.5 h-3.5" />
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
