import React, { useRef, useEffect, useState } from 'react';
import { List, Input, Spin, Typography, Button } from 'antd';
import {
  InboxOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
  SendOutlined,
} from '@ant-design/icons';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import remarkGfm from 'remark-gfm';

const { Text } = Typography;

const ChatArea = ({
  messages,
  onSend,
  isLoading = false,
  streamingMessage = null,
  streamingType = null,
  streamingThinking = null,
  activeConversationId = null,
  currentConversationId = null,
}) => {
  const messagesEndRef = useRef(null);
  const [inputValue, setInputValue] = useState('');
  const [showThinking, setShowThinking] = useState(false);

  const isActive = activeConversationId === currentConversationId;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, streamingMessage, streamingThinking]);

  const handleSend = () => {
    if (inputValue.trim() && !isLoading) {
      onSend(inputValue);
      setInputValue('');
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const toggleThinking = () => {
    setShowThinking(!showThinking);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Messages */}
      <div
        style={{
          flex: 1,
          padding: 24,
          maxWidth: 965,
          margin: '0 auto',
          width: '100%',
          position: 'relative',
        }}
      >
        {messages.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#bfbfbf', marginTop: 80 }}>
            <InboxOutlined style={{ fontSize: 48, marginBottom: 8 }} />
            <div style={{ fontSize: 16 }}>No messages yet</div>
            <Text type="secondary" style={{ fontSize: 14 }}>
              Start a conversation by sending a message
            </Text>
          </div>
        ) : (
          <List
            dataSource={messages}
            renderItem={(msg, idx) => {
              const lastUserIdx = [...messages].reverse().findIndex(m => m.role === 'user');
              const isLastUser = messages.length - 1 - lastUserIdx === idx;
              const isUser = msg.role === 'user';

              return (
                <React.Fragment key={msg.id || idx}>
                  <List.Item
                    style={{
                      display: 'flex',
                      justifyContent: isUser ? 'flex-end' : 'flex-start',
                      border: 'none',
                      background: 'transparent',
                      padding: 0,
                      marginBottom: 24,
                      animation: 'fadeIn 0.3s ease',
                    }}
                  >
                    <div
                      style={{
                        maxWidth: isUser ? '80%' : '100%',
                        borderRadius: isUser
                          ? '20px 20px 20px 20px'
                          : '14px 14px 14px 4px',
                        background: isUser ? '#1890ff' : 'transparent',
                        color: isUser ? '#fff' : '#222',
                        padding: '12px 14px',
                        fontSize: 15,
                        boxShadow: isUser ? '0 2px 8px rgba(0,0,0,0.04)' : 'none',
                        whiteSpace: 'normal',
                        lineHeight: 1.4,
                      }}
                    >
                    <ReactMarkdown
                      remarkPlugins={[remarkMath, remarkGfm]}
                      rehypePlugins={[rehypeKatex]}
                      components={{
                        p: ({ children }) => (
                          <p style={{ margin: '4px 0', lineHeight: 1.6 }}>{children}</p>
                        ),
                        ul: ({ children }) => (
                          <ul
                            style={{
                              paddingLeft: 0,
                              listStyleType: 'none',
                              margin: '4px 0',
                              textAlign: 'left',
                            }}
                          >
                            {children}
                          </ul>
                        ),
                        li: ({ children }) => (
                          <li style={{ 
                            lineHeight: 1.4, 
                            textAlign: 'left', 
                            paddingLeft: '20px',
                            margin: '2px 0',
                            display: 'flex',
                            alignItems: 'flex-start'
                          }}>
                            <span style={{ marginRight: '8px', flexShrink: 0 }}>•</span>
                            <span style={{ flex: 1 }}>{children}</span>
                          </li>
                        ),
                        hr: () => <hr style={{ margin: '12px 0', borderColor: '#ccc' }} />,
                        a: ({ href, children }) => (
                          <a
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              color: isUser ? '#fff' : '#1890ff',
                              textDecoration: 'underline',
                              cursor: 'pointer',
                            }}
                            onClick={(e) => {
                              e.preventDefault();
                              window.open(href, '_blank', 'noopener,noreferrer');
                            }}
                          >
                            {children}
                          </a>
                        ),
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                    </div>
                  </List.Item>

                  {/* Thinking section */}
                  {isLastUser && (isLoading || streamingMessage) && streamingThinking && isActive && (
                    <div
                      style={{
                        marginBottom: 16,
                        background: '#f0f2f5',
                        borderRadius: 16,
                        padding: 16,
                        boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
                        maxWidth: showThinking ? '100%' : 360,
                        transition: 'all 0.3s ease',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: 8,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ color: '#1890ff', fontWeight: 500 }}>Thinking</span>
                          <div className="thinking-dots">
                            <span className="dot" />
                            <span className="dot" />
                            <span className="dot" />
                          </div>
                        </div>
                        <button
                          onClick={toggleThinking}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#1890ff',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            fontSize: 14,
                          }}
                        >
                          {showThinking ? (
                            <>
                              <EyeInvisibleOutlined />
                              Ẩn
                            </>
                          ) : (
                            <>
                              <EyeOutlined />
                              Xem
                            </>
                          )}
                        </button>
                      </div>
                      <div
                        style={{
                          fontSize: 14,
                          color: '#444',
                          lineHeight: 1.5,
                          display: showThinking ? 'block' : '-webkit-box',
                          WebkitLineClamp: showThinking ? 'unset' : 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          maxHeight: showThinking ? 300 : '3.5em',
                        }}
                      >
                        <ReactMarkdown 
                          remarkPlugins={[remarkMath]} 
                          rehypePlugins={[rehypeKatex]}
                          components={{
                            a: ({ href, children }) => (
                              <a
                                href={href}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                  color: '#1890ff',
                                  textDecoration: 'underline',
                                  cursor: 'pointer',
                                }}
                                onClick={(e) => {
                                  e.preventDefault();
                                  window.open(href, '_blank', 'noopener,noreferrer');
                                }}
                              >
                                {children}
                              </a>
                            ),
                          }}
                        >
                          {streamingThinking}
                        </ReactMarkdown>
                      </div>
                    </div>
                  )}
                </React.Fragment>
              );
            }}
          />
        )}

        {/* Streaming bot message */}
        {streamingMessage && isActive && (
          <List.Item
            key="streaming"
            style={{
              display: 'flex',
              justifyContent: 'flex-start',
              border: 'none',
              background: 'transparent',
              padding: 0,
              marginBottom: 24,
              animation: 'fadeIn 0.3s ease',
            }}
          >
            <div
              style={{
                maxWidth: '100%',
                borderRadius: '14px 14px 14px 4px',
                background: 'transparent',
                color: '#222',
                padding: '12px 14px',
                fontSize: 15,
                boxShadow: 'none',
                whiteSpace: 'normal',
                lineHeight: 1.4,
              }}
            >
              <ReactMarkdown 
                 remarkPlugins={[remarkMath, remarkGfm]}
                 rehypePlugins={[rehypeKatex]}
                 components={{
                   p: ({ children }) => (
                     <p style={{ margin: '4px 0', lineHeight: 1.6 }}>{children}</p>
                   ),
                   ul: ({ children }) => (
                     <ul
                       style={{
                         paddingLeft: 0,
                         listStyleType: 'none',
                         margin: '4px 0',
                         textAlign: 'left',
                       }}
                     >
                       {children}
                     </ul>
                   ),
                   li: ({ children }) => (
                     <li style={{ 
                       lineHeight: 1.4, 
                       textAlign: 'left', 
                       paddingLeft: '20px',
                       margin: '2px 0',
                       display: 'flex',
                       alignItems: 'flex-start'
                     }}>
                       <span style={{ marginRight: '8px', flexShrink: 0 }}>•</span>
                       <span style={{ flex: 1 }}>{children}</span>
                     </li>
                   ),
                   hr: () => <hr style={{ margin: '12px 0', borderColor: '#ccc' }} />,
                   a: ({ href, children }) => (
                     <a
                       href={href}
                       target="_blank"
                       rel="noopener noreferrer"
                       style={{
                         color: '#1890ff',
                         textDecoration: 'underline',
                         cursor: 'pointer',
                       }}
                       onClick={(e) => {
                         e.preventDefault();
                         window.open(href, '_blank', 'noopener,noreferrer');
                       }}
                     >
                       {children}
                     </a>
                   ),
                 }}
              >
                {streamingMessage}
              </ReactMarkdown>
            </div>
          </List.Item>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'center',
          position: 'sticky',
          bottom: 0,
          padding: '24px 0',
        }}
      >
        <div
          style={{
            width: '100%',
            padding: '12px',
            maxWidth: '950px',
            margin: '0px auto',
            background: '#fff',
            borderRadius: 24,
            boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
            display: 'flex',
            alignItems: 'center',
            border: '1px solid #f0f0f0',
          }}
        >
          <Input.TextArea
            placeholder="Type your message..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={isLoading}
            autoSize={{ minRows: 1, maxRows: 6 }}
            style={{
              border: 'none',
              background: 'transparent',
              resize: 'none',
              fontSize: 16,
              flex: 1,
            }}
          />
          <Button
            icon={isLoading ? <Spin size="small" /> : <SendOutlined />}
            type="primary"
            shape="circle"
            onClick={handleSend}
            disabled={!inputValue.trim()}
          />
        </div>
      </div>

      {/* Styles */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(5px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .thinking-dots {
          display: flex;
          gap: 3px;
        }
        .thinking-dots .dot {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background-color: #1890ff;
          animation: thinkingPulse 1.4s infinite ease-in-out;
        }
        .thinking-dots .dot:nth-child(1) { animation-delay: -0.32s; }
        .thinking-dots .dot:nth-child(2) { animation-delay: -0.16s; }
        .thinking-dots .dot:nth-child(3) { animation-delay: 0s; }

        @keyframes thinkingPulse {
          0%, 80%, 100% { transform: scale(0.7); opacity: 0.5; }
          40% { transform: scale(1); opacity: 1; }
        }
        table {
          border-collapse: collapse;
          width: 100%;
          margin: 16px 0;
        }
        th, td {
          border: 1px solid #ddd;
          padding: 8px;
          text-align: left;
        }
        th {
          background-color: #f5f5f5;
          font-weight: bold;
        }
      `}</style>
    </div>
  );
};

export default ChatArea;