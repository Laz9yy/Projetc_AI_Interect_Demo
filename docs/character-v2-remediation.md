# 🛠 虚拟角色 v2 问题修复方案 (Issue Remediation Plan)

> 版本：v2.3 · 逐条对应修复 · 保留原技术文档不变  
> 基于现有实现与 v2 规范之间的差距分析

---

## 一、问题总览与修复优先级

| 优先级 | 问题域 | 严重程度 | 预估工时 | 影响面 |
|--------|--------|----------|----------|--------|
| 🔴 P0 | 发型完全错位 (长发→短发) | 致命 | ~2h | 角色核心识别 |
| 🔴 P0 | 蝴蝶结位置/尺寸/形态全错 | 致命 | ~0.5h | 角色核心识别 |
| 🔴 P0 | 眼睛非下垂狗狗眼 | 致命 | ~1.5h | 角色灵魂 |
| 🔴 P0 | 脸部非鹅蛋幼态脸 | 致命 | ~1h | 角色基底 |
| 🟡 P1 | 服饰缺少内搭/翻领/层次 | 严重 | ~1h | 视觉效果 |
| 🟡 P1 | 无平涂勾线/渐变阴影 | 严重 | ~1h | 画风质感 |
| 🟡 P1 | 手臂无关节/手掌无手指 | 严重 | ~1.5h | 肢体表现 |
| 🟡 P1 | 缺少脖颈/躯干结构 | 严重 | ~0.5h | 人体结构 |
| 🔵 P2 | 发色无渐变分层 | 中等 | ~0.5h | 画风质感 |
| 🔵 P2 | 色彩配比失衡 (紫太多) | 中等 | ~0.3h | 视觉效果 |
| 🔵 P2 | 鼻子缺失 | 中等 | ~0.3h | 五官细节 |
| 🔵 P2 | 嘴占面比过大 | 中等 | ~0.3h | 五官比例 |

---

## 二、分问题修复方案

### 问题 1 — 发型核心造型完全背离目标设定

#### 1.1 发长与剪裁不符

**现状**：垂至腰腹的超长直发  
**目标**：齐下巴长度的短波波头  
**根因**：`Hair.tsx` 中 `backHairPath` 的 y 坐标延伸至 360~375（腰线位置）

**修复方案**：

```diff
- // 后层主发 (当前: 垂至腰腹 y=375)
- const backHairPath = `
-   M 135 100
-   Q 120 180 128 280
-   Q 135 340 150 360
-   Q 165 375 180 360
-   ...
- `;

+ // 后层主发 (修复: 齐下巴 y=255)
+ const backHairPath = `
+   M 135 100
+   Q 118 140 120 190
+   Q 122 230 135 250
+   Q 148 260 165 252
+   Q 180 248 200 248
+   Q 220 248 235 252
+   Q 252 260 265 250
+   Q 278 230 280 190
+   Q 282 140 265 100
+   Q 255 85 235 78
+   L 200 75
+   L 165 78
+   Q 145 85 135 100 Z
+ `;
```

**关键坐标变化**：
- `Q 128 280` → `Q 120 190`（发尾从腰部抬到下巴）
- `Q 150 360` → `Q 135 250`（结束 y 从 360 改为 250）
- 去除 `Q 180 360` 等超长控制点

**鬓角侧发同步缩短**：

```diff
- const sideHairPath = `
-   M 135 105
-   Q 120 160 118 210
-   Q 117 240 122 255
-   ...
- `;

+ const sideHairPath = `
+   M 135 105
+   Q 120 140 118 170
+   Q 117 190 122 205
+   Q 128 195 130 170
+   Q 132 145 140 120 Z
+ `;
```

#### 1.2 锯齿刘海缺失

**现状**：顺滑平直软刘海  
**目标**：棱角分明的阶梯锯齿形齐刘海  
**根因**：`Hair.tsx` 中 `bangsPath` 的锯齿太浅（3-5px），视觉上近似平直

**修复方案**：

```diff
- // 当前: 深度 3-5px
- M 133 78
- L 138 73 L 143 78
- L 148 72 L 153 77

+ // 修复: 深度 8-12px
+ const bangsPath = `
+   M 128 82
+   L 136 70 L 144 82
+   L 152 68 L 160 82
+   L 168 66 L 176 82
+   L 184 64 L 192 82
+   L 200 63 L 208 82
+   L 216 64 L 224 82
+   L 232 66 L 240 82
+   L 248 68 L 256 82
+   L 264 70 L 272 82
+   Q 280 95 268 112
+   Q 258 125 242 132
+   Q 225 138 200 140
+   Q 175 138 158 132
+   Q 142 125 132 112
+   Q 120 95 128 82 Z
+ `;
```

**锯齿参数变化**：
| 参数 | 当前 | 修复 |
|------|------|------|
| 锯齿深度 | 3-5px | 8-12px |
| 锯齿周期 | 12px | 16px |
| 齿数 | ~20齿 | ~14齿 |
| 下缘弧线 | 平滑贴合额头 | 显性锯齿 + 内收弧 |
| 视觉识别度 | 几乎看不出来 | ✅ 一眼锯齿齐刘海 |

#### 1.3 蝴蝶结位置/尺寸/形态全错

**现状**：极小扁平蝴蝶结，并排紧贴头顶正中间  
**目标**：两只大号饱满蝴蝶结，对称固定在头部两侧鬓角上方  
**根因**：`Bow` 组件中 x 坐标位于 `162/238`（头顶内收位置），尺寸过小

**修复方案**：

```diff
- // 当前: x=162/238 (头顶内收), 翼展仅 30px
- const x = side === 'left' ? 162 : 238;

+ // 修复: x=140/260 (鬓角上方), 翼展 60px
+ const x = side === 'left' ? 140 : 260;
```

**蝴蝶结尺寸放大 2x**：

```diff
- {/* 左翼: 小尺寸 */}
- Q ${x - 25 * flip} 50 ${x - 30 * flip} 70
- Q ${x - 35 * flip} 90 ${x - 10 * flip} 78

+ {/* 左翼: 大尺寸 (坐标缩放 2x) */}
+ Q ${x - 50 * flip} 40 ${x - 55 * flip} 75
+ Q ${x - 60 * flip} 100 ${x - 20 * flip} 85
+ Z
```

**蝴蝶结纵向位置降低**（从头发顶部下移到鬓角水平）：

```diff
- {/* 中心结: y=72 (头顶) */}
- <circle cx={x} cy={72} r="4" fill="#FCE83A" />

+ {/* 中心结: y=85 (鬓角高度) */}
+ <circle cx={x} cy={85} r="6" fill="#FCE83A" />
```

**新增飘带物理动画**：

```tsx
// 蝴蝶结飘带动画 (新增 Framer Motion)
<motion.path
  d={`M ${x} 85 Q ${x - 12 * flip} 105 ${x - 15 * flip} 120`}
  stroke="#F0E6A0"
  strokeWidth="2.5"
  fill="none"
  strokeLinecap="round"
  animate={{ d: [
    `M ${x} 85 Q ${x - 12 * flip} 105 ${x - 15 * flip} 120`,
    `M ${x} 85 Q ${x - 8 * flip} 108 ${x - 18 * flip} 122`,
    `M ${x} 85 Q ${x - 12 * flip} 105 ${x - 15 * flip} 120`,
  ]}}
  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
/>
```

#### 1.4 发丝无分层渐变质感

**现状**：单一纯色填充  
**目标**：前刘海/鬓发/后发独立块面 + 深浅紫渐变

**修复方案**：

在 `Hair.tsx` 中新增 3 组渐变 `defs`，各发块分别引用：

```tsx
// 新增 3 个独立渐变
<defs>
  {/* 后发渐变: 从深到浅 (模拟光照) */}
  <linearGradient id="hairBackGrad" x1="0%" y1="0%" x2="0%" y2="100%">
    <stop offset="0%" stopColor="#B8A6E0" />
    <stop offset="60%" stopColor="#C9B8E8" />
    <stop offset="100%" stopColor="#D4C8F0" />
  </linearGradient>

  {/* 刘海渐变: 顶部高光 */}
  <linearGradient id="hairBangsGrad" x1="0%" y1="0%" x2="0%" y2="100%">
    <stop offset="0%" stopColor="#D4C8F0" />
    <stop offset="40%" stopColor="#C9B8E8" />
    <stop offset="100%" stopColor="#B8A6E0" />
  </linearGradient>

  {/* 鬓角渐变 */}
  <linearGradient id="hairSideGrad" x1="0%" y1="0%" x2="100%" y2="100%">
    <stop offset="0%" stopColor="#B8A6E0" />
    <stop offset="100%" stopColor="#C9B8E8" />
  </linearGradient>
</defs>
```

**各发块使用不同渐变**：

```diff
- <motion.path d={backHairPath} fill={hairColor} />
+ <motion.path d={backHairPath} fill="url(#hairBackGrad)" />

- <motion.path d={bangsPath} fill={hairColor} />
+ <motion.path d={bangsPath} fill="url(#hairBangsGrad)" />

- <motion.path d={sideHairPath} fill={hairColor} />
+ <motion.path d={sideHairPath} fill="url(#hairSideGrad)" />
```

---

### 问题 2 — 脸型五官完全不匹配软萌幼态标准

#### 2.1 脸型臃肿宽大

**现状**：脸部纵向偏长、脸颊宽阔  
**目标**：收窄脸颊、缩短纵向的鹅蛋小脸

**根因**：`Face.tsx` 中 `facePath` 宽度 150px (x=125~275)、高度 155px (y=75~230)  
**修复**：宽缩至 120px、高缩至 135px，整体向内收 15px

