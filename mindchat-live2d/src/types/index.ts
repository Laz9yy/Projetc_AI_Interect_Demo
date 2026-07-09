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
