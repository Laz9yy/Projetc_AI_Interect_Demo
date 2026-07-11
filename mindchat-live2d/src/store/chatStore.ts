import { create } from 'zustand';
import type { ChatMessage, ExpressionType } from '../types';
import { streamChat, simulateChat } from '../services/ai';
import { useSettingsStore, buildSystemPrompt } from './settingsStore';
import { usePersonalityStore } from './personalityStore';
import { inferExpression } from '../data/expressions';

interface ChatStore {
  messages: ChatMessage[];
  isStreaming: boolean;
  currentExpression: ExpressionType;

  addMessage: (role: 'user' | 'assistant', content: string, expression?: ExpressionType) => void;
  sendMessage: (content: string) => Promise<void>;
  setExpression: (expr: ExpressionType) => void;
  clearMessages: () => void;
}

// 生成唯一 ID
const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

// HOLD → IDLE 回归 timer（模块级，跨渲染周期存活）
let holdTimerRef: number | null = null;

export const useChatStore = create<ChatStore>((set, get) => ({
  messages: [],
  isStreaming: false,
  currentExpression: 'neutral' as ExpressionType,

  addMessage: (role, content, expression) => {
    const msg: ChatMessage = {
      id: uid(),
      role,
      content,
      timestamp: Date.now(),
      expression,
    };
    set((s) => ({ messages: [...s.messages, msg] }));
  },

  sendMessage: async (content: string) => {
    const { addMessage } = get();
    const settings = useSettingsStore.getState();

    // 清除旧的 HOLD timer，新消息中断旧表情保持
    if (holdTimerRef) { window.clearTimeout(holdTimerRef); holdTimerRef = null; }

    // 优化2: 用户情绪即时检测 — 先对用户消息做情绪推断
    const userExpr = inferExpression(content);
    const empathyExpr: ExpressionType =
      userExpr === 'sad' || userExpr === 'angry' || userExpr === 'happy' || userExpr === 'surprised'
        ? userExpr
        : 'thinking';

    // 添加用户消息
    addMessage('user', content);

    // 重新获取最新消息列表（含刚添加的用户消息）
    const { messages } = get();

    // 发送消息时显示共情表情（若有强情绪）或 thinking
    set({ currentExpression: empathyExpr });

    // 共情表情保持 1.5s，之后过渡到 thinking（让 AI 回复接管）
    let empathyTimer: ReturnType<typeof setTimeout> | null = null;
    if (empathyExpr !== 'thinking') {
      empathyTimer = setTimeout(() => {
        set({ currentExpression: 'thinking' as ExpressionType });
      }, 1500);
    }

    // 创建 AI 回复占位
    const aiMsgId = uid();
    const aiMsg: ChatMessage = {
      id: aiMsgId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      expression: 'neutral',
      isTyping: true,
    };
    set((s) => ({
      messages: [...s.messages, aiMsg],
      isStreaming: true,
    }));

    try {
      // 从 store 当前状态读取，与第 53 行的 set({ currentExpression: 'thinking' }) 保持一致
      let lastExpr: string = get().currentExpression;

      if (settings.isConfigured) {
        // ===== AI 流式模式（带防抖）=====
        const allMsgs = [...messages];
        const personalityId = usePersonalityStore.getState().activeId;
        const effectiveConfig = {
          ...settings.config,
          systemPrompt: buildSystemPrompt(settings.config.systemPrompt, personalityId),
        };
        const stream = streamChat(allMsgs, effectiveConfig);

        let debounceTimer: ReturnType<typeof setTimeout> | null = null;

        for await (const chunk of stream) {
          // 更新消息内容（每次 chunk 都更新文本）— 不可变更新
          set((s) => ({
            messages: s.messages.map((msg) =>
              msg.id === aiMsgId
                ? { ...msg, content: msg.content + chunk.text, isTyping: false }
                : msg
            ),
          }));

          // 防抖窗口内跳过表达式更新
          if (debounceTimer !== null) continue;

          // 更新表达式 — 修复比较逻辑，避免死代码
          const expr = chunk.expression;
          if (expr !== lastExpr) {
            lastExpr = expr;
            set((s) => ({
              messages: s.messages.map((msg) =>
                msg.id === aiMsgId ? { ...msg, expression: expr } : msg
              ),
              currentExpression: expr as ExpressionType,
            }));
          }

          debounceTimer = setTimeout(() => { debounceTimer = null; }, 800);
        }
      } else {
        // ===== 离线模拟模式（带防抖）=====
        const personalityId = usePersonalityStore.getState().activeId;
        const stream = simulateChat(content, personalityId);

        let debounceTimer: ReturnType<typeof setTimeout> | null = null;
        let emittedExpr = '';

        for await (const chunk of stream) {
          lastExpr = chunk.expression;

          // 更新消息内容 — 不可变更新
          set((s) => ({
            messages: s.messages.map((msg) =>
              msg.id === aiMsgId
                ? { ...msg, content: msg.content + chunk.text, isTyping: false }
                : msg
            ),
          }));

          // 防抖窗口内跳过
          if (debounceTimer !== null) continue;

          // 更新表达式 — 不可变更新
          if (chunk.expression !== emittedExpr) {
            emittedExpr = chunk.expression;
            set((s) => ({
              messages: s.messages.map((msg) =>
                msg.id === aiMsgId ? { ...msg, expression: chunk.expression } : msg
              ),
              currentExpression: chunk.expression as ExpressionType,
            }));
          }

          debounceTimer = setTimeout(() => { debounceTimer = null; }, 800);
        }
      }

      // 清除共情 timer（AI 已开始回复，无需手动过渡）
      if (empathyTimer) clearTimeout(empathyTimer);

      set((s) => ({ isStreaming: false, currentExpression: lastExpr as ExpressionType }));

      // 优化5: HOLD → IDLE: 先 relaxed 过渡 500ms，再回归 neutral
      holdTimerRef = window.setTimeout(() => {
        set({ currentExpression: 'relaxed' as ExpressionType });
        // 二层 timer: relaxed 保持 1.5s → neutral
        holdTimerRef = window.setTimeout(() => {
          set({ currentExpression: 'neutral' as ExpressionType });
          holdTimerRef = null;
        }, 1500);
      }, 5000);
    } catch (err) {
      console.error('sendMessage 错误:', err);
      set((s) => ({
        messages: s.messages.map((msg) =>
          msg.id === aiMsgId
            ? {
                ...msg,
                content: `❌ ${err instanceof Error ? err.message : '未知错误'}`,
                isTyping: false,
                expression: 'sad' as ExpressionType,
              }
            : msg
        ),
        isStreaming: false,
        currentExpression: 'sad' as ExpressionType,
      }));
    }
  },

  setExpression: (expr) => set({ currentExpression: expr }),

  clearMessages: () =>
    set({ messages: [], currentExpression: 'neutral' as ExpressionType }),
}));