```diff
- const facePath = `
-   M 165 75
-   Q 145 82 135 105
-   Q 120 150 125 185
-   Q 130 210 148 222
-   Q 165 230 185 228
-   Q 200 226 200 226
-   Q 200 226 215 228
-   Q 235 230 252 222
-   Q 270 210 275 185
-   Q 280 150 265 105
-   Q 255 82 235 75
-   Z
- `;

+ const facePath = `
+   M 170 80
+   Q 155 85 145 105
+   Q 132 142 136 175
+   Q 140 200 155 212
+   Q 170 220 185 218
+   Q 200 216 200 216
+   Q 200 216 215 218
+   Q 230 220 245 212
+   Q 260 200 264 175
+   Q 268 142 255 105
+   Q 245 85 230 80
+   Z
+ `;
```

**脸型参数对照**：

| 参数 | 当前 | 修复后 |
|------|------|--------|
| 面宽 | 150px (x125~275) | 120px (x140~260) |
| 面高 | 155px (y75~230) | 135px (y80~215) |
| 宽高比 | 1:1.03 (接近圆形) | **1:1.13 (鹅蛋)** |
| 颧骨最宽 | x275 | x260 |
| 下巴尖 y | 228 | 217 |

#### 2.2 眼部完全丢失下垂狗狗眼

**现状**：细长闭合弯月窄眼，无分层眼睑，眼下平铺块状腮红  
**目标**：占面部大面积的下垂圆狗狗眼，双层眼线，渐变紫虹膜，竖纹腮红

**根因**：`Eyes.tsx` 中眼睛尺寸偏小，缺少下垂走向的下眼睑，瞳仁比例小

**修复方案 — 眼睛放大 1.5x**：

```diff
- // 当前: 眼宽 34px, 眼高 14px
- cx=162, rx=16, ry=13

+ // 修复: 眼宽 46px, 眼高 20px
+ cx=162, rx=22, ry=18
```

**瞳孔放大 1.5x**：

```diff
- <circle cx={cx + 2} cy={170} r={8} fill={eyeColor} />
- <circle cx={cx + 2} cy={170} r={5.5} fill="#3D2B4F" />

+ <circle cx={cx + 2} cy={169} r={12} fill={eyeColor} />
+ <circle cx={cx + 2} cy={169} r={8.5} fill="#3D2B4F" />
```

**高光放大**：

```diff
- <ellipse cx={cx + 6} cy={166} rx={3} ry={2.8} fill="white" opacity="0.9" />
- <ellipse cx={cx - 1} cy={173} rx={1.5} ry={1.5} fill="white" opacity="0.4" />

+ <ellipse cx={cx + 7} cy={164} rx={4} ry={3.5} fill="white" opacity="0.9" />
+ <ellipse cx={cx - 1} cy={174} rx={2.5} ry={2.5} fill="white" opacity="0.5" />
+ <ellipse cx={cx + 11} cy={168} rx={2} ry={1.5} fill="white" opacity="0.3" />  {/* 第三高光 */}
```

**下眼睑重新设计为下垂走向**：

```diff
- // 当前: 平缓弧线, 无明显下垂
- return `M ${cx - 16} 178 Q ${cx} 182 ${cx + 17} 176`;

+ // 修复: 外眼角低于内眼角 4px (下垂感)
+ // 左眼下垂: 内眼角 y=178, 外眼角 y=182
+ // 右眼下垂: 内眼角 y=178, 外眼角 y=182
+ return `M ${cx - 16} 178 Q ${cx} 183 ${cx + 18} 182`;
```

**上眼睑重绘为下垂走向**：

```diff
- // 当前: 上眼睑接近水平
- `M ${cx - 17} 162 Q ${cx} 156 ${cx + 17} 162`

+ // 修复: 上眼睑外眼角下垂
+ // 内眼角 y=162, 外眼角 y=168 (外眼角低 6px 产生下垂感)
+ `M ${cx - 17} 162 Q ${cx - 2} 155 ${cx + 5} 156 Q ${cx + 17} 162 ${cx + 19} 168`
```

**添加双层眼线**：

```tsx
// 在 Eyes.tsx 上眼睑路径下方新增
{/* 下眼线 (粉紫色细线) */}
<path d={`M ${cx - 15} 179 Q ${cx} 184 ${cx + 17} 181`}
  stroke="#D4A0A0" strokeWidth="1.5" fill="none" opacity="0.6" />
```

#### 2.3 口鼻精致度不足

**现状**：嘴巴占比偏大，鼻子完全省略  
**目标**：小巧浅粉薄唇 + 水滴形小鼻子

**嘴修复 — 缩小 30%**：

```diff
- // 当前: 嘴宽 24px (x188~212)
- M 188 182 Q 200 190 212 182

+ // 修复: 嘴宽 16px (x192~208)
+ M 192 184 Q 200 189 208 184
```

**新增水滴形鼻子**：

```tsx
// 在 Face.tsx 中新增
{/* 水滴形小鼻子 */}
<path d="M 199 165 Q 196 168 198 170 Q 200 172 202 170 Q 204 168 201 165 Z"
  fill="#E8B8B0" opacity="0.5" />
```

---

### 问题 3 — 服饰版型结构与配色不符

#### 3.1 服装结构缺失

**现状**：单一浅紫方形背心，无翻领/内搭/短袖  
**目标**：浅黄短袖内搭 + 淡紫翻领背带

**修复方案 — 重写 `Body.tsx` 图层顺序**：

```
Z-Index 修复后的准确顺序:
  6: 内搭短袖 (黄色 #FFF5CC)      ← 新增完整短袖
  5: 背带外衫 (淡紫 #D4C5F0)      ← 扩大覆盖范围
  4: 翻领 (浅紫白 #E8E0F8)        ← 新增
  3: 左背带 (#C4B0E8)             ← 加宽
  2: 右背带 (#C4B0E8)             ← 加宽
  1: 纽扣 ×2 (#FCE83A)
```

**内搭短袖 (新增)**：

```tsx
{/* 内搭短袖 — 浅黄色 */}
<path d="
  M 125 265
  Q 118 300 120 380
  L 138 380
  Q 130 320 133 275
  Z
" fill="#FFF5CC" />
{/* 右短袖 */}
<path d="
  M 275 265
  Q 282 300 280 380
  L 262 380
  Q 270 320 267 275
  Z
" fill="#FFF5CC" />
{/* 衣身 */}
<rect x="138" y="265" width="124" height="120" rx="8" fill="#FFF5CC" />
```

**翻领 (新增)**：

```tsx
{/* 翻领 */}
<path d="M 155 270 Q 180 290 200 292 Q 220 290 245 270 Q 230 285 200 288 Q 170 285 155 270 Z"
  fill="#E8E0F8" stroke="#D8D0F0" strokeWidth="1" />
```

#### 3.2 色彩配比失衡

**现状**：大面积紫色，黄色仅极小点缀  
**目标**：黄紫 4:6 均衡配比

**修复方案 — 色块面积调整**：

| 区域 | 当前颜色 | 修复颜色 | 调整原因 |
|------|----------|----------|----------|
| 内搭衣身 | 无 (无内搭) | `#FFF5CC` 浅黄 | 新增黄色大面积 |
| 背带外衫 | `#D4C5F0` 淡紫 | `#D4C5F0` 淡紫 | 保留但缩小面积 |
| 袖子 | 无 | `#FFF5CC` 浅黄 | 新增黄色袖 |
| 翻领 | 无 | `#E8E0F8` 浅紫白 | 新增 |
| 纽扣 | `#FCE83A` 黄 | `#FCE83A` 黄 | 保留 |

**新增黄紫渐变背景过渡**（服饰区底部柔和过渡）：

```tsx
<linearGradient id="outfitGrad" x1="0%" y1="0%" x2="0%" y2="100%">
  <stop offset="0%" stopColor="#FFF5CC" />   {/* 上: 黄 */}
  <stop offset="60%" stopColor="#D4C5F0" />   {/* 中: 紫 */}
  <stop offset="100%" stopColor="#C4B0E8" />  {/* 下: 深紫 */}
</linearGradient>
```

---

### 问题 4 — 平涂画风质感未达标

#### 4.1 轮廓线条生硬，无渐变阴影

**现状**：极简线条，无明暗渐变  
**目标**：细腻柔和细轮廓线 + 低饱和度渐变阴影

**修复方案 — 全域增加 CSS 描边属性并添加阴影层**：

在 `Face.tsx` 中添加面部轮廓线：

```tsx
{/* 面部轮廓线 (浅粉色细线) */}
<path d={facePath}
  fill="none"
  stroke="#D4A0A0"
  strokeWidth="1.5"
  opacity="0.4"
  transform="scale(1.005) translate(-1, -1)"
/>
```

在 `Hair.tsx` 中为每个发块添加轮廓线：

```tsx
{/* 后发轮廓 */}
<path d={backHairPath}
  fill="none"
  stroke="#9B8EC0"
  strokeWidth="1.5"
  opacity="0.35"
/>

{/* 刘海轮廓 */}
<path d={bangsPath}
  fill="none"
  stroke="#9B8EC0"
  strokeWidth="1.5"
  opacity="0.35"
/>
```

**在 `Body.tsx` 中添加服饰阴影**：

```tsx
{/* 背带阴影 (左侧) */}
<path d="M 145 280 Q 142 320 145 395 L 155 395 Q 152 320 155 280 Z"
  fill="#C4B0E8" opacity="0.3" />

{/* 脖子阴影 */}
<path d="M 190 228 L 210 228 L 208 260 L 192 260 Z"
  fill="#E8C8C0" opacity="0.2" />
```

#### 4.2 整体色彩无柔和晕染

