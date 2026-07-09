import type { AIProvider } from '../types';

// ===== 预置 AI 提供商 =====
export const aiProviders: AIProvider[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    models: ['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo'],
    defaultModel: 'gpt-4o-mini',
    requiresApiKey: true,
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    models: ['deepseek-chat', 'deepseek-reasoner'],
    defaultModel: 'deepseek-chat',
    requiresApiKey: true,
  },
  {
    id: 'qwen',
    name: '通义千问',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    models: ['qwen-turbo', 'qwen-plus', 'qwen-max'],
    defaultModel: 'qwen-plus',
    requiresApiKey: true,
  },
  {
    id: 'custom',
    name: '自定义',
    baseUrl: '',
    models: [],
    defaultModel: '',
    requiresApiKey: false,
  },
];

// 根据 ID 查找提供商
export function getProvider(id: string): AIProvider | undefined {
  return aiProviders.find((p) => p.id === id);
}
