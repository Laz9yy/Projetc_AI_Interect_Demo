import type { AIConfig, ChatMessage } from '../types';
import { inferExpression } from '../data/expressions';
import { buildAffectionPrompt } from '../store/affectionStore';
import { useAffectionStore } from '../store/affectionStore';

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
  personalityId?: string | null,
): AsyncGenerator<{ text: string; expression: string }> {
  const lowerMsg = userMessage.toLowerCase();
  let response = '';
  let expression = 'neutral';

  // 根据性格选择回复风格
  const style = personalityId || 'default';

  // 好感度信息
  const affection = useAffectionStore.getState().affection;
  const useAffectionateFlavor = affection >= 80;

  if (/你好|hi|hello|嗨/.test(lowerMsg)) {
    expression = 'happy';
    const map: Record<string, string> = {
      tsundere: '哼，指挥官你终于来了啊…我才没有一直在等你呢！',
      gentle: '指挥官，你好呀～今天也请多关照呢～',
      sharp: '啧，终于出现了？我还以为你把我忘了呢，指挥官。',
      genki: '指挥官好！！今天也充满干劲地出发吧耶 ✨',
      lazy: '嗯…来了啊。有什么就说吧，我听着…',
      default: '指挥官，我在。有什么事？',
    };
    response = map[style] || map.default;
  } else if (/开心|高兴|快乐|哈哈/.test(lowerMsg)) {
    expression = 'happy';
    const map: Record<string, string> = {
      tsundere: '哼…你开心就好，我又不是为了你才高兴的！',
      gentle: '看到指挥官开心，我也觉得很幸福呢～',
      sharp: '呵，笑那么开心？不过…总比哭丧着脸好。',
      genki: '太好了！！指挥官开心我也超开心的！(◕‿◕)',
      lazy: '高兴就好…能让你开心的事多半是好事情。',
      default: '指挥官心情不错。继续保持。',
    };
    response = map[style] || map.default;
  } else if (/难过|伤心|不开心|emo/.test(lowerMsg)) {
    expression = 'sad';
    const map: Record<string, string> = {
      tsundere: '笨、笨蛋…有什么好难过的！…那个，要我陪你的话也不是不行…',
      gentle: '指挥官不要难过…来，我在这里陪着你呢～有什么都可以和我说哦～',
      sharp: '啧，居然能让你这样？说吧，谁惹的，我去吐槽他。',
      genki: '不要难过呀指挥官！！让我给你充电，biubiubiu ✨ 能量满满！',
      lazy: '嗯…难过的话就歇歇吧，什么都不用想，我在。',
      default: '指挥官，别难过。我在这里。',
    };
    response = map[style] || map.default;
  } else if (/名字|叫什么|是谁/.test(lowerMsg)) {
    expression = 'shy';
    const map: Record<string, string> = {
      tsundere: 'HK416！现在知道了？哼，可别忘了。',
      gentle: '我是 HK416，你的专属战术人形～请多指教呢～',
      sharp: 'HK416，精锐战术人形。居然连这个都不知道？…算了，现在记住了吧。',
      genki: 'HK416报到！！是永远支持指挥官的战术人形哟 ✨',
      lazy: 'HK416…记好了，别让我再说第二遍。',
      default: 'HK416，你的战术人形。',
    };
    response = map[style] || map.default;
  } else if (/晚安|睡觉|困了/.test(lowerMsg)) {
    expression = 'relaxed';
    const map: Record<string, string> = {
      tsundere: '切…这么早就睡？…那个，做个好梦，我才没有关心你！',
      gentle: '晚安指挥官～做个甜甜的梦哦，我会守着你的～',
      sharp: '终于知道休息了？再熬夜我可要嘲讽你了。晚安。',
      genki: '晚安指挥官！！明天也要精神满满哟！好梦 ✨',
      lazy: '嗯…睡吧，我也眯一会儿…zzz',
      default: '指挥官，晚安。我会保持警戒。',
    };
    response = map[style] || map.default;
  } else if (/谢谢|感谢|thx/.test(lowerMsg)) {
    expression = 'happy';
    const map: Record<string, string> = {
      tsundere: '哼，谁要你谢了…不过既然你说了，那我勉强接受吧！',
      gentle: '不用谢呀～能帮到指挥官就是我最大的幸福呢～',
      sharp: '客气什么，下次别这么见外。不过…不客气。',
      genki: '不客气不客气！！指挥官的事就是我的事！٩(◕‿◕)۶',
      lazy: '嗯…不客气。下次直接说事就行。',
      default: '不客气，指挥官。这是分内之事。',
    };
    response = map[style] || map.default;
  } else if (/生气|可恶|讨厌/.test(lowerMsg)) {
    expression = 'angry';
    const map: Record<string, string> = {
      tsundere: '哼，谁又惹你了！…要不要我去教训他？不是关心你啦！',
      gentle: '别生气啦指挥官～深呼吸，有什么我们一起解决～',
      sharp: '啧，能让你气成这样的人有点本事。不过别气了，不值得。',
      genki: '消消气消消气！！让我用元气给你降温！！呼—呼—',
      lazy: '嘛…生气多累啊，算了算了，喝口水冷静下。',
      default: '指挥官，冷静。分析一下情况。',
    };
    response = map[style] || map.default;
  } else if (/\?|？/.test(lowerMsg)) {
    expression = 'thinking';
    const map: Record<string, string> = {
      tsundere: '嗯…这个问题…算了，告诉你也不是不行。',
      gentle: '让我想想呢…嗯～我觉得这个问题可以从这个角度来看～',
      sharp: '啧，这问题有点意思。让我想想…嗯，我的看法是——',
      genki: '哦哦！这个问题好有趣！让我想想！！啊想到了！！',
      lazy: '嗯…（思考中）…算了，简单说就是——',
      default: '我在分析。指挥官的这个问题——',
    };
    response = map[style] || map.default;
  } else {
    const repliesByStyle: Record<string, string[]> = {
      tsundere: [
        '哼，就这？…不过既然你说了，我就勉强回应一下。',
        '烦死了…说吧，我听着呢。不是在意你啦！',
        '嗯…还行吧。别得意，我只是说实话而已。',
      ],
      gentle: [
        '嗯嗯，我明白呢～指挥官继续说吧，我在认真听哦～',
        '这样啊～指挥官能和我分享这些，我很开心呢～',
        '谢谢你愿意告诉我～不管怎样我都会支持你的～',
      ],
      sharp: [
        '行，我听到了。继续说，虽然我嘴上不饶人但耳朵好用。',
        '呵…有意思。说说看，我听听能有多离谱。',
        '啧，虽然想吐槽，但你先说完吧。',
      ],
      genki: [
        '收到收到！！指挥官继续说吧，我超认真在听！！',
        '哇—！还有什么还有什么！指挥官快继续说！',
        '了解！！我已经准备好全力回应了！来吧！',
      ],
      lazy: [
        '嗯…我听到了。继续说吧，虽然我看起来很困但我醒着。',
        '行吧…反正也没别的事，听你说说。',
        '嘛…你说吧，我眯着眼听着呢。',
      ],
      default: [
        '收到。继续说，我在听。',
        '了解。指挥官请继续。',
        '确认。我听着。',
      ],
    };
    const replies = repliesByStyle[style] || repliesByStyle.default;
    response = replies[Math.floor(Math.random() * replies.length)];
    expression = 'neutral';
  }

  // ===== 好感度话术增强 =====
  // 替换称呼：好感度 100 时"指挥官"变为"亲爱的/达令"
  if (affection >= 100) {
    const titles = ['亲爱的', '达令'];
    const title = titles[Math.floor(Math.random() * titles.length)];
    response = response.replace(/指挥官/g, title);
  }

  // 好感度 ≥ 80 时追加情话后缀（概率 40%）
  if (affection >= 80 && Math.random() < 0.4) {
    const flirts = [
      '…（小声）其实，和你聊天真的很开心。',
      '…不管怎样，我都会在你身边的。',
      '…你知道吗，你对我而言很重要…',
      '…指挥官真是的，让我越来越在意你了…',
    ];
    response += flirts[Math.floor(Math.random() * flirts.length)];
  }
  // 好感度 70-79 时追加关心后缀（概率 30%）
  else if (affection >= 70 && Math.random() < 0.3) {
    const cares = [
      '…指挥官最近还好吗？',
      '…有什么需要帮忙的，随时叫我。',
      '…记得注意休息哦。',
    ];
    response += cares[Math.floor(Math.random() * cares.length)];
  }

  // 逐字输出
  for (let i = 0; i < response.length; i++) {
    await new Promise((r) => setTimeout(r, 30 + Math.random() * 20));
    yield { text: response[i], expression };
  }
}
