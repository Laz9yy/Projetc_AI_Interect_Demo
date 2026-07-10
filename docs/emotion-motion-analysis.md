# 人物情绪检测 + AI 应答情绪机制 + 动作关联机制 完整分析

## 一、架构总览

```mermaid
flowchart TD
    subgraph 输入层
        A[用户输入文字] --> B[ChatInput.onTypingChange]
        B -->|isTyping=true| C[setExpression('thinking')]
        A -->|点击发送| D[chatStore.sendMessage]
    end

    subgraph AI处理层
        D --> E[set currentExpression = 'thinking']
        E --> F{AI 配置?}
        F -->|已配置| G[streamChat - 流式 API]
        F -->|未配置| H[simulateChat - 离线模拟]
        G --> I["每个 chunk: inferExpression(fullText)"]
        H --> J["预设 expression 值"]
        I --> K[防抖 800ms + 最小8字符阈值]
        J --> K
    end

    subgraph Store层
        K --> L[更新 chatStore.currentExpression]
        L --> M["HOLD 6秒 → currentExpression = 'neutral'"]
    end

    subgraph 渲染层
        L --> N[App.tsx 读取 currentExpression]
        N --> O[Live2DViewer 接收 expression prop]
        O --> P[useEffect 监听 expression 变化]
        P --> Q["面部: model.expression('f00'~'f07')"]
        P --> R["身体: model.motion(group, index)"]
    end

    style C fill:#FECA57,color:#000
    style E fill:#FECA57,color:#000
    style P fill:#7C5CFC,color:#fff
    style Q fill:#FF6B9D,color:#fff
    style R fill:#FF6B9D,color:#fff
```

---

## 二、情绪检测模式详解

### 2.1 核心引擎：`inferExpression()` 函数

```typescript
// mindchat-live2d/src/data/expressions.ts:71-83
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
```

**检测策略**：纯关键词正则匹配，优先级从上到下（happy → sad → surprised → shy → angry → thinking → relaxed → neutral 兜底）

**关键发现与风险**：

| 问题 | 说明 |
|------|------|
| 🔴 **优先级固化** | 如果 AI 回复同时含"开心"和"难过"，永远返回 `happy`，无法体现复合情绪 |
| 🟠 **"思考"误匹配** | 关键词中"可能""也许"是 AI 常用的礼貌用语（如"也许你可以试试..."），会导致频繁误判为 `thinking` |
| 🟠 **"讨厌"的歧义** | 中文"讨厌"可能是撒娇（shy）也可能是真讨厌（angry），当前归类为 `shy`，但正则中 `shy` 的匹配在 `angry` 之前 |
| 🟡 **仅匹配完整文本** | 函数接收的是整个 AI 回复的累积文本 `fullText`，而非最新句子。对话越长越容易命中最前面的关键词 |

### 2.2 AI 流式回答时的情绪检测时机

```typescript
// mindchat-live2d/src/services/ai.ts:159-160
fullText += content;
const expr = fullText.length >= 8 ? inferExpression(fullText) : 'thinking';
```

- **前 8 个字符**：统一返回 `thinking`（等待 AI 生成足够语义内容）
- **≥ 8 字符后**：每收到一个 chunk 都用 `inferExpression(fullText)` 检测，但有 **800ms 防抖窗口**

```typescript
// mindchat-live2d/src/store/chatStore.ts:91-107
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
```

**时序示例**（一条 AI 回复的完整检测过程）：

```
t=0ms     → 用户点击发送 → currentExpression = 'thinking'
t=200ms   → AI 返回 "指挥官，" (4字符) → expression = 'thinking' (不足8字符)
t=450ms   → AI 返回 "指挥官，我很高兴" (8字符) → inferExpression → 'happy'
t=450ms   → 'happy' 首次出现，set currentExpression → 触发 Live2D 表情切换 ✅
t=500ms   → AI 返回 "指挥官，我很高兴能帮" (11字符) → 在防抖窗口内，跳过
t=1300ms  → 防抖窗口打开 → inferExpression → 'happy' (不变) → 跳过 set
t=1800ms  → AI 流结束 → HOLD → 6秒后回归 neutral
```

---

## 三、情绪 → 动作的关联机制

### 3.1 映射表（代码实现）

```typescript
// mindchat-live2d/src/components/Live2D/Live2DViewer.tsx:192-201
const EMOTION_MOTIONS: Record<ExpressionType, { group: string; index: number }> = {
  neutral:   { group: 'idle', index: 0 },
  happy:     { group: '',     index: 2 },
  sad:       { group: '',     index: 7 },
  surprised: { group: '',     index: 1 },
  shy:       { group: '',     index: 4 },
  angry:     { group: '',     index: 6 },
  thinking:  { group: '',     index: 8 },
  relaxed:   { group: '',     index: 9 },
};

// mindchat-live2d/src/components/Live2D/Live2DViewer.tsx:186-189
const EXPRESSION_IDS: Record<ExpressionType, string> = {
  neutral: 'f00', happy: 'f01', sad: 'f02', surprised: 'f03',
  shy: 'f04', angry: 'f05', relaxed: 'f06', thinking: 'f07',
};
```

