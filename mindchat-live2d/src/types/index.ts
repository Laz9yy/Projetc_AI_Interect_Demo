// ===== Live2D 人物形象类型 =====
export interface CharacterConfig {
  name: string;
  modelUrl: string;
  personality: string;
  greeting: string;
}

// ===== 表情类型 =====
export type ExpressionType =
  | 'neutral'
  | 'happy'
  | 'sad'
  | 'surprised'
  | 'shy'
  | 'angry'
  | 'thinking'
  | 'relaxed';

export interface ExpressionConfig {
  id: ExpressionType;
  label: string;
  labelCn: string;
  emoji: string;
  color: string;
  motion?: string;
}

// ===== 聊天消息类型 =====
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  expression?: ExpressionType;
  isTyping?: boolean;
}

// ===== 多 AI 提供商定义 =====
export interface AIProvider {
  id: string;           // 'openai' | 'deepseek' | 'qwen' | 'custom'
  name: string;         // 'OpenAI' | 'DeepSeek' | '通义千问' | '自定义'
  baseUrl: string;      // API 端点
  models: string[];     // 该提供商支持的模型列表
  defaultModel: string;
  requiresApiKey: boolean;
}

// ===== AI 服务配置（扩展版）=====
export interface AIConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  systemPrompt: string;
  provider: string;          // 当前提供商 ID
  temperature: number;       // 温度参数
  maxTokens: number;         // 最大 Token
  maxContextMessages: number;// 上下文窗口消息数
}

// ===== 聊天状态 =====
export interface ChatState {
  messages: ChatMessage[];
  isStreaming: boolean;
  currentExpression: ExpressionType;
}

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

// ===== Live2D 交互系统配置 =====
export const INTERACTION_CONFIG = {
  /** 触摸冷却时间 (ms) */
  TOUCH_COOLDOWN_MS: 2000,
  /** 空闲超时自发小动作间隔 (ms) */
  AUTO_MOTION_INTERVAL_MS: 20000,
  /** idle 循环重播间隔 (ms, 略短于动作时长确保无缝) */
  IDLE_LOOP_INTERVAL_MS: 2500,
  /** 动作优先级权重: 1=login 2=touch 3=emotion 4=idle (数字越小越高) */
  MOTION_PRIORITY: {
    LOGIN: 1,
    TOUCH: 2,
    EMOTION: 3,
    IDLE: 4,
  } as const,
} as const;