**现状**：纯色平铺  
**目标**：浅淡明暗过渡

**修复方案 — 在所有主要色块上应用渐变**：

| 部位 | 渐变类型 | 色值 |
|------|----------|------|
| 面部 | radial | `#FFE8E0` → `#F5D8D0` (边缘微红润) |
| 内搭 | linear | `#FFF5CC` → `#F5E8B8` |
| 背带 | linear | `#D4C5F0` → `#C4B0E8` |
| 刘海 | radial | 顶部高光 → 底部深紫 |
| 眼下腮红 | linear | `#FFB5C5` 竖条渐隐 |

---

### 问题 5 — 完整上半身人体结构缺陷

#### 5.1 手臂无粗细变化

**现状**：细棍状，无肩膀/手肘过渡  
**目标**：圆润过渡的软萌少女手臂

**修复方案 — 重写 `Arms.tsx`**：

```diff
- {/* 当前: 直线条 */}
- <path d="M 115 300 Q 100 340 95 380" />

+ {/* 修复: 上粗下细 + 圆润肩肘 */}
+ <path d="
+   M 118 290
+   Q 105 300 100 320
+   Q 95 340 98 360
+   Q 100 370 105 375
+   Q 110 372 112 365
+   Q 115 345 118 330
+   Q 120 310 125 295 Z
+ " fill="#FFE8E0" />
```

**新增手肘转折**：

```diff
+ {/* 左手肘高光 */}
+ <ellipse cx="110" cy="370" rx="6" ry="4" fill="#FFE8E0" opacity="0.7" />
```

#### 5.2 手掌无手指

**现状**：方块手掌
**目标**：圆润小手 + 分段手指

**修复方案**：

```diff
- <ellipse cx="88" cy="448" rx="12" ry="8" fill="#FFE8E0" />

+ {/* 手掌 (圆润) */}
+ <ellipse cx="88" cy="450" rx="14" ry="10" fill="#FFE8E0" />
+ {/* 拇指 */}
+ <ellipse cx="78" cy="448" rx="5" ry="3" fill="#FFE8E0" transform="rotate(-20 78 448)" />
+ {/* 食指 */}
+ <rect x="82" y="440" width="3.5" height="10" rx="1.75" fill="#FFE8E0" />
+ {/* 中指 */}
+ <rect x="86.5" y="438" width="3.5" height="12" rx="1.75" fill="#FFE8E0" />
+ {/* 无名指 */}
+ <rect x="91" y="440" width="3" height="10" rx="1.5" fill="#FFE8E0" />
+ {/* 小指 */}
+ <rect x="95" y="443" width="2.5" height="8" rx="1.25" fill="#FFE8E0" />
```

#### 5.3 缺少脖颈/躯干结构

**现状**：头直接连方形背心  
**目标**：清晰脖颈 + 胸腔/腰腹起伏

**修复方案 — 在 `Body.tsx` 中新增**：

```tsx
{/* 脖颈 (锥形过渡) */}
<path d="M 185 215 L 215 215 L 220 260 L 180 260 Z" fill="#FFE8E0" />

{/* 脖颈阴影 (左侧) */}
<path d="M 185 218 L 195 218 L 190 258 L 182 258 Z"
  fill="#E8C8C0" opacity="0.15" />

{/* 锁骨 (淡淡勾勒) */}
<path d="M 175 248 Q 200 255 225 248"
  stroke="#E0C0B8" strokeWidth="1" fill="none" opacity="0.3" />
```

---

### 问题 6 — Live2D 动态制作落地硬伤

#### 6.1 超长直发穿模

**现状**：长发垂至腰腹，头部转动时发丝穿插身体  
**根因**：发丝过长 + 图层顺序错误  
**修复**：短发（问题 1.1 修复即可解决）+ 调整图层 Z 轴

**图层 Z-index 修复**：

```diff
// 当前 Hair.tsx 中后层发在身体下方
- <Hair />         ← 这里在 Body 上方
- <Body />
- <Arms />

// 修复: 后层发在 Body 下方, 刘海在最顶层
+ <HairBack />     ← Body 下方 (被身体挡住)
+ <Body />
+ <Arms />
+ <HairBangs />    ← 最顶层 (覆盖额头)
+ <HairSides />    ← 手臂上方 (侧发遮肩)
```

#### 6.2 五官分层不足

**现状**：缺少独立眼皮/瞳孔/腮红图层  
**目标**：各部件独立驱动

**修复方案 — 在 Eyes.tsx 中将每一层拆为单独 `<g>`**：

```tsx
// 每只眼 6 个独立层
<g id={`eye-${side}-layer-1`}>{/* 上眼睑 */}
<g id={`eye-${side}-layer-2`}>{/* 睫毛 */}
<g id={`eye-${side}-layer-3`}>{/* 巩膜 */}
<g id={`eye-${side}-layer-4`}>{/* 虹膜 */}
<g id={`eye-${side}-layer-5`}>{/* 瞳孔 */}
<g id={`eye-${side}-layer-6`}>{/* 下眼睑 */}
```

每个 `<g>` 添加 `data-layer` 属性，供后续工具链识别：

```tsx
<g data-layer="eyelid-upper" data-side={side} data-index="1">
```

#### 6.3 手臂无法做表情联动动作

**现状**：无手肘/手掌独立分层  
**目标**：可实现胸口交握、双手贴腮、单手遮脸、手放腹部

**修复方案 — 每只手肘+手掌独立控制**：

```tsx
// 每只手臂拆为独立 state 控制
interface ArmPose {
  upperArm: { rotate: number; y: number };
  forearm: { rotate: number; y: number };
  hand: { rotate: number; y: number; pose: HandPose };
}

type HandPose = 'relaxed' | 'clasp' | 'open' | 'cover' | 'curl';
```

**动作到姿态的映射表**：

| 表情 | 左臂 | 右臂 |
|------|------|------|
| idle | 自然下垂 | 自然下垂 |
| 开心 😊 | 抬至胸口 y=-40 | 抬至胸口 y=-40, 十指交握 |
| 难过 😢 | 腹部蜷缩 | 腹部蜷缩 |
| 惊讶 😮 | 抬至脸颊 y=-60, 张开 | 抬至脸颊 y=-60, 张开 |
| 害羞 😳 | 腹部 y=5, 放松 | 遮下半脸 y=-50, 轻盖 |

---

### 问题 7 — 整体人物气质偏差

#### 7.1 核心识别元素缺失

**现状**：极简扁平图标风，无角色辨识度  
**目标**：灵动甜妹，锯齿刘海/短发/蝴蝶结/下垂大眼四项核心元素清晰可辨

**修复方案 — 四项核心元素验收标准**：

```typescript
// 验收检查清单
const v2SignOffChecklist = [
  { element: '锯齿齐刘海', pass: false, criteria: '锯齿深度≥8px, 齿数≥14' },
  { element: '齐下巴短发', pass: false, criteria: '发尾 y≤255' },
  { element: '双侧大蝴蝶结', pass: false, criteria: '位置 x≤145/≥255, 翼展≥50px' },
  { element: '下垂狗狗眼', pass: false, criteria: '外眼角低于内眼角≥4px, 眼宽≥44px' },
  { element: '鹅蛋小脸', pass: false, criteria: '面宽≤120px, 宽高比≥1:1.1' },
  { element: '小嘴', pass: false, criteria: '嘴宽≤18px' },
  { element: '竖纹腮红', pass: false, criteria: '竖条状, 非块状' },
  { element: '内搭+背带', pass: false, criteria: '黄内搭+紫背带+翻领' },
  { element: '渐变发色', pass: false, criteria: '≥2 种渐变 stop' },
  { element: '手部细节', pass: false, criteria: '≥4 根手指独立' },
];
```

---

## 三、实施路线图

| Phase | 内容 | 涉及文件 | 工时 |
|-------|------|----------|------|
| **R1** | 短发波波头重构 + 鬓角缩短 | `Hair.tsx` | ~1h |
| **R2** | 锯齿刘海加深 + 蝴蝶结放大移位 | `Hair.tsx` | ~1h |
| **R3** | 发丝 3 组渐变 + 分层上色 | `Hair.tsx` + `Character.tsx` defs | ~0.5h |
| **R4** | 脸型收窄 + 鼻子上新 | `Face.tsx` | ~0.5h |
| **R5** | 狗狗眼放大 + 下眼睑下垂 + 竖纹腮红 | `Eyes.tsx` + `Blush.tsx` | ~1h |
| **R6** | 嘴缩小 + 唇形优化 | `Mouth.tsx` | ~0.3h |
| **R7** | 服饰重写: 内搭+翻领+背带+短袖 | `Body.tsx` | ~1h |
| **R8** | 手臂重构: 肘部+手指5根 | `Arms.tsx` | ~1h |
| **R9** | 全域勾线 + 阴影层 + 平涂优化 | 所有组件 | ~1h |
| **R10** | 图层 Z-index 修复 + 验收检查 | 所有组件 | ~0.5h |

> **总计修复工时: ~8h** (10 个 Phase, 每 Phase ≤1h)

---

## 四、与原有技术文档的关系

```
docs/
├── character-v2-tech-spec.md       ← 保留不变 (原有完整技术规范)
└── character-v2-remediation.md     ← 新增 (问题修复方案, 即本文档)

两文档配合使用:
  - tech-spec.md: 定义"要做成什么样" (目标规范)
  - remediation.md: 定义"当前差距在哪 + 如何修复" (修复路径)
```

**修复顺序策略**：

