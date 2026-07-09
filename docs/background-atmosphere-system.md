# 🌌 背景氛围系统技术文档 (Background Atmosphere System)

> 版本：v1.0 · Vanta.js FOG + STARS 双背景层 · 情绪色联动
> 适配「心言・MindChat」虚拟人设陪伴页深色 UI

---

## 一、背景架构总览

### 1.1 层级结构 (Z-Index)

```
┌── UI 交互层 ──────────────────────┐  z: 100
│  按钮 / 输入框 / 情绪标签          │
├── 玻璃卡片层 ──────────────────────┤  z: 50
│  聊天气泡 / 角色面板                │
│  backdrop-filter: blur(20px)       │
├── 前景粒子层 ──────────────────────┤  z: 20
│  tsParticles 情绪色粒子飘散         │
│  (开心→金色/难过→蓝色/害羞→粉红)   │
├── 角色层 ──────────────────────────┤  z: 10
│  2D 虚拟形象 SVG                   │
├── 角色情绪光晕层 ──────────────────┤  z: 5
│  径向渐变光晕跟随表情色             │
├── Vanta STARS 背景 ───────────────│  z: 3
│  深邃星空粒子 (静态或缓慢旋转)      │
├── Vanta FOG 迷雾极光背景 ─────────│  z: 2
│  流动极光光晕 (情绪色联动)          │
└── 深色基底 ────────────────────────┘  z: 1
    #0A0A1A 背景色
```

### 1.2 渲染性能分级

```
层编号  层名称          渲染方式      GPU 开销    帧率影响
───────────────────────────────────────────────────────
L1      深色基底         CSS          0%          0%
L2      Vanta FOG       WebGL        ~15%        -2fps
L3      Vanta STARS     WebGL        ~10%        -1fps
L4      角色光晕         CSS          0%          0%
L5      SVG 角色        2D Canvas    ~5%         -1fps
L6      前景粒子         Canvas/WebGL ~10%       -2fps
L7      玻璃卡片         CSS GPU      ~3%         0%
L8      UI 交互          CSS          ~2%         0%
───────────────────────────────────────────────────────
合计                    ──           ~45%        -6fps
```

**目标设备帧率**：
- 旗舰机: 55-60fps (L6 开启)
- 中端机: 45-50fps (L6 关闭)
- 低端机: 30-40fps (L2+L3 降质)

---

## 二、Vanta.js 集成方案

### 2.1 安装

```bash
npm install vanta
```

或通过 CDN 加载 (推荐，按需分包)：

```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/vanta@latest/dist/vanta.fog.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/vanta@latest/dist/vanta.stars.min.js"></script>
```

### 2.2 React 封装组件

#### VantaFog — 迷雾极光背景

```tsx
// src/components/effects/VantaFog.tsx
import { useEffect, useRef } from "react";
import * as THREE from "three";
import FOG from "vanta/dist/vanta.fog.min";

interface VantaFogProps {
  accentColor?: string;   // 情绪主色
  highlightColor?: string; // 情绪辅色
  midtoneColor?: string;  // 中间色
  mouseControls?: boolean;
  touchControls?: boolean;
  gyroControls?: boolean;
  minHeight?: number;
  minWidth?: number;
  speed?: number;          // 流速 0.5~3
}

const VantaFog: React.FC<VantaFogProps> = ({
  accentColor = 0x7c5cfc,       // 默认紫
  highlightColor = 0xff6b9d,    // 默认粉
  midtoneColor = 0x4a3a8a,      // 默认深紫
  mouseControls = true,
  touchControls = true,
  gyroControls = false,
  minHeight = 200,
  minWidth = 200,
  speed = 1.2,
}) => {
  const vantaRef = useRef<HTMLDivElement>(null);
  const vantaEffect = useRef<any>(null);

  useEffect(() => {
    if (!vantaRef.current) return;

    vantaEffect.current = FOG({
      el: vantaRef.current,
      THREE,
      mouseControls,
      touchControls,
      gyroControls,
      minHeight,
      minWidth,
      speed,
      baseColor: 0x0a0a1a,          // 深色基底
      backgroundColor: 0x0a0a1a,     // 背景色
      accentColor,
      highlightColor,
      midtoneColor,
      blurFactor: 0.6,               // 模糊度 0~1
      zoom: 0.8,                      // 缩放
    });

    return () => {
      vantaEffect.current?.destroy();
    };
  }, []);

  // 情绪色变化时更新
  useEffect(() => {
    if (!vantaEffect.current) return;
    vantaEffect.current.setOptions({
      accentColor,
      highlightColor,
      midtoneColor,
    });
  }, [accentColor, highlightColor, midtoneColor]);

  return (
    <div
      ref={vantaRef}
      className="fixed inset-0 -z-10"
      style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%" }}
    />
  );
};

export default VantaFog;
```

