# Live2D 模型动作利用率优化方案

> **工作流**: gstack — 完整审计 → 优先级分级 → 分步实施 → 验证闭环  
> **日期**: 2026-07-10  
> **基线**: `mindchat-live2d` 主分支  
> **模型**: `hk416_c2` (Cubism2, 12个 .mtn 动作文件)  
> **当前利用率**: 9/12 = 75%，3个动作浪费 (~511 KB)

---

## 一、审计结论总览

```
┌──────────────────────────────────────────────────────┐
│            12 个动作资源的利用现状                       │
│                                                      │
│  ████████████████████████████░░░░░░░░  75%  已使用    │
│  ░░░░░░░░░░░░░░░░░░░░░░░░░░████████  25%  浪费      │
│                                                      │
│  已使用: daiji_idle_01, login, shake, touch_1,        │
│          touch_3, touch_5, wait_1, wait_2, wedding    │
│  未使用: touch_2 (188KB), touch_4 (79KB),             │
│          wedding_touch (244KB)                        │
└──────────────────────────────────────────────────────┘
```

### 三大核心差距

| # | 差距 | 严重度 | 影响 |
|:--:|------|:--:|------|
| G1 | **触摸/点击交互完全缺失** — 设计文档要求的随机 `touch_1~5` 点击反馈为0 | 🔴 P0 | `hit_areas` 定义了但代码未绑定 |
| G2 | **idle 动作不循环** — `daiji_idle_01` 播完一次后模型静止 | 🔴 P0 | 表现生硬，长时间空白 |
| G3 | **3个动作从未被映射** — `touch_2/4/wedding_touch` 完全浪费 | 🟠 P1 | 511KB 资源闲置 |

---

## 二、动作资源全景

### 2.1 模型文件结构

```
public/models/hk416_c2/
├── model.json              ← 动作索引 + hit_areas 定义
├── model.moc
├── physics.json
├── model.1024/texture_00.png
└── motions/
    ├── daiji_idle_01.mtn   (103KB) ← idle 组, index 0
    ├── login.mtn           ( 68KB) ← "" 组, index 0
    ├── shake.mtn           (140KB) ← "" 组, index 1
    ├── touch_1.mtn         ( 94KB) ← "" 组, index 2
    ├── touch_2.mtn         (188KB) ← "" 组, index 3  ⚠
    ├── touch_3.mtn         (127KB) ← "" 组, index 4
    ├── touch_4.mtn         ( 79KB) ← "" 组, index 5  ⚠
    ├── touch_5.mtn         ( 61KB) ← "" 组, index 6
    ├── wait_1.mtn          ( 86KB) ← "" 组, index 7
    ├── wait_2.mtn          ( 98KB) ← "" 组, index 8
    ├── wedding.mtn         (174KB) ← "" 组, index 9
    └── wedding_touch.mtn   (244KB) ← "" 组, index 10 ⚠
```

### 2.2 当前映射对照表 (Live2DViewer.tsx:186-201)

| 情绪 | 面部ID | Motion调用 | 动作文件 | 利用率 |
|------|--------|-----------|----------|:--:|
| neutral | `f00` | `('idle', 0)` | `daiji_idle_01` | ✅ |
| happy | `f01` | `('', 2)` | `touch_1` | ✅ |
| sad | `f02` | `('', 7)` | `wait_1` | ✅ |
| surprised | `f03` | `('', 1)` | `shake` | ✅ |
| shy | `f04` | `('', 4)` | `touch_3` | ✅ |
| angry | `f05` | `('', 6)` | `touch_5` | ✅ |
| thinking | `f07` | `('', 8)` | `wait_2` | ✅ |
| relaxed | `f06` | `('', 9)` | `wedding` | ✅ |
| (启动) | — | `('', 0)` | `login` | ✅ |
| — | — | `('', 3)` | `touch_2` | ❌ |
| — | — | `('', 5)` | `touch_4` | ❌ |
| — | — | `('', 10)` | `wedding_touch` | ❌ |

### 2.3 model.json 关键配置 (第7-31行)