### 3.2 完整对照关系

| 情绪 | 面部 ID | 动作文件 | Motion 调用 | 语义 |
|------|---------|----------|-------------|------|
| neutral 😶 | `f00` | `daiji_idle_01.mtn` | `model.motion('idle', 0)` | 待机呼吸 |
| happy 😊 | `f01` | `touch_1.mtn` | `model.motion('', 2)` | 开心歪头 |
| sad 😢 | `f02` | `wait_1.mtn` | `model.motion('', 7)` | 难过低头 |
| surprised 😮 | `f03` | `shake.mtn` | `model.motion('', 1)` | 惊讶后仰 |
| shy 😳 | `f04` | `touch_3.mtn` | `model.motion('', 4)` | 害羞遮脸 |
| angry 😠 | `f05` | `touch_5.mtn` | `model.motion('', 6)` | 生气握拳 |
| thinking 🤔 | `f07` | `wait_2.mtn` | `model.motion('', 8)` | 歪头思考 |
| relaxed 😌 | `f06` | `wedding.mtn` | `model.motion('', 9)` | 闭眼微笑 |

---

## 四、动作播放的保护机制（已修复后的现状）

```typescript
// mindchat-live2d/src/components/Live2D/Live2DViewer.tsx:222-275
useEffect(() => {
  if (isLoading || error) return;

  // 初始化：expression='neutral' + lastExprRef='neutral' 时也播放一次 idle
  const isInitial = lastExprRef.current === 'neutral' && expression === 'neutral' && lastMotionKeyRef.current === '';

  // 同一表情不重复触发（初始化时除外）
  if (!isInitial && expression === lastExprRef.current) return;
  lastExprRef.current = expression;

  callModelSafely((model) => {
    // 1. 切换面部表情
    const exprId = EXPRESSION_IDS[expression] || 'f00';
    try { (model as any).expression?.(exprId); } catch { /* 模型可能不支持 expression API */ }

    // 2. 播放身体动作（带间隔保护）
    const motion = EMOTION_MOTIONS[expression];
    if (!motion) return;

    const motionKey = motion.group + ':' + motion.index;
    const sameMotion = motionKey === lastMotionKeyRef.current;
    const now = Date.now();
    const elapsedSinceLastMotion = now - lastMotionTimeRef.current;

    // 策略：同一动作冷却 3 秒；不同动作冷却仅 300ms；首次调用不检查
    const shouldPlay =
      lastMotionKeyRef.current === ''
        ? true                                           // 首次调用，立即播放
        : sameMotion
          ? elapsedSinceLastMotion >= 3000               // 同一动作需要 3 秒冷却
          : elapsedSinceLastMotion >= 300;               // 不同动作仅需 300ms 间隔

    if (shouldPlay) {
      lastMotionKeyRef.current = motionKey;
      lastMotionTimeRef.current = now;
      try {
        model.motion(motion.group, motion.index);
        console.log(
          `[Live2D] 动作播放: group="${motion.group}" index=${motion.index} ` +
          `(情绪=${expression}, 距上次=${elapsedSinceLastMotion}ms)`
        );
      } catch (e) {
        console.warn(
          `[Live2D] 动作失败: group="${motion.group}" index=${motion.index}`, e
        );
      }
    } else {
      console.log(
        `[Live2D] 动作跳过: group="${motion.group}" index=${motion.index} ` +
        `(情绪=${expression}, sameMotion=${sameMotion}, 距上次=${elapsedSinceLastMotion}ms)`
      );
    }
  });
}, [expression, isLoading, error, callModelSafely]);
```

**保护策略总结**：

| 保护项 | 策略 | 目的 |
|--------|------|------|
| 模型生存检查 | `callModelSafely()` 检查 modelRef 和 destroyed 标志 | 防止卸载后崩溃 |
| 同表情去重 | `expression === lastExprRef.current` 跳过 | 避免无意义重播 |
| 首次播放 | `lastMotionKeyRef === ''` 立即播放 | 保证首个动作不延迟 |
| 不同动作间隔 | ≥ 300ms | 情绪快速切换时允许流畅过渡 |
| 同动作冷却 | ≥ 3000ms | 避免同一动作抖动重播 |
| 初始化 idle | `isInitial` 条件允许 neutral+neutral 首次触发 | 显式播放 idle，不依赖自动循环 |