#### VantaStars — 星空粒子背景

```tsx
// src/components/effects/VantaStars.tsx
import { useEffect, useRef } from "react";
import * as THREE from "three";
import STARS from "vanta/dist/vanta.stars.min";

interface VantaStarsProps {
  color?: number;
  starDensity?: number;   // 星星密度
  rotationSpeed?: number; // 旋转速度
  mouseControls?: boolean;
}

const VantaStars: React.FC<VantaStarsProps> = ({
  color = 0x7c5cfc,
  starDensity = 0.6,
  rotationSpeed = 0.5,
  mouseControls = false,   // 星星不响应鼠标（留给FOG层）
}) => {
  const vantaRef = useRef<HTMLDivElement>(null);
  const vantaEffect = useRef<any>(null);

  useEffect(() => {
    if (!vantaRef.current) return;

    vantaEffect.current = STARS({
      el: vantaRef.current,
      THREE,
      mouseControls: false,
      touchControls: false,
      gyroControls: false,
      minHeight: 200,
      minWidth: 200,
      color,
      starDensity,
      rotationSpeed,
      backgroundColor: 0x0a0a1a,
      showSun: true,          // 显示中心光晕
      sunSize: 0.3,           // 光晕大小
    });

    return () => {
      vantaEffect.current?.destroy();
    };
  }, []);

  useEffect(() => {
    if (!vantaEffect.current) return;
    vantaEffect.current.setOptions({ color });
  }, [color]);

  return (
    <div
      ref={vantaRef}
      className="fixed inset-0 -z-20"
      style={{
        position: "fixed", top: 0, left: 0, width: "100%", height: "100%",
        opacity: 0.4,  // 半透明叠加在FOG之上，不能喧宾夺主
      }}
    />
  );
};

export default VantaStars;
```

### 2.3 双背景叠加

两个 Vanta 组件通过**半透明叠加**实现层次感：

```tsx
// 在 App.tsx 或 Layout.tsx 中使用
<div className="fixed inset-0">
  <VantaStars       // z: 3 — 底层星空 (opacity 0.4)
    color={emotionColor}
    starDensity={0.6}
    rotationSpeed={0.5}
  />
  <VantaFog         // z: 2 — 上层极光 (完全显示)
    accentColor={emotionAccent}
    highlightColor={emotionHighlight}
    midtoneColor={emotionMidtone}
    speed={1.2}
  />
</div>
```

---

## 三、情绪色联动系统

### 3.1 情绪色映射表