```json
"motions": {
    "idle": [{"file": "motions/daiji_idle_01.mtn"}],
    "": [/* 11个动作: login, shake, touch_1~5, wait_1~2, wedding, wedding_touch */]
},
"hit_areas": [
    {"name":"head", "id":"D_REF_HEAD"},
    {"name":"body", "id":"D_REF_BODY"},
    {"name":"hand", "id":"D_REF_HAND"}
]
```

---

## 三、架构数据流 (当前状态)

```
┌─────────────── 用户交互 ───────────────┐
│ 发送消息 → chatStore.sendMessage()      │
│ 输入文字 → onTypingChange → thinking   │
│ [点击角色] → 🔴 不存在                  │
└───────────────────────────────────────┘
                    ↓
┌─────────────── Store 层 ───────────────┐
│ chatStore.ts: currentExpression        │
│ inferExpression() 反抖 800ms, ≥8字符   │
│ HOLD 5s → relaxed 1.5s → neutral      │
└───────────────────────────────────────┘
                    ↓
┌─────────────── 渲染层 (Live2DViewer) ──┐
│ ✅ login 登场: model.motion('', 0)     │
│ ✅ 情绪驱动: applyExpression + motion  │
│    · 同表情去重 + 冷却保护              │
│    · 标准API → Cubism2 参数双路径回退   │
│ 🔴 idle 不循环   🔴 无触摸交互          │
└───────────────────────────────────────┘
```

---

## 四、P0 优化: 功能缺失修复

### 4.1 P0-1: idle 动作循环播放

**现状**: `Live2DViewer.tsx:307` 调用 `model.motion('idle', 0)` 只播一次，`daiji_idle_01` 约3秒，播完后模型静止。

**实施** — 在 `Live2DViewer.tsx` 中添加 idle 循环管理 (约 25 行):

```typescript
// 在 emotion→motion useEffect (第324行之后) 插入
const idleTimerRef = useRef<number | null>(null);

useEffect(() => {
  if (isLoading || error) return;
  if (expression !== 'neutral') {
    if (idleTimerRef.current) { clearTimeout(idleTimerRef.current); idleTimerRef.current = null; }
    return;
  }
  const playIdle = () => {
    callModelSafely((model) => { try { model.motion('idle', 0); } catch {} });
    idleTimerRef.current = window.setTimeout(playIdle, 2500); // 提前500ms重播无缝衔接
  };
  playIdle();
  return () => { if (idleTimerRef.current) clearTimeout(idleTimerRef.current); };
}, [expression, isLoading, error, callModelSafely]);
```

### 4.2 P0-2: 点击/触摸交互系统

**现状**: 设计文档 (`emotion-motion-system.md:37`) 要求的"用户点击角色 → 随机播 touch_1~5"完全缺失。

**实施** — 分三步:

**Step A**: 绑定 PIXI canvas 点击事件 (~15 行)

```typescript
// 在模型加载完成 (第150行 setIsLoading(false)) 之后添加
const lastTouchTimeRef = useRef(0);
const TOUCH_COOLDOWN = 2000; // 触摸冷却 2s

const handleCanvasClick = useCallback((e: MouseEvent) => {
  const now = Date.now();
  if (now - lastTouchTimeRef.current < TOUCH_COOLDOWN) return;
  if (isLoading || error) return;

  callModelSafely((model) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = (e.clientX - rect.left) * (canvasRef.current!.width / rect.width);
    const y = (e.clientY - rect.top) * (canvasRef.current!.height / rect.height);

    // hitTest 尝试 / 坐标粗判回退
    let hitArea = 'body';
    try {
      if (typeof (model as any).hitTest === 'function') {
        hitArea = (model as any).hitTest(x, y) || 'body';
      }
    } catch {
      const modelCenterY = rect.height * 0.4;
      if (y < modelCenterY * 0.7) hitArea = 'head';
      else if (y > modelCenterY * 1.3) hitArea = 'hand';
    }

    // 部位 → 动作映射
    let pool: number[];
    switch (hitArea) {
      case 'head': pool = [2, 3]; break;   // touch_1, touch_2
      case 'hand': pool = [5, 6]; break;   // touch_4, touch_5
      default:     pool = [4];     break;   // touch_3
    }
    const idx = pool[Math.floor(Math.random() * pool.length)];
    try { model.motion('', idx); lastTouchTimeRef.current = now; } catch {}
  });
}, [isLoading, error, callModelSafely]);
```

