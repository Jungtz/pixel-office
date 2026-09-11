import React, { useState, useEffect, useRef } from 'react';
import { ChatMessage, RoleType } from '../game/types';
import { ROLE_CONFIGS } from '../services/roles';
import { soundManager } from '../services/sound';
import { X, Trash2, Download, History, Search, Filter, FolderOpen } from 'lucide-react';

interface ChatLogProps {
  isOpen: boolean;
  onClose: () => void;
  messages: ChatMessage[];
  onClear: () => void;
  onLoadHistory?: () => void;
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

export const ChatLog: React.FC<ChatLogProps> = ({
  isOpen,
  onClose,
  messages,
  onClear,
  onLoadHistory
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRole, setSelectedRole] = useState<string>('ALL');
  const listEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      listEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isOpen, messages]);

  if (!isOpen) return null;

  const exportLogs = () => {
    soundManager.playSelectSound();
    const textData = messages
      .map(m => `[${m.timestamp}] ${m.speakerName} (${m.speakerRole}): ${m.text}`)
      .join('\n');
    const blob = new Blob([textData], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `office-chat-log-${Date.now()}.txt`;
    a.click();
  };

  const filteredMessages = messages.filter(m => {
    const matchesSearch =
      m.speakerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.text.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = selectedRole === 'ALL' || m.speakerRole === selectedRole;
    return matchesSearch && matchesRole;
  });

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        zIndex: 70
      }}
      className="w-80 md:w-96 lg:w-[420px] bg-slate-900 border-l-4 border-amber-400 shadow-2xl flex flex-col animate-slide-left"
    >
      {/* Header */}
      <div className="bg-slate-950 p-4 border-b border-amber-500/40 flex items-center justify-between">
        <h2 className="text-sm font-bold font-mono text-amber-400 flex items-center gap-2">
          <History className="w-4 h-4 text-amber-400" />
          完整對話歷史紀錄 <span className="text-xs text-amber-300/80">({messages.length})</span>
        </h2>
        <button
          onClick={() => {
            soundManager.playSelectSound();
            onClose();
          }}
          className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 transition"
          title="關閉紀錄視窗"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* 搜尋與角色過濾工具列 */}
      <div className="p-3 bg-slate-950/80 border-b border-slate-800 flex flex-col gap-2">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
          <input
            type="text"
            placeholder="搜尋對話關鍵字或發言人..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded pl-8 pr-3 py-1 text-xs font-mono text-amber-300 placeholder:text-slate-600 focus:outline-none focus:border-amber-400"
          />
        </div>

        {/* 角色 Tag 過濾 */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 text-[11px] font-mono scrollbar-thin">
          <span className="text-slate-500 flex items-center gap-1 pr-1 flex-shrink-0">
            <Filter className="w-3 h-3" /> 篩選:
          </span>
          {['ALL', 'PM', 'RD', 'QA', 'UIUX', 'AD', 'INTERN', 'BOSS'].map(role => (
            <button
              key={role}
              onClick={() => {
                soundManager.playSelectSound();
                setSelectedRole(role);
              }}
              className={`px-2 py-0.5 rounded border flex-shrink-0 transition ${
                selectedRole === role
                  ? 'bg-amber-400 text-slate-950 font-bold border-amber-500'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700'
              }`}
            >
              {role === 'ALL' ? '全部' : ROLE_SHORT_CODES[role] || role}
            </button>
          ))}
        </div>
      </div>

      {/* Messages List */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 font-sans">
        {filteredMessages.length === 0 ? (
          <div className="text-center text-slate-500 text-xs py-12 font-mono">
            {messages.length === 0 ? '尚無對話紀錄。角色互動時將自動記錄於此。' : '未找到符合條件的對話紀錄。'}
          </div>
        ) : (
          filteredMessages.map(msg => {
            const roleConfig = ROLE_CONFIGS[msg.speakerRole];

            return (
              <div
                key={msg.id}
                className="bg-slate-950 border border-slate-800/80 p-3 rounded flex flex-col gap-2 hover:border-amber-500/40 transition shadow-sm"
              >
                <div className="flex items-center justify-between border-b border-slate-900 pb-1.5">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-6 h-6 rounded border border-amber-400/60 flex items-center justify-center font-bold text-[10px] text-white font-mono shadow-sm flex-shrink-0"
                      style={{ backgroundColor: roleConfig?.avatarColor || '#3b82f6' }}
                    >
                      {ROLE_SHORT_CODES[msg.speakerRole] || msg.speakerRole}
                    </span>
                    <span className="text-xs font-bold text-amber-400 font-mono">
                      {msg.speakerName}
                    </span>
                    <span className="text-[10px] text-slate-500 font-sans">
                      ({roleConfig?.title})
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-500">{msg.timestamp}</span>
                </div>

                <p className="text-xs text-slate-200 leading-relaxed font-sans pl-1">
                  {msg.text}
                </p>
              </div>
            );
          })
        )}
        <div ref={listEndRef} />
      </div>

      {/* Footer Controls */}
      <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              soundManager.playSelectSound();
              onClear();
            }}
            disabled={messages.length === 0}
            className="px-3 py-1.5 text-xs font-mono text-rose-400 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/60 hover:border-rose-600 rounded flex items-center gap-1 disabled:opacity-40 transition"
          >
            <Trash2 className="w-3.5 h-3.5" /> 清空紀錄
          </button>

          {onLoadHistory && (
            <button
              onClick={() => {
                soundManager.playSelectSound();
                onLoadHistory();
              }}
              className="px-3 py-1.5 text-xs font-mono text-amber-400 bg-amber-950/40 hover:bg-amber-900/60 border border-amber-800/60 hover:border-amber-600 rounded flex items-center gap-1 transition"
              title="從歷史紀錄備份並接續討論"
            >
              <FolderOpen className="w-3.5 h-3.5" /> 讀取歷史
            </button>
          )}
        </div>

        <button
          onClick={exportLogs}
          disabled={messages.length === 0}
          className="px-3 py-1.5 text-xs font-mono text-sky-400 bg-sky-950/40 hover:bg-sky-900/60 border border-sky-800/60 hover:border-sky-600 rounded flex items-center gap-1 disabled:opacity-40 transition"
        >
          <Download className="w-3.5 h-3.5" /> 匯出歷史 (.txt)
        </button>
      </div>
    </div>
  );
};
