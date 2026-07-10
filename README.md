# 心言 · MindChat

> 轻量化 Live2D 虚拟人情感陪伴 Web 应用  
> *你的专属虚拟灵魂搭子*

---

## 项目定位

**MindChat** 是一款基于 Live2D + AI 大模型的虚拟人交互应用。通过 2D 动态角色 + 实时情感推断 + 流式 AI 对话，打造沉浸式虚拟陪伴体验。

| 维度 | 内容 |
|------|------|
| **定位** | 轻量化 2D 虚拟人情感陪伴 Web 应用 |
| **目标** | Z 世代年轻人，情绪树洞、轻陪伴 |
| **视觉基调** | 毛玻璃 / 渐变噪点 / 柔光 / 圆润卡片 / 深色 + 紫粉调 |

---

## 功能特性

- **Live2D 角色渲染** — 基于 PIXI.js + Cubism SDK，支持呼吸、眨眼、表情切换、动作系统
- **流式 AI 对话** — 支持 OpenAI / DeepSeek / 通义千问 / 自定义端点，SSE 流式输出
- **智能情绪引擎** — 基于 AI 回复内容自动推断 8 种表情（开心/难过/惊讶/害羞/生气/思考/放松/中立）
- **触摸交互** — 点击角色头部/身体/手部触发不同动作反馈
- **动作优先级系统** — Login > Touch > Emotion > Idle，避免动作冲突
- **拖拽分栏** — 聊天面板与角色展示区比例可自由调整
- **离线模拟** — 未配置 API Key 时自动降级为规则对话
- **配置持久化** — AI 设置自动保存到 localStorage

---

## 技术栈

| 技术 | 说明 |
|------|------|
| **React 19** + TypeScript | UI 框架 |
| **Vite 8** | 构建工具 |
| **Tailwind CSS v4** | 原子化样式 |
| **PIXI.js 6** | Canvas 2D 渲染引擎 |
| **pixi-live2d-display** | Live2D Cubism 2 运行时 |
| **Zustand 5** | 轻量状态管理 |
| **Framer Motion** | 声明式 UI 动画 |

---

## 快速开始

### 环境要求

- Node.js >= 18
- npm / pnpm / yarn

### 安装与运行

```bash
# 进入项目
cd mindchat-live2d

# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 预览构建结果
npm run preview
```

### AI 服务配置

启动后点击右上角 **⚡ AI 已连接** / **⚠ 未配置 AI** 按钮，填写 AI 配置：

| 配置项 | 说明 |
|--------|------|
| **提供商** | OpenAI / DeepSeek / 通义千问 / 自定义端点 |
| **API Key** | 对应提供商的 API 密钥 |
| **模型** | 如 `gpt-4o-mini`、`deepseek-chat`、`qwen-plus` |

> 💡 不配置 API Key 时，系统自动使用内置离线模拟对话。

---

## 项目结构

```
mindchat-live2d/
├── public/
│   └── assets/                  # Live2D 模型资源 (.model.json / .mtn 动作文件)
├── src/
│   ├── main.tsx                 # 应用入口
│   ├── App.tsx                  # 主布局（分栏 + 拖拽）
│   ├── index.css                # 全局样式 + Tailwind
│   │
│   ├── components/
│   │   ├── Live2D/
│   │   │   └── Live2DViewer.tsx # Live2D 渲染 + 表情/动作/触摸系统
│   │   ├── chat/                # 聊天模块
│   │   │   ├── ChatWindow.tsx   # 聊天窗口容器
│   │   │   ├── ChatBubble.tsx   # 聊天气泡
│   │   │   ├── ChatInput.tsx    # 输入框
│   │   │   ├── PanelHeader.tsx  # 面板头部（折叠/清空）
│   │   │   └── QuickReplies.tsx # 快捷回复
│   │   ├── scene/               # 场景层
│   │   │   ├── SceneBackground.tsx
│   │   │   ├── CharacterOverlay.tsx
│   │   │   └── ProjectCredit.tsx
│   │   ├── settings/
│   │   │   └── SettingsPanel.tsx # AI 配置面板
│   │   └── ErrorBoundary.tsx    # 错误边界
│   │
│   ├── hooks/
│   │   └── useLive2D.ts         # Live2D 初始化 Hook
│   │
│   ├── store/
│   │   ├── chatStore.ts         # 对话状态（消息/流式/表情）
│   │   └── settingsStore.ts     # 设置状态（AI 配置持久化）
│   │
│   ├── services/
│   │   ├── ai.ts                # AI 流式对话 + 离线模拟
│   │   └── providers.ts         # AI 提供商定义
│   │
│   ├── data/
│   │   ├── characters.ts        # 角色预设
│   │   └── expressions.ts       # 8 种表情定义 + 情绪推断
│   │
│   └── types/
│       └── index.ts             # TypeScript 类型 + 常量配置
│
├── docs/                        # 开发文档（10 篇设计/技术说明）
├── PROJECT_PLAN.md              # 项目规划书
└── README.md
```

