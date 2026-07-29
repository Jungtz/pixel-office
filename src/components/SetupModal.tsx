import React, { useState } from 'react';
import { RoleType } from '../game/types';
import { ROLE_CONFIGS } from '../services/roles';
import { soundManager } from '../services/sound';
import { Users, Sparkles, Play, ShieldAlert } from 'lucide-react';

export interface RoleSetupConfig {
  counts: Record<RoleType, number>;
  useMockAI: boolean;
  apiKey?: string;
  provider: 'mock' | 'openai' | 'gemini';
}

interface SetupModalProps {
  isOpen: boolean;
  onStart: (config: RoleSetupConfig) => void;
}

export const SetupModal: React.FC<SetupModalProps> = ({ isOpen, onStart }) => {
  const [counts, setCounts] = useState<Record<RoleType, number>>({
    PM: 1,
    RD: 2,
    QA: 1,
    UIUX: 1,
    AD: 1,
    INTERN: 1,
    BOSS: 1
  });

  const [provider, setProvider] = useState<'mock' | 'openai' | 'gemini'>('mock');
  const [apiKey, setApiKey] = useState('');

  if (!isOpen) return null;

  const handleCountChange = (role: RoleType, delta: number) => {
    soundManager.playSelectSound();
    setCounts(prev => {
      const nextVal = Math.max(0, Math.min(3, prev[role] + delta));
      return { ...prev, [role]: nextVal };
    });
  };

  const totalMembers = Object.values(counts).reduce((a, b) => a + b, 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    soundManager.playFanfareSound();
    onStart({
      counts,
      useMockAI: provider === 'mock',
      apiKey,
      provider
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border-4 border-amber-400 max-w-2xl w-full p-1 rounded-sm shadow-2xl animate-scale-up">
        <div className="bg-slate-950 border-2 border-amber-500/60 p-6 flex flex-col gap-6">
          
          {/* Header */}
          <div className="text-center border-b border-slate-800 pb-4">
            <h1 className="text-2xl font-bold text-amber-400 font-mono flex items-center justify-center gap-2 tracking-wider">
              <Sparkles className="w-6 h-6 text-amber-400" />
              AI 辦公室大亂鬥 - 團隊配置
            </h1>
            <p className="text-slate-400 text-xs mt-1 font-mono">
              請選擇入場角色與人數，建立屬於你的 AI Town 職場冒險團隊！
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            
            {/* 角色數量選擇 Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[320px] overflow-y-auto pr-1">
              {(Object.keys(ROLE_CONFIGS) as RoleType[]).map(roleKey => {
                const role = ROLE_CONFIGS[roleKey];
                const count = counts[roleKey];

                return (
                  <div
                    key={roleKey}
                    className={`p-3 rounded border transition flex items-center justify-between ${
                      count > 0
                        ? 'bg-slate-900 border-amber-500/50'
                        : 'bg-slate-950/50 border-slate-800 opacity-60'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-9 h-9 rounded border border-amber-400/80 flex items-center justify-center font-bold text-white text-xs font-mono shadow"
                        style={{ backgroundColor: role.avatarColor }}
                      >
                        {roleKey}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-slate-200 font-mono">{role.name}</div>
                        <div className="text-[11px] text-slate-400">{role.title}</div>
                      </div>
                    </div>

                    {/* 人數計數器 */}
                    <div className="flex items-center gap-2 bg-slate-950 px-2 py-1 border border-slate-800 rounded">
                      <button
                        type="button"
                        onClick={() => handleCountChange(roleKey, -1)}
                        className="w-6 h-6 rounded bg-slate-800 text-amber-400 hover:bg-slate-700 font-bold text-sm flex items-center justify-center"
                      >
                        -
                      </button>
                      <span className="w-6 text-center font-mono font-bold text-amber-300 text-sm">
                        {count}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCountChange(roleKey, 1)}
                        className="w-6 h-6 rounded bg-slate-800 text-amber-400 hover:bg-slate-700 font-bold text-sm flex items-center justify-center"
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* AI 驅動模式選擇 */}
            <div className="bg-slate-900/90 border border-slate-800 p-4 rounded flex flex-col gap-3">
              <label className="text-xs font-mono font-bold text-amber-400 flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4" /> AI 對話驅動模式：
              </label>

              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => { soundManager.playSelectSound(); setProvider('mock'); }}
                  className={`py-2 px-3 text-xs font-mono rounded border transition text-center ${
                    provider === 'mock'
                      ? 'bg-amber-400 text-slate-950 font-bold border-amber-500'
                      : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  ⚡ 即插即用 (Mock AI)
                </button>
                <button
                  type="button"
                  onClick={() => { soundManager.playSelectSound(); setProvider('openai'); }}
                  className={`py-2 px-3 text-xs font-mono rounded border transition text-center ${
                    provider === 'openai'
                      ? 'bg-amber-400 text-slate-950 font-bold border-amber-500'
                      : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  🤖 OpenAI (GPT-3.5)
                </button>
                <button
                  type="button"
                  onClick={() => { soundManager.playSelectSound(); setProvider('gemini'); }}
                  className={`py-2 px-3 text-xs font-mono rounded border transition text-center ${
                    provider === 'gemini'
                      ? 'bg-amber-400 text-slate-950 font-bold border-amber-500'
                      : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  ✨ Google Gemini
                </button>
              </div>

              {provider !== 'mock' && (
                <div className="mt-2">
                  <input
                    type="password"
                    placeholder={`請輸入 ${provider.toUpperCase()} API Key...`}
                    value={apiKey}
                    onChange={e => setApiKey(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-xs font-mono text-amber-300 focus:outline-none focus:border-amber-400"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    * API Key 僅在您的本機瀏覽器內運作，不會上傳至任何第三方程式庫。
                  </p>
                </div>
              )}
            </div>

            {/* Footer Submit Button */}
            <div className="flex items-center justify-between border-t border-slate-800 pt-4">
              <div className="text-xs font-mono text-slate-400 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-amber-400" />
                總入場人數：<span className="text-amber-300 font-bold">{totalMembers}</span> 人
              </div>

              <button
                type="submit"
                disabled={totalMembers === 0}
                className="px-6 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold font-mono text-sm rounded border border-amber-500 shadow-lg transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Play className="w-4 h-4 fill-slate-950" /> 開啟辦公室冒險！
              </button>
            </div>

          </form>
        </div>
      </div>
    </div>
  );
};
