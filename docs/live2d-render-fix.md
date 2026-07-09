# 🛠 Live2D 模型渲染故障修复方案 (Render Fix Plan)

> 版本：v1.0 · 根因定位 + 逐条修复 + 防御加固  
> 错误信息：`模型加载失败 Cannot read properties of undefined (reading 'toString')`

---

## 一、问题总览与修复优先级

| 优先级 | 问题域 | 严重程度 | 预估工时 | 影响面 |
|--------|--------|----------|----------|--------|
| 🔴 P0 | PIXI 渲染器 `backgroundColor = undefined` 触发 toString 崩溃 | 致命 | ~5min | 模型 100% 无法加载 |
| 🟡 P1 | Canvas 父容器尺寸初始化竞态（0 尺寸） | 严重 | ~10min | 启动时偶发白屏 |
| 🟡 P1 | 模型加载无空值保护 | 严重 | ~5min | 异常时无友好降级 |
| 🔵 P2 | Canvas CSS 未做自适应（硬编码 px） | 中等 | ~5min | 窗口缩放时画布错位 |

---

## 二、根因定位

### 🔴 根因 1 — `backgroundColor = undefined` 直接触发 toString 崩溃

**错误链路**：

```
Live2DViewer.tsx:58
  → (app.renderer as any).backgroundColor = undefined
  → PIXI WebGLRenderer 每帧 render() 读取 backgroundColor 做颜色转换
  → 内部调用 backgroundColor.toString(16) 或位运算取 RGBA 通道
  → undefined.toString() → TypeError
```

**问题代码** (`src/components/Live2D/Live2DViewer.tsx` 第 57-58 行)：

```typescript
// 将 canvas 背景设为透明（叠加在场景背景之上）
app.renderer.view.style.backgroundColor = 'transparent';
(app.renderer as any).backgroundColor = undefined;  // ← 致命行
```

**分析**：
- 在干掉卡片容器后，想让 PIXI 画布透明叠加场景背景
- 直接 `= undefined` 覆盖了 PIXI 内部期望的数值类型 `backgroundColor`
- PIXI 的无类型 Guard 不够完善，导致 `undefined.toString()` 报错
- **项目源码中不存在对其他 `.toString()` 的直接调用**，报错 100% 来自第三方库内部

**环境特征**：
- 使用 `pixi-live2d-display` (cubism2 分支)
- PIXI.js Application 实例化后动态修改了 `renderer.backgroundColor`
- Canvas 父容器为 `absolute inset-0`，无固定尺寸

### 🟡 根因 2 — Canvas 容器尺寸初始化竞态

**问题代码** (`Live2DViewer.tsx` 第 29-35 行)：

```typescript
const w = container.clientWidth || window.innerWidth;
const h = container.clientHeight || window.innerHeight;

if (w === 0 || h === 0) {
  setTimeout(init, 200);
  return;
}
```

**分析**：
- 父容器 `<div style="height: '75vh'">` 在 React 首次渲染时，子元素的 `clientWidth/clientHeight` 可能为 0
- `useEffect` 中 300ms 延迟启动 init，但布局计算可能仍未完成
- Fallback 到 `window.innerWidth/innerHeight` 后，画布尺寸与父容器不一致，模型被拉伸

### 🟡 根因 3 — Canvas CSS 未自适应

**问题代码** (`Live2DViewer.tsx` 第 40-41 行)：

```typescript
canvas.style.width = w + 'px';
canvas.style.height = h + 'px';
```

**分析**：
- 硬编码 px 尺寸，窗口缩放时画布不会自动跟随父容器
- 父容器使用 `absolute inset-0` 自适应，canvas 却用绝对 px

---

## 三、逐条修复方案

### 修复 1 — 正确设置透明背景（根因 1）

**改动文件**：`src/components/Live2D/Live2DViewer.tsx`

```diff
  const app = new PIXI.Application({
    view: canvas,
    width: w,
    height: h,
-   backgroundColor: 0x0a0a1a,
+   backgroundAlpha: 0,            // ✅ PIXI 官方透明背景 API
    resolution: Math.min(window.devicePixelRatio, 2),
    autoDensity: true,
    antialias: true,
  });

- // 将 canvas 背景设为透明（叠加在场景背景之上）
- app.renderer.view.style.backgroundColor = 'transparent';
- (app.renderer as any).backgroundColor = undefined;
```

**说明**：
- `backgroundAlpha: 0` 是 PIXI.Application 构造函数的官方参数，将 alpha 通道设为 0 实现透明背景
- 无需再通过 CSS 或 hack 方式修改 `backgroundColor`
- WebGL 上下文不再读取 undefined 值，`toString` 错误彻底消除

---

### 修复 2 — Canvas 尺寸自适应（根因 2 + 3）

**改动文件**：`src/components/Live2D/Live2DViewer.tsx`

#### 2.1 使用 `getBoundingClientRect` 获取更精确的尺寸