```typescript
// src/data/emotionColors.ts
export interface EmotionColorScheme {
  accent: number;       // Vanta accentColor (主色)
  highlight: number;    // Vanta highlightColor (高光)
  midtone: number;      // Vanta midtoneColor (中间色)
  glow: string;         // 角色光晕 CSS color
  particle: string;     // 前景粒子色 CSS color
  name: string;         // 调色板名称
}

export const emotionColorSchemes: Record<string, EmotionColorScheme> = {
  idle: {
    accent: 0x7c5cfc,        // 紫
    highlight: 0x6c4cf0,     // 深紫
    midtone: 0x4a3a8a,       // 暗紫
    glow: "rgba(124, 92, 252, 0.15)",
    particle: "#7c5cfc",
    name: "静谧紫",
  },
  happy: {
    accent: 0xff9a56,        // 暖橙
    highlight: 0xff6b3d,     // 橙红
    midtone: 0xcc7a44,       // 金橙
    glow: "rgba(255, 154, 86, 0.2)",
    particle: "#FFD700",
    name: "暖阳橙",
  },
  sad: {
    accent: 0x4a90d9,        // 冷蓝
    highlight: 0x6ab0f0,     // 亮蓝
    midtone: 0x2a5a8a,       // 深蓝
    glow: "rgba(74, 144, 217, 0.2)",
    particle: "#4A90D9",
    name: "静夜蓝",
  },
  surprised: {
    accent: 0x00d4ff,        // 电蓝
    highlight: 0x66e0ff,     // 亮青
    midtone: 0x0099cc,       // 深青
    glow: "rgba(0, 212, 255, 0.25)",
    particle: "#00D4FF",
    name: "惊喜青",
  },
  shy: {
    accent: 0xff6b9d,        // 粉红
    highlight: 0xff8db8,     // 浅粉
    midtone: 0xcc5588,       // 暗粉
    glow: "rgba(255, 107, 157, 0.2)",
    particle: "#FF6B9D",
    name: "羞怯粉",
  },
  thinking: {
    accent: 0xa29bfe,        // 淡紫
    highlight: 0xc4b0ff,     // 浅紫
    midtone: 0x7c6ccc,       // 灰紫
    glow: "rgba(162, 155, 254, 0.15)",
    particle: "#A29BFE",
    name: "思绪紫",
  },
  angry: {
    accent: 0xff4757,        // 红
    highlight: 0xff6b6b,     // 亮红
    midtone: 0xcc2233,       // 暗红
    glow: "rgba(255, 71, 87, 0.2)",
    particle: "#FF4757",
    name: "微怒红",
  },
  relaxed: {
    accent: 0x55efc4,        // 薄荷
    highlight: 0x81ecec,     // 青绿
    midtone: 0x339988,       // 深绿
    glow: "rgba(85, 239, 196, 0.15)",
    particle: "#55EFC4",
    name: "放松绿",
  },
};
```

### 3.2 情绪色过渡动画

```typescript
// 情绪色变化时的过渡参数
const emotionTransition = {
  // Vanta 颜色更新 (setOptions 内部自动过渡)
  vanta: {
    duration: 800,           // 800ms 渐变过渡
    easing: "easeInOut",
  },
  // 角色光晕 CSS 过渡
  glow: {
    duration: 800,
    easing: "easeInOut",
    property: "background",
  },
  // 前景粒子过渡
  particle: {
    duration: 1000,
    easing: "easeOut",
  },
};
```

---

## 四、前景粒子系统 (tsParticles)

### 4.1 安装

```bash
npm install tsparticles @tsparticles/react
```

### 4.2 情绪粒子配置

```tsx
// src/components/effects/EmotionParticles.tsx
import { useCallback } from "react";
import Particles from "@tsparticles/react";
import { loadSlim } from "@tsparticles/slim";
import type { Container, Engine } from "@tsparticles/engine";

interface EmotionParticlesProps {
  color: string;            // 情绪色
  speed?: number;           // 粒子速度 (开心快, 难过慢)
  quantity?: number;        // 粒子数量
  shape?: "circle" | "star" | "heart";  // 粒子形状
}

const EmotionParticles: React.FC<EmotionParticlesProps> = ({
  color = "#7c5cfc",
  speed = 1,
  quantity = 30,
  shape = "circle",
}) => {
  const particlesInit = useCallback(async (engine: Engine) => {
    await loadSlim(engine);
  }, []);

  return (
    <Particles
      id="emotion-particles"
      init={particlesInit}
      options={{
        fpsLimit: 30,
        particles: {
          number: { value: quantity, density: { enable: true } },
          color: { value: color },
          shape: { type: shape },
          opacity: {
            value: { min: 0.1, max: 0.5 },
            animation: { enable: true, speed: 0.5, sync: false },
          },
          size: {
            value: { min: 1, max: 4 },
            animation: { enable: true, speed: 1, sync: false },
          },
          move: {
            enable: true,
            speed: speed,
            direction: "none" as const,
            random: true,
            straight: false,
            outModes: { default: "bounce" as const },
            attract: { enable: true, rotateX: 600, rotateY: 600 },
          },
        },
        interactivity: {
          events: {
            onHover: { enable: true, mode: "repulse" as const },
            onClick: { enable: true, mode: "push" as const },
          },
          modes: {
            repulse: { distance: 100, duration: 0.4 },
            push: { quantity: 4 },
          },
        },
        detectRetina: false,
      }}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 20 }}
    />
  );
};

export default EmotionParticles;
```

