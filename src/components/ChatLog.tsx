import React from 'react';
import { ChatMessage } from '../game/types';
import { ROLE_CONFIGS } from '../services/roles';
import { X, Trash2, Download, MessageSquare } from 'lucide-react';

interface ChatLogProps {
  isOpen: boolean;
  onClose: () => void;
  messages: ChatMessage[];
  onClear: () => void;
}

export const ChatLog: React.FC<ChatLogProps> = ({
  isOpen,
  onClose,
  messages,
  onClear
}) => {
  if (!isOpen) return null;

  const exportLogs = () => {
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

  return (
    <div className="fixed top-0 right-0 bottom-0 w-80 md:w-96 bg-slate-900 border-l-4 border-amber-400 z-40 shadow-2xl flex flex-col animate-slide-left">
      {/* Header */}
      <div className="bg-slate-950 p-4 border-b border-amber-500/40 flex items-center justify-between">
        <h2 className="text-sm font-bold font-mono text-amber-400 flex items-center gap-2">
          <MessageSquare className="w-4 h-4" /> 對話與事件歷史 ({messages.length})
        </h2>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Messages List */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 font-sans">
        {messages.length === 0 ? (
          <div className="text-center text-slate-500 text-xs py-10 font-mono">
            尚無任何對話紀錄。角色在辦公室互動時將自動紀錄。
          </div>
        ) : (
          messages.map(msg => {
            const roleConfig = ROLE_CONFIGS[msg.speakerRole];

            return (
              <div
                key={msg.id}
                className="bg-slate-950 border border-slate-800 p-3 rounded flex flex-col gap-1.5 hover:border-slate-700 transition"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold text-white"
                      style={{ backgroundColor: roleConfig?.avatarColor || '#3b82f6' }}
                    >
                      {msg.speakerRole}
                    </span>
                    <span className="text-xs font-bold text-slate-200 font-mono">
                      {msg.speakerName}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-500">{msg.timestamp}</span>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed pl-1">
                  {msg.text}
                </p>
              </div>
            );
          })
        )}
      </div>

      {/* Footer Controls */}
      <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between gap-2">
        <button
          onClick={onClear}
          disabled={messages.length === 0}
          className="px-3 py-1.5 text-xs font-mono text-rose-400 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/60 rounded flex items-center gap-1 disabled:opacity-40"
        >
          <Trash2 className="w-3.5 h-3.5" /> 清空紀錄
        </button>

        <button
          onClick={exportLogs}
          disabled={messages.length === 0}
          className="px-3 py-1.5 text-xs font-mono text-sky-400 bg-sky-950/40 hover:bg-sky-900/60 border border-sky-800/60 rounded flex items-center gap-1 disabled:opacity-40"
        >
          <Download className="w-3.5 h-3.5" /> 匯出對話 (.txt)
        </button>
      </div>
    </div>
  );
};