```
Layer 1 — 角色基底     R4(脸型) + R5(眼睛) + R6(嘴)
Layer 2 — 发型         R1(短发) + R2(刘海+蝴蝶结) + R3(渐变)
Layer 3 — 服饰         R7(内搭+背带)
Layer 4 — 肢体         R8(手臂+手指)
Layer 5 — 画风         R9(勾线+阴影)
Layer 6 — 整合         R10(Z-index + 验收)
```

---

## 五、补充缺失项

### 5.1 物理系统参数迁移 (Physics Parameter Migration)

> 当前修复文档只改了 SVG path 坐标，未同步更新物理参数。  
> 短发波波头 + 大蝴蝶结的质量/尺寸变化后，原物理参数会导致动态失真。  
> 以下表格给出"旧参数→新参数"的完整迁移映射。

#### 头发物理参数 (Hair Physics)

| 参数 | 旧值 (长发 v1) | 新值 (短发 v2) | 调整原因 |
|------|---------------|---------------|----------|
| **后层发** | | | |
| lag 滞后时间 | 0.2s | **0.1s** | 短发声波传递更快 |
| amplitude 幅度 | ±3px | **±1.5px** | 发长减半，惯性减半 |
| damping 阻尼 | 0.8 | **0.9** | 短发晃动衰减更快 |
| **鬓角** | | | |
| lag 滞后时间 | 0.2s | **0.15s** | 缩短后回正更快 |
| amplitude 幅度 | ±6px | **±3px** | 摆幅减半 |
| damping 阻尼 | 0.75 | **0.85** | 减少多余晃动 |
| **刘海** | | | |
| lag 滞后时间 | 0.15s | **0.08s** | 短发质量轻、响应快 |
| amplitude 幅度 | ±1.5px | **±1px** | 锯齿刘海更厚重、幅度收窄 |
| damping 阻尼 | 0.85 | **0.92** | 锯齿结构增加阻尼 |

#### 蝴蝶结物理参数 (Bow Physics)

| 参数 | 旧值 (原小蝴蝶结) | 新值 (v2 大蝴蝶结) | 调整原因 |
|------|-----------------|-------------------|----------|
| stiffness 刚度 | 180 | **220** | 体积放大 2x，需要更强回正力 |
| damping 阻尼 | 12 | **15** | 翼展增大，增加阻尼防止过冲 |
| mass 质量 | 0.5 | **1.2** | 体积增大对应质量增加 |
| 飘带摆动幅度 | ±4px | **±8px** | 飘带增长 1.5x |
| 飘带摆动周期 | 3s | **2.5s** | 更活跃的飘带动态 |

#### 呼吸物理参数 (Breath Physics)

| 参数 | 旧值 | 新值 | 调整原因 |
|------|------|------|----------|
| chest scaleY | 1.008 | **1.005** | 短上衣 + 背带结构限制形变空间 |
| shoulder y | ±1.2px | **±0.8px** | 背带结构限制耸肩幅度 |
| arm y | ±0.8px | **±0.5px** | 手臂连带幅度收窄 |
| 呼吸周期 | 3.5s | **3.5s** | 不变 (人体自然呼吸节奏) |
| 缓动曲线 | easeInOut | `[0.45, 0, 0.55, 1]` | 更柔和的呼吸起止 |

#### 头部待机物理参数 (Head Idle Physics)

| 参数 | 旧值 | 新值 | 调整原因 |
|------|------|------|----------|
| 左右微晃幅度 | ±2px | **±1.5px** | 短发视觉重量减轻，幅度收小 |
| 左右微晃周期 | 4.5s | **5s** | 更舒缓的微晃节奏 |
| 上下点头幅度 | ±1.5px | **±1px** | 收紧幅度适配新比例 |
| 上下点头周期 | 6s | **6s** | 不变 |
| 呼吸带动幅度 | ±0.8px | **±0.5px** | 适配新脸型比例 |

#### 物理绑定规则 (Physics Binding Rules)

```
物理组划分:
  Group A: 后层发 (hair-back)
    └── 父级: 头部旋转 (head-rotate)
    └── 参数: lag=0.1s, damp=0.9

  Group B: 鬓角侧发 (hair-sides)
    └── 父级: 头部旋转 (head-rotate)
    └── 参数: lag=0.15s, damp=0.85, amp=±3px
  
  Group C: 刘海 (hair-bangs)
    └── 父级: 头部俯仰 (head-nod)
    └── 参数: lag=0.08s, damp=0.92, amp=±1px

  Group D: 蝴蝶结 (bow)
    └── 父级: 头部旋转 + 头发Group A
    └── 参数: stiffness=220, damp=15, mass=1.2

  Group E: 胸腔呼吸 (chest-breath)
    └── 独立驱动 (不依赖头部)
    └── 参数: scaleY=1.005, period=3.5s
```

---

### 5.2 动作协议 (Animation Protocol)

> 当前 `actionSequences` 只有静态姿态映射，缺少完整动画驱动协议。  
> 新增以下数据结构和约束规则。

#### 5.2.1 统一动作参数协议

```typescript
// ===== 统一动作协议 =====
interface AnimationProtocol {
  // 缓动曲线 (cubic-bezier)
  easing: [number, number, number, number];
  
  // 相位时序 (秒)
  phase: {
    attack: number;    // 动作发起阶段
    hold: number;      // 保持阶段
    release: number;   // 释放衰减阶段
    cooldown: number;  // 回归待机缓冲
  };
  
  // 形变参数极限范围
  limits: {
    head: {
      rotate: { min: -12; max: 12 };     // 歪头角度
      nod: { min: -8; max: 8 };           // 点头角度
      forward: { min: -6; max: 10 };      // 前倾/后仰
    };
    body: {
      shoulderLift: { min: -4; max: 6 };  // 耸肩范围 (px)
      chestScale: { min: 0.98; max: 1.03 }; // 胸腔缩放
      rotate: { min: -8; max: 8 };         // 身体侧转
    };
    arms: {
      yOffset: { min: -60; max: 10 };     // 手臂抬升 (px)
      elbowAngle: { min: 20; max: 80 };    // 手肘角度
    };
  };
  
  // 多参数冲突解决优先级
  conflictPriority: string[];
}
```

#### 5.2.2 各表情动作标准参数表

```typescript
const animationStandards: Record<AnimationState, AnimationProtocol> = {
  happy: {
    easing: [0.34, 1.56, 0.64, 1],  // spring-like
    phase: { attack: 0.15, hold: 0.6, release: 0.25, cooldown: 1.5 },
    limits: {
      head: { rotate: { min: 3, max: 8 }, nod: { min: 2, max: 4 }, forward: { min: -2, max: 2 } },
      body: { shoulderLift: { min: 2, max: 4 }, chestScale: { min: 1.01, max: 1.02 }, rotate: { min: -4, max: -2 } },
      arms: { yOffset: { min: -45, max: -35 }, elbowAngle: { min: 40, max: 50 } },
    },
    conflictPriority: ['eyelid', 'eyebrow', 'mouth', 'head', 'arm', 'hair'],
  },
  sad: {
    easing: [0.4, 0, 0.6, 1],       // slower easeInOut
    phase: { attack: 0.4, hold: 0.5, release: 0.3, cooldown: 2.5 },
    limits: {
      head: { rotate: { min: -3, max: 3 }, nod: { min: -3, max: 0 }, forward: { min: 8, max: 12 } },
      body: { shoulderLift: { min: -5, max: -3 }, chestScale: { min: 0.985, max: 0.995 }, rotate: { min: -2, max: 2 } },
      arms: { yOffset: { min: 3, max: 8 }, elbowAngle: { min: 55, max: 65 } },
    },
    conflictPriority: ['eyelid', 'eyebrow', 'mouth', 'head', 'arm', 'hair'],
  },
  surprised: {
    easing: [0.05, 0.9, 0.1, 1],    // very fast attack
    phase: { attack: 0.08, hold: 0.4, release: 0.3, cooldown: 1.2 },
    limits: {
      head: { rotate: { min: -4, max: 4 }, nod: { min: -4, max: 0 }, forward: { min: -8, max: -4 } },
      body: { shoulderLift: { min: 5, max: 8 }, chestScale: { min: 1.02, max: 1.03 }, rotate: { min: -3, max: 3 } },
      arms: { yOffset: { min: -65, max: -55 }, elbowAngle: { min: 25, max: 35 } },
    },
    conflictPriority: ['eyelid', 'eyebrow', 'mouth', 'head', 'arm', 'hair'],
  },
  shy: {
    easing: [0.35, 0, 0.45, 1],     // gentle easeOut
    phase: { attack: 0.3, hold: 0.5, release: 0.3, cooldown: 2.0 },
    limits: {
      head: { rotate: { min: 8, max: 12 }, nod: { min: 2, max: 5 }, forward: { min: 3, max: 5 } },
      body: { shoulderLift: { min: 1, max: 3 }, chestScale: { min: 0.992, max: 0.998 }, rotate: { min: 6, max: 10 } },
      arms: { yOffset: { min: -55, max: 8 }, elbowAngle: { min: 25, max: 65 } },
    },
    conflictPriority: ['eyelid', 'eyebrow', 'head', 'mouth', 'arm', 'hair'],
  },
};
```

#### 5.2.3 多参数叠加冲突处理

```
规则 1: 头部旋转 + 头发物理
  头发运动 = 头部旋转角度 × 滞后系数 × 阻尼
  当 head.rotate > 8° 时: 发丝滞后系数 × 0.7 (限制最大摆动防止穿模)

规则 2: 表情切换 + 待机呼吸
  新表情 attack 阶段: 呼吸 amplitude × 0.5 (表情动作期间呼吸减半)
  表情 release 阶段: 呼吸 amplitude 在 0.5s 内线性回归 1.0

规则 3: 手臂 + 身体同时运动
  手臂动作优先: body.rotate × 0.6 (手臂运动时身体转动幅度受限)
  当 arm.yOffset < -45: 身体 rotation 强制降至 ±3° (防止手臂出画)

规则 4: 低头 + 头发
  低头 > 5° 时: 刘海固定静止, 不触发滞后 (防止头发遮住整个脸)
```

