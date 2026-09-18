import React, { useState, useEffect } from 'react';
import { RoleType } from '../game/types';
import { ROLE_CONFIGS } from '../services/roles';
import { getRolesByTeam } from '../services/roleLoader';
import { TEAMS, DEFAULT_TEAM } from '../services/teams';
import { soundManager } from '../services/sound';
import { getProviderList, getProviderById, resolveModel, initModelConfig } from '../services/configService';
import { Users, Sparkles, Play, ShieldAlert, Key, Cpu, Globe, History } from 'lucide-react';

export interface RoleSetupConfig {
  counts: Record<string, number>;
  team: string;
  useMockAI: boolean;
  apiKey?: string;
  provider: string;
  baseUrl?: string;
  model?: string;
  sdk?: string;
  userRole?: string;
  userName?: string;
}

export interface ResumeLlmConfig {
  provider: string;
  apiKey?: string;
  model?: string;
}

interface SetupModalProps {
  isOpen: boolean;
  onStart: (config: RoleSetupConfig) => void;
  onOpenResume: (llm: ResumeLlmConfig) => void;
}

const getShortCode = (roleId: string): string => roleId.slice(0, 2);

const STORAGE_KEY_COUNTS = 'roundtable-setup-counts';
const STORAGE_KEY_PROVIDER = 'roundtable-setup-provider';
const STORAGE_KEY_TEAM = 'roundtable-setup-team';

const buildDefaultCounts = (): Record<string, number> => {
  const counts: Record<string, number> = {};
  for (const roleId of Object.keys(ROLE_CONFIGS)) {
    counts[roleId] = ROLE_CONFIGS[roleId].defaultCount;
  }
  return counts;
};

const loadSavedCounts = (): Record<string, number> => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_COUNTS);
    if (saved) return { ...buildDefaultCounts(), ...JSON.parse(saved) };
  } catch { /* localStorage 損毀則回退預設值 */ }
  return buildDefaultCounts();
};

const loadSavedProvider = (): string | null => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_PROVIDER);
    if (saved) return saved;
  } catch { /* ignore */ }
  return null;
};

const loadSavedTeam = (): string => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_TEAM);
    if (saved && TEAMS.some(t => t.id === saved)) return saved;
  } catch { /* ignore */ }
  return DEFAULT_TEAM;
};

