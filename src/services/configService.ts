import rawConfig from '../../config.json';

export interface ProviderDefinition {
  id: string;
  type: string;
  sdk: string;
  apiKey: string;
  description: string;
  baseURL: string;
  defaultModel: string;
}

export interface GameLoopConfig {
  heartbeatIntervalMs: number;
  behaviorWeights: {
    goCoffee: number;
    visitColleague: number;
    stayDesk: number;
  };
  dialogueTrigger: {
    minIntervalMs: number;
    chance: number;
  };
  autoAdvanceMs?: number;
  maxDialogueRounds?: number;
}

export interface AppConfig {
  port?: number;
  gameLoop?: GameLoopConfig;
  models?: { model: string; label?: string };
  providers?: Record<string, Omit<ProviderDefinition, 'id'>>;
}

const config: AppConfig = rawConfig as AppConfig;

interface ModelConfig {
  provider: string;
  model: string;
  label: string;
}

let cachedModelConfig: ModelConfig | null = null;

export async function initModelConfig(options?: { retry?: boolean }): Promise<ModelConfig> {
  const maxAttempts = options?.retry ? 20 : 1;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const res = await fetch('/api/model-config');
      if (res.ok) {
        const data = await res.json();
        cachedModelConfig = {
          provider: data.provider || '',
          model: data.model || '',
          label: data.label || data.model || ''
        };
        return cachedModelConfig;
      }
    } catch {
      // 後端可能尚未就緒，等一下再重試
    }
    if (attempt < maxAttempts - 1) {
      await new Promise(r => setTimeout(r, 1500));
    }
  }
  console.warn('[ModelConfig] 無法從伺服器取得模型設定，使用預設值');
  cachedModelConfig = { provider: '', model: '', label: '' };
  return cachedModelConfig;
}

export function resolveModel(): { provider: string; model: string; label: string } {
  if (cachedModelConfig) {
    return { ...cachedModelConfig };
  }
  return { provider: '', model: '', label: '' };
}

export function getProviderList(): ProviderDefinition[] {
  const list: ProviderDefinition[] = [
    {
      id: 'mock',
      type: 'mock',
      sdk: 'mock',
      apiKey: '',
      description: '即插即用 (Mock AI)',
      baseURL: '',
      defaultModel: 'mock-script'
    }
  ];

  if (config && config.providers) {
    Object.entries(config.providers).forEach(([key, val]) => {
      list.push({
        id: key,
        type: val.type || 'cloud',
        sdk: val.sdk || 'openai',
        apiKey: val.apiKey || '',
        description: val.description || key,
        baseURL: val.baseURL || '',
        defaultModel: val.defaultModel || ''
      });
    });
  }

  return list;
}

export function getProviderById(id: string): ProviderDefinition | undefined {
  return getProviderList().find(p => p.id === id);
}

export function getGameLoopConfig(): GameLoopConfig {
  const defaultLoop: GameLoopConfig = {
    heartbeatIntervalMs: 3000,
    behaviorWeights: {
      goCoffee: 0.3,
      visitColleague: 0.3,
      stayDesk: 0.4
    },
    dialogueTrigger: {
      minIntervalMs: 3000,
      chance: 0.4
    },
    autoAdvanceMs: 3000,
    maxDialogueRounds: 20
  };

  if (config && config.gameLoop) {
    return {
      heartbeatIntervalMs: config.gameLoop.heartbeatIntervalMs ?? defaultLoop.heartbeatIntervalMs,
      behaviorWeights: {
        goCoffee: config.gameLoop.behaviorWeights?.goCoffee ?? defaultLoop.behaviorWeights.goCoffee,
        visitColleague: config.gameLoop.behaviorWeights?.visitColleague ?? defaultLoop.behaviorWeights.visitColleague,
        stayDesk: config.gameLoop.behaviorWeights?.stayDesk ?? defaultLoop.behaviorWeights.stayDesk
      },
      dialogueTrigger: {
        minIntervalMs: config.gameLoop.dialogueTrigger?.minIntervalMs ?? defaultLoop.dialogueTrigger.minIntervalMs,
        chance: config.gameLoop.dialogueTrigger?.chance ?? defaultLoop.dialogueTrigger.chance
      },
      autoAdvanceMs: (config.gameLoop as any).autoAdvanceMs ?? defaultLoop.autoAdvanceMs,
      maxDialogueRounds: (config.gameLoop as any).maxDialogueRounds ?? defaultLoop.maxDialogueRounds
    };
  }

  return defaultLoop;
}