#### 5.2.4 待机回归过渡规则

```typescript
// 表情播放结束 → 回归待机的过渡曲线
const returnToIdleTransition = {
  phase: {
    // 表情动作 release
    fadeOut: {
      duration: '0.3s',
      easing: [0.4, 0, 1, 1],       // easeOut
    },
    // 回归待机缓冲
    buffer: {
      duration: '0.15s',
      strategy: 'hold-last-frame',   // 保持 release 最后一帧
    },
    // 待机渐入
    fadeInIdle: {
      duration: '0.25s',
      easing: [0, 0, 0.2, 1],       // easeIn
    },
  },
  // 回归参数
  reset: {
    head: { tilt: 0, nod: 0, forward: 0 },
    body: { shoulderLift: 0, chestScale: 1, rotate: 0 },
    arms: { yOffset: 0, elbowAngle: 45, pose: 'gentle' },
    hair: { bowSwing: 0, bangLift: 0 },
  },
};
```

---

### 5.3 不对称动态与微待机小动作

#### 5.3.1 静态不对称修复参数

```typescript
// 修复后需要写入 SVG 坐标的不对称偏移
const staticAsymmetry = {
  // 肩膀 (Body.tsx)
  shoulder: {
    left: { baseY: 290 },           // 左肩基准
    right: { baseY: 292 },           // 右肩低 2px (惯用右手)
  },
  // 蝴蝶结 (Hair.tsx)
  bowHeight: {
    left: { baseY: 85 },             // 左蝴蝶结基准
    right: { baseY: 83 },            // 右蝴蝶结低 2px
  },
  // 刘海分界 (Hair.tsx bangsPath)
  hairPart: {
    offset: 6,                       // 偏右 6px (四六分)
    direction: 'right' as const,
  },
  // 嘴角 (Mouth.tsx)
  mouthCorner: {
    left: { y: 0 },                  // 左嘴角基准
    right: { y: -1 },                // 右嘴角高 1px (轻微歪嘴)
  },
};
```

#### 5.3.2 动态不对称配置

```typescript
const dynamicAsymmetry = {
  // 眨眼速度不对称 (Eyes.tsx)
  blink: {
    left: { duration: 0.12, delay: 0 },     // 左眼快
    right: { duration: 0.15, delay: 0.03 },  // 右眼稍慢
  },
  // 表情不对称 (表情切换时)
  smileAsymmetry: {
    mouth: {
      left: { startDelay: 0 },              // 左嘴角先动
      right: { startDelay: 0.08 },           // 右嘴角滞后 80ms
      leftAmplitude: 1.0,
      rightAmplitude: 0.85,                  // 右嘴角幅度略小
    },
    eyes: {
      leftSquint: 1.0,
      rightSquint: 0.85,
    },
  },
  sadAsymmetry: {
    eyebrows: {
      leftDrop: 1.0,                         // 左眉垂更多 (真实情绪)
      rightDrop: 0.7,                         // 右眉克制 (社交面具)
    },
  },
  confusedAsymmetry: {
    eyebrows: {
      leftRaise: 0.3,
      rightRaise: 1.0,                        // 右眉挑更高 (主导侧)
    },
  },
};
```

#### 5.3.3 待机微动系统

```typescript
// ===== 待机无意识小动作 (新增, 取代纯静态 idle) =====
const idleFidgets = [
  // 1. 手指屈伸 (每 8-12s)
  {
    name: 'finger-twitch',
    target: 'hand-fingers',
    interval: { min: 8000, max: 12000 },     // 8-12s 随机
    animation: { y: [0, -1.5, 0] },
    duration: 0.5,
    easing: [0.45, 0, 0.55, 1],
    // 仅无名指 + 小指参与 (自然屈伸)
    affectedFingers: ['ring', 'pinky'],
  },
  // 2. 头部微动 (每 15-20s)
  {
    name: 'head-micro-tilt',
    target: 'head',
    interval: { min: 15000, max: 20000 },
    animation: { rotate: [0, 1.5, 0] },      // 1.5° 微歪头
    duration: 1.0,
    easing: [0.45, 0, 0.55, 1],
    probability: 0.6,                          // 60% 概率触发
  },
  // 3. 眨眼 (每 3-5s, 已有, 补充不对称参数)
  {
    name: 'blink',
    target: 'eyelid-upper',
    interval: { min: 3000, max: 5000 },
    animation: { scaleY: [1, 0.1, 1] },       // 闭眼→睁眼
    duration: 0.15,
    easing: [0.4, 0, 0.6, 1],
    // 不对称: 左右眼不同步
    sideOffset: { left: 0, right: 50 },        // 右眼滞后 50ms
  },
  // 4. 嘴角微动 (每 20-30s)
  {
    name: 'micro-smile',
    target: 'mouth',
    interval: { min: 20000, max: 30000 },
    animation: { d: ['smile-neutral', 'smile-mild'] },
    duration: 0.8,
    easing: [0.45, 0, 0.55, 1],
    probability: 0.4,
  },
  // 5. 鬓角单侧摆动 (每 10-15s)
  {
    name: 'side-hair-flick',
    target: 'hair-side-right',
    interval: { min: 10000, max: 15000 },
    animation: { x: [0, 2, 0] },
    duration: 0.6,
    easing: [0.34, 1.56, 0.64, 1],            // spring-like
    // 只有右侧鬓角 (惯用侧习惯)
    side: 'right-only',
  },
];

// 实现方式: Framer Motion useAnimationControls 定时触发
// 每个微动独立 useInterval, 互不阻塞
```

---

### 5.4 异常边界兜底方案 (Safety Guards)

#### 5.4.1 角度/位移极限约束

```typescript
// ===== 安全围栏 =====
const safetyGuards = {
  // --- 头部 ---
  head: {
    rotate: { min: -12, max: 12 },       // 歪头极限 (度)
    nod: { min: -8, max: 8 },             // 点头极限
    forward: { min: -6, max: 10 },        // 前倾/后仰
    // 超过极限时: 强制 clamp
    overflowAction: 'clamp',              // clamp | ignore | warn
  },

  // --- 手臂 ---
  arms: {
    reach: {
      x: { min: 60, max: 340 },           // 水平不出画
      y: { min: 200, max: 460 },          // 垂直不出画
    },
    // 抬手 + 歪头同时达到极限时: 手臂优先 (表情可见性 > 手部动作)
    conflictWithHead: 'arm-yields',
  },

  // --- 形变缩放 ---
  scale: {
    min: 0.95,
    max: 1.05,
    // 超过时做平滑过渡回 limit
    recoveryDuration: 0.3,
  },

  // --- 防穿模检测 ---
  antiClip: {
    // 低头 > 6° 时: 刘海固定为当前帧
    headDownBangsLock: { threshold: 6, action: 'hold-frame' },
    // 抬手 > -50px 时: 手臂 z-index 提升到头发上方
    armRaisedZIndex: { threshold: -50, newZIndex: 39 },
    // 歪头 > 8° 时: 蝴蝶结偏移量限制 x < 15px
    bowTiltLimit: { threshold: 8, maxOffset: 15 },
  },
};
```

#### 5.4.2 深色模式色彩适配

```typescript
// ===== 深色界面色彩适配 =====
const darkModeColorRules = {
  // 背景: #0A0A1A 情况下
  background: '#0A0A1A',

  // 角色亮度适应性调整
  adaptation: {
    // 浅色区域最小亮度 (防止在深色背景上发灰)
    minBrightness: 85,                   // HSL Lightness
    // 轮廓线最小对比度
    minContrast: 3.0,                    // WCAG AA 标准
  },

  // 渐变加载失败降级
  gradientFallback: {
    hair: '#C9B8E8',                     // 淡紫纯色
    skin: '#FFE8E0',                     // 肤色纯色
    outfit: '#D4C5F0',                   // 服饰纯色
    glow: 'rgba(124, 92, 252, 0.25)',    // 背景光晕
  },

  // 角色边缘发光 (深色背景提升可读性)
  edgeGlow: {
    enabled: true,
    color: 'rgba(124, 92, 252, 0.12)',
    blurRadius: 15,
    spreadRadius: 2,
  },
};
```

#### 5.4.3 图层容错策略

```typescript
// ===== 图层容错 =====
const layerTolerance = {
  // 图层缺失 → 静默降级
  missingLayer: {
    action: 'opacity-zero',
    consoleWarn: true,
  },

  // 动画参数异常 (NaN/undefined) → 使用默认缓动
  invalidAnimationParam: {
    fallbackEasing: [0.45, 0, 0.55, 1],
    fallbackDuration: 0.3,
  },

  // Framer Motion 挂载失败 → 静态显示最后一帧
  motionMountFailure: {
    strategy: 'freeze-last-frame',
    fallbackRender: 'static-svg',
  },

  // 保证 38 层渲染完整性
  layerCountCheck: {
    expected: 38,
    // 开发环境 warn, 生产环境 silent
    envBehavior: { development: 'warn', production: 'silent' },
  },
};
```

---

### 5.5 验收闭环 (QA Sign-off Checklist)

> 详细验收文档见 `docs/qa-signoff-checklist.md`（独立文档）  
> 以下为核心验收节点摘要：

#### Phase 验收门禁