```diff
  const init = useCallback(async () => {
    if (!canvasRef.current || !containerRef.current || initializedRef.current) return;

    const container = containerRef.current;
    const canvas = canvasRef.current;
-   const w = container.clientWidth || window.innerWidth;
-   const h = container.clientHeight || window.innerHeight;
+   const rect = container.getBoundingClientRect();
+   const w = rect.width || window.innerWidth;
+   const h = rect.height || window.innerHeight;

    if (w === 0 || h === 0) {
-     setTimeout(init, 200);
+     // 父容器布局未完成，延迟重试（使用 requestAnimationFrame 更精确）
+     requestAnimationFrame(() => setTimeout(init, 100));
      return;
    }
```

**说明**：`getBoundingClientRect()` 比 `clientWidth/clientHeight` 更精确，直接读取渲染后位置。

#### 2.2 Canvas 改用 CSS 类自适应，而非硬编码 px

```diff
- canvas.width = w;
- canvas.height = h;
- // CSS 也应用相同尺寸
- canvas.style.width = w + 'px';
- canvas.style.height = h + 'px';
+ // 画布分辨率（考虑设备像素比）
+ const pixelRatio = Math.min(window.devicePixelRatio, 2);
+ canvas.width = w * pixelRatio;
+ canvas.height = h * pixelRatio;
+ // CSS 尺寸由 className 控制自适应
```

**JSX 改动**：

```diff
- <canvas ref={canvasRef} className="block" />
+ <canvas ref={canvasRef} className="block w-full h-full" />
```

**说明**：
- `canvas.width/height` 设为物理像素（分辨率 × 像素比），保证清晰度
- CSS 层用 `w-full h-full` 让画布自动撑满父容器 `absolute inset-0`
- 窗口缩放时画布自动跟随，无需额外 resize 监听（初始阶段足够）

---

### 修复 3 — 模型加载空值保护（根因 3 补充）

**改动文件**：`src/components/Live2D/Live2DViewer.tsx`

```diff
  console.log('[Live2D C2] 加载模型:', modelUrl);
  const model = await Live2DModel.from(modelUrl, { autoInteract: false });

+ // 空值保护：Live2DModel.from 异常时可能返回 null/undefined
+ if (!model) {
+   throw new Error(
+     '模型对象创建失败：Live2DModel.from 返回了空值。\n' +
+     '可能原因：模型文件损坏、CDN 跨域、或 JSON 解析异常'
+   );
+ }

  modelRef.current = model;

  // Galgame 大立绘：人物占上层 60% 高度，居中定位底部
- const modelW = (model as any).width || 1024;
- const modelH = (model as any).height || 1024;
+ const modelW = (model as any)?.width || 1024;
+ const modelH = (model as any)?.height || 1024;
```

**说明**：在模型属性读取前增加可选链操作符，防止 `model` 为 null 时二次崩溃。

---

### 修复 4 — error 状态重置（防御性补丁）

**改动文件**：`src/components/Live2D/Live2DViewer.tsx`

当 `modelUrl` 变化时（角色切换），需要重置错误状态和初始化标志：

```diff
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

+ // modelUrl 变化时重置状态
+ React.useEffect(() => {
+   setError(null);
+   setIsLoading(true);
+   initializedRef.current = false;
+ }, [modelUrl]);
```

**说明**：角色切换时重新初始化，避免旧错误状态残留造成 UI 显示异常。

---

## 四、完整修复后的 `Live2DViewer.tsx` init 函数

以 diff 方式展示完整变更：

```typescript
// ===== 修复后的完整 init 函数核心逻辑 =====

const init = useCallback(async () => {
  if (!canvasRef.current || !containerRef.current || initializedRef.current) return;

  const container = containerRef.current;
  const canvas = canvasRef.current;

  // ✅ 修复 2.1: 使用 getBoundingClientRect 获取精确尺寸
  const rect = container.getBoundingClientRect();
  const w = rect.width || window.innerWidth;
  const h = rect.height || window.innerHeight;

  if (w === 0 || h === 0) {
    // ✅ 修复 2.1: 使用 rAF 延迟重试
    requestAnimationFrame(() => setTimeout(init, 100));
    return;
  }

  // ✅ 修复 2.2: 物理像素分辨率 + CSS 自适应分离
  const pixelRatio = Math.min(window.devicePixelRatio, 2);
  canvas.width = w * pixelRatio;
  canvas.height = h * pixelRatio;

  try {
    console.log('[Live2D C2] 初始化 PIXI', { w, h, pixelRatio });

    // ✅ 修复 1: 使用 backgroundAlpha 替代 backgroundColor hack
    const app = new PIXI.Application({
      view: canvas,
      width: w,
      height: h,
      backgroundAlpha: 0,          // ← 正确透明背景
      resolution: pixelRatio,
      autoDensity: true,
      antialias: true,
    });

    // 不再需要：
    // app.renderer.view.style.backgroundColor = 'transparent';   ← 删除
    // (app.renderer as any).backgroundColor = undefined;          ← 删除

    appRef.current = app;
    initializedRef.current = true;

    // ... Live2D 运行时加载逻辑不变 ...

    const model = await Live2DModel.from(modelUrl, { autoInteract: false });

    // ✅ 修复 3: 空值保护
    if (!model) {
      throw new Error('模型对象创建失败：Live2DModel.from 返回了空值');
    }

    modelRef.current = model;

    // ✅ 修复 3: 可选链
    const modelW = (model as any)?.width || 1024;
    const modelH = (model as any)?.height || 1024;

    // ... 定位缩放逻辑不变 ...

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[Live2D C2] 失败:', msg, err);
    setError(msg);
    setIsLoading(false);
  }
}, [modelUrl]);
```

