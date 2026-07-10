import type { AIConfig, ChatMessage } from '../types';
import { inferExpression } from '../data/expressions';

// ===== Token 估算（简易版，中英文混合估算）=====
function estimateTokens(text: string): number {
  // 中文：~1.5 字符/token，英文：~4 字符/token
  const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  const otherChars = text.length - chineseChars;
  return Math.ceil(chineseChars / 1.5 + otherChars / 4);
}

// 截断消息历史，保证不超出上下文窗口
function truncateMessages(
  messages: ChatMessage[],
  systemPrompt: string,
  maxTokens: number,
  maxMessages: number,
): { role: string; content: string }[] {
  const systemTokens = estimateTokens(systemPrompt);
  let budget = maxTokens - systemTokens - 2000; // 预留 2000 给回复

  const result: { role: string; content: string }[] = [
    { role: 'system', content: systemPrompt },
  ];

  // 从最近的开始取，保证最近对话在上下文内
  const recent = messages
    .filter((m) => m.role !== 'system')
    .slice(-maxMessages);

  // Token 预算计算
  let usableFrom = recent.length;
  for (let i = recent.length - 1; i >= 0; i--) {
    const tokens = estimateTokens(recent[i].content);
    if (budget - tokens < 0) break; // Token 预算耗尽
    budget -= tokens;
    usableFrom = i;
  }

  // 正序插入可用消息
  for (let i = usableFrom; i < recent.length; i++) {
    result.push({
      role: recent[i].role as 'user' | 'assistant',
      content: recent[i].content,
    });
  }

  return result;
}

// ===== 指数退避重试 =====
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 2,
): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);

      // 429 / 5xx 重试，4xx（非429）不重试
      if (response.ok) return response;

      if (response.status === 429 || response.status >= 500) {
        if (attempt < maxRetries) {
          const delay = Math.min(1000 * 2 ** attempt, 8000);
          console.warn(`[AI] 重试第 ${attempt + 1} 次，等待 ${delay}ms...`);
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }
      }

      return response; // 非可重试错误，直接返回
    } catch (err) {
      if (attempt < maxRetries) {
        const delay = Math.min(1000 * 2 ** attempt, 8000);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
  throw new Error('请求失败：已达最大重试次数');
}

// ===== 流式 AI 对话（增强版）=====
export async function* streamChat(
  messages: ChatMessage[],
  config: AIConfig,
): AsyncGenerator<{ text: string; expression: string }> {
  const apiMessages = truncateMessages(
    messages,
    config.systemPrompt,
    config.maxTokens || 4096,
    config.maxContextMessages || 20,
  );

  const response = await fetchWithRetry(
    `${config.baseUrl}/chat/completions`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: apiMessages,
        stream: true,
        max_tokens: 2000,
        temperature: config.temperature ?? 0.8,
      }),
    },
  );

  if (!response.ok) {
    let userMessage = 'AI 服务请求失败';

    if (response.status === 401) {
      userMessage = 'API Key 无效，请检查设置中的密钥是否正确';
    } else if (response.status === 429) {
      userMessage = '请求过于频繁，请稍后再试';
    } else if (response.status === 403) {
      userMessage = 'API Key 无权限，请检查账户余额或权限';
    } else {
      userMessage = `AI API 错误 (${response.status})`;
    }

    throw new Error(userMessage);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('无法读取响应流');

  const decoder = new TextDecoder();
  let fullText = '';
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('data: ')) continue;

      const dataStr = trimmed.slice(6);
      if (dataStr === '[DONE]') continue;

      try {
        const data = JSON.parse(dataStr);
        const content = data.choices?.[0]?.delta?.content;
        if (content) {
          fullText += content;
          const expr = fullText.length >= 8 ? inferExpression(fullText) : 'thinking';
          yield { text: content, expression: expr };
        }
      } catch {
        // 跳过解析错误的行
      }
    }
  }
}

// ===== 模拟 AI 回复 (无 API Key 时的离线模式) =====
export async function* simulateChat(
  userMessage: string,
): AsyncGenerator<{ text: string; expression: string }> {
  const lowerMsg = userMessage.toLowerCase();
  let response = '';
  let expression = 'neutral';

  if (/你好|hi|hello|嗨/.test(lowerMsg)) {
    response = '你好呀！今天过得怎么样呀？有什么想聊的吗～';
    expression = 'happy';
  } else if (/开心|高兴|快乐|哈哈/.test(lowerMsg)) {
    response = '看到你开心我也很高兴呢！分享快乐会让快乐加倍哦～';
    expression = 'happy';
  } else if (/难过|伤心|不开心|emo/.test(lowerMsg)) {
    response = '抱抱你～不开心的话就和我说说吧，我会一直在这里陪着你。要不要一起想想怎么让心情好起来？';
    expression = 'sad';
  } else if (/名字|叫什么|是谁/.test(lowerMsg)) {
    response = '我叫 Haru，是你的专属虚拟伙伴哦！会一直陪在你身边的～';
    expression = 'shy';
  } else if (/晚安|睡觉|困了/.test(lowerMsg)) {
    response = '晚安呀～做个好梦，我会在梦里守护你的 🌙';
    expression = 'relaxed';
  } else if (/谢谢|感谢|thx/.test(lowerMsg)) {
    response = '不客气呀～能帮到你就好！有什么需要随时找我哦 😊';
    expression = 'happy';
  } else if (/生气|可恶|讨厌/.test(lowerMsg)) {
    response = '别生气啦～深呼吸，我陪你聊聊天放松一下好不好？';
    expression = 'angry';
  } else if (/\?|？/.test(lowerMsg)) {
    response = '嗯…让我想想呢～这个问题很有意思，我觉得每个人都有自己的答案吧。你觉得呢？';
    expression = 'thinking';
  } else {
    const replies = [
      '嗯嗯，我听到了呢～继续说吧，我在认真听哦',
      '这样啊～感觉你今天的心情挺特别的呢，想多和我说说吗？',
      '我明白你的感受～不管怎样，我都会在这里陪着你的 ❤️',
      '有意思！想再详细说说吗？我对你说的很感兴趣呢～',
    ];
    response = replies[Math.floor(Math.random() * replies.length)];
    expression = 'neutral';
  }

  // 逐字输出
  for (let i = 0; i < response.length; i++) {
    await new Promise((r) => setTimeout(r, 30 + Math.random() * 20));
    yield { text: response[i], expression };
  }
}
