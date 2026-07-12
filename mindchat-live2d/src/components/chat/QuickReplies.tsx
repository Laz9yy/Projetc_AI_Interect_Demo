import React from 'react';
import { motion } from 'framer-motion';

interface QuickRepliesProps {
  replies: { label: string; text: string; emoji: string }[];
  onSelect: (text: string) => void;
  disabled?: boolean;
}

const QuickReplies: React.FC<QuickRepliesProps> = React.memo(({ replies, onSelect, disabled }) => {
  return (
    <div
      className="flex-shrink-0 overflow-x-auto scrollbar-none whitespace-nowrap"
      style={{ padding: '0 20px', marginTop: 10, marginBottom: 12 }}
    >
      <div className="flex gap-2">
        {replies.map((reply, i) => (
          <motion.button
            key={i}
            onClick={() => !disabled && onSelect(reply.text)}
            disabled={disabled}
            className="px-3 py-1.5 rounded-full text-xs flex-shrink-0 transition-colors duration-200"
            style={{
              color: 'rgba(255,255,255,0.55)',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              opacity: disabled ? 0.3 : 1,
              cursor: disabled ? 'not-allowed' : 'pointer',
            }}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 + i * 0.03 }}
            whileHover={!disabled ? {
              backgroundColor: 'rgba(124,92,252,0.30)',
              color: '#fff',
              scale: 1.03,
            } : {}}
            whileTap={!disabled ? { scale: 0.97 } : {}}
          >
            {reply.label}
          </motion.button>
        ))}
      </div>
    </div>
  );
});

// 预设快捷回复（仅文字，无 emoji）
export const defaultQuickReplies = [
  { label: '你好呀', text: '你好呀', emoji: '' },
  { label: '今天心情不错', text: '今天心情不错呢！', emoji: '' },
  { label: '有点无聊', text: '好无聊啊，陪我聊聊天吧', emoji: '' },
  { label: '讲个笑话', text: '给我讲个笑话吧', emoji: '' },
  { label: '晚安', text: '晚安啦', emoji: '' },
  { label: '你是谁', text: '你是谁呀？', emoji: '' },
];

export default QuickReplies;