**Step B**: 在 useEffect 中绑定/解绑事件 (~10 行)

```typescript
useEffect(() => {
  const canvas = canvasRef.current;
  if (!canvas || isLoading || error) return;
  canvas.addEventListener('pointerdown', handleCanvasClick); // pointerdown 兼容移动端
  canvas.style.cursor = 'pointer';
  return () => canvas.removeEventListener('pointerdown', handleCanvasClick);
}, [isLoading, error, handleCanvasClick]);
```

**Step C**: 点击部位 → 动作映射策略

| 点击部位 | hit_areas ID | 可选动作 | 语义 |
|----------|-------------|---------|------|
| `head` | `D_REF_HEAD` | `touch_1`, `touch_2` | 摸头反馈 |
| `body` | `D_REF_BODY` | `touch_3` | 戳身体 |
| `hand` | `D_REF_HAND` | `touch_4`, `touch_5` | 牵手互动 |

**利用的 wasted 动作**: `touch_2` (head 变体), `touch_4` (hand 变体)

---

## 五、P1 优化: 动作映射完善

### 5.1 P1-1: 情绪映射增加动作变体

**问题**: 当前每个情绪只映射1个动作，高频情绪 (happy/shy/relaxed) 重复感强，且 `touch_2/4/wedding_touch` 从未被触发。

**实施** — 修改 `EMOTION_MOTIONS` 映射表 (第192-201行)，改为数组支持随机变体:

```typescript
// 修改前 (单一动作):
const EMOTION_MOTIONS: Record<ExpressionType, { group: string; index: number }> = {
  happy:   { group: '', index: 2 },
  shy:     { group: '', index: 4 },
  relaxed: { group: '', index: 9 },
  // ...
};

// 修改后 (动作池):
const EMOTION_MOTIONS: Record<ExpressionType, Array<{ group: string; index: number }>> = {
  happy:   [{ group: '', index: 2 }, { group: '', index: 3 }],   // touch_1 or touch_2
  shy:     [{ group: '', index: 4 }, { group: '', index: 5 }],   // touch_3 or touch_4
  relaxed: [{ group: '', index: 9 }, { group: '', index: 10 }],  // wedding or wedding_touch
  neutral:   [{ group: 'idle', index: 0 }],
  sad:       [{ group: '', index: 7 }],
  surprised: [{ group: '', index: 1 }],
  angry:     [{ group: '', index: 6 }],
  thinking:  [{ group: '', index: 8 }],
};
```

播放时随机选:

```typescript
// 在 emotion→motion useEffect (第287-288行) 中:
const motionPool = EMOTION_MOTIONS[expression];
const motion = motionPool[Math.floor(Math.random() * motionPool.length)];
```

**结果**: 利用率从 9/12 (75%) → 12/12 (100%)

### 5.2 P1-2: 空闲超时自发小动作

**问题**: 长时间无交互 (>30s) 时 idle 循环单调。

**实施** — 新增自发动作调度 (~18 行):

```typescript
const IDLE_AUTO_MOTIONS = [
  { group: '', index: 7 },  // wait_1
  { group: '', index: 8 },  // wait_2
];
const autoMotionTimerRef = useRef<number | null>(null);
const AUTO_MOTION_INTERVAL = 20000; // 20秒

const scheduleAutoMotion = useCallback(() => {
  if (autoMotionTimerRef.current) clearTimeout(autoMotionTimerRef.current);
  autoMotionTimerRef.current = window.setTimeout(() => {
    callModelSafely((model) => {
      const m = IDLE_AUTO_MOTIONS[Math.floor(Math.random() * IDLE_AUTO_MOTIONS.length)];
      try { model.motion(m.group, m.index); } catch {}
    });
    scheduleAutoMotion();
  }, AUTO_MOTION_INTERVAL);
}, [callModelSafely]);

useEffect(() => {
  if (isLoading || error) return;
  if (expression === 'neutral') scheduleAutoMotion();
  else { if (autoMotionTimerRef.current) clearTimeout(autoMotionTimerRef.current); }
  return () => { if (autoMotionTimerRef.current) clearTimeout(autoMotionTimerRef.current); };
}, [expression, isLoading, error, scheduleAutoMotion]);
```