### 4.3 情绪联动参数

```typescript
// 表情 → 粒子参数映射
const particleEmotionMap = {
  idle:    { speed: 0.5, quantity: 20, shape: "circle" },
  happy:   { speed: 1.5, quantity: 40, shape: "star" },
  sad:     { speed: 0.3, quantity: 15, shape: "circle" },
  surprised: { speed: 2, quantity: 50, shape: "star" },
  shy:     { speed: 0.6, quantity: 25, shape: "heart" },
  thinking: { speed: 0.4, quantity: 20, shape: "circle" },
  angry:   { speed: 1.8, quantity: 35, shape: "circle" },
  relaxed: { speed: 0.3, quantity: 18, shape: "circle" },
};
```

---

## 五、角色情绪光晕层

```tsx
// src/components/effects/EmotionGlow.tsx
import { motion } from "framer-motion";

interface EmotionGlowProps {
  color: string;    // 情绪光晕色
  size?: number;    // 光晕大小
}

const EmotionGlow: React.FC<EmotionGlowProps> = ({
  color = "rgba(124, 92, 252, 0.15)",
  size = 600,
}) => (
  <motion.div
    className="fixed -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none"
    style={{
      left: "50%",
      top: "50%",
      width: size,
      height: size,
      filter: "blur(80px)",
      zIndex: 5,
    }}
    animate={{
      background: `radial-gradient(ellipse at center, ${color}, transparent 70%)`,
    }}
    transition={{ duration: 0.8, ease: "easeInOut" }}
  />
);

export default EmotionGlow;
```

---

## 六、玻璃拟态 UI 集成

### 6.1 玻璃卡片组件

```tsx
// src/components/ui/GlassCard.tsx
interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  blur?: number;      // 模糊程度
  opacity?: number;    // 背景透明度
  glow?: boolean;      // 是否带边框发光
}

const GlassCard: React.FC<GlassCardProps> = ({
  children,
  className = "",
  blur = 20,
  opacity = 0.06,
  glow = false,
}) => (
  <div
    className={`rounded-2xl ${glow ? "shadow-lg" : ""} ${className}`}
    style={{
      background: `rgba(255, 255, 255, ${opacity})`,
      backdropFilter: `blur(${blur}px)`,
      WebkitBackdropFilter: `blur(${blur}px)`,
      border: "1px solid rgba(255, 255, 255, 0.08)",
      boxShadow: glow
        ? `0 0 30px rgba(124, 92, 252, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.05)`
        : "none",
    }}
  >
    {children}
  </div>
);
```

### 6.2 全局样式更新

```css
/* src/index.css — 新增玻璃拟态工具类 */

/* 玻璃卡片基类 */
.glass {
  background: rgba(255, 255, 255, 0.06);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 20px;
}

/* 玻璃卡片 - 强调 (用于角色面板/操作区) */
.glass-strong {
  background: rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(25px);
  -webkit-backdrop-filter: blur(25px);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 24px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}

/* 玻璃输入框 */
.glass-input {
  background: rgba(255, 255, 255, 0.04);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 14px;
  color: #e8e8f0;
  outline: none;
  transition: all 0.3s ease;
}
.glass-input:focus {
  border-color: rgba(124, 92, 252, 0.4);
  box-shadow: 0 0 20px rgba(124, 92, 252, 0.1);
}

/* 玻璃按钮 */
.glass-btn {
  background: rgba(255, 255, 255, 0.04);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 12px;
  color: rgba(255, 255, 255, 0.6);
  transition: all 0.3s ease;
}
.glass-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.15);
  color: rgba(255, 255, 255, 0.9);
}

/* 渐变边框 (用于特殊强调元素) */
.glass-border-gradient {
  border: 1px solid transparent;
  background-clip: padding-box;
  position: relative;
}
.glass-border-gradient::before {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  padding: 1px;
  background: linear-gradient(135deg, rgba(124, 92, 252, 0.3), rgba(255, 107, 157, 0.3));
  -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  pointer-events: none;
}
```

---

## 七、性能优化策略

### 7.1 分级渲染配置

