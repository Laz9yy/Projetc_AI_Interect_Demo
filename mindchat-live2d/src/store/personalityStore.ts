import { create } from 'zustand';
import { getPersonalityById } from '../data/personalities';

const STORAGE_KEY_UNLOCKED = 'mindchat_personality_unlocked';
const STORAGE_KEY_ACTIVE = 'mindchat_personality_active';

const CORRECT_PASSWORD = 'Yr13541192308';

interface PersonalityStore {
  /** 密码是否已解锁 */
  isUnlocked: boolean;
  /** 当前激活的性格 ID */
  activeId: string | null;
  /** 密码错误次数 */
  errorCount: number;
  /** 冷却截止时间戳 (ms) */
  cooldownUntil: number;
  /** 是否正在显示密码输入区 */
  showPasswordInput: boolean;

  /** 尝试解锁 */
  attemptUnlock: (password: string) => boolean;
  /** 设置当前性格 */
  setActive: (id: string) => void;
  /** 重置为默认性格 */
  resetToDefault: () => void;
  /** 打开/关闭密码输入区 */
  setShowPasswordInput: (show: boolean) => void;
  /** 重置错误计数（冷却后自动调用） */
  resetErrorCount: () => void;
}

function loadUnlocked(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY_UNLOCKED) === 'true';
  } catch {
    return false;
  }
}

function loadActiveId(): string | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_ACTIVE);
    if (saved && getPersonalityById(saved)) return saved;
  } catch {
    /* ignore */
  }
  return null;
}

function saveUnlocked(value: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY_UNLOCKED, String(value));
  } catch {
    /* ignore */
  }
}

function saveActiveId(id: string | null) {
  try {
    if (id) {
      localStorage.setItem(STORAGE_KEY_ACTIVE, id);
    } else {
      localStorage.removeItem(STORAGE_KEY_ACTIVE);
    }
  } catch {
    /* ignore */
  }
}

export const usePersonalityStore = create<PersonalityStore>((set, get) => ({
  isUnlocked: loadUnlocked(),
  activeId: loadActiveId(),
  errorCount: 0,
  cooldownUntil: 0,
  showPasswordInput: false,

  attemptUnlock: (password: string) => {
    const state = get();

    // 冷却中
    if (Date.now() < state.cooldownUntil) return false;

    if (password === CORRECT_PASSWORD) {
      saveUnlocked(true);
      set({ isUnlocked: true, errorCount: 0, cooldownUntil: 0, showPasswordInput: false });
      return true;
    }

    const newCount = state.errorCount + 1;
    if (newCount >= 3) {
      // 进入 5 秒冷却
      set({
        errorCount: newCount,
        cooldownUntil: Date.now() + 5000,
      });
    } else {
      set({ errorCount: newCount });
    }
    return false;
  },

  setActive: (id: string) => {
    saveActiveId(id);
    set({ activeId: id });
  },

  resetToDefault: () => {
    saveActiveId(null);
    set({ activeId: null });
  },

  setShowPasswordInput: (show: boolean) => {
    set({ showPasswordInput: show });
  },

  resetErrorCount: () => {
    set({ errorCount: 0, cooldownUntil: 0 });
  },
}));
