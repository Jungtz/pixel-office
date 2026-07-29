import React, { useState, useEffect } from 'react';
import { RoleType } from '../game/types';
import { ROLE_CONFIGS } from '../services/roles';
import { soundManager } from '../services/sound';
import { getProviderList, getProviderById, resolveModel, initModelConfig } from '../services/configService';
import { Users, Sparkles, Play, ShieldAlert } from 'lucide-react';

export interface RoleSetupConfig {
  counts: Record<RoleType, number>;
  useMockAI: boolean;
  apiKey?: string;
  provider: string;
  baseUrl?: string;
  model?: string;
  sdk?: string;
}

interface SetupModalProps {
  isOpen: boolean;
  onStart: (config: RoleSetupConfig) => void;
}

const ROLE_SHORT_CODES: Record<RoleType, string> = {
  PM: 'PM',
  RD: 'RD',
  QA: 'QA',
  UIUX: 'UI',
  AD: 'AD',
  INTERN: 'IN',
  BOSS: 'BO'
};

const STORAGE_KEY_COUNTS = 'roundtable-setup-counts';
const STORAGE_KEY_PROVIDER = 'roundtable-setup-provider';

const DEFAULT_COUNTS: Record<RoleType, number> = {
  PM: 1,
  RD: 2,
  QA: 1,
  UIUX: 1,
  AD: 1,
  INTERN: 1,
  BOSS: 1
};

const loadSavedCounts = (): Record<RoleType, number> => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_COUNTS);
    if (saved) return { ...DEFAULT_COUNTS, ...JSON.parse(saved) };
  } catch { /* localStorage 損毀則回退預設值 */ }
  return { ...DEFAULT_COUNTS };
};

const loadSavedProvider = (): string | null => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_PROVIDER);
    if (saved) return saved;
  } catch { /* ignore */ }
  return null;
};

export const SetupModal: React.FC<SetupModalProps> = ({ isOpen, onStart }) => {
  const [counts, setCounts] = useState<Record<RoleType, number>>(loadSavedCounts);

  const providers = getProviderList();
  const [selectedProviderId, setSelectedProviderId] = useState<string>(() => loadSavedProvider() || '');
  const [apiKey, setApiKey] = useState<string>('');
  const [baseUrl, setBaseUrl] = useState<string>('');
  const [model, setModel] = useState<string>('');
  const [sdk, setSdk] = useState<string>('');

  useEffect(() => {
    initModelConfig().then(() => {
      const saved = loadSavedProvider();
      const resolved = resolveModel();
      const validIds = new Set(['mock', resolved.provider].filter(Boolean));

      if (saved && validIds.has(saved)) {
        setSelectedProviderId(saved);
      } else {
        setSelectedProviderId(resolved.provider || 'mock');
      }
    });
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_COUNTS, JSON.stringify(counts));
  }, [counts]);

  useEffect(() => {
    if (selectedProviderId) {
      localStorage.setItem(STORAGE_KEY_PROVIDER, selectedProviderId);
    }
  }, [selectedProviderId]);

  useEffect(() => {
    const provDef = getProviderById(selectedProviderId);
    if (provDef) {
      const resolved = resolveModel();
      setApiKey(provDef.apiKey);
      setBaseUrl(provDef.baseURL);
      setModel(selectedProviderId === resolved.provider && resolved.model ? resolved.model : provDef.defaultModel);
      setSdk(provDef.sdk);
    }
  }, [selectedProviderId]);

  if (!isOpen) return null;

  const handleCountChange = (role: RoleType, delta: number) => {
    soundManager.playSelectSound();
    setCounts(prev => {
      const nextVal = Math.max(0, Math.min(3, prev[role] + delta));
      return { ...prev, [role]: nextVal };
    });
  };

  const handleSelectProvider = (provId: string) => {
    soundManager.playSelectSound();
    setSelectedProviderId(provId);
    const provDef = getProviderById(provId);
    if (provDef) {
      const resolved = resolveModel();
      setApiKey(provDef.apiKey);
      setBaseUrl(provDef.baseURL);
      setModel(provId === resolved.provider && resolved.model ? resolved.model : provDef.defaultModel);
      setSdk(provDef.sdk);
    } else {
      setApiKey('');
      setBaseUrl('');
      setModel('');
      setSdk('');
    }
  };

  const totalMembers = Object.values(counts).reduce((a, b) => a + b, 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    soundManager.playFanfareSound();
    onStart({
      counts,
      useMockAI: selectedProviderId === 'mock',
      provider: selectedProviderId,
      apiKey,
      baseUrl,
      model,
      sdk
    });
  };


  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4"
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
          className="bg-slate-950 border-2 border-amber-500/60 p-5 md:p-6 flex flex-col gap-4 overflow-y-auto"
          style={{ maxHeight: 'calc(92vh - 8px)' }}
        >

          
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[280px] overflow-y-auto pr-1">
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
                        className="w-9 h-9 rounded border border-amber-400/80 flex items-center justify-center font-bold text-white text-xs font-mono shadow flex-shrink-0"
                        style={{ backgroundColor: role.avatarColor }}
                      >
                        {ROLE_SHORT_CODES[roleKey]}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-slate-100 font-sans tracking-wide">{role.name}</div>
                        <div className="text-xs text-slate-400 font-sans mt-0.5">{role.title}</div>
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

             {/* AI 驅動模式選擇 (連動 config.json) */}
            <div className="bg-slate-900/90 border border-slate-800 p-4 rounded flex flex-col gap-3">
              <label className="text-xs font-mono font-bold text-amber-400 flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-amber-400" /> AI 對話驅動模式 (連動 config.json models 設定)：
              </label>

              <div className="grid grid-cols-2 gap-2">
                {(() => {
                  const resolved = resolveModel();
                  const visibleProviders = providers.filter(p =>
                    p.id === 'mock' || (resolved.provider && p.id === resolved.provider)
                  );

                  return visibleProviders.map(prov => {
                    const isSelected = selectedProviderId === prov.id;
                    const isMock = prov.id === 'mock';
                    const title = isMock
                      ? 'Mock AI'
                      : (resolved.label || `${resolved.provider}/${resolved.model}`);

                    return (
                      <button
                        key={prov.id}
                        type="button"
                        onClick={() => handleSelectProvider(prov.id)}
                        className={`py-2 px-2 text-xs font-mono rounded border transition flex flex-col items-center justify-center gap-1 text-center ${
                          isSelected
                            ? 'bg-amber-400 text-slate-950 font-bold border-amber-500 shadow-md'
                            : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <span className="font-bold text-xs flex items-center gap-1">
                          <span>{isMock ? '⚡' : '☁️'}</span> {title}
                        </span>
                        {isMock && (
                          <span className={`text-[10px] ${isSelected ? 'text-slate-900 font-bold' : 'text-slate-500'} font-mono`}>
                            即插即用
                          </span>
                        )}
                      </button>
                    );
                  });
                })()}
              </div>
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
