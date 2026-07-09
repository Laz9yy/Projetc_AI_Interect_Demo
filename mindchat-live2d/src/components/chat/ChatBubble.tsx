import React from 'react';
import { motion } from 'framer-motion';
import type { ChatMessage } from '../../types';

interface ChatBubbleProps {
  message: ChatMessage;
}

const ChatBubble: React.FC<ChatBubbleProps> = ({ message }) => {
  const isUser = message.role === 'user';

  return (
    <motion.div
      className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
      style={{ marginBottom: 10 }}
      initial={{ opacity: 0, y: 16, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
    >
      <div
        className="px-4 py-3 rounded-2xl text-sm leading-relaxed"
        style={{
          maxWidth: '85%',
          background: isUser
            ? 'rgba(124,92,252,0.28)'
            : 'rgba(255,255,255,0.06)',
          color: 'rgba(255,255,255,0.82)',
          borderTopRightRadius: isUser ? '4px' : '16px',
          borderTopLeftRadius: isUser ? '16px' : '4px',
          border: isUser
            ? '1px solid rgba(255,255,255,0.10)'
            : '1px solid rgba(255,255,255,0.05)',
        }}
      >
        {/* 消息内容 */}
        <p className="whitespace-pre-wrap break-words">
          {message.content}
          {message.isTyping && (
            <span className="inline-block w-2 h-4 bg-white/60 ml-0.5 animate-pulse rounded-sm" />
          )}
        </p>

        {/* 时间戳 */}
        <p className="text-[10px] text-white/18 mt-1 text-right">
          {new Date(message.timestamp).toLocaleTimeString('zh-CN', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      </div>
    </motion.div>
  );
};

export default ChatBubble;