---

## 五、状态机执行流程（含时序）

```
                    ┌─────────────────┐
    应用启动         │   login 动画    │ model.motion('', 0)
    ───────────────▶│   (600ms 延迟)  │──────────────────────┐
                    └─────────────────┘                      │
                                                            ▼
                    ┌─────────────────┐            ┌─────────────────┐
                    │   IDLE 空闲     │            │  neutral idle   │
                    │  neutral 😶     │───────────▶│  daiji_idle_01  │
                    └───────┬─────────┘            └─────────────────┘
                            │
                    用户开始输入
                            │
                            ▼
                    ┌─────────────────┐            ┌─────────────────┐
                    │ USER_TYPING     │            │  thinking wait  │
                    │  thinking 🤔    │───────────▶│  wait_2 思考    │
                    └───────┬─────────┘            └─────────────────┘
                            │
                    用户点击发送
                            │
                            ▼
                    ┌─────────────────┐
                    │ AI_PROCESSING   │  (保持 thinking，最短 1.2s)
                    │  thinking 🤔    │
                    └───────┬─────────┘
                            │
                    AI 首 chunk ≥ 8 字符
                            │
                            ▼
                    ┌─────────────────┐            ┌─────────────────┐
                    │ AI_REPLYING     │            │ inferExpression │
                    │ 动态情绪匹配    │───────────▶│ → 对应 Motion   │
                    │ 800ms 防抖窗口  │            └─────────────────┘
                    └───────┬─────────┘
                            │
                    流结束
                            │
                            ▼
                    ┌─────────────────┐
                    │   HOLD 保持     │  保持最后情绪
                    │  6秒后 ────────▶│  ────────────▶ IDLE
                    └─────────────────┘
```

---

## 六、发现的问题与风险

### 🔴 高严重度

| # | 问题 | 位置 | 影响 |
|---|------|------|------|
| 1 | **`inferExpression` 优先级固化** | `expressions.ts:71-83` | "讨厌"同时匹配 `shy`（害羞）和 `angry`（生气），但 `shy` 在前无法到达 `angry` |
| 2 | **"可能""也许"误触发 thinking** | `expressions.ts:79` | AI 高频使用礼貌用语会被持续误判为思考状态 |

### 🟠 中严重度

| # | 问题 | 位置 | 影响 |
|---|------|------|------|
| 3 | **没有对用户输入文本做情绪检测** | `chatStore.ts:39-68` | 用户说"我很难过"，但角色在 AI 回复前一直保持 `thinking`，缺少同理心即时反馈 |
| 4 | **`inferExpression` 只检测全文本而非最新句子** | `ai.ts:159` | 对话越长，越容易被前面早已失效的情绪关键词"黏住" |
| 5 | **面部表情 API 可能不存在** | `Live2DViewer.tsx:235` | `(model as any).expression?.(exprId)` 用 try/catch 包裹，但 `expression()` 方法可能是 `pixi-live2d-display` 的非标准扩展，Cubism2 模型不一定支持 |

### 🟡 低严重度

| # | 问题 | 位置 | 影响 |
|---|------|------|------|
| 6 | **HOLD 6秒 timer 未被 cleanup 管理** | `chatStore.ts:148-150` | `holdTimerRef` 是模块级变量（line 21），组件卸载后不会自动清理 |
| 7 | **离线模拟模式无情绪变化** | `ai.ts:170-217` | 预设回复的 `expression` 值固定，不会随文本进展变化（设计如此但体验单一） |
| 8 | **没有"对话结束回归 neutral 前插入过渡表情"** | `chatStore.ts:149` | 从任何情绪直接跳回 neutral 略显生硬 |

---

## 七、优化建议

1. **情绪检测增强**：将 `inferExpression` 的匹配策略从"全文正则"改为"最新句子 + 情绪权重递减"，前 2-3 个句子的情绪权重高于后续文本

2. **用户情绪即时反馈**：在 `sendMessage` 中，用户消息发出后先对用户文本做一次 `inferExpression`，如果用关键词命中 sad/angry 等强情绪，角色立即先切到共情表情而非 thinking

3. **过滤"可能/也许"误判**：在 `thinking` 的匹配正则中排除"可能能""也许可以"这类 AI 惯用词组合，或者增加"嗯""让我想想"等更强关键词的权重

4. **`expression()` API 兼容保护**：确认 `pixi-live2d-display` 的 Cubism2 模型是否支持 `model.expression()` 方法；若不支持，考虑使用 `model.internalModel.coreModel.setParameterValueById()` 手动设置表情参数

5. **HOLD → IDLE 过渡优化**：在回归 neutral 前，先经过一个 500ms 的 `relaxed` 过渡，实现"情绪自然消退"的视觉效果