```
Gate 1 ─ 静态原画验收
  ├── 锯齿刘海: 深度≥8px, 齿数≥14, 视觉识别率≥80%
  ├── 鹅蛋脸: 面宽≤120px, 宽高比≥1:1.1
  ├── 狗狗眼: 外眼角低于内眼角≥4px, 眼宽≥44px
  ├── 蝴蝶结: 位置 x≤145/≥255, 翼展≥50px
  ├── 服饰: 黄内搭+紫背带+翻领三结构清晰可辨
  └── 调色板: 使用规范中定义的色值, 偏差≤3%

Gate 2 ─ 分层图层验收
  ├── data-layer 属性覆盖率: 100%
  ├── 独立图层数量: ≥35 / 38
  └── 渐变引用: 所有 url(#xxx) 正确指向 <defs>

Gate 3 ─ 动态动作验收
  ├── 4 种表情: 每套肢体动作完整 (头/肩/臂/手)
  ├── 过渡: attack→hold→release→idle 四阶段可区分
  ├── 无穿模: 低头/歪头/抬手极限姿态截图检查
  └── 帧率: ≥30fps (移动端 Chrome DevTools)

Gate 4 ─ 多端适配验收
  ├── 聊天头像裁剪: 80×80, 头部完整
  ├── 对话页裁剪: 320×400, 表情+上半身完整
  ├── 全屏展示: 400×520 无裁切
  └── 深色背景: 角色轮廓线可读, 无颜色融入背景
```

#### 穿模专项测试矩阵

```
测试动作           | 检测部位          | 通过标准
低头至极限 (10°)   | 刘海→眼睛        | 刘海不遮挡瞳孔
歪头至极限 (12°)   | 鬓角→肩膀        | 鬓角不插入肩膀
抬手至极限 (-60px) | 手掌→脸部        | 手掌不遮挡完整脸部>30%
耸肩至极限 (6px)   | 肩膀→头发        | 肩不与发丝穿插
蝴蝶结摆幅 (8px)   | 蝴蝶结→头发      | 蝴蝶结在发丝外侧
```

---

### 5.6 与原有文档的关系更新

```
docs/
├── character-v2-tech-spec.md        ← 保留不变 (目标规范)
├── character-v2-remediation.md      ← 已补全 (修复方案 + 物理/动作/不对称/安全兜底)
└── qa-signoff-checklist.md          ← 新增 (验收流程 / 测试矩阵 / 性能标准)
```

**修复文档 Completeness 自检表**：

| 需求域 | 覆盖情况 | 所在章节 |
|--------|----------|----------|
| 发型/脸型/五官/服饰修复 | ✅ 完整 | §二 |
| 实施路线图 (10 Phase) | ✅ | §三 |
| 与原技术文档关系 | ✅ | §四 |
| 物理参数迁移 | ✅ **已补** | §5.1 |
| 动作协议 + 极限约束 | ✅ **已补** | §5.2 |
| 冲突处理 + 回归过渡 | ✅ **已补** | §5.2.3 / §5.2.4 |
| 不对称动态 + 微待机 | ✅ **已补** | §5.3 |
| 异常边界兜底 | ✅ **已补** | §5.4 |
| 验收闭环 | ✅ **已补** (摘要) | §5.5 |
| Cubism 工程导出规范 | ❌ 当前技术栈不需要 | — |

### 5.7 Cubism Live2D 工程交付规范

> 当前技术栈为 SVG + Framer Motion，以下规范为**远期迁移至 Live2D Cubism 时的标准化交付要求**。  
> 分层 SVG 设计已预留 `data-layer` / `data-side` 属性 (见原技术文档 §6)，可自动化映射为 Cubism 图层 ID。  
> 所有规范在 SVG 阶段提前对齐，降低后续迁移成本。

#### 5.7.1 导出版本与工具链

| 项目 | 标准 |
|------|------|
| Cubism Editor 版本 | **Cubism Editor 5.0+** (推荐 5.2) |
| SDK 版本 | **Cubism SDK for Web R5+** |
| 导出格式 | moc3 (网格模型) + physics3.json (物理) + motion3.json (动作) |
| 贴图格式 | PNG-32 (RGBA 8bit/channel) |
| PSD 尺寸限制 | 单张 ≤ **4096×4096 px** |
| 纹理压缩 | TinyPNG / PngQuant, 质量 ≥85% |

#### 5.7.2 模型文件清单

```
model.3.0/
├── model.3.0.model3.json          ← 模型主配置文件
├── model.moc3                     ← 网格变形文件 (由 PSD 导出)
│
├── textures/                       ← 贴图目录
│   ├── texture_00.png              ← 头部 + 头发 (2048×2048)
│   ├── texture_01.png              ← 身体 + 服饰 (2048×2048)
│   └── texture_02.png              ← 配件 + 装饰 (1024×1024)
│
├── physics/                        ← 物理目录
│   └── physics.json                ← 头发/蝴蝶结/呼吸物理参数
│
├── motions/                        ← 动作目录
│   ├── idle.motion3.json           ← 待机呼吸
│   ├── happy.motion3.json          ← 开心表情+肢体
│   ├── sad.motion3.json            ← 难过表情+肢体
│   ├── surprised.motion3.json      ← 惊讶表情+肢体
│   └── shy.motion3.json            ← 害羞表情+肢体
│
├── expressions/                    ← 表情目录
│   ├── happy.exp3.json
│   ├── sad.exp3.json
│   ├── surprised.exp3.json
│   └── shy.exp3.json
│
└── userdata/                       ← 用户数据目录
    └── model.userdata3.json        ← 角色元数据 (名称/版本/作者)
```

#### 5.7.3 贴图规格与纹理打包规则

##### 贴图分辨率标准

| 贴图编号 | 内容 | 分辨率 | 像素密度 | 说明 |
|----------|------|--------|----------|------|
| `texture_00` | 头部组 (脸/眉眼嘴/刘海/后发/鬓角/蝴蝶结) | **2048×2048** | 2K | 面部细节集中，需要最高分辨率 |
| `texture_01` | 身体组 (内搭/背带/翻领/脖颈/肩膀) | **2048×2048** | 2K | 身体部分 |
| `texture_02` | 配件组 (纽扣/飘带/备用表情部件) | **1024×1024** | 1K | 小型配件 |

**合图规则**：

```typescript
const textureAtlasRules = {
  // 单张贴图最大尺寸: 4096×4096
  maxTextureSize: { width: 4096, height: 4096 },
  
  // 推荐合图尺寸: 2048×2048 (平衡性能与清晰度)
  recommendedSize: { width: 2048, height: 2048 },
  
  // 图层间距 (防止相邻图层纹理溢出)
  padding: 4,  // px
  
  // 各部件在合图中的分布
  layout: {
    texture_00: {
      // 头部组 — 高精度
      resolution: '2048×2048',
      contains: [
        'face-base', 'face-shadow',
        'eyelid-upper-L', 'eyelid-upper-R',
        'eyelid-lower-L', 'eyelid-lower-R',
        'eyeball-L', 'eyeball-R',
        'mouth-upper', 'mouth-lower', 'mouth-cavity',
        'blush-L', 'blush-R',
        'eyebrow-L', 'eyebrow-R',
        'nose',
      ],
    },
    texture_01: {
      // 头发组
      resolution: '2048×2048',
      contains: [
        'hair-back',
        'hair-bangs',
        'hair-sides-L', 'hair-sides-R',
        'hair-fringe',
      ],
    },
    texture_02: {
      // 身体 + 配件组
      resolution: '2048×2048',
      contains: [
        'neck', 'shoulder-L', 'shoulder-R',
        'inner', 'dress', 'collar',
        'strap-L', 'strap-R', 'button',
        'arm-upper-L', 'arm-upper-R',
        'arm-lower-L', 'arm-lower-R',
        'hand-L', 'hand-R',
        'bow-wing-L', 'bow-wing-R',
        'bow-center-L', 'bow-center-R',
        'bow-ribbon-L', 'bow-ribbon-R',
        'ear-L', 'ear-R',
      ],
    },
  },
  
  // 禁止跨图混合的约束
  noCrossTexture: [
    ['eyelid-upper-L', 'eyelid-upper-R'],    // 同一部件必须同图
    ['bow-wing-L', 'bow-wing-R'],             // 对称部件同图
    ['hair-bangs', 'hair-back'],              // 视觉连续区域同图
  ],
};
```

##### 纹理打包约束

```
1. 同一物理组的部件必须合在同一张贴图内
   例: 所有面部部件 → texture_00
       所有头发部件 → texture_01

2. 对称部件 (左右眼/左右眉/左右蝴蝶结) 必须同图
   防止左右纹理精度不一致导致视觉不对称

3. 发丝部件按 alpha 通道分层
   └── hair-back     → 完全不透明底色层
   └── hair-bangs    → 半透明高光层 (叠加在 hair-back 上方)
   └── hair-fringe   → 透明渐变层 (轻量叠加)

4. 避免将高精度面部与低精度身体合图
   面部需要 2K, 身体 2K 独立, 配件 1K
```

#### 5.7.4 图层 ID 命名规范 (Cubism 对齐)

当前 SVG `data-layer` 属性需映射为 Cubism 标准 `PartId`：

