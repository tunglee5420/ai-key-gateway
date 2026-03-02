import { AIProvider, ProviderType, GLMProvider, DeepseekProvider, MinimaxProvider, KIMIProvider } from './index';
import { AIProvider as ConfigProvider } from '../config';

export function createProvider(config: ConfigProvider): AIProvider {
  switch (config.type) {
    case 'glm':
      return new GLMProvider(config.apiKey);
    case 'deepseek':
      return new DeepseekProvider(config.apiKey);
    case 'minimax':
      return new MinimaxProvider(config.apiKey);
    case 'kimi':
      return new KIMIProvider(config.apiKey);
    default:
      throw new Error(`Unknown provider type: ${(config as any).type}`);
  }
}

export function getDefaultModel(type: ProviderType): string {
  const models: Record<ProviderType, string> = {
    glm: 'glm-4',
    deepseek: 'deepseek-chat',
    minimax: 'abab6.5s-chat',
    kimi: 'moonshot-v1-8k'
  };
  return models[type];
}