---

## 架构设计

```
┌─────────────────────────────────────────────────────┐
│  App.tsx                                             │
│  ┌────────────────────┐ ┌──────────────────────────┐│
│  │  Live2D 渲染层       │ │  聊天面板（glass-panel）  ││
│  │  · SceneBackground   │ │  · PanelHeader           ││
│  │  · Live2DViewer      │ │  · ChatWindow            ││
│  │  · CharacterOverlay  │ │  · ChatInput             ││
│  │  · ProjectCredit     │ │  · QuickReplies          ││
│  └────────────────────┘ └──────────────────────────┘│
│                    ↕ 拖拽分栏                          │
├─────────────────────────────────────────────────────┤
│  Zustand Store                                       │
│  · chatStore: messages / isStreaming / expression    │
│  · settingsStore: AI config / localStorage 持久化     │
├─────────────────────────────────────────────────────┤
│  Services                                            │
│  · streamChat(): SSE 流式 AI 调用                    │
│  · simulateChat(): 离线规则对话                       │
│  · providers: OpenAI / DeepSeek / Qwen / Custom      │
├─────────────────────────────────────────────────────┤
│  Live2D Engine (PIXI.js + Cubism SDK)                │
│  · 表情系统 (8 种)   · 动作系统 (4 级优先级)          │
│  · 触摸交互         · Idle 循环 + 自发动作            │
└─────────────────────────────────────────────────────┘
```

### 对话数据流

```
用户输入 → chatStore.sendMessage()
  → inferExpression() 推断用户情绪
  → 添加用户消息（含表情）
  → 创建 AI 占位消息
  → [已配置] streamChat() SSE 流式输出
  → [未配置] simulateChat() 规则逐字输出
  → 每个 chunk 更新内容 + 实时表情推断（800ms 防抖）
  → 完成后 5s 表情渐退到 neutral
  → Live2DViewer 接收 expression 变化 → 播放对应动作
```

### 表情系统

| 表情 | ID | 触发示例 |
|------|:--:|----------|
| 😐 中立 | `neutral` | 默认状态 |
| 😊 开心 | `happy` | "哈哈"、"真好" |
| 😢 难过 | `sad` | "难过"、"伤心" |
| 😲 惊讶 | `surprised` | "什么"、"真的吗" |
| 😳 害羞 | `shy` | "不好意思"、"害羞" |
| 😠 生气 | `angry` | "生气"、"可恶" |
| 🤔 思考 | `thinking` | AI 生成回复中 |
| 😌 放松 | `relaxed` | "晚安"、"休息" |

### 动作优先级

| 优先级 | 类型 | 说明 |
|:--:|------|------|
| 1 | Login | 启动时播放（最高） |
| 2 | Touch | 用户触摸角色时 |
| 3 | Emotion | 表情变化触发 |
| 4 | Idle | 空闲循环 + 随机动作 |

---

## AI 提供商

内置 4 个 OpenAI 兼容端点：

| 提供商 | 默认模型 | API 端点 |
|--------|----------|----------|
| **OpenAI** | `gpt-4o-mini` | `https://api.openai.com/v1` |
| **DeepSeek** | `deepseek-chat` | `https://api.deepseek.com/v1` |
| **通义千问** | `qwen-plus` | `https://dashscope.aliyuncs.com/compatible-mode/v1` |
| **自定义** | — | 用户自填 |

支持通过环境变量预配置：

```bash
VITE_DEFAULT_PROVIDER=openai
VITE_OPENAI_API_KEY=sk-xxx
VITE_OPENAI_MODEL=gpt-4o-mini
```

---

## 角色信息

当前预设角色：**HK416**（战术人形）

> 性格：冷静、忠诚，偶尔流露温柔。拥有人类般的情感，是你的专属作战伙伴。

角色模型文件位于 `public/assets/`，使用 Cubism 2 格式（`.model.json` + `.mtn` 动作文件）。

---

## 开发

```bash
npm run dev    # 开发模式（HMR 即时热更新）
npm run build  # TypeScript 编译 + Vite 构建
npm run lint   # oxlint 代码检查
```

### 文档

`docs/` 目录包含 10 篇开发文档，涵盖表情/动作系统、渲染修复、氛围设计等技术细节。

---

## 扩展方向

- [ ] 多角色切换（预设多套虚拟人设）
- [ ] 语音输入 / 语音播报输出
- [ ] 角色养成系统（陪伴时长解锁新外观）
- [ ] 每日情绪签到 + 情绪曲线
- [ ] 移动端适配
- [ ] 环境音效（雨声、篝火）

---

## License

MIT
