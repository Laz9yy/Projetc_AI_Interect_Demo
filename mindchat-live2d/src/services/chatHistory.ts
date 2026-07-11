import type { ChatMessage } from '../types';

const HISTORY_KEY = 'mindchat_chat_history';

/** 保存完整聊天记录到 localStorage */
export function saveChatHistory(messages: ChatMessage[]): void {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(messages));
  } catch {
    console.warn('[chatHistory] localStorage 存储失败，可能已满');
  }
}

/** 从 localStorage 加载聊天记录 */
export function loadChatHistory(): ChatMessage[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // 筛选有效消息
    return parsed.filter(
      (m: any) =>
        m &&
        typeof m.id === 'string' &&
        (m.role === 'user' || m.role === 'assistant' || m.role === 'system') &&
        typeof m.content === 'string' &&
        typeof m.timestamp === 'number',
    );
  } catch {
    console.warn('[chatHistory] localStorage 读取失败');
    return [];
  }
}

/** 清空聊天记录 */
export function clearChatHistory(): void {
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {
    console.warn('[chatHistory] 清空失败');
  }
}

/** 获取最近对话摘要文本（用于注入 systemPrompt） */
export function getChatSummary(messages: ChatMessage[], maxChars = 500): string {
  if (messages.length === 0) return '';

  const recent = messages.slice(-20);
  const lines: string[] = [];

  for (const msg of recent) {
    if (msg.role === 'system') continue;
    const prefix = msg.role === 'user' ? '指挥官' : 'HK416';
    const short = msg.content.length > 80 ? msg.content.slice(0, 80) + '…' : msg.content;
    lines.push(`${prefix}: ${short}`);
  }

  let summary = lines.join('\n');
  if (summary.length > maxChars) {
    summary = summary.slice(-maxChars);
    const idx = summary.indexOf('\n');
    if (idx > 0) summary = summary.slice(idx + 1);
  }

  return summary ? `\n\n【近期对话摘要】\n${summary}` : '';
}