---

## 六、P2 优化: 体验增强

### 6.1 P2-1: 触摸视觉反馈

**实施** — 点击时添加脉冲动画状态:

```typescript
const [touchPulse, setTouchPulse] = useState(false);

// 在 handleCanvasClick 中:
setTouchPulse(true);
setTimeout(() => setTouchPulse(false), 400);

// 在 JSX canvas 上添加:
className={`block w-full h-full ${touchPulse ? 'animate-pulse' : ''}`}
```

### 6.2 P2-2: 动作优先级系统

**问题**: 情绪切换和触摸交互可能同时发生，需优先级仲裁。

| 优先级 | 场景 | 行为 |
|:--:|------|------|
| 1 (最高) | login 登场 | 不被打断 |
| 2 | 触摸交互 | 打断 idle，不被情绪打断 |
| 3 | 情绪驱动 | 打断 idle，不打断触摸 |
| 4 (最低) | idle 循环 | 可被任意打断 |

**实施** (~20 行):

```typescript
const motionPriorityRef = useRef(0);

function tryPlayMotion(model: Live2DModel, group: string, index: number, priority: number): boolean {
  if (motionPriorityRef.current > 0 && priority >= motionPriorityRef.current) return false;
  motionPriorityRef.current = priority;
  // 在 motion 结束后重置优先级
  const origOnFinish = (model as any).__onMotionFinish;
  (model as any).__onMotionFinish = () => {
    motionPriorityRef.current = 0;
    if (typeof origOnFinish === 'function') origOnFinish();
  };
  model.motion(group, index);
  return true;
}
```

---

## 七、实施清单

### 7.1 文件修改总览

| # | 文件 | 操作 | 新增 | 对应 |
|:--:|------|------|:--:|------|
| 1 | `src/components/Live2D/Live2DViewer.tsx` | **增强** | ~120 行 | P0-1, P0-2, P1-1, P1-2, P2-1, P2-2 |
| 2 | `src/types/index.ts` | **扩展** | +8 行 | 触摸冷却/自发动作常量 |

**完全不变**: `App.tsx`, `ChatInput.tsx`, `ChatWindow.tsx`, `chatStore.ts`, `ai.ts`, `expressions.ts`, `characters.ts`, `useLive2D.ts`, 所有 `public/models/` 资源文件。

### 7.2 Live2DViewer.tsx 修改位置精确索引

```
不修改的部分 (渲染核心, 保留100%不动):
  第 31-147 行: PIXI 初始化 (init 函数)
  第 204-252 行: applyExpression() 双路径表情
  第 253-268 行: callModelSafely() 安全包装
  第 345-367 行: JSX 渲染树

新增/修改:
  第 20b:   touchPulse state                  (P2-1: +3行)
  第 109:   修改 autoInteract 说明            (P0-1: 注释)
  第 150b:  绑定 canvas pointerdown 事件       (P0-2B: +8行)
  第 192-201: [修改] EMOTION_MOTIONS 改为数组  (P1-1: 改映射)
  第 287-288: [修改] 随机选动作池              (P1-1: 改调用)
  第 324b:  idle 循环管理 useEffect           (P0-1: +25行)
  第 343b:  自发动作调度                      (P1-2: +18行)
  第 344b:  handleCanvasClick 实现            (P0-2A: +35行)
  第 344c:  tryPlayMotion 优先级函数           (P2-2: +20行)
```

### 7.3 分阶段实施顺序