```typescript
// src/config/performance.ts
export const performanceTiers = {
  high: {
    // 旗舰机: 全开
    vantaFog: true,
    vantaStars: true,
    particles: true,
    particleCount: 40,
    glassBlur: 25,
    fpsLimit: 60,
  },
  medium: {
    // 中端机: 关闭粒子
    vantaFog: true,
    vantaStars: true,
    particles: false,
    particleCount: 0,
    glassBlur: 20,
    fpsLimit: 45,
  },
  low: {
    // 低端机: 降质Vanta + 简化玻璃
    vantaFog: true,
    vantaStars: false,
    particles: false,
    particleCount: 0,
    glassBlur: 12,
    fpsLimit: 30,
  },
};
```

### 7.2 FPS 监控 & 自动降级

```typescript
// src/hooks/usePerformanceMonitor.ts
import { useState, useEffect, useRef } from "react";

type PerformanceTier = "high" | "medium" | "low";

export function usePerformanceMonitor() {
  const [tier, setTier] = useState<PerformanceTier>("high");
  const frames = useRef<number[]>([]);
  const lastTime = useRef(performance.now());

  useEffect(() => {
    let animId: number;

    const check = (time: number) => {
      const delta = time - lastTime.current;
      lastTime.current = time;
      frames.current.push(1000 / delta);

      if (frames.current.length >= 60) {
        const avg = frames.current.reduce((a, b) => a + b) / frames.current.length;
        if (avg >= 50) setTier("high");
        else if (avg >= 35) setTier("medium");
        else setTier("low");
        frames.current = [];
      }

      animId = requestAnimationFrame(check);
    };

    animId = requestAnimationFrame(check);
    return () => cancelAnimationFrame(animId);
  }, []);

  return tier;
}
```

---

## 八、实施计划

| Phase | 内容 | 涉及文件 | 工时 |
|-------|------|----------|------|
| **B1** | 安装 vanta + three.js 依赖 | `package.json` | ~5min |
| **B2** | VantaFog 组件 + 情绪色联动 | `VantaFog.tsx` | ~1h |
| **B3** | VantaStars 组件 + 双背景叠加 | `VantaStars.tsx` | ~0.5h |
| **B4** | 情绪色映射表 + 联动系统 | `emotionColors.ts` | ~0.5h |
| **B5** | 角色情绪光晕组件 | `EmotionGlow.tsx` | ~0.3h |
| **B6** | 玻璃拟态 CSS + GlassCard 组件 | `index.css` + `GlassCard.tsx` | ~0.5h |
| **B7** | 前景粒子系统 (tsParticles) | `EmotionParticles.tsx` | ~0.5h |
| **B8** | 性能监控 + 分级降级 | `usePerformanceMonitor.ts` | ~0.5h |
| **B9** | 集成测试 + 多端适配 | App.tsx | ~0.5h |

> **总计: ~4.3h** (9 个 Phase)

---

## 九、文件结构

```
src/
├── components/
│   ├── effects/
│   │   ├── VantaFog.tsx           ← 极光迷雾背景 (WebGL)
│   │   ├── VantaStars.tsx         ← 星空粒子背景 (WebGL)
│   │   ├── EmotionGlow.tsx        ← 角色情绪光晕 (CSS)
│   │   └── EmotionParticles.tsx   ← 前景情绪粒子 (tsParticles)
│   └── ui/
│       └── GlassCard.tsx          ← 玻璃卡片组件
├── data/
│   └── emotionColors.ts           ← 情绪色映射表
├── hooks/
│   └── usePerformanceMonitor.ts   ← 性能监控
├── config/
│   └── performance.ts             ← 分级渲染配置
└── index.css                      ← 玻璃拟态全局样式
```

---

## 十、注意事项

1. **Vanta 加载顺序** — THREE.js 必须在 Vanta 之前加载，否则报错
2. **双背景 z-index** — Stars 在 Fog 下层，Stars 设 `opacity: 0.4` 半透明
3. **移动端降质** — `detectRetina: false` 在低端机可关闭视网膜渲染
4. **粒子性能** — 粒子数 ≤ 40，否则低端机卡顿
5. **玻璃毛边** — `backdrop-filter` 在 Android WebView 低版本不支持，需加 `@supports` 兜底