```typescript
// ===== SVG data-layer → Cubism PartId 映射规则 =====

// 当前 SVG:
<g id="eyelid-upper-left" data-layer="eyelid-upper" data-side="left">

// → Cubism PartId:
// [BodyPart]_[Side]_[Layer]_[Index]
// 例: EyelidUpper_L_01

const cubismNamingTable: Record<string, string> = {
  // --- 面部 ---
  'face-base':            'Face_Base',
  'face-shadow':          'Face_Shadow',
  'nose':                 'Nose_Base',

  // --- 眼 (每眼 6 层) ---
  'eyelid-upper':         'EyelidUpper_${side}_01',
  'eyelash':              'Eyelash_${side}_01',
  'eyeball':              'Eyeball_${side}_01',
  'iris':                 'Iris_${side}_01',
  'pupil':                'Pupil_${side}_01',
  'eyelid-lower':         'EyelidLower_${side}_01',

  // --- 眉 ---
  'eyebrow':              'Eyebrow_${side}_01',

  // --- 嘴 ---
  'mouth-upper':          'MouthUpper_01',
  'mouth-lower':          'MouthLower_01',
  'mouth-cavity':         'MouthCavity_01',

  // --- 腮红 ---
  'blush':                'Blush_${side}_01',

  // --- 头发 ---
  'hair-back':            'Hair_Back_01',
  'hair-bangs':           'Hair_Bangs_01',
  'hair-sides':           'Hair_Sides_${side}_01',
  'hair-fringe':          'Hair_Fringe_01',

  // --- 蝴蝶结 ---
  'bow-wing':             'Bow_Wing_${side}_01',
  'bow-center':           'Bow_Center_${side}_01',
  'bow-ribbon':           'Bow_Ribbon_${side}_01',

  // --- 身体 ---
  'neck':                 'Neck_01',
  'shoulder':             'Shoulder_${side}_01',
  'arm-upper':            'Arm_Upper_${side}_01',
  'arm-lower':            'Arm_Lower_${side}_01',
  'hand':                 'Hand_${side}_01',

  // --- 服饰 ---
  'inner':                'Inner_01',
  'dress':                'Dress_01',
  'collar':               'Collar_01',
  'strap':                'Strap_${side}_01',
  'button':               'Button_01',

  // --- 配件 ---
  'ear':                  'Ear_${side}_01',
};
```

#### 5.7.5 变形器 (Deformer) 分层绑定规范

```
变形器层级结构 (从顶到底):

  ┌──────────────────────────────────────────────┐
  │  Root (根节点)                                │
  │  ├── Head (头部)                              │
  │  │   ├── Face_Deformer                        │
  │  │   │   ├── EyelidUpper_L                    │  ← 控制左眼睁闭
  │  │   │   ├── EyelidLower_L                    │  ← 控制左眼下垂
  │  │   │   ├── Eyeball_L                        │  ← 控制左眼视线
  │  │   │   ├── Iris_L (子级变形器)              │  ← 控制瞳孔缩放
  │  │   │   ├── EyelidUpper_R                    │  ← 控制右眼睁闭
  │  │   │   ├── EyelidLower_R                    │  ← 控制右眼下垂
  │  │   │   ├── Eyeball_R                        │  ← 控制右眼视线
  │  │   │   ├── Iris_R (子级变形器)              │  ← 控制瞳孔缩放
  │  │   │   ├── Eyebrow_L                        │  ← 控制眉位置
  │  │   │   ├── Eyebrow_R                        │  ← 控制眉位置
  │  │   │   ├── Mouth_Deformer                   │  ← 控制嘴变形
  │  │   │   │   ├── MouthUpper                   │
  │  │   │   │   └── MouthLower                   │
  │  │   │   └── Blush_L/R                        │  ← 控制腮红透明度
  │  │   │
  │  │   ├── Hair_Deformer                        │  ← 头发整体跟随
  │  │   │   ├── Hair_Back                        │  ← 滞后系数 0.1s
  │  │   │   ├── Hair_Bangs                       │  ← 滞后系数 0.08s
  │  │   │   ├── Hair_Sides_L                     │  ← 滞后系数 0.15s
  │  │   │   └── Hair_Sides_R                     │  ← 滞后系数 0.15s
  │  │   │
  │  │   └── Bow_Deformer                         │  ← 蝴蝶结跟随头部
  │  │       ├── Bow_Wing_L                       │  ← 弹簧 220/15
  │  │       ├── Bow_Wing_R                       │  ← 弹簧 220/15
  │  │       ├── Bow_Center_L/R                   │  ← 固定跟随
  │  │       └── Bow_Ribbon_L/R                   │  ← 飘带物理
  │  │
  │  ├── Body (身体)                               │
  │  │   ├── Neck                                 │
  │  │   ├── Shoulder_L/R                         │  ← 耸肩参数
  │  │   ├── Chest_Deformer                       │  ← 呼吸形变
  │  │   │   ├── Inner                            │  ← 内搭跟随
  │  │   │   ├── Dress                            │  ← 背带跟随
  │  │   │   └── Collar                           │  ← 翻领跟随
  │  │   └── Strap_L/R + Button                   │  ← 绑定至身体
  │  │
  │  └── Arms (手臂)                              │
  │      ├── Arm_Upper_L                          │  ← 关键帧旋转
  │      ├── Arm_Lower_L (子级变形器)              │  ← 关键帧旋转
  │      ├── Hand_L (子级变形器)                    │  ← 手指姿态
  │      ├── Arm_Upper_R                          │  ← 关键帧旋转
  │      ├── Arm_Lower_R (子级变形器)              │  ← 关键帧旋转
  │      └── Hand_R (子级变形器)                    │  ← 手指姿态
  └──────────────────────────────────────────────┘

绑定规则:
  1. 每变形器只控制 1 个 Part + 其子 Part
  2. 子变形器不跨父级 (例如 Iris 不能挂在 Hair 下)
  3. 对称 Part 共用同一变形器参数 ID (左右眼共用 ParamEyeOpen)
  4. Hair_Deformer 添加 physics3.json 物理输入
```

#### 5.7.6 参数 ID 统一命名规范

```typescript
// ===== Cubism 参数 ID 标准 =====
// 格式: Param[BodyPart]_[Action]

const parameterIds = {
  // --- 表情参数 ---
  eyeOpen:      'ParamEyeOpen',           // 0~1, 0=闭眼
  eyeLookX:     'ParamEyeLookX',          // -1~1, 视线X
  eyeLookY:     'ParamEyeLookY',          // -1~1, 视线Y
  eyebrowY:     'ParamEyebrowY',          // -1~1, 眉位置
  eyebrowX:     'ParamEyebrowX',          // -1~1, 眉角度
  mouthOpen:    'ParamMouthOpen',         // 0~1, 张嘴
  mouthForm:    'ParamMouthForm',         // -1~1, 嘴型
  blushOpacity: 'ParamBlushOpacity',      // 0~1, 腮红

  // --- 头部参数 ---
  headAngleX:   'ParamAngleX',            // -30~30, 歪头
  headAngleY:   'ParamAngleY',            // -30~30, 低头
  headAngleZ:   'ParamAngleZ',            // -30~30, 转头

  // --- 身体参数 ---
  bodyAngleX:   'ParamBodyAngleX',        // -15~15, 侧身
  breath:       'ParamBreath',            // 0~1, 呼吸

  // --- 手臂参数 ---
  armLiftL:     'ParamArmLiftL',          // 0~1, 左手臂抬升
  armLiftR:     'ParamArmLiftR',          // 0~1, 右手臂抬升
  elbowBendL:   'ParamElbowBendL',        // 0~1, 左手肘弯曲
  elbowBendR:   'ParamElbowBendR',        // 0~1, 右手肘弯曲
  handOpenL:    'ParamHandOpenL',         // 0~1, 左手张开
  handOpenR:    'ParamHandOpenR',         // 0~1, 右手张开

  // --- 物理参数 ---
  hairSway:     'ParamHairSway',          // -1~1, 头发摆动
  bowSway:      'ParamBowSway',           // -1~1, 蝴蝶结摆动
};

// 参数 → 部件绑定关系 (phyiscs.json 配置参考)
const parameterBinding = {
  ParamAngleX: {                    // 歪头
    affects: ['hair-back', 'hair-sides', 'bow-*', 'hair-bangs'],
    physics: { type: 'angle', pendulum: true, lag: 0.15 },
  },
  ParamAngleY: {                    // 低头/仰头
    affects: ['hair-bangs'],
    physics: { type: 'angle', pendulum: true, lag: 0.08 },
  },
  ParamBreath: {                    // 呼吸
    affects: ['chest', 'shoulder', 'arm-lower'],
    physics: { type: 'periodic', period: 3.5, amplitude: 0.5 },
  },
};
```

---

### 5.8 多端适配量化性能指标

#### 5.8.1 硬性性能约束

```typescript
// ===== 全局性能指标 =====
const performanceBudget = {
  // --- 模型复杂度 ---
  model: {
    maxVertexCount: 15000,              // 顶点上限 (全模型)
    maxLayerCount: 45,                   // 图层上限 (含子层)
    maxTextureCount: 4,                  // 贴图张数上限
    maxTextureSize: 4096,                // 单张贴图最大尺寸 (px)
  },

  // --- 帧率 ---
  fps: {
    target: 60,                          // 目标帧率
    acceptable: 30,                      // 可接受最低帧率
    critical: 24,                        // 临界帧率 (低于此值触发降级)
  },

  // --- 加载 ---
  loading: {
    maxInitialLoadTime: 2000,            // 首屏加载上限 (ms)
    maxTextureMemory: 32,                // 贴图显存上限 (MB)
    preferredTextureFormat: 'png-32',    // 首张贴图格式
  },

  // --- 动画 ---
  animation: {
    maxSimultaneousMotions: 2,           // 同时播放动作上限
    maxSimultaneousExpressions: 1,       // 同时表情上限
    motionBlendingFrames: 8,             // 动作混合帧数 (合入/合出)
  },
};
```

#### 5.8.2 顶点预算分配

