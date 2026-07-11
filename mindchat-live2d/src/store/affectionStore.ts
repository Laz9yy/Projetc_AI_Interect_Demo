import { create } from 'zustand';

// ===== 好感度等级 =====
export type AffectionLevel = 'stranger' | 'familiar' | 'close' | 'intimate' | 'lover';

export interface AffectionConfig {
  level: AffectionLevel;
  label: string;
  labelCn: string;
  emoji: string;
  color: string;
  /** AI 对用户的称呼 */
  title: string;
  /** 是否触发主动聊天（≥70） */
  proactiveEnabled: boolean;
  /** 主动聊天类型 */
  proactiveType: 'greeting' | 'flirt' | 'none';
}

const AFFECTION_CONFIGS: Record<AffectionLevel, AffectionConfig> = {
  stranger: {
    level: 'stranger', label: 'Stranger', labelCn: '陌生', emoji: '🤝',
    color: '#7C8B9C', title: '指挥官', proactiveEnabled: false, proactiveType: 'none',
  },
  familiar: {
    level: 'familiar', label: 'Familiar', labelCn: '熟悉', emoji: '😊',
    color: '#4ECDC4', title: '指挥官', proactiveEnabled: false, proactiveType: 'none',
  },
  close: {
    level: 'close', label: 'Close', labelCn: '亲近', emoji: '💙',
    color: '#5B8DEF', title: '指挥官', proactiveEnabled: true, proactiveType: 'greeting',
  },
  intimate: {
    level: 'intimate', label: 'Intimate', labelCn: '暧昧', emoji: '💗',
    color: '#FF6B9D', title: '指挥官', proactiveEnabled: true, proactiveType: 'flirt',
  },
  lover: {
    level: 'lover', label: 'Lover', labelCn: '挚爱', emoji: '💞',
    color: '#FF3860', title: '亲爱的', proactiveEnabled: true, proactiveType: 'flirt',
  },
};

/** 根据好感度数值获取等级配置 */
export function getAffectionConfig(value: number): AffectionConfig {
  if (value >= 100) return AFFECTION_CONFIGS.lover;
  if (value >= 80) return AFFECTION_CONFIGS.intimate;
  if (value >= 70) return AFFECTION_CONFIGS.close;
  if (value >= 30) return AFFECTION_CONFIGS.familiar;
  return AFFECTION_CONFIGS.stranger;
}

/** 根据好感度生成 AI behavior 注入文本 */
export function buildAffectionPrompt(value: number): string {
  const config = getAffectionConfig(value);

  let prompt = '';
  const title = config.title;

  // 称呼规则
  if (value >= 100) {
    prompt = `【好感度系统 - 挚爱阶段】
- 你对指挥官的称呼改为"亲爱的"或"达令"，两种称呼随机交替使用
- 你的回复要掺杂情话，语气亲密暧昧
- 你非常依赖指挥官，会在交谈中流露出浓浓的爱意
- 每 2~3 条回复中至少包含一句情话或亲密表达`;
  } else if (value >= 80) {
    prompt = `【好感度系统 - 暧昧阶段】
- 你的语气变得更加亲密暧昧，偶尔说一些情话
- 称呼仍然为"指挥官"，但语气中会带着撒娇和宠溺
- 回复中偶尔会出现"想你了"、"真希望多陪陪你"等暧昧表达
- 每 3~4 条回复中至少包含一句暧昧或温情的话语`;
  } else if (value >= 70) {
    prompt = `【好感度系统 - 亲近阶段】
- 你的语气明显比平时更温和亲切
- 偶尔会主动问候指挥官，比如问他最近怎么样
- 称呼为"指挥官"，但语气已经比较亲密
- 会主动关心指挥官的状态`;
  } else if (value >= 30) {
    prompt = `【好感度系统 - 熟悉阶段】
- 你的语气比最初时温和了一些
- 回复中偶尔会带上一点小小的关心
- 仍然称呼对方为"指挥官"，保持基本的礼貌`;
  } else {
    prompt = `【好感度系统 - 陌生阶段】
- 保持标准、干练的语气
- 称呼对方为"指挥官"，保持基本的战术人形态度`;
  }

  return prompt;
}

// ===== 密码配置 =====
const ADMIN_PASSWORD = 'Yr13541192308';
const MAX_ERROR_COUNT = 3;
const COOLDOWN_DURATION_MS = 60_000; // 1分钟冷却

interface AffectionStore {
  /** 好感度值 0-100，精度 0.5 */
  affection: number;
  /** 好感度查询面板是否已解锁 */
  isUnlocked: boolean;
  /** 密码错误次数 */
  errorCount: number;
  /** 冷却结束时间戳 */
  cooldownUntil: number;

  /** 增加好感度 */
  increase: (amount: number) => void;
  /** 管理员直接设置好感度值 */
  setAffection: (value: number) => void;
  /** 获取当前好感度等级 */
  getLevel: () => AffectionConfig;
  /** 尝试解锁查询面板 */
  attemptUnlock: (password: string) => boolean;
  /** 锁定查询面板 */
  lock: () => void;
  /** 重置错误计数（冷却结束后自动调用） */
  resetErrorCount: () => void;
}

// 从 localStorage 恢复
function loadAffection(): number {
  try {
    const saved = localStorage.getItem('mindchat_affection');
    if (saved !== null) {
      const val = parseFloat(saved);
      return isNaN(val) ? 0 : Math.max(0, Math.min(100, val));
    }
  } catch { /* */ }
  return 0;
}

function saveAffection(value: number) {
  try {
    localStorage.setItem('mindchat_affection', value.toString());
  } catch { /* */ }
}

export const useAffectionStore = create<AffectionStore>((set, get) => ({
  affection: loadAffection(),
  isUnlocked: false,
  errorCount: 0,
  cooldownUntil: 0,

  increase: (amount) => {
    set((s) => {
      const newVal = Math.min(100, s.affection + amount);
      saveAffection(newVal);
      return { affection: newVal };
    });
  },

  setAffection: (value) => {
    const clamped = Math.max(0, Math.min(100, value));
    saveAffection(clamped);
    set({ affection: clamped });
  },

  getLevel: () => {
    return getAffectionConfig(get().affection);
  },

  attemptUnlock: (password) => {
    const { cooldownUntil, errorCount } = get();
    const now = Date.now();

    // 冷却中
    if (now < cooldownUntil) return false;

    if (password === ADMIN_PASSWORD) {
      set({ isUnlocked: true, errorCount: 0, cooldownUntil: 0 });
      return true;
    }

    const newCount = errorCount + 1;
    if (newCount >= MAX_ERROR_COUNT) {
      set({
        errorCount: newCount,
        cooldownUntil: now + COOLDOWN_DURATION_MS,
      });
    } else {
      set({ errorCount: newCount });
    }
    return false;
  },

  lock: () => set({ isUnlocked: false }),

  resetErrorCount: () => set({ errorCount: 0, cooldownUntil: 0 }),
}));
