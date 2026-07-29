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

export interface AppConfig {
  providers: Record<string, Omit<ProviderDefinition, 'id'>>;
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
