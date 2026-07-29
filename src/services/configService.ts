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
}

export interface AppConfig {
  gameLoop?: GameLoopConfig;
  models?: { model: string };
  providers?: Record<string, Omit<ProviderDefinition, 'id'>>;
}

const config: AppConfig = rawConfig as AppConfig;

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
      minIntervalMs: 6000,
      chance: 0.4
    }
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
      }
    };
  }

  return defaultLoop;
}

export function resolveModel(): string {
  const modelConfig = config?.models?.model;
  if (!modelConfig || typeof modelConfig !== 'string') return '';

  if (modelConfig.includes('/')) {
    return modelConfig;
  }

  const provider = config?.providers?.[modelConfig];
  return provider?.defaultModel || '';
}