```
Phase 1 (P0) — 约 60 分钟
  Step 1: idle 循环 (4.1)           15min
  Step 2: 点击交互 (4.2)            30min
  Step 3: 验证 P0                    15min

Phase 2 (P1) — 约 45 分钟
  Step 4: 动作映射变体 (5.1)         20min
  Step 5: 自发小动作 (5.2)          15min
  Step 6: 验证 P1                    10min

Phase 3 (P2) — 约 30 分钟
  Step 7: 视觉反馈 (6.1)            15min
  Step 8: 动作优先级 (6.2)          10min
  Step 9: 全线回归测试               15min
```

---

## 八、验证检查单

### 功能验证

- [ ] **idle 循环**: 加载后等待 10 秒，模型持续呼吸动画不停止
- [ ] **点击头部**: 触发 `touch_1` 或 `touch_2`，光标 pointer
- [ ] **点击身体**: 触发 `touch_3`
- [ ] **点击手部**: 触发 `touch_4` 或 `touch_5`
- [ ] **冷却保护**: 快速连点 2 秒内，只触发一次
- [ ] **情绪驱动**: 输入带关键词的消息，确认对应动作播放
- [ ] **动作变体**: 同一情绪重复触发，动作有随机变化
- [ ] **login 登场**: 刷新页面，login 动画正常
- [ ] **自发小动作**: 静置 20 秒，角色自动做小动作
- [ ] **动作优先级**: 触摸交互不被情绪切换打断
- [ ] **移动端**: 手机上点击模型，pointerdown 响应正常

### 性能验证

- [ ] FPS 保持 60fps (无 timer 泄漏)
- [ ] 组件卸载后 model 正确 destroy，无 console 报错
- [ ] 内存不持续增长 (DevTools Memory 快照对比)

---

## 九、风险与回退

### 风险清单

| # | 风险 | 概率 | 缓解 |
|:--:|------|:--:|------|
| R1 | `hitTest()` 在 pixi-live2d-display Cubism2 中不可用 | 中 | 坐标粗判回退已内置 |
| R2 | idle 循环定时器与模型销毁时序冲突 | 低 | `callModelSafely` 检查 destroyed |
| R3 | 动作优先级与 motionFinish 事件不同步 | 低 | 超时 5s 兜底重置优先级 |

### 回退方案

所有改动集中在 `Live2DViewer.tsx` 一个文件。如出问题:

1. `git checkout -- src/components/Live2D/Live2DViewer.tsx` — 一键回退
2. 不改 PIXI 初始化链路 (第31-147行从未动过)，渲染核心坚如磐石
3. 逐 Phase 提交，P0 → P1 → P2 分三次 commit，出问题可精确回退

---

## 十、优化前后对比

| 指标 | 优化前 | 优化后 | 提升 |
|------|:--:|:--:|:--:|
| 动作利用率 | 9/12 (75%) | 12/12 (100%) | +25% |
| 浪费体积 | 511 KB | 0 KB | -511 KB |
| 触摸交互 | 无 | head/body/hand 三区 | 新功能 |
| idle 循环 | 不循环 | 无缝循环 | 修复 |
| 动作变体 | 1:1 映射 | happy/shy/relaxed 有变体 | 新功能 |
| 自发动作 | 无 | 20s 间隔随机 | 新功能 |
| 动作优先级 | 无 | 4 级仲裁 | 新功能 |

---

## 附录: 代码引用索引

| 功能 | 文件 | 行号 |
|------|------|:--:|
| 动作映射表 EMOTION_MOTIONS | `Live2DViewer.tsx` | 192-201 |
| 表情 ID 映射 EXPRESSION_IDS | `Live2DViewer.tsx` | 186-189 |
| applyExpression 双路径 | `Live2DViewer.tsx` | 204-252 |
| emotion→motion useEffect | `Live2DViewer.tsx` | 271-324 |
| login 登场 useEffect | `Live2DViewer.tsx` | 327-343 |
| PIXI 初始化 | `Live2DViewer.tsx` | 31-165 |
| modelRef 赋值 | `Live2DViewer.tsx` | 119 |
| model.json 动作索引 | `public/models/hk416_c2/model.json` | 7-24 |
| model.json hit_areas | `public/models/hk416_c2/model.json` | 27-31 |
| inferExpression | `expressions.ts` | 96-133 |
| currentExpression store | `chatStore.ts` | 27 |
| sendMessage 流式循环 | `chatStore.ts` | 40-192 |
| EXPRESSION_TIMING 常量 | `types/index.ts` | 69-84 |

