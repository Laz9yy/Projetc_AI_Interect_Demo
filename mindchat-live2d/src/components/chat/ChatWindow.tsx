import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ChatBubble from './ChatBubble';
import ChatInput from './ChatInput';
import QuickReplies, { defaultQuickReplies } from './QuickReplies';
import PanelHeader from './PanelHeader';
import { useChatStore } from '../../store/chatStore';

const ChatWindow: React.FC = () => {
  const { messages, isStreaming, sendMessage } = useChatStore();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = useState(false);

  // 自动滚动
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleQuickReply = (text: string) => {
    sendMessage(text);
  };

  return (
    <>
      {/* 头部栏 */}
      <PanelHeader collapsed={collapsed} onToggleCollapse={() => setCollapsed(!collapsed)} />

      {/* 折叠态仅显示头部栏 */}
      <AnimatePresence>
        {!collapsed && (
          <motion.div
            className="flex flex-col flex-1 min-h-0"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
          >
            {/* 对话历史滚动区 */}
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto scroll-smooth"
              style={{ padding: '12px 20px' }}
            >
              {/* 空状态 */}
              {messages.length === 0 && (
                <motion.div
                  className="flex items-center justify-center h-full"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 }}
                >
                  <p className="text-[13px] font-light text-white/[0.28]">
                    发送消息开启对话
                  </p>
                </motion.div>
              )}

              <AnimatePresence>
                {messages.map((msg) => (
                  <ChatBubble key={msg.id} message={msg} />
                ))}
              </AnimatePresence>

              {/* 流式输出指示器 */}
              {isStreaming && (
                <div className="flex justify-start mb-3">
                  <div className="px-3 py-2 rounded-xl bg-white/[0.03] border border-white/5">
                    <div className="flex gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-white/30 animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-white/30 animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-white/30 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 快捷话术标签栏 */}
            <QuickReplies
              replies={defaultQuickReplies}
              onSelect={handleQuickReply}
              disabled={isStreaming}
            />

            {/* 底部消息输入栏 */}
            <ChatInput onSend={sendMessage} disabled={isStreaming} />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default ChatWindow;
