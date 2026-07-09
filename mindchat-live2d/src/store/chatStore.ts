import { create } from 'zustand';
import type { ChatMessage, ExpressionType } from '../types';
import { streamChat, simulateChat } from '../services/ai';
import { useSettingsStore } from './settingsStore';

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
    const { addMessage, messages } = get();
    const settings = useSettingsStore.getState();

    // 添加用户消息
    addMessage('user', content);

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
      let lastExpr = 'neutral';

      if (settings.isConfigured) {
        // ===== AI 流式模式 =====
        const allMsgs = [...messages, { id: uid(), role: 'user' as const, content, timestamp: Date.now() }];
        const stream = streamChat(allMsgs, settings.config);

        for await (const chunk of stream) {
          lastExpr = chunk.expression;
          set((s) => {
            const msgs = [...s.messages];
            const lastMsg = msgs[msgs.length - 1];
            if (lastMsg && lastMsg.id === aiMsgId) {
              lastMsg.content += chunk.text;
              lastMsg.expression = chunk.expression;
              lastMsg.isTyping = false;
            }
            return { messages: msgs, currentExpression: chunk.expression as ExpressionType };
          });
        }
      } else {
        // ===== 离线模拟模式 =====
        const stream = simulateChat(content);
        for await (const chunk of stream) {
          lastExpr = chunk.expression;
          set((s) => {
            const msgs = [...s.messages];
            const lastMsg = msgs[msgs.length - 1];
            if (lastMsg && lastMsg.id === aiMsgId) {
              lastMsg.content += chunk.text;
              lastMsg.expression = chunk.expression;
              lastMsg.isTyping = false;
            }
            return { messages: msgs, currentExpression: chunk.expression as ExpressionType };
          });
        }
      }

      set((s) => ({ isStreaming: false, currentExpression: lastExpr as ExpressionType }));
    } catch (err) {
      set((s) => {
        const msgs = [...s.messages];
        const lastMsg = msgs[msgs.length - 1];
        if (lastMsg && lastMsg.id === aiMsgId) {
          lastMsg.content = `❌ ${err instanceof Error ? err.message : '未知错误'}`;
          lastMsg.isTyping = false;
          lastMsg.expression = 'sad';
        }
        return { messages: msgs, isStreaming: false, currentExpression: 'sad' as ExpressionType };
      });
    }
  },

  setExpression: (expr) => set({ currentExpression: expr }),

  clearMessages: () =>
    set({ messages: [], currentExpression: 'neutral' as ExpressionType }),
}));
