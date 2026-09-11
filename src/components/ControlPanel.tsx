import React, { useState } from 'react';
import { soundManager } from '../services/sound';
import { ROLE_CONFIGS } from '../services/roles';
import {
  Users,
  MessageSquare,
  Volume2,
  VolumeX,
  Play,
  Pause,
  RotateCcw,
  Zap,
  Coffee,
  AlertTriangle,
  History,
  FolderOpen
} from 'lucide-react';

interface ControlPanelProps {
  onCallMeeting: (topic: string) => void;
  onDispatchTask: (task: string) => void;
  onTriggerRandomEvent: () => void;
  onToggleChatLog: () => void;
  onLoadHistory: () => void;
  onResetSetup: () => void;
  onInterject: (speakerId: string, text: string) => void;
  interjectSpeakers: { id: string; name: string; role: string; isUser: boolean }[];
  canInterject: boolean;
  isPaused: boolean;
  onTogglePause: () => void;
  isMeetingActive: boolean;
  agentCount: number;
  chatMessagesCount?: number;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
  onCallMeeting,
  onDispatchTask,
  onTriggerRandomEvent,
  onToggleChatLog,
  onLoadHistory,
  onResetSetup,
  onInterject,
  interjectSpeakers,
  canInterject,
  isPaused,
  onTogglePause,
  isMeetingActive,
  agentCount,
  chatMessagesCount = 0
}) => {

  const [soundEnabled, setSoundEnabled] = useState(true);
  const [customInput, setCustomInput] = useState('');
  const [showInputModal, setShowInputModal] = useState<'meeting' | 'task' | 'interject' | null>(null);
  const [interjectSpeakerId, setInterjectSpeakerId] = useState<string>('');

  const toggleAudio = () => {
    const nextState = soundManager.toggleSound();
    setSoundEnabled(nextState);
  };

  const handleInputSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customInput.trim()) return;

    if (showInputModal === 'meeting') {
      onCallMeeting(customInput.trim());
    } else if (showInputModal === 'task') {
      onDispatchTask(customInput.trim());
    }

    setCustomInput('');
    setShowInputModal(null);
  };

  const openInterjectModal = () => {
    soundManager.playSelectSound();
    const defaultSpeaker = interjectSpeakers.find(s => s.isUser) || interjectSpeakers[0];
    setInterjectSpeakerId(defaultSpeaker ? defaultSpeaker.id : '');
    setCustomInput('');
    setShowInputModal('interject');
  };

  const handleInterjectSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = customInput.trim();
    if (!trimmed || !interjectSpeakerId) return;

    onInterject(interjectSpeakerId, trimmed);

    setCustomInput('');
    setShowInputModal(null);
  };

  return (
    <>
      {/* 頂部 DQ 風格頂列 */}
      <header
        className="fixed top-3 left-1/2 -translate-x-1/2 z-30 w-[95%] max-w-6xl"
        style={{
          position: 'fixed',
          top: '12px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 30,
          width: '95%',
          maxWidth: '1152px'
        }}
      >
        <div className="bg-slate-900 border-2 border-amber-400 p-1 shadow-2xl rounded-sm">

          <div className="bg-slate-950 border border-amber-500/50 px-4 py-2 flex flex-wrap items-center justify-between gap-3">
            
            {/* Title & Status */}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded bg-amber-400 border border-amber-500 flex items-center justify-center font-mono font-bold text-slate-950 text-base">
                ⚔️
              </div>
              <div>
                <h1 className="text-sm font-bold font-mono text-amber-400 tracking-wide flex items-center gap-2">
                  PixelOffice 像素辦公室
                  {isMeetingActive && (
                    <span className="text-[10px] bg-red-600 text-white px-2 py-0.5 rounded font-mono animate-pulse">
                      ● 會議中
                    </span>
                  )}
                  {isPaused && (
                    <span className="text-[10px] bg-slate-600 text-white px-2 py-0.5 rounded font-mono">
                      ⏸ 已暫停
                    </span>
                  )}
                </h1>
                <p className="text-[10px] text-slate-400 font-mono">
                  現有成員: <span className="text-amber-300 font-bold">{agentCount}</span> 人
                </p>
              </div>
            </div>

            {/* Action Buttons Group */}
            <div className="flex flex-wrap items-center gap-2">
              
              {/* Call Meeting Button */}
              <button
                onClick={() => {
                  soundManager.playSelectSound();
                  setShowInputModal('meeting');
                }}
                className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/60 rounded text-amber-300 text-xs font-mono font-bold flex items-center gap-1.5 transition"
              >
                <Users className="w-3.5 h-3.5" />
                開會
              </button>

              {/* Broadcast Task Button */}
              <button
                onClick={() => {
                  soundManager.playSelectSound();
                  setShowInputModal('task');
                }}
                className="px-3 py-1.5 bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/60 rounded text-sky-300 text-xs font-mono font-bold flex items-center gap-1.5 transition"
              >
                <Zap className="w-3.5 h-3.5" />
                任務
              </button>

              {/* Interject Button */}
              <button
                onClick={openInterjectModal}
                disabled={!canInterject}
                title={canInterject ? '隨時以你的身份加入討論' : 'AI 回應中或對話已達上限時無法插話'}
                className="px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/60 rounded text-emerald-300 text-xs font-mono font-bold flex items-center gap-1.5 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                插話
              </button>

              {/* Trigger Random Event */}
              <button
                onClick={() => {
                  soundManager.playSelectSound();
                  onTriggerRandomEvent();
                }}
                className="px-3 py-1.5 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-400/60 rounded text-purple-300 text-xs font-mono font-bold flex items-center gap-1.5 transition"
              >
                <AlertTriangle className="w-3.5 h-3.5 text-purple-400" />
                事件
              </button>

              {/* Pause / Resume Button */}
              <button
                onClick={() => {
                  soundManager.playSelectSound();
                  onTogglePause();
                }}
                disabled={agentCount === 0}
                title={isPaused ? '恢復自主行為' : '暫停自主行為（仍可手動下一步／插話）'}
                className={`px-3 py-1.5 border rounded text-xs font-mono font-bold flex items-center gap-1.5 transition disabled:opacity-40 disabled:cursor-not-allowed ${
                  isPaused
                    ? 'bg-amber-500/20 hover:bg-amber-500/30 border-amber-400/60 text-amber-300'
                    : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-200'
                }`}
              >
                {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                {isPaused ? '繼續' : '暫停'}
              </button>

              {/* Load History Button */}
              <button
                onClick={() => {
                  soundManager.playSelectSound();
                  onLoadHistory();
                }}
                disabled={agentCount === 0}
                className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-amber-400/60 rounded text-slate-200 text-xs font-mono font-bold flex items-center gap-1.5 transition disabled:opacity-40 disabled:cursor-not-allowed"
                title="從歷史紀錄備份並接續討論（將取代當前對話）"
              >
                <FolderOpen className="w-4 h-4 text-amber-400" />
                讀取
              </button>

              {/* Chat Log Drawer Button */}
              <button
                onClick={() => {
                  soundManager.playSelectSound();
                  onToggleChatLog();
                }}
                className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-amber-400/60 rounded text-slate-200 text-xs font-mono font-bold flex items-center gap-1.5 transition"
                title="查看對話與事件歷史"
              >
                <History className="w-4 h-4 text-amber-400" />
                歷史
                {chatMessagesCount > 0 && (
                  <span className="px-1.5 py-0.2 bg-amber-400 text-slate-950 rounded-full text-[10px] font-bold font-mono">
                    {chatMessagesCount}
                  </span>
                )}
              </button>


              {/* Reset Team Setup Button */}
              <button
                onClick={() => {
                  soundManager.playSelectSound();
                  onResetSetup();
                }}
                className="p-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded text-slate-300 text-xs transition"
                title="重新設定團隊"
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              {/* Audio Toggle Button */}
              <button
                onClick={toggleAudio}
                className="p-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded text-slate-300 text-xs transition"
                title={soundEnabled ? '關閉音效' : '開啟音效'}
              >
                {soundEnabled ? <Volume2 className="w-4 h-4 text-amber-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
              </button>
            </div>

          </div>
        </div>
      </header>

      {/* 輸入話題 / 任務彈窗 */}
      {showInputModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            zIndex: 80,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(2, 6, 23, 0.7)',
            backdropFilter: 'blur(4px)'
          }}
        >
          <div
            className="bg-slate-900 border-4 border-amber-400 p-1 rounded max-w-md w-full shadow-2xl animate-scale-up"
            style={{ maxHeight: '90vh', overflowY: 'auto' }}
          >
            <div className="bg-slate-950 border-2 border-amber-500/60 p-5 flex flex-col gap-4">

              {showInputModal === 'interject' ? (
                <>
                  <h2 className="text-base font-bold font-mono text-emerald-400 flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-emerald-400" /> 插話討論
                  </h2>

                  <form onSubmit={handleInterjectSubmit} className="flex flex-col gap-3">
                    {interjectSpeakers.length > 1 ? (
                      <label className="flex flex-col gap-1.5 text-xs font-mono text-slate-400">
                        發言身份（無扮演角色時可任選一人附身）
                        <select
                          value={interjectSpeakerId}
                          onChange={e => setInterjectSpeakerId(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-slate-100 font-sans focus:outline-none focus:border-emerald-400"
                        >
                          {interjectSpeakers.map(s => (
                            <option key={s.id} value={s.id}>
                              {s.isUser ? '👤 ' : ''}{s.name}（{ROLE_CONFIGS[s.role]?.title || s.role}）
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : (
                      interjectSpeakers[0] && (
                        <p className="text-xs font-mono text-slate-400">
                          將以 <span className="text-emerald-300 font-bold">{interjectSpeakers[0].name}</span> 的身份發言
                        </p>
                      )
                    )}
                    <input
                      type="text"
                      autoFocus
                      placeholder="輸入你想說的話，送出後 AI 會接著回應..."
                      value={customInput}
                      onChange={e => setCustomInput(e.target.value)}
                      maxLength={200}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-slate-100 font-sans focus:outline-none focus:border-emerald-400"
                    />

                    <div className="flex justify-end gap-2 mt-2">
                      <button
                        type="button"
                        onClick={() => setShowInputModal(null)}
                        className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono rounded"
                      >
                        取消
                      </button>
                      <button
                        type="submit"
                        disabled={!customInput.trim() || !interjectSpeakerId || !canInterject}
                        className="px-5 py-1.5 bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-bold text-xs font-mono rounded border border-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {!canInterject ? 'AI 發言中…' : '送出發言'}
                      </button>
                    </div>
                  </form>
                </>
              ) : (
                <>
                  <h2 className="text-base font-bold font-mono text-amber-400 flex items-center gap-2">
                    {showInputModal === 'meeting' ? (
                      <>
                        <Users className="w-5 h-5 text-amber-400" /> 召開全體辦公室會議
                      </>
                    ) : (
                      <>
                        <Zap className="w-5 h-5 text-sky-400" /> 派發緊急需求與任務
                      </>
                    )}
                  </h2>

                  <form onSubmit={handleInputSubmit} className="flex flex-col gap-3">
                    <input
                      type="text"
                      autoFocus
                      placeholder={
                        showInputModal === 'meeting'
                          ? '請輸入會議討論主題 (如：今天上線規劃, Code 重構規範)...'
                          : '請輸入需求內容 (如：客戶要求首頁加一個 3D 浮動選單)...'
                      }
                      value={customInput}
                      onChange={e => setCustomInput(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-slate-100 font-sans focus:outline-none focus:border-amber-400"
                    />

                    <div className="flex justify-end gap-2 mt-2">
                      <button
                        type="button"
                        onClick={() => setShowInputModal(null)}
                        className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono rounded"
                      >
                        取消
                      </button>
                      <button
                        type="submit"
                        className="px-5 py-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs font-mono rounded border border-amber-500"
                      >
                        發送與執行
                      </button>
                    </div>
                  </form>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