---

## 五、修复前后对比

| 维度 | 修复前 | 修复后 |
|------|--------|--------|
| 透明背景 | `backgroundColor = undefined` 崩溃 | `backgroundAlpha: 0` 官方 API |
| 容器尺寸 | `clientWidth` 可能为 0 → 回退全屏 | `getBoundingClientRect` + rAF 精确重试 |
| Canvas 自适应 | 硬编码 px，缩放错位 | CSS `w-full h-full` + 物理像素分离 |
| 模型空值 | 无保护，`model.width` 二次崩溃 | `if (!model) throw` + 可选链 |
| 角色切换 | 旧错误残留，UI 异常 | `useEffect` 重置状态 |

---

## 六、实施路线图

| 序号 | 修复内容 | 涉及文件 | 工时 |
|------|----------|----------|------|
| **R1** | `backgroundAlpha: 0` 替代 hack | `Live2DViewer.tsx:46-58` | 2min |
| **R2** | `getBoundingClientRect` + rAF 重试 | `Live2DViewer.tsx:29-35` | 3min |
| **R3** | Canvas CSS `w-full h-full` + 物理像素分离 | `Live2DViewer.tsx:37-41` + JSX | 3min |
| **R4** | 模型空值保护 + 可选链 | `Live2DViewer.tsx:102-108` | 2min |
| **R5** | modelUrl 变化重置状态 | `Live2DViewer.tsx` 新增 useEffect | 2min |
| **R6** | 编译验证 + 浏览器测试 | — | 5min |

> **总计修复工时：≈ 17min**

---

## 七、验收标准

### 7.1 功能验收

- [ ] 页面首次加载，Live2D 模型正常渲染，无 `toString` 报错
- [ ] PIXI 画布背景透明，场景背景可见
- [ ] 窗口缩放（resize）时模型位置/比例不变形
- [ ] 角色切换时旧错误状态清理，新模型正常加载
- [ ] 模型文件损坏/缺失时显示友好错误提示（非白屏）

### 7.2 回归验证

- [ ] `.glass-panel` 底部对话面板仍正常渲染
- [ ] `SceneBackground` 场景背景层级正确
- [ ] `CharacterOverlay` 角色状态文字正常显示
- [ ] 表情切换仍正常工作
- [ ] 聊天输入/发送功能不受影响

### 7.3 浏览器控制台检查

- [ ] 无 `Cannot read properties of undefined (reading 'toString')` 红色报错
- [ ] 无 PIXI 相关 warning
- [ ] `[Live2D C2]` 日志正常输出初始化信息
- [ ] 无 WebGL 上下文丢失警告

---

## 八、与已有文档的关系

```
docs/
├── character-v2-tech-spec.md        ← 角色技术规范（做什么）
├── character-v2-remediation.md      ← 角色形象修复方案（怎么画）
├── background-atmosphere-system.md  ← 背景氛围系统设计
└── live2d-render-fix.md             ← 🆕 Live2D 渲染层修复（本文档）
```

**文档层次关系**：
- `character-v2-remediation.md`：关注 **角色外观**（发型/脸型/服饰/五官）
- `live2d-render-fix.md`：关注 **渲染引擎**（PIXI 透明背景/Canvas 初始化/模型加载保护）
- 两文档解决不同层面的问题，互补不重叠

---

## 九、扩展防御清单（低优先级，后续迭代）

| 防护项 | 说明 | 优先级 |
|--------|------|--------|
| WebGL 上下文丢失恢复 | `canvas.addEventListener('webglcontextlost', handler)` | 🔵 P2 |
| 模型加载超时机制 | `Promise.race(modelPromise, timeoutPromise)` 防止永久 loading | 🔵 P2 |
| ResizeObserver 自适应 | 监听父容器变化动态调整画布尺寸 | 🔵 P3 |
| 降级到静态占位图 | 三次重试失败后显示静态角色图 | 🔵 P3 |
| 错误上报 | Sentry / 自定义埋点记录模型加载失败原因 | 🔵 P3 |
