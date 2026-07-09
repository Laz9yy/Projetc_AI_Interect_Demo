# Live2D 角色表情动作驱动系统 — 修改文档

> **版本**: v1.0  
> **日期**: 2026-07-09  
> **工程基线**: `mindchat-live2d` 主分支当前代码  
> **文档原则**: 不改 Live2D 渲染核心，只在其上叠加情绪→表情→动作驱动层

---

## 目录

1. [需求回顾](#1-需求回顾)
2. [当前架构分析](#2-当前架构分析)
3. [情绪 × 动作对照表](#3-情绪--动作对照表)
4. [表情状态机设计](#4-表情状态机设计)
5. [时序参数设计](#5-时序参数设计)
6. [崩溃风险与保护措施](#6-崩溃风险与保护措施)
7. [实施计划 — 文件修改清单](#7-实施计划--文件修改清单)
8. [修改详情](#8-修改详情)

---

## 1. 需求回顾

基于之前多轮讨论，核心需求归纳为 5 个阶段的情绪状态机：

| 阶段 | 触发条件 | 表情 | 动作 |
|------|----------|------|------|
| **IDLE 空闲** | 页面无任何交互 | `neutral` 😶 | `daiji_idle_01` 待机呼吸循环 |
| **USER_TYPING 输入中** | 用户在输入框输入文字 | `thinking` 🤔 | `wait_2` 歪头思考 |
| **AI_PROCESSING AI思考** | 用户发送→AI返回首chunk | `thinking` 🤔 | 保持上一个动作或 `wait_2` |
| **AI_REPLYING AI回复** | AI流式返回文本≥8字符 | 动态匹配 | 对应动作 |
| **HOLD 表情保持** | AI回复结束→回归空闲 | 最后表情 | 保持→缓慢回 idle |

特殊动作：
- **应用启动** → 播放 `login` 登场动画
- **用户点击角色** → 随机播放 `touch_1~5`

---

## 2. 当前架构分析

### 2.1 数据流（当前）

```
用户输入
  → ChatInput.onSend(text)
    → ChatWindow
      → chatStore.sendMessage(text)
        ├─ 添加用户消息到 messages[]
        ├─ 创建 AI 消息占位
        ├─ 调用 streamChat(messages, config)  /  simulateChat(text)
        │   └─ 每个 chunk: inferExpression(fullText) → yield { text, expression }
        └─ 更新 chatStore.currentExpression

App.tsx
  → useChatStore().currentExpression     ← 全局情绪状态
  → expressionList.find().labelCn        ← 角色状态文字
  → Live2DViewer({ modelUrl, expression })  ← ⚠ 传入但未消费
```

### 2.2 问题诊断

```
                    ┌──────────────────────────┐
                    │   Live2DViewer.tsx       │
                    │                          │
expression prop ───▶│   接收了 expression      │
                    │   但从未调用模型 API      │  ← 核心问题
                    │                          │
                    │   model.motion()  ✗      │
                    │   model.expression() ✗   │
                    └──────────────────────────┘
```

### 2.3 不做的事

- ❌ **不重构 Live2DViewer 的 PIXI 初始化逻辑** — 现有渲染链路已稳定（CDN 降级、透明背景、自适应缩放）
- ❌ **不接入 useLive2D.ts hook** — 该 hook 使用不同的初始化方案（Cubism5 SDK），与当前 Cubism2 CDN 方案冲突
- ❌ **不修改模型文件** — 12 个 `.mtn` 动作文件保持不变

### 2.4 要做的事

- ✅ 在 `Live2DViewer.tsx` 中**新增一个 `useEffect`**，监听 `expression` prop
- ✅ 在该 effect 中调用 `modelRef.current` 上的 `expression(id)` 和 `motion(group, index)`
- ✅ 添加防抖和去重保护
- ✅ 补充 `ChatInput` → 输入状态通知链路

---

## 3. 情绪 × 动作对照表

### 3.1 模型动作索引（基于 model.json）

`model.json` 中的动作结构：

```json
"motions": {
    "idle": [
        {"file": "motions/daiji_idle_01.mtn"}
    ],
    "": [
        {"file": "motions/login.mtn"},         // index 0
        {"file": "motions/shake.mtn"},         // index 1
        {"file": "motions/touch_1.mtn"},        // index 2
        {"file": "motions/touch_2.mtn"},        // index 3
        {"file": "motions/touch_3.mtn"},        // index 4
        {"file": "motions/touch_4.mtn"},        // index 5
        {"file": "motions/touch_5.mtn"},        // index 6
        {"file": "motions/wait_1.mtn"},         // index 7
        {"file": "motions/wait_2.mtn"},         // index 8
        {"file": "motions/wedding.mtn"},        // index 9
        {"file": "motions/wedding_touch.mtn"}   // index 10
    ]
}
```

### 3.2 情绪→动作完整映射表

```typescript
const EMOTION_TO_MOTION: Record<ExpressionType, { group: string; index: number }> = {
  neutral:  { group: 'idle', index: 0 },   // daiji_idle_01  平静待机呼吸 (循环)
  happy:    { group: '',     index: 2 },   // touch_1        开心歪头点头
  sad:      { group: '',     index: 7 },   // wait_1         难过低头含胸
  surprised:{ group: '',     index: 1 },   // shake          惊讶后仰定格
  shy:      { group: '',     index: 4 },   // touch_3        害羞歪头遮脸
  angry:    { group: '',     index: 6 },   // touch_5        生气皱眉握拳
  thinking: { group: '',     index: 8 },   // wait_2         思考歪头点下巴
  relaxed:  { group: '',     index: 9 },   // wedding        放松闭眼微笑
};
```

### 3.3 情绪色与表情 ID 映射

```typescript
const EMOTION_TO_EXPRESSION_ID: Record<ExpressionType, string> = {
  neutral:   'f00',
  happy:     'f01',
  sad:       'f02',
  surprised: 'f03',
  shy:       'f04',
  angry:     'f05',
  relaxed:   'f06',
  thinking:  'f07',
};
```

### 3.4 完整对照表

| # | 情绪 | Emoji | 色值 | 面部ID | 动作(Motion) | 动作文件 | 触发条件 |
|---|------|-------|------|--------|-------------|----------|----------|
| 0 | neutral 平静 | 😶 | `#7C5CFC` | `f00` | `idle[0]` | `daiji_idle_01` | 页面无交互（空闲态） |
| 1 | thinking 思考 | 🤔 | `#FECA57` | `f07` | `""[8]` | `wait_2` | 用户输入中 / AI 处理中 |
| 2 | happy 开心 | 😊 | `#FF9A56` | `f01` | `""[2]` | `touch_1` | AI 回复含正向关键词 |
| 3 | sad 难过 | 😢 | `#4A90D9` | `f02` | `""[7]` | `wait_1` | AI 回复含负向关键词 |
| 4 | surprised 惊讶 | 😮 | `#00D4FF` | `f03` | `""[1]` | `shake` | AI 回复含惊叹关键词 |
| 5 | shy 害羞 | 😳 | `#FF6B9D` | `f04` | `""[4]` | `touch_3` | AI 回复含害羞关键词 |
| 6 | angry 生气 | 😠 | `#FF4757` | `f05` | `""[6]` | `touch_5` | AI 回复含愤怒关键词 |
| 7 | relaxed 放松 | 😌 | `#A29BFE` | `f06` | `""[9]` | `wedding` | AI 回复含放松/晚安关键词 |

### 特殊动作（非情绪驱动）

| 场景 | Motion | 调用方式 | 描述 |
|------|--------|----------|------|
| 应用启动 | `login` | `model.motion('', 0)` | 角色登场，开场白播放 |
| 用户点击角色 | `touch_1~5` | `model.motion('', 2~6)` 随机 | 触摸交互反馈 |

---

## 4. 表情状态机设计

### 4.1 状态转移图

```
                         ┌──────────────────────────────────────┐
                         │                                      │
                         ▼                                      │
                    ┌──────────┐                                │
    页面加载 ──────▶│   IDLE   │◀──────── 超时2s ────────┐      │
                    │ neutral  │                          │      │
                    │ idle[0]  │                          │      │
                    └────┬─────┘                          │      │
                         │                                │      │
                   用户开始输入                            │  用户清空输入
                         │                                │      │
                         ▼                                │      │
                 ┌───────────────┐                        │      │
                 │ USER_TYPING   │────────────────────────┘      │
                 │  thinking 🤔   │                               │
                 │  wait_2        │                               │
                 └───────┬───────┘                               │
                         │                                        │
                   用户点击发送                                     │
                         │                                        │
                         ▼                                        │
                 ┌───────────────┐                                │
                 │ AI_PROCESSING │  (最短1.2s)                    │
                 │  thinking 🤔   │                               │
                 │  保持上一动作   │                               │
                 └───────┬───────┘                               │
                         │                                        │
                 AI返回首chunk                                     │
                 (fullText ≥ 8字符)                                │
                         │                                        │
                         ▼                                        │
                 ┌───────────────┐                                │
                 │ AI_REPLYING   │◀── 每800ms窗口               │
                 │ inferExpression│     匹配表情                   │
                 │  动态切换      │                               │
                 └───────┬───────┘                               │
                         │                                        │
                  AI流结束                                         │
                         │                                        │
                         ▼                                        │
                 ┌───────────────┐                                │
                 │    HOLD       │  保持最后表情                    │
                 │   6秒后 ──────┼──────────▶ IDLE               │
                 └───────────────┘                                │
```

### 4.2 状态切换规则

| 当前状态 | 触发事件 | 目标状态 | 优先级 |
|----------|----------|----------|--------|
| IDLE | `chatInput.text.length > 0` | USER_TYPING | 高 |
| USER_TYPING | `chatInput.text.length === 0` | IDLE | 高 |
| USER_TYPING | `用户点击发送` | AI_PROCESSING | 最高 |
| AI_PROCESSING | `首个有效文本chunk` (fullText ≥ 8) | AI_REPLYING | 高 |
| AI_REPLYING | `inferExpression 变化` | AI_REPLYING (切换子表情) | 中 |
| AI_REPLYING | `流结束` | HOLD | 高 |
| HOLD | `6秒超时` | IDLE | 低 |
| 任意状态 | `新消息发送` | AI_PROCESSING | 最高 |

---

## 5. 时序参数设计

### 5.1 参数总表

```typescript
// 建议新增到 types/index.ts
export const EXPRESSION_TIMING = {
  /** inferExpression 防抖窗口间隔 (ms) */
  INFER_DEBOUNCE_MS: 800,

  /** inferExpression 启动所需的最小文本长度（中文字符） */
  MIN_TEXT_LENGTH: 8,

  /** AI处理阶段 thinking 表情的最小保持时间 (ms) */
  AI_PROCESSING_MIN_MS: 1200,

  /** AI回复结束后，表情保持时间后再回归 idle (ms) */
  HOLD_DURATION_MS: 6000,

  /** 用户停止输入后，回归 idle 的延迟 (ms) */
  USER_TYPING_IDLE_MS: 2000,

  /** 两次身体动作播放之间的最小间隔 (ms) */
  MOTION_MIN_INTERVAL_MS: 1500,

  /** 同一情绪连续匹配时不重复触发的间隔 (ms) */
  SAME_EXPRESSION_COOLDOWN_MS: 3000,
} as const;
```

### 5.2 时序说明

| 参数 | 值 | 理由 |
|------|-----|------|
| `INFER_DEBOUNCE_MS` | 800ms | AI 返回一个有效句子约 500-1000ms，800ms 窗口避免每 chunk（~30ms）抖动 |
| `MIN_TEXT_LENGTH` | 8 | 少于 8 字符的文本不具语义分析价值，避免空文本或无意义片段匹配 |
| `AI_PROCESSING_MIN_MS` | 1200ms | 覆盖 API 冷启动延迟，保证 thinking 表情至少播放 1.2 秒 |
| `HOLD_DURATION_MS` | 6000ms | AI 回复完成后保持最后表情 6 秒，让用户看清情绪后再回归平静 |
| `USER_TYPING_IDLE_MS` | 2000ms | 用户暂停输入 2 秒后回 idle，避免思考中频繁切换 |
| `MOTION_MIN_INTERVAL_MS` | 1500ms | 两次 Live2D motion 调用最小间隔，防止运动状态机冲突 |
| `SAME_EXPRESSION_COOLDOWN_MS` | 3000ms | 同一情绪 3 秒内不重播，避免 `happy→happy` 重复触发 |

---

## 6. 崩溃风险与保护措施

### 6.1 风险清单

| 编号 | 风险 | 严重度 | 触发条件 | 后果 |
|------|------|--------|----------|------|
| R1 | **高频 expression 调用** | 🔴 严重 | 流式每 chunk (~30ms) 都调 expression() | Live2D 表情混合计算过载，帧率暴跌 |
| R2 | **Motion 中断重播** | 🔴 严重 | 上一个 motion 未播完就切新 motion | 模型参数错乱，渲染异常 |
| R3 | **卸载后调用模型** | 🟡 中等 | 组件销毁后 timer 仍触发 motion/expression | 控制台报错，白屏 |
| R4 | **同情绪重复触发** | 🟡 中等 | `happy → happy` 重复调用 motion | 动作抖动，体验差 |
| R5 | **Timer 内存泄漏** | 🟢 轻微 | debounce/hold timer 未清理 | 内存泄漏累积 |

### 6.2 保护措施

#### 保护 P1: 模型生存检查（最关键）

**所有对 model 的调用前必须检查：**

```typescript
function isModelSafe(model: Live2DModel | null): model is Live2DModel {
  if (!model) return false;
  // pixi-live2d-display 内部会标记 destroyed
  try { return !(model as any).destroyed; } catch { return false; }
}
```

#### 保护 P2: Motion 间隔离

```typescript
let lastMotionKey = '';
let lastMotionTime = 0;

function tryPlayMotion(model: Live2DModel, key: string, group: string, index: number): void {
  if (!isModelSafe(model)) return;
  if (key === lastMotionKey && Date.now() - lastMotionTime < EXPRESSION_TIMING.SAME_EXPRESSION_COOLDOWN_MS) return;
  if (Date.now() - lastMotionTime < EXPRESSION_TIMING.MOTION_MIN_INTERVAL_MS) return;

  lastMotionKey = key;
  lastMotionTime = Date.now();
  model.motion(group, index);
}
```

#### 保护 P3: Timer 生命周期

```typescript
// 在 useEffect 中管理所有 timer
useEffect(() => {
  const timers: number[] = [];
  const safeSetTimeout = (fn: () => void, ms: number) => {
    const id = window.setTimeout(fn, ms);
    timers.push(id);
    return id;
  };
  return () => timers.forEach(clearTimeout);
}, [/* deps */]);
```

#### 保护 P4: 防抖窗口

```typescript
// chatStore 流式循环中
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let lastEmittedExpression = 'thinking';

for await (const chunk of stream) {
  fullText += chunk.text;

  if (fullText.length < EXPRESSION_TIMING.MIN_TEXT_LENGTH) continue;
  if (debounceTimer !== null) continue; // 仍在防抖窗口内

  const newExpr = inferExpression(fullText);
  if (newExpr !== lastEmittedExpression) {
    set(s => ({ ...s, currentExpression: newExpr as ExpressionType }));
    lastEmittedExpression = newExpr;
  }

  debounceTimer = setTimeout(() => { debounceTimer = null; }, EXPRESSION_TIMING.INFER_DEBOUNCE_MS);
}
```

---

## 7. 实施计划 — 文件修改清单

### 7.1 修改文件总览

| 文件 | 操作 | 改动规模 | 说明 |
|------|------|----------|------|
| `src/types/index.ts` | **扩展** | +15行 | 新增 `EXPRESSION_TIMING` 常量配置 |
| `src/components/Live2D/Live2DViewer.tsx` | **增强** | +55行 | 新增 emotion→motion useEffect（**不修改渲染代码**） |
| `src/store/chatStore.ts` | **增强** | +20行 | 添加防抖逻辑、HOLD→IDLE 回归 timer |
| `src/services/ai.ts` | **增强** | +10行 | `streamChat` 增加最小文本长度判断 |
| `src/components/chat/ChatInput.tsx` | **增强** | +10行 | 新增 `onTypingChange` 回调 |
| `src/components/chat/ChatWindow.tsx` | **增强** | +5行 | 透传 `onTypingChange` |
| `src/App.tsx` | **不变** | 0 | 已正确透传 `expression` prop |
| `src/data/expressions.ts` | **不变** | 0 | 配置类已完备 |
| `src/hooks/useLive2D.ts` | **不动** | 0 | 保留但继续不使用 |

### 7.2 不变的文件

以下文件**完全不变**，保证渲染稳定性：

- `Live2DViewer.tsx` 中的 **PIXI 初始化逻辑**（第 31-147 行）
- `Live2DViewer.tsx` 中的 **canvas 渲染代码**（第 162-183 行）
- `model.json` 及所有 `.mtn` 动作文件
- `characters.ts` / `expressions.ts` / `settingsStore.ts`

---

## 8. 修改详情

### 8.1 `src/types/index.ts` — 新增时序常量

在文件末尾新增：

```typescript
// ===== 表情动作时序配置 =====
export const EXPRESSION_TIMING = {
  /** inferExpression 防抖窗口间隔 (ms) */
  INFER_DEBOUNCE_MS: 800,
  /** inferExpression 启动所需的最小文本长度 */
  MIN_TEXT_LENGTH: 8,
  /** AI处理阶段 thinking 表情的最小保持时间 (ms) */
  AI_PROCESSING_MIN_MS: 1200,
  /** AI回复结束后，表情保持时间 (ms) */
  HOLD_DURATION_MS: 6000,
  /** 用户停止输入后，回归 idle 的延迟 (ms) */
  USER_TYPING_IDLE_MS: 2000,
  /** 两次身体动作之间的最小间隔 (ms) */
  MOTION_MIN_INTERVAL_MS: 1500,
  /** 同一情绪不重复触发的冷却时间 (ms) */
  SAME_EXPRESSION_COOLDOWN_MS: 3000,
} as const;
```

### 8.2 `src/components/Live2D/Live2DViewer.tsx` — 新增情绪驱动层

**原则：在现有文件末尾新增代码，不修改第 1-147 行（初始化）和第 162-183 行（JSX）。**

在第 160 行 cleanup effect 之后、第 162 行 return 之前，插入以下代码：

```typescript
  // ===== 新增：情绪→表情+动作驱动层 =====
  const lastExprRef = useRef<ExpressionType>('neutral');
  const lastMotionTimeRef = useRef(0);
  const lastMotionKeyRef = useRef('');

  // 情绪→面部表情ID映射
  const EXPRESSION_IDS: Record<ExpressionType, string> = {
    neutral: 'f00', happy: 'f01', sad: 'f02', surprised: 'f03',
    shy: 'f04', angry: 'f05', relaxed: 'f06', thinking: 'f07',
  };

  // 情绪→动作映射（group, index基于model.json）
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

  // 安全地调用模型方法
  const callModelSafely = useCallback((fn: (model: Live2DModel) => void) => {
    const model = modelRef.current;
    if (!model) return;
    try {
      if ((model as any).destroyed) return;
      fn(model);
    } catch (e) {
      // 静默忽略卸载后的调用
    }
  }, []);

  // 监听 expression 变化，驱动模型
  useEffect(() => {
    if (isLoading || error) return; // 模型未就绪，跳过

    // 同一表情不重复触发（去重）
    if (expression === lastExprRef.current) return;
    lastExprRef.current = expression;

    callModelSafely((model) => {
      // 1. 切换面部表情
      const exprId = EXPRESSION_IDS[expression] || 'f00';
      try { (model as any).expression?.(exprId); } catch {}

      // 2. 播放身体动作（带间隔保护）
      const motion = EMOTION_MOTIONS[expression];
      if (!motion) return;

      const now = Date.now();
      const sameMotion = motion.group + motion.index === lastMotionKeyRef.current;
      const tooSoon = now - lastMotionTimeRef.current < 1500;

      if (!sameMotion || now - lastMotionTimeRef.current >= 3000) {
        if (!tooSoon) {
          lastMotionKeyRef.current = motion.group + motion.index;
          lastMotionTimeRef.current = now;
          try { model.motion(motion.group, motion.index); } catch {}
        }
      }
    });
  }, [expression, isLoading, error, callModelSafely]);

  // 应用启动时播放 login 登场动画
  useEffect(() => {
    if (isLoading || error) return;
    const timer = setTimeout(() => {
      callModelSafely((model) => {
        try { model.motion('', 0); } catch {} // login.mtn
      });
    }, 600);
    return () => clearTimeout(timer);
  }, [isLoading, error, callModelSafely]);
```

**不修改的部分（保持原样）：**
- 第 1-30 行：imports + props 接口
- 第 31-147 行：`init()` PIXI 初始化函数
- 第 149-152 行：初始化触发 useEffect
- 第 154-160 行：组件卸载 cleanup
- 第 162-183 行：JSX 渲染树

### 8.3 `src/store/chatStore.ts` — 防抖 + HOLD ↔ IDLE 回归

修改 `sendMessage` 方法，增加以下逻辑：

**修改点 1：发送时先设 thinking**

在 `sendMessage` 开头、`addMessage('user', content)` 之后插入：

```typescript
// 发送消息时立即进入 thinking 状态
set({ currentExpression: 'thinking' as ExpressionType });
```

**修改点 2：流式循环中添加防抖**

将第 66-78 行（AI模式）和第 82-94 行（离线模式）的 for await 循环，改为带防抖的版本：

```typescript
// 防抖变量（在 for await 之前声明）
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let lastEmittedExpression = 'thinking';
let fullText = ''; // 累积文本用于阈值判断

for await (const chunk of stream) {
  fullText += chunk.text;

  // 先更新 UI 文本（不阻塞）
  set((s) => {
    const msgs = [...s.messages];
    const lastMsg = msgs[msgs.length - 1];
    if (lastMsg && lastMsg.id === aiMsgId) {
      lastMsg.content += chunk.text;
      lastMsg.isTyping = false;
    }
    return { messages: msgs };
  });

  // 文本不足阈值，跳过表情判断
  if (fullText.length < 8) continue;
  // 仍在防抖窗口内，跳过
  if (debounceTimer !== null) continue;

  // 评估情绪
  const newExpr = chunk.expression; // AI模式已包含 inferExpression 结果
  if (newExpr !== lastEmittedExpression) {
    lastEmittedExpression = newExpr;
    set((s) => {
      const msgs = [...s.messages];
      const lastMsg = msgs[msgs.length - 1];
      if (lastMsg && lastMsg.id === aiMsgId) {
        lastMsg.expression = newExpr;
      }
      return { messages: msgs, currentExpression: newExpr as ExpressionType };
    });
  }

  debounceTimer = setTimeout(() => { debounceTimer = null; }, 800);
}
```

**修改点 3：流结束后的 HOLD → IDLE 回归**

在第 97 行 `set(s => ({ isStreaming: false, ... }))` 之后插入：

```typescript
// 清除旧的回归 timer
if (holdTimerRef.current) clearTimeout(holdTimerRef.current);

// 6秒后回归 idle
holdTimerRef.current = window.setTimeout(() => {
  set({ currentExpression: 'neutral' as ExpressionType });
}, 6000);
```

在 store 文件顶部（模块级）声明：

```typescript
let holdTimerRef: number | null = null;
```

同时在 `sendMessage` **开头**清除旧的 hold timer：

```typescript
if (holdTimerRef.current) { clearTimeout(holdTimerRef.current); holdTimerRef.current = null; }
```

### 8.4 `src/services/ai.ts` — 增加推理阈值

修改 `streamChat` 函数，第 159 行改为仅在文本足够长时才做情绪推断：

```typescript
// 修改前（第159行）:
yield { text: content, expression: inferExpression(fullText) };

// 修改后:
const expr = fullText.length >= 8 ? inferExpression(fullText) : 'thinking';
yield { text: content, expression: expr };
```

`simulateChat` 函数不变，因为离线模式在每个 yield 中 expression 是固定的。

### 8.5 `src/components/chat/ChatInput.tsx` — 新增输入状态通知

**新增 prop：**

```typescript
interface ChatInputProps {
  onSend: (text: string) => void;
  disabled?: boolean;
  onTypingChange?: (isTyping: boolean) => void;  // 新增
}
```

**新增 useEffect（在第 19 行 `}, [text]);` 之后）：**

```typescript
  // 通知父组件输入状态
  const prevHasText = useRef(false);
  useEffect(() => {
    const hasText = text.trim().length > 0;
    if (hasText !== prevHasText.current) {
      prevHasText.current = hasText;
      onTypingChange?.(hasText);
    }
  }, [text, onTypingChange]);
```

需要新增 import：`useRef` 已存在，无需额外 import。

### 8.6 `src/components/chat/ChatWindow.tsx` — 透传输入状态

**修改点：第 10 行增加 store 解构，第 88 行 ChatInput 增加 prop**

```typescript
// 第10行修改为:
const { messages, isStreaming, sendMessage, setExpression } = useChatStore();

// 新增回调函数:
const handleTypingChange = (isTyping: boolean) => {
  if (isTyping) {
    setExpression('thinking');
  } else if (!isStreaming && messages.length === 0) {
    // 输入框清空且无历史 → 回 idle
    setExpression('neutral');
  }
};

// 第88行 ChatInput 增加 prop:
<ChatInput
  onSend={sendMessage}
  disabled={isStreaming}
  onTypingChange={handleTypingChange}
/>
```

---

## 附录 A: 修改文件清单（汇总）

| # | 文件路径 | 操作类型 | 新增行数 |
|---|----------|----------|----------|
| 1 | `src/types/index.ts` | 扩展 | +15 |
| 2 | `src/components/Live2D/Live2DViewer.tsx` | 增强（不改渲染核心） | +55 |
| 3 | `src/store/chatStore.ts` | 增强 | +20 |
| 4 | `src/services/ai.ts` | 增强 | +2 |
| 5 | `src/components/chat/ChatInput.tsx` | 增强 | +10 |
| 6 | `src/components/chat/ChatWindow.tsx` | 增强 | +8 |

**总计新增：约 110 行**

**完全不变的文件：**
- `Live2DViewer.tsx` 第 31-147 行（PIXI 初始化）
- `Live2DViewer.tsx` 第 162-183 行（JSX渲染树）
- `App.tsx`
- `useLive2D.ts`（保留不使用）
- `expressions.ts`
- `characters.ts`
- `settingsStore.ts`
- 所有 `public/models/` 下的资源文件

---

## 附录 B: 后续可调参数

以下参数标注为 `[待实测]`，需根据实际运行效果微调：

| 参数 | 当前值 | 调整方向 |
|------|--------|----------|
| 防抖窗口 | 800ms | 过快切换→增大；反应迟钝→减小 |
| HOLD 保持时间 | 6000ms | 表情太短→增大；等待太久→减小 |
| Motion 最小间隔 | 1500ms | 动作冲突→增大；动作太少→减小 |
| 文本启动阈值 | 8字符 | 过早触发→增大；反应太慢→减小 |
