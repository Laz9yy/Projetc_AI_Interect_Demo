import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';

interface ChatInputProps {
  onSend: (text: string) => void;
  disabled?: boolean;
  onTypingChange?: (isTyping: boolean) => void;
}

const ChatInput: React.FC<ChatInputProps> = ({ onSend, disabled, onTypingChange }) => {
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // 自动调整高度
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 200) + 'px';
    }
  }, [text]);

  // 通知父组件输入状态变化
  const prevHasText = useRef(false);
  useEffect(() => {
    const hasText = text.trim().length > 0;
    if (hasText !== prevHasText.current) {
      prevHasText.current = hasText;
      onTypingChange?.(hasText);
    }
  }, [text, onTypingChange]);

  // AI 回复完成后自动恢复输入框焦点
  const prevDisabledRef = useRef(disabled);
  useEffect(() => {
    if (prevDisabledRef.current && !disabled) {
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
    prevDisabledRef.current = disabled;
  }, [disabled]);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText('');
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <motion.div
      className="flex-shrink-0"
      style={{ padding: '10px 20px' }}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
    >
      {/* 通栏输入组 */}
      <div className="flex items-end gap-2 w-full border rounded-xl px-4 py-2.5"
        style={{
          borderColor: 'rgba(255,255,255,0.10)',
          background: 'rgba(255,255,255,0.02)',
        }}
      >
        <textarea
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="说点什么吧…"
          rows={2}
          disabled={disabled}
          className="flex-1 bg-transparent text-white/80 text-sm outline-none resize-none placeholder:text-white/20 max-h-[160px]"
        />
        <motion.button
          onClick={handleSend}
          disabled={!text.trim() || disabled}
          className="p-2 rounded-lg transition-all duration-300 flex-shrink-0"
          style={{
            background: text.trim() && !disabled
              ? 'linear-gradient(135deg, #7C5CFC, #FF6B9D)'
              : 'rgba(255,255,255,0.05)',
            color: text.trim() && !disabled ? '#fff' : 'rgba(255,255,255,0.20)',
            boxShadow: text.trim() && !disabled
              ? '0 2px 12px rgba(124,92,252,0.30)'
              : 'none',
          }}
          whileHover={text.trim() && !disabled ? { scale: 1.05 } : {}}
          whileTap={text.trim() && !disabled ? { scale: 0.95 } : {}}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </motion.button>
      </div>
    </motion.div>
  );
};

export default ChatInput;
