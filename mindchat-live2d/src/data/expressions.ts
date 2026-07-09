import type { ExpressionConfig } from '../types';

export const expressionList: ExpressionConfig[] = [
  {
    id: 'neutral',
    label: 'Neutral',
    labelCn: '平静',
    emoji: '😶',
    color: '#7C5CFC',
    motion: 'idle',
  },
  {
    id: 'happy',
    label: 'Happy',
    labelCn: '开心',
    emoji: '😊',
    color: '#FF9A56',
    motion: 'happy',
  },
  {
    id: 'sad',
    label: 'Sad',
    labelCn: '难过',
    emoji: '😢',
    color: '#4A90D9',
    motion: 'sad',
  },
  {
    id: 'surprised',
    label: 'Surprised',
    labelCn: '惊讶',
    emoji: '😮',
    color: '#00D4FF',
    motion: 'surprised',
  },
  {
    id: 'shy',
    label: 'Shy',
    labelCn: '害羞',
    emoji: '😳',
    color: '#FF6B9D',
    motion: 'shy',
  },
  {
    id: 'angry',
    label: 'Angry',
    labelCn: '生气',
    emoji: '😠',
    color: '#FF4757',
    motion: 'angry',
  },
  {
    id: 'thinking',
    label: 'Thinking',
    labelCn: '思考',
    emoji: '🤔',
    color: '#FECA57',
    motion: 'thinking',
  },
  {
    id: 'relaxed',
    label: 'Relaxed',
    labelCn: '放松',
    emoji: '😌',
    color: '#A29BFE',
    motion: 'relaxed',
  },
];

// 根据 AI 回复内容推断情绪
export function inferExpression(text: string): string {
  const lower = text.toLowerCase();

  if (/哈哈|开心|太好了|真棒|喜欢|爱你|😊|😄|😂/.test(lower)) return 'happy';
  if (/难过|伤心|哭泣|对不起|😢|😭/.test(lower)) return 'sad';
  if (/啊|天哪|不会吧|什么|震惊|😮|😱/.test(lower)) return 'surprised';
  if (/害羞|不好意思|讨厌|😳|👉👈/.test(lower)) return 'shy';
  if (/生气|可恶|过分|不要|哼|😠|😡/.test(lower)) return 'angry';
  if (/嗯|让我想想|思考|可能|也许|🤔/.test(lower)) return 'thinking';
  if (/晚安|休息|放松|平静|😌/.test(lower)) return 'relaxed';

  return 'neutral';
}