export const SetupModal: React.FC<SetupModalProps> = ({ isOpen, onStart, onOpenResume }) => {
  const [counts, setCounts] = useState<Record<string, number>>(loadSavedCounts);
  const [selectedTeam, setSelectedTeam] = useState<string>(loadSavedTeam);

  const providers = getProviderList();
  const [selectedProviderId, setSelectedProviderId] = useState<string>(() => loadSavedProvider() || '');
  const [resolvedProvider, setResolvedProvider] = useState<string>('');
  const [resolvedLabel, setResolvedLabel] = useState<string>('');
  const [apiKey, setApiKey] = useState<string>('');
  const [userApiKey, setUserApiKey] = useState<string>('');
  const [testingKey, setTestingKey] = useState(false);
  const [keyTestResult, setKeyTestResult] = useState<'idle' | 'success' | 'failure'>('idle');
  const [keyTestError, setKeyTestError] = useState<string>('');
  const [baseUrl, setBaseUrl] = useState<string>('');
  const [model, setModel] = useState<string>('');
  const [sdk, setSdk] = useState<string>('');
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const resolved = await initModelConfig({ retry: true });
      if (cancelled) return;

      const saved = loadSavedProvider();
      const resolvedModel = resolveModel();

      setResolvedProvider(resolvedModel.provider);
      setResolvedLabel(resolvedModel.label);

      const validIds = new Set(['mock', resolvedModel.provider].filter(Boolean));

      if (saved && validIds.has(saved)) {
        setSelectedProviderId(saved);
      } else {
        setSelectedProviderId(resolvedModel.provider || 'mock');
      }
    };
    load();
    return () => { cancelled = true; };
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
    try {
      localStorage.setItem(STORAGE_KEY_TEAM, selectedTeam);
    } catch { /* ignore */ }
  }, [selectedTeam]);

  const teamRoleKeys = getRolesByTeam(ROLE_CONFIGS, selectedTeam);

  useEffect(() => {
    const provDef = getProviderById(selectedProviderId);
    if (provDef) {
      setApiKey(provDef.apiKey);
      setBaseUrl(provDef.baseURL);
      const resolved = resolveModel();
      setModel(selectedProviderId === resolved.provider && resolved.model ? resolved.model : provDef.defaultModel);
      setSdk(provDef.sdk);
    }
  }, [selectedProviderId, resolvedProvider]);

  if (!isOpen) return null;

  const handleCountChange = (role: string, delta: number) => {
    soundManager.playSelectSound();
    setCounts(prev => {
      const nextVal = Math.max(0, Math.min(3, (prev[role] || 0) + delta));
      return { ...prev, [role]: nextVal };
    });
  };

  const handleSelectTeam = (teamId: string) => {
    soundManager.playSelectSound();
    setSelectedTeam(teamId);
    // 扮演角色若不在新團隊內則清除，避免送出隱藏角色
    setUserRole(prev => {
      if (!prev) return prev;
      const cfg = ROLE_CONFIGS[prev];
      return cfg && cfg.teams.includes(teamId) ? prev : null;
    });
    setUserName('');
  };

  const handleSelectProvider = (provId: string) => {
    soundManager.playSelectSound();
    setSelectedProviderId(provId);
    setUserApiKey('');
    setKeyTestResult('idle');
    setKeyTestError('');
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

  const totalMembers = teamRoleKeys.reduce((sum, key) => sum + (counts[key] || 0), 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    soundManager.playFanfareSound();
    // 只送出當前團隊的角色人數，避免他團殘留數量混入開局
    const teamCounts: Record<string, number> = {};
    for (const key of teamRoleKeys) {
      teamCounts[key] = counts[key] || 0;
    }
    onStart({
      counts: teamCounts,
      team: selectedTeam,
      useMockAI: selectedProviderId === 'mock',
      provider: selectedProviderId,
      apiKey: userApiKey || apiKey,
      baseUrl,
      model,
      sdk,
      userRole: userRole || undefined,
      userName: userName || undefined
    });
  };

  const handleTestKey = async () => {
    if (!userApiKey || !currentProviderDef) return;
    setTestingKey(true);
    setKeyTestResult('idle');
    setKeyTestError('');
    try {
      const res = await fetch('/api/test-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providerId: selectedProviderId, apiKey: userApiKey })
      });
      const data = await res.json();
      if (data.valid) {
        setKeyTestResult('success');
      } else {
        setKeyTestResult('failure');
        setKeyTestError(data.error || '金鑰無效');
      }
    } catch {
      setKeyTestResult('failure');
      setKeyTestError('無法連線至伺服器');
    } finally {
      setTestingKey(false);
    }
  };

  const currentProviderDef = getProviderById(selectedProviderId);
  const apiKeyMissing = selectedProviderId !== 'mock' && currentProviderDef && !currentProviderDef.apiKey && !userApiKey;
  const needsKey = selectedProviderId !== 'mock' && currentProviderDef && !currentProviderDef.apiKey;
  const keyNotVerified = needsKey && keyTestResult !== 'success';


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
              PixelOffice - 團隊配置
            </h1>
            <p className="text-slate-400 text-xs mt-1 font-mono">
              請選擇入場角色與人數，建立屬於你的 PixelOffice 職場冒險團隊！
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-6">

            {/* 團隊類型選擇頁籤 */}
            <div className="grid grid-cols-3 gap-2">
              {TEAMS.map(team => {
                const isSelected = selectedTeam === team.id;
                return (
                  <button
                    key={team.id}
                    type="button"
                    onClick={() => handleSelectTeam(team.id)}
                    title={team.description}
                    className={`py-2 px-2 text-sm font-mono rounded border transition flex flex-col items-center justify-center gap-0.5 text-center ${
                      isSelected
                        ? 'bg-amber-400 text-slate-950 font-bold border-amber-500 shadow-md'
                        : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <span className="font-bold">{team.label}團隊</span>
                    <span className={`text-[10px] font-mono ${isSelected ? 'text-slate-900' : 'text-slate-500'}`}>
                      {getRolesByTeam(ROLE_CONFIGS, team.id).length} 種角色
                    </span>
                  </button>
                );
              })}
            </div>

            {/* 角色數量選擇 Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[280px] overflow-y-auto pr-1">
              {teamRoleKeys.map(roleKey => {
                const role = ROLE_CONFIGS[roleKey];
                const count = counts[roleKey] || 0;
                const isUserRole = userRole === roleKey;

                return (
                  <div
                    key={roleKey}
                    className={`p-3 rounded border transition min-w-0 overflow-hidden ${
                      count > 0 || isUserRole
                        ? 'bg-slate-900 border-amber-500/50'
                        : 'bg-slate-950/50 border-slate-800 opacity-60'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="w-9 h-9 rounded border border-amber-400/80 flex items-center justify-center font-bold text-white text-xs font-mono shadow flex-shrink-0"
                          style={{ backgroundColor: role.avatarColor }}
                        >
                          {getShortCode(roleKey)}
                        </div>
                        <div className="min-w-0">
                          <div
                            className="text-sm font-bold text-slate-100 font-sans tracking-wide"
                            style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                          >{role.name}</div>
                          <div className="text-[11px] text-slate-400 font-sans mt-0.5">{role.title}</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <div className="flex items-center gap-1.5 bg-slate-950 px-1.5 py-1 border border-slate-800 rounded">
                          <button
                            type="button"
                            onClick={() => handleCountChange(roleKey, -1)}
                            className="w-5 h-5 rounded bg-slate-800 text-amber-400 hover:bg-slate-700 font-bold text-xs flex items-center justify-center"
                          >
                            -
                          </button>
                          <span className="w-5 text-center font-mono font-bold text-amber-300 text-xs">
                            {count}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCountChange(roleKey, 1)}
                            className="w-5 h-5 rounded bg-slate-800 text-amber-400 hover:bg-slate-700 font-bold text-xs flex items-center justify-center"
                          >
                            +
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            soundManager.playSelectSound();
                            if (isUserRole) {
                              setUserRole(null);
                              setUserName('');
                            } else {
                              setUserRole(roleKey);
                              setUserName('');
                            }
                          }}
                          className={`w-7 h-7 rounded border text-xs flex items-center justify-center transition flex-shrink-0 ${
                            isUserRole
                              ? 'bg-amber-400 text-slate-950 border-amber-500'
                              : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-amber-500/50 hover:text-amber-400'
                          }`}
                          title={isUserRole ? '取消扮演' : '扮演此角色'}
                        >
                          👤
                        </button>
                      </div>
                    </div>

                    {isUserRole && (
                      <div className="mt-2 flex items-center gap-2 min-w-0">
                        <span className="text-[10px] text-amber-400 font-mono whitespace-nowrap flex-shrink-0">暱稱：</span>
                        <input
                          type="text"
                          value={userName}
                          onChange={e => setUserName(e.target.value)}
                          placeholder={role.name}
                          maxLength={12}
                          className="flex-1 min-w-0 bg-slate-950 border border-amber-500/40 rounded px-2 py-1 text-xs text-slate-100 font-mono outline-none focus:border-amber-400 placeholder-slate-600"
                          style={{ minWidth: 0 }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

             {/* AI 驅動模式選擇 (連動 config.json) */}
            <div className="bg-slate-900/90 border border-slate-800 p-4 rounded flex flex-col gap-3">
              <label className="text-xs font-mono font-bold text-amber-400 flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-amber-400" /> 對話驅動模式：
              </label>

              <div className="grid grid-cols-2 gap-2">
                {(() => {
                  const visibleProviders = providers.filter(p =>
                    p.id === 'mock' || (resolvedProvider && p.id === resolvedProvider)
                  );

                  return visibleProviders.map(prov => {
                    const isSelected = selectedProviderId === prov.id;
                    const isMock = prov.id === 'mock';
                    const title = isMock
                      ? 'Mock AI'
                      : (resolvedLabel || `${resolvedProvider}/${prov.defaultModel}`);

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

              {(() => {
                const needsKey = selectedProviderId !== 'mock' && currentProviderDef && !currentProviderDef.apiKey;
                if (!needsKey) return null;
                return (
                  <div className="mt-2 p-3 bg-slate-950/80 border border-amber-500/30 rounded flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-xs font-mono text-amber-300">
                      <Key className="w-3.5 h-3.5" /> API Key (金鑰)：
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="password"
                        placeholder={`請輸入 ${selectedProviderId} API Key...`}
                        value={userApiKey}
                        onChange={e => { setUserApiKey(e.target.value); setKeyTestResult('idle'); setKeyTestError(''); }}
                        className="flex-1 bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-xs font-mono text-amber-300 focus:outline-none focus:border-amber-400"
                      />
                      <button
                        type="button"
                        onClick={handleTestKey}
                        disabled={!userApiKey || testingKey}
                        className="px-3 py-1.5 text-xs font-mono font-bold rounded border transition disabled:opacity-40 disabled:cursor-not-allowed bg-slate-800 text-amber-400 border-slate-700 hover:bg-slate-700 hover:border-amber-500/50"
                      >
                        {testingKey ? '測試中...' : '測試金鑰'}
                      </button>
                    </div>
                    {keyTestResult === 'success' && (
                      <div className="flex items-center gap-1.5 text-[11px] font-mono text-green-400">
                        <span className="w-2 h-2 rounded-full bg-green-400 inline-block" /> 金鑰驗證成功
                      </div>
                    )}
                    {keyTestResult === 'failure' && (
                      <div className="flex items-center gap-1.5 text-[11px] font-mono text-red-400">
                        <span className="w-2 h-2 rounded-full bg-red-400 inline-block" /> {keyTestError}
                      </div>
                    )}
                    <div className="flex flex-col gap-1 text-[10px] font-mono text-slate-500 mt-1 pt-1 border-t border-slate-800/80">
                      {currentProviderDef.description && (
                        <span className="text-slate-400">{currentProviderDef.description}</span>
                      )}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                        {currentProviderDef.baseURL && (
                          <span className="flex items-center gap-1 text-slate-400">
                            <Globe className="w-3 h-3" /> 端點：{currentProviderDef.baseURL}
                          </span>
                        )}
                        {currentProviderDef.defaultModel && (
                          <span className="flex items-center gap-1 text-sky-400">
                            <Cpu className="w-3 h-3" /> 模型：{currentProviderDef.defaultModel}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Footer Submit Button */}
            <div className="flex flex-col gap-2 border-t border-slate-800 pt-4">
              {apiKeyMissing && (
                <div className="flex items-center gap-2 text-xs font-mono text-red-400 bg-red-950/40 border border-red-800/50 rounded px-3 py-2">
                  <ShieldAlert className="w-4 h-4 text-red-400 flex-shrink-0" />
                  尚未輸入 {selectedProviderId} 的 API Key，請先填入有效金鑰並測試。
                </div>
              )}
              {!apiKeyMissing && keyNotVerified && (
                <div className="flex items-center gap-2 text-xs font-mono text-amber-300 bg-amber-950/30 border border-amber-800/50 rounded px-3 py-2">
                  <Key className="w-4 h-4 text-amber-400 flex-shrink-0" />
                  請點擊「測試金鑰」按鈕驗證 API Key 有效性。
                </div>
              )}
              {!apiKeyMissing && !keyNotVerified && keyTestResult === 'success' && (
                <div className="flex items-center gap-2 text-xs font-mono text-green-400 bg-green-950/20 border border-green-800/50 rounded px-3 py-2">
                  <span className="w-2 h-2 rounded-full bg-green-400 inline-block flex-shrink-0" />
                  金鑰驗證通過，可以開始冒險！
                </div>
              )}
              <div className="flex items-center justify-between">
                <div className="text-xs font-mono text-slate-400 flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-amber-400" />
                  總入場人數：<span className="text-amber-300 font-bold">{totalMembers}</span> 人
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      soundManager.playSelectSound();
                      onOpenResume({
                        provider: selectedProviderId,
                        apiKey: userApiKey || apiKey,
                        model
                      });
                    }}
                    className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-amber-300 font-mono text-sm rounded border border-slate-700 hover:border-amber-500/50 transition flex items-center gap-2"
                    title="從 chat-logs 歷史紀錄備份並接續討論"
                  >
                    <History className="w-4 h-4" /> 接續歷史討論
                  </button>
                  <button
                    type="submit"
                    disabled={totalMembers === 0 || apiKeyMissing || keyNotVerified}
                    className="px-6 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold font-mono text-sm rounded border border-amber-500 shadow-lg transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Play className="w-4 h-4 fill-slate-950" /> 開啟辦公室冒險！
                  </button>
                </div>
              </div>
            </div>

          </form>
        </div>
      </div>
    </div>
  );
};