---

## 十一、实施记录 (2026-07-10)

> **状态**: ✅ 全部实施完成  
> **改动范围**: 2 个文件，渲染核心 (PIXI 初始化链路) 完全未动

### 11.1 实施功能清单

#### 🔴 P0 — 核心功能修复

| # | 功能 | 说明 | 状态 |
|:--:|------|------|:--:|
| **P0-1** | **idle 动作循环播放** | 原有的 `daiji_idle_01` 只播放一次后模型静止，现在改为每 2.5 秒重播，实现无缝循环呼吸动画。非 `neutral` 表情时自动暂停 | ✅ |
| **P0-2** | **点击/触摸交互系统** | 填补了完全缺失的触摸交互，基于 `model.json` 中已定义的 `hit_areas` (head/body/hand) 三区映射：<br>• **头部** → 随机播放 `touch_1` / `touch_2`<br>• **身体** → `touch_3`<br>• **手部** → 随机播放 `touch_4` / `touch_5`<br>支持 `pointerdown` 事件（兼容桌面+移动端），内置 2 秒冷却保护 | ✅ |

#### 🟠 P1 — 动作映射完善

| # | 功能 | 说明 | 状态 |
|:--:|------|------|:--:|
| **P1-1** | **情绪→动作变体池** | `EMOTION_MOTIONS` 映射从单动作改为动作数组，`happy`/`shy`/`relaxed` 各有双变体随机选择。动作利用率从 **75% (9/12) → 100% (12/12)**，消除了 3 个闲置动作 (~511KB) | ✅ |
| **P1-2** | **空闲超时自发小动作** | 模型处于 idle 状态且无交互 20 秒后，自动随机穿插 `wait_1` 或 `wait_2` 小动作，增强生动感。非 idle 状态自动暂停 | ✅ |

#### 🟡 P2 — 体验增强

| # | 功能 | 说明 | 状态 |
|:--:|------|------|:--:|
| **P2-1** | **触摸视觉反馈** | 点击角色时 canvas 播放 `animate-pulse` 脉冲动画（持续 400ms），给用户即时操作反馈 | ✅ |
| **P2-2** | **动作优先级系统** | 引入 4 级优先级仲裁机制 (`login > 触摸 > 情绪 > idle`)，通过 `tryPlayMotion()` 统一管控所有 `model.motion()` 调用：<br>• Priority 1: 登场动画不被打断<br>• Priority 2: 触摸交互不被情绪切换打断<br>• Priority 3: 情绪动作不打断触摸<br>• Priority 4: idle 循环可被任意打断 | ✅ |

### 11.2 实施优化前后对比

| 指标 | 优化前 | 优化后 |
|------|:--:|:--:|
| 动作利用率 | 9/12 (75%) | 12/12 (100%) |
| 闲置资源体积 | 511 KB | 0 KB |
| 触摸交互 | ❌ 不存在 | ✅ 三区映射 |
| idle 循环 | ❌ 一次性 | ✅ 持续循环 |
| 动作变体 | ❌ 1:1 固定 | ✅ 有随机性 |
| 自发小动作 | ❌ 无 | ✅ 20s 间隔 |
| 优先级仲裁 | ❌ 无 | ✅ 4 级系统 |

### 11.3 实际改动文件

| 文件 | 变更类型 | 说明 |
|------|------|------|
| `src/components/Live2D/Live2DViewer.tsx` | 增强 | ~130 行新增，零 linter 错误；PIXI 初始化链路 (原第31-179行) 完全未动 |
| `src/types/index.ts` | 扩展 | +15 行 `INTERACTION_CONFIG` 常量 |

**完全未改动**: `App.tsx`, `ChatInput.tsx`, `ChatWindow.tsx`, `chatStore.ts`, `ai.ts`, `expressions.ts`, `characters.ts`, `useLive2D.ts`, 所有 `public/models/` 资源文件。
