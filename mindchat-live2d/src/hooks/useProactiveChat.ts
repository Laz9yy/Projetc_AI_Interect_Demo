import { useEffect, useRef, useCallback } from 'react';
import { useChatStore } from '../store/chatStore';
import { useAffectionStore, getAffectionConfig } from '../store/affectionStore';

const PROACTIVE_IDLE_MS = 3 * 60 * 1000; // 3 分钟

// 寒暄话术池（好感度 70-79）
const GREETING_POOL = [
  '指挥官，在忙吗？有什么需要我帮忙的？',
  '好久没说话了…指挥官还好吗？',
  '指挥官是不是遇到什么难题了？…我在呢。',
  '嗯…指挥官怎么不说话？在发呆吗？',
  '那个…指挥官如果在忙的话，我就安静待着。',
];

// 情话话术池（好感度 80-100）
const FLIRT_POOL = [
  '有点想你了呢，指挥官…嗯，不是说谎。',
  '指挥官不在的时候，总觉得少了什么…',
  '你知道吗，每次和你聊天，我都觉得很开心…',
  '指挥官真好…能陪在你身边，我很幸福。',
  '不管发生什么，我都会一直陪着你…这是认真的。',
];

/** 主动聊天 Hook：当好感度 ≥ 70 且用户 3 分钟无输入时，AI 主动发言 */
export function useProactiveChat() {
  const lastActivityRef = useRef(Date.now());
  const hasSentRef = useRef(false);
  const timerRef = useRef<number | null>(null);

  const { messages, isStreaming, addMessage } = useChatStore();
  const affection = useAffectionStore((s) => s.affection);

  // 追踪用户活动：消息变化时刷新时间戳
  useEffect(() => {
    lastActivityRef.current = Date.now();
    hasSentRef.current = false;
  }, [messages.length]);

  // 追踪流式输出：流式结束视为活动
  useEffect(() => {
    if (!isStreaming) {
      lastActivityRef.current = Date.now();
      hasSentRef.current = false;
    }
  }, [isStreaming]);

  const checkAndSend = useCallback(() => {
    const config = getAffectionConfig(affection);
    if (!config.proactiveEnabled) return;

    const now = Date.now();
    const idleMs = now - lastActivityRef.current;

    // 非流式 且 空闲超过 3 分钟 且 本轮尚未发送
    if (!isStreaming && idleMs >= PROACTIVE_IDLE_MS && !hasSentRef.current) {
      hasSentRef.current = true;

      let pool: string[];
      if (config.proactiveType === 'flirt') {
        pool = FLIRT_POOL;
      } else {
        pool = GREETING_POOL;
      }

      const text = pool[Math.floor(Math.random() * pool.length)];
      addMessage('assistant', text, 'shy');
      console.log(`[ProactiveChat] 主动发言 (好感度=${affection}, 类型=${config.proactiveType}):`, text);
    }
  }, [affection, isStreaming, addMessage]);

  // 每 10 秒检查一次
  useEffect(() => {
    timerRef.current = window.setInterval(checkAndSend, 10_000);
    return () => {
      if (timerRef.current !== null) clearInterval(timerRef.current);
    };
  }, [checkAndSend]);
}