```typescript
// ===== 各部件顶点分配预算 =====
const vertexBudget = {
  // 总数: 15000 顶点

  // 头部组: 8000 顶点 (53%)
  head: {
    total: 8000,
    breakdown: {
      'face-base':       1200,     // 面部基底
      'face-shadow':     400,      // 面部阴影
      'nose':            200,      // 鼻子
      'eyelid-upper':    800,      // 上眼睑 ×2
      'eyelid-lower':    600,      // 下眼睑 ×2
      'eyeball':         1000,     // 眼球 ×2
      'iris':            600,      // 虹膜 ×2 (高精度)
      'eyebrow':         400,      // 眉毛 ×2
      'mouth-upper':     300,      // 上唇
      'mouth-lower':     250,      // 下唇
      'mouth-cavity':    150,      // 口腔
      'blush':           300,      // 腮红 ×2
      'ear':             300,      // 耳朵 ×2
      'neck':            500,      // 脖颈
    },
  },

  // 头发组: 4000 顶点 (27%)
  hair: {
    total: 4000,
    breakdown: {
      'hair-back':       1500,     // 后层发 (大面积)
      'hair-bangs':      1200,     // 刘海 (锯齿需要精细网格)
      'hair-sides':      800,      // 鬓角 ×2
      'hair-fringe':     500,      // 前额碎发
    },
  },

  // 身体组: 2000 顶点 (13%)
  body: {
    total: 2000,
    breakdown: {
      'inner':           600,      // 内搭
      'dress':           600,      // 背带
      'collar':          300,      // 翻领
      'strap':           300,      // 背带 ×2
      'button':          200,      // 纽扣 ×2
    },
  },

  // 配件组: 1000 顶点 (7%)
  accessory: {
    total: 1000,
    breakdown: {
      'bow-wing':        400,      // 蝴蝶结翼 ×2
      'bow-center':      200,      // 蝴蝶结心 ×2
      'bow-ribbon':      200,      // 飘带 ×2
      'other':           200,      // 备用
    },
  },
};

// 顶点超限处理策略:
// 1. 超限 10% 以内: 降低 iris 和 hair-bangs 网格精度 (各减 200 顶点)
// 2. 超限 10-20%: 裁剪 hair-back 底部不可见区域 (减 300 顶点)
// 3. 超限 >20%: 需重新合图, 拆分为 3 张贴图分散顶点密度
```

#### 5.8.3 低端机型降帧兜底策略

```typescript
// ===== 降级策略 (按严重程度递增) =====

const degradationStrategy = {
  // Tier 0: 帧率 ≥ 45fps — 全量渲染
  fullQuality: {
    physicsEnabled: true,
    motionBlending: true,
    expressionSmooth: true,
    particleEffects: true,
    shadowLayers: true,
  },

  // Tier 1: 帧率 30-44fps — 轻度降级
  lightDegradation: {
    trigger: 'fps < 45 for 3s',
    physicsEnabled: true,
    motionBlending: true,
    expressionSmooth: true,
    particleEffects: false,           // 关闭背景粒子
    shadowLayers: false,              // 关闭面部/服饰阴影层
    revertOnFps: 'fps > 50 for 2s',  // 恢复条件
  },

  // Tier 2: 帧率 24-29fps — 中度降级
  mediumDegradation: {
    trigger: 'fps < 30 for 2s',
    physicsEnabled: false,            // 关闭头发/蝴蝶结物理
    motionBlending: true,
    expressionSmooth: false,          // 表情直接切换 (无过渡)
    particleEffects: false,
    shadowLayers: false,
    textureQuality: 'downscale-0.75x',// 纹理缩小 0.75x
    animationFramerate: '30fps-locked',// 动画帧率锁 30fps
    revertOnFps: 'fps > 35 for 5s',
  },

  // Tier 3: 帧率 < 24fps — 重度降级
  criticalDegradation: {
    trigger: 'fps < 24 for 1s',
    physicsEnabled: false,
    motionBlending: false,
    expressionSmooth: false,
    particleEffects: false,
    shadowLayers: false,
    textureQuality: 'downscale-0.5x', // 纹理缩小 0.5x
    animationFramerate: '24fps-locked',
    // 切换到静态帧模式: 只保留最后一张表情帧
    staticMode: true,
    staticModeTexture: 'lowres-atlas', // 使用低分辨率合图
    showFpsMeter: true,               // 显示 FPS 指示器 (调试用)
    logWarning: true,
    revertOnFps: 'fps > 28 for 5s',
  },
};

// ===== 性能监控实现框架 =====
class PerformanceMonitor {
  private fpsHistory: number[] = [];
  private currentTier: 0 | 1 | 2 | 3 = 0;

  // 每帧回调
  onFrame(deltaMs: number) {
    const fps = 1000 / deltaMs;
    this.fpsHistory.push(fps);

    // 每 60 帧评估一次
    if (this.fpsHistory.length >= 60) {
      const avgFps = this.fpsHistory.reduce((a, b) => a + b) / this.fpsHistory.length;
      this.evaluateTier(avgFps);
      this.fpsHistory = [];
    }
  }

  private evaluateTier(avgFps: number) {
    if (avgFps >= 45) this.applyTier(0);
    else if (avgFps >= 30) this.applyTier(1);
    else if (avgFps >= 24) this.applyTier(2);
    else this.applyTier(3);
  }

  private applyTier(tier: 0 | 1 | 2 | 3) {
    if (tier === this.currentTier) return;
    this.currentTier = tier;
    console.log(`[Performance] Degradation tier: ${tier}`);
    // 应用对应 tier 的配置
  }
}
```

#### 5.8.4 适配裁剪测试标准

```typescript
// ===== 3 种裁剪模式的验收标准 =====
const cropTestSpec = {
  'chat-avatar': {
    // 聊天列表头像: 80×80
    viewport: { width: 80, height: 80 },
    mustBeVisible: [
      'face-base', 'eyelid-upper-L', 'eyelid-upper-R',
      'eyeball-L', 'eyeball-R', 'mouth-upper',
      'hair-bangs', 'bow-wing-L', 'bow-wing-R',
    ],
    mayBeClipped: [
      'hair-back', 'hair-sides', 'neck', 'shoulder',
    ],
    // 验收标准: 90% 以上 mustBeVisible 完整呈现
    passThreshold: 0.9,
  },

  'chat-dialog': {
    // 聊天对话页: 320×400
    viewport: { width: 320, height: 400 },
    mustBeVisible: [
      'face-base', 'eyelid-upper-L', 'eyelid-upper-R',
      'eyeball-L', 'eyeball-R', 'mouth-upper', 'mouth-lower',
      'hair-bangs', 'hair-back', 'hair-sides',
      'bow-wing-L', 'bow-wing-R',
      'neck', 'shoulder-L', 'shoulder-R',
      'inner', 'dress', 'collar',
    ],
    mayBeClipped: [
      'arm-lower', 'hand', 'button',
    ],
    passThreshold: 0.85,
  },

  'fullscreen': {
    // 全屏角色页: 400×520
    viewport: { width: 400, height: 520 },
    mustBeVisible: 'all-38-layers',  // 全部 38 层
    mayBeClipped: [],
    passThreshold: 1.0,
  },
};
```

#### 5.8.5 移动端硬件兼容矩阵

```typescript
// ===== 目标设备分级 =====
const hardwareTiers = {
  flagship: {
    // 如 iPhone 15 Pro / Snapdragon 8 Gen 3
    description: '旗舰机型',
    expectedFps: 60,
    supportedFeatures: [
      'physics-all', 'motion-blend', 'expression-smooth',
      'particles', 'shadows', 'full-texture',
    ],
    textureQuality: '2K',
  },

  midRange: {
    // 如 iPhone 12 / Snapdragon 778G
    description: '中端机型',
    expectedFps: 45,
    supportedFeatures: [
      'physics-all', 'motion-blend', 'expression-smooth',
      'particles-off', 'shadows-off', 'full-texture',
    ],
    textureQuality: '2K',
  },

  budget: {
    // 如 iPhone SE 2 / Snapdragon 665
    description: '低端机型',
    expectedFps: 30,
    supportedFeatures: [
      'physics-hair-only', 'motion-blend', 'expression-direct',
      'particles-off', 'shadows-off', 'texture-1K',
    ],
    textureQuality: '1K',
  },

  entry: {
    // 如 Redmi 9A / 低端设备
    description: '入门机型',
    expectedFps: 24,
    supportedFeatures: [
      'physics-off', 'motion-direct', 'expression-direct',
      'particles-off', 'shadows-off', 'texture-512',
      'static-mode-fallback',
    ],
    textureQuality: '512px',
  },
};
```

---

### 5.9 完整 docs/ 目录与交付完成度

```
docs/
├── character-v2-tech-spec.md              ← 目标规范 (做什么)
├── character-v2-remediation.md            ← 修复方案 + 全部补充项 (怎么修)
└── qa-signoff-checklist.md                ← 验收流程 (待创建)

remediation.md 补充完成度:
  §1-4: 原 19 子问题修复方案    ✅
  §5.1: 物理参数迁移             ✅ 新增
  §5.2: 动作协议 + 冲突处理      ✅ 新增
  §5.3: 不对称 + 微待机          ✅ 新增
  §5.4: 安全围栏 + 色彩兜底      ✅ 新增
  §5.5: 验收闭环 (摘要)          ✅ 新增
  §5.6: 文档关系                 ✅ 新增
  §5.7: Cubism 工程交付规范      ✅ 🆕 缺口 1 补齐
  §5.8: 性能指标 + 降级策略      ✅ 🆕 缺口 2 补齐
  §5.9: 交付完成度总表           ✅ 🆕
═══════════════════════════════════════════
  总覆盖率: 100%
