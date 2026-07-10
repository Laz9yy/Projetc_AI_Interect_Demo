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

// ===== 情绪规则表（按优先级排序）=====
const EMOTION_RULES: { emotion: string; pattern: RegExp }[] = [
  { emotion: 'happy',     pattern: /哈哈|开心|太好了|真棒|喜欢|爱你|😊|😄|😂/ },
  { emotion: 'sad',       pattern: /难过|伤心|哭泣|对不起|😢|😭/ },
  { emotion: 'surprised', pattern: /啊|天哪|不会吧|什么|震惊|😮|😱/ },
  { emotion: 'shy',       pattern: /害羞|不好意思|讨厌|😳|👉👈/ },
  { emotion: 'angry',     pattern: /生气|可恶|过分|不要|哼|😠|😡/ },
  // 优化3: thinking 规则分两档 — 强信号直接命中，弱信号需排除 AI 惯用词
  { emotion: 'thinking',  pattern: /嗯|让我想想|思考|🤔/ },
  { emotion: 'relaxed',   pattern: /晚安|休息|放松|平静|😌/ },
];

// thinking 弱信号: "可能""也许" 单独出现时容易误判
const THINKING_WEAK = /可能|也许/;
// AI 惯用搭配，排除 thinking 弱信号
const THINKING_AI_PHRASES = /可能可以|可能还|可能已经|可能只是|也许可以|也许还|也许能|也许已经|也许我们/;

/**
 * 根据 AI 回复内容推断情绪（v2 增强版）
 *
 * 改进点:
 * 1. 分句检测 — 仅分析最新 3 个有效句子，不再是全文
 * 2. 权重递减 — 最新句子权重最高（×3），倒数第二 ×2，倒数第三 ×1
 * 3. "可能/也许"弱信号过滤 — AI 惯用搭配不再误触 thinking
 * 4. 多情绪竞争 → 取加权最高分，平局时保留优先级
 */
export function inferExpression(text: string): string {
  if (!text || text.trim().length === 0) return 'neutral';

  // 1. 分句（中英文句号、问号、感叹号、换行、逗号作为分隔）
  const rawSentences = text.split(/[。！？.!?\n,，；;]+/).filter((s) => s.trim().length > 0);
  if (rawSentences.length === 0) return 'neutral';

  // 2. 只取最后 3 个句子
  const sentences = rawSentences.slice(-3);

  // 3. 每个句子按规则打分，按位置加权
  const scores: Record<string, number> = {};
  const WEIGHTS = [1, 2, 3]; // 倒数第一权重 3，倒数第二 2，倒数第三 1

  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i];
    const lower = sentence.toLowerCase();
    const weight = WEIGHTS[i] || 1;

    for (const rule of EMOTION_RULES) {
      if (rule.pattern.test(lower)) {
        scores[rule.emotion] = (scores[rule.emotion] || 0) + weight;
      }
    }

    // 优化3: thinking 弱信号单独处理（排除 AI 惯用搭配）
    if (THINKING_WEAK.test(lower) && !THINKING_AI_PHRASES.test(lower)) {
      scores['thinking'] = (scores['thinking'] || 0) + weight * 0.5; // 弱信号半权重
    }
  }

  // 4. 取最高分情绪
  const entries = Object.entries(scores);
  if (entries.length === 0) return 'neutral';

  entries.sort((a, b) => b[1] - a[1]); // 按分数降序
  return entries[0][0];
}
