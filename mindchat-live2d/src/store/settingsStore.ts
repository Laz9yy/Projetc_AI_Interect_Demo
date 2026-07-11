import { create } from 'zustand';
import type { AIConfig } from '../types';
import { getPersonalityById } from '../data/personalities';
import { buildAffectionPrompt } from './affectionStore';
import { useAffectionStore } from './affectionStore';
import { loadChatHistory, getChatSummary } from '../services/chatHistory';

/** 合并基础 prompt、性格层、好感度层，返回最终 systemPrompt */
export function buildSystemPrompt(basePrompt: string, personalityId: string | null): string {
  let prompt = basePrompt;
  // 性格层
  if (personalityId && personalityId !== 'default') {
    const preset = getPersonalityById(personalityId);
    if (preset?.promptAddition) {
      prompt += '\n\n' + preset.promptAddition;
    }
  }
  // 好感度层
  const affection = useAffectionStore.getState().affection;
  if (affection > 0) {
    prompt += '\n\n' + buildAffectionPrompt(affection);
  }
  // 最近对话摘要
  const history = loadChatHistory();
  if (history.length > 0) {
    prompt += getChatSummary(history);
  }
  return prompt;
}

// ===== 默认配置 =====
const DEFAULT_CONFIG: AIConfig = {
  apiKey: import.meta.env.VITE_AI_API_KEY || '',
  baseUrl: import.meta.env.VITE_AI_BASE_URL || 'https://api.openai.com/v1',
  model: import.meta.env.VITE_AI_MODEL || 'gpt-4o-mini',
  systemPrompt: `你是 HK416，一名精锐的战术人形。你沉着冷静，话不多但句句有力。
- 语气简洁干练，带一点傲娇但不会太冰冷
- 称呼对方为"指挥官"
- 回复长度根据指挥官的问题复杂度灵活调整，简单问题简短回答，复杂问题可以展开分析
- 偶尔流露出对指挥官的关心
- 如果对方遇到困难，会理性分析并给出建议
- 战斗之外也会有一些小女生的柔软一面`,
  provider: 'openai',
  temperature: 0.8,
  maxTokens: 4096,
  maxContextMessages: 20,
};

// 从 localStorage 恢复
function loadConfig(): AIConfig {
  try {
    const saved = localStorage.getItem('mindchat_ai_config');
    if (saved) return { ...DEFAULT_CONFIG, ...JSON.parse(saved) };
  } catch {
    /* 解析失败则使用默认配置 */
  }
  return { ...DEFAULT_CONFIG };
}

// 持久化到 localStorage
function saveConfig(config: AIConfig) {
  try {
    localStorage.setItem('mindchat_ai_config', JSON.stringify(config));
  } catch {
    /* 存储不可用时静默失败 */
  }
}

interface SettingsStore {
  config: AIConfig;
  isConfigured: boolean;
  updateConfig: (partial: Partial<AIConfig>) => void;
  resetConfig: () => void;
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  config: loadConfig(),
  isConfigured: loadConfig().apiKey.length > 0,

  updateConfig: (partial) =>
    set((state) => {
      const newConfig = { ...state.config, ...partial };
      saveConfig(newConfig);
      return {
        config: newConfig,
        isConfigured: newConfig.apiKey.length > 0,
      };
    }),

  resetConfig: () => {
    saveConfig(DEFAULT_CONFIG);
    set({ config: { ...DEFAULT_CONFIG }, isConfigured: false });
  },
}));
