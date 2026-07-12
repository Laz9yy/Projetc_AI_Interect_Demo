import { create } from 'zustand';
import type { ChatMessage, ExpressionType } from '../types';
import { streamChat, simulateChat } from '../services/ai';
import { useSettingsStore, buildSystemPrompt } from './settingsStore';
import { usePersonalityStore } from './personalityStore';
import { useAffectionStore } from './affectionStore';
import { inferExpression } from '../data/expressions';
import { saveChatHistory, loadChatHistory } from '../services/chatHistory';

interface ChatStore {
  messages: ChatMessage[];
  isStreaming: boolean;
  currentExpression: ExpressionType;

  addMessage: (role: 'user' | 'assistant', content: string, expression?: ExpressionType) => void;
  sendMessage: (content: string) => Promise<void>;
  setExpression: (expr: ExpressionType) => void;
  clearMessages: () => void;
  loadHistory: () => void;
}

// 生成唯一 ID
const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

// HOLD → IDLE 回归 timer（模块级，跨渲染周期存活）
let holdTimerRef: number | null = null;

export const useChatStore = create<ChatStore>((set, get) => ({
  messages: loadChatHistory(),
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
    set((s) => {
      const newMessages = [...s.messages, msg];
      // 持久化保存
      saveChatHistory(newMessages);
      return { messages: newMessages };
    });
  },

  loadHistory: () => {
    const history = loadChatHistory();
    if (history.length > 0) {
      set({ messages: history });
    }
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

    // ★ 用户每发送一次消息，好感度 +0.5
    useAffectionStore.getState().increase(0.5);

    // 重新获取最新消息列表（含刚添加的用户消息）
    const { messages } = get();

    // 发送消息时显示共情表情（若有强情绪）或 thinking
    // 不再设 1.5s thinking timer — AI 流式的 expression 字段会自然接管
    set({ currentExpression: empathyExpr });

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
        // ===== AI 流式模式（rAF 批量提交 + 表情防抖）=====
        const allMsgs = [...messages];
        const personalityId = usePersonalityStore.getState().activeId;
        const effectiveConfig = {
          ...settings.config,
          systemPrompt: buildSystemPrompt(settings.config.systemPrompt, personalityId),
        };
        const stream = streamChat(allMsgs, effectiveConfig);

        // rAF 批量：不在每个 chunk 更新 React，累积后在帧回调中提交
        let accumulatedText = '';
        let rafScheduled = false;
        let pendingExpr = '';
        let debounceTimer: ReturnType<typeof setTimeout> | null = null;

        for await (const chunk of stream) {
          accumulatedText += chunk.text;
          const currentExpr = chunk.expression;

          if (currentExpr !== lastExpr) {
            pendingExpr = currentExpr;
          }

          if (!rafScheduled) {
            rafScheduled = true;
            requestAnimationFrame(() => {
              rafScheduled = false;

              // ★ O(1) 数组更新：仅 shallow-copy + 替换最后一个元素
              set((s) => {
                const msgs = s.messages;
                const last = msgs.length - 1;
                if (last < 0 || msgs[last].id !== aiMsgId) return {};
                const updated = msgs.slice();
                updated[last] = { ...msgs[last], content: accumulatedText, isTyping: false };
                return { messages: updated };
              });

              // 表达式仅在防抖窗口过后且确已变化时提交
              if (debounceTimer === null && pendingExpr !== '' && pendingExpr !== lastExpr) {
                lastExpr = pendingExpr;
                set((s) => {
                  const msgs = s.messages;
                  const last = msgs.length - 1;
                  if (last < 0 || msgs[last].id !== aiMsgId) return {};
                  const updated = msgs.slice();
                  updated[last] = { ...msgs[last], expression: pendingExpr };
                  return { messages: updated, currentExpression: pendingExpr as ExpressionType };
                });
                debounceTimer = setTimeout(() => { debounceTimer = null; }, 800);
              }
            });
          }
        }

        // flush 最后一批
        await new Promise<void>((resolve) => {
          requestAnimationFrame(() => {
            set((s) => {
              const msgs = s.messages;
              const last = msgs.length - 1;
              if (last < 0 || msgs[last].id !== aiMsgId) return {};
              const updated = msgs.slice();
              updated[last] = { ...msgs[last], content: accumulatedText, isTyping: false };
              return { messages: updated };
            });
            resolve();
          });
        });
      } else {
        // ===== 离线模拟模式（rAF 批量提交）=====
        const personalityId = usePersonalityStore.getState().activeId;
        const stream = simulateChat(content, personalityId);

        let accumulatedText = '';
        let rafScheduled = false;
        let debounceTimer: ReturnType<typeof setTimeout> | null = null;
        let emittedExpr = '';

        for await (const chunk of stream) {
          accumulatedText += chunk.text;
          if (chunk.expression !== emittedExpr) {
            emittedExpr = chunk.expression;
          }

          if (!rafScheduled) {
            rafScheduled = true;
            requestAnimationFrame(() => {
              rafScheduled = false;

              set((s) => {
                const msgs = s.messages;
                const last = msgs.length - 1;
                if (last < 0 || msgs[last].id !== aiMsgId) return {};
                const updated = msgs.slice();
                updated[last] = { ...msgs[last], content: accumulatedText, isTyping: false };
                return { messages: updated };
              });

              if (debounceTimer === null && emittedExpr !== '' && emittedExpr !== lastExpr) {
                lastExpr = emittedExpr;
                set((s) => {
                  const msgs = s.messages;
                  const last = msgs.length - 1;
                  if (last < 0 || msgs[last].id !== aiMsgId) return {};
                  const updated = msgs.slice();
                  updated[last] = { ...msgs[last], expression: emittedExpr };
                  return { messages: updated, currentExpression: emittedExpr as ExpressionType };
                });
                debounceTimer = setTimeout(() => { debounceTimer = null; }, 800);
              }
            });
          }
        }

        // flush
        await new Promise<void>((resolve) => {
          requestAnimationFrame(() => {
            set((s) => {
              const msgs = s.messages;
              const last = msgs.length - 1;
              if (last < 0 || msgs[last].id !== aiMsgId) return {};
              const updated = msgs.slice();
              updated[last] = { ...msgs[last], content: accumulatedText, isTyping: false };
              return { messages: updated };
            });
            resolve();
          });
        });
      }

      set((s) => ({ isStreaming: false, currentExpression: lastExpr as ExpressionType }));

      // 流式完成后持久化保存完整记录
      saveChatHistory(get().messages);

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
      set((s) => {
        const msgs = s.messages;
        const last = msgs.length - 1;
        if (last >= 0 && msgs[last].id === aiMsgId) {
          const updated = msgs.slice();
          updated[last] = {
            ...msgs[last],
            content: `❌ ${err instanceof Error ? err.message : '未知错误'}`,
            isTyping: false,
            expression: 'sad' as ExpressionType,
          };
          return { messages: updated, isStreaming: false, currentExpression: 'sad' as ExpressionType };
        }
        return { isStreaming: false, currentExpression: 'sad' as ExpressionType };
      });
    }
  },

  setExpression: (expr) => set({ currentExpression: expr }),

  clearMessages: () => {
    set({ messages: [], currentExpression: 'neutral' as ExpressionType });
    saveChatHistory([]);
  },
}));
