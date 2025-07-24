import React, { useRef, useEffect, useLayoutEffect, useState } from 'react';
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
  const messagesContainerRef = useRef(null);
  const lastUserMessageRef = useRef(null);
  const [inputValue, setInputValue] = useState('');
  const [showThinking, setShowThinking] = useState(false);

  const isActive = activeConversationId === currentConversationId;

  // Auto scroll to the latest message div
  useEffect(() => {
    if (messages.length > 0) {
      // Use a longer delay to ensure DOM is fully rendered
      setTimeout(() => {
        if (lastUserMessageRef.current && messagesContainerRef.current) {
          const container = messagesContainerRef.current;
          const messageDiv = lastUserMessageRef.current;
          
          // Try different scroll methods
          try {
            // Method 1: Direct scrollTop calculation
            const scrollTop = messageDiv.offsetTop - container.offsetTop - 24;
            container.scrollTop = scrollTop;
            
            // Method 2: If Method 1 doesn't work, try scrollIntoView
            if (container.scrollTop === 0) {
              messageDiv.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
            
            console.log('Scrolling to:', scrollTop, 'Message offset:', messageDiv.offsetTop, 'Container offset:', container.offsetTop);
          } catch (error) {
            console.error('Scroll error:', error);
          }
        }
      }, 300);
    }
  }, [messages]);

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
        ref={messagesContainerRef}
        style={{
          flex: 1,
          padding: '24px 24px 120px 24px',
          maxWidth: 965,
          margin: '0 auto',
          width: '100%',
          position: 'relative',
          overflow: 'auto'
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
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {messages.map((msg, idx) => {
              const isUser = msg.role === 'user';
              const isLastUser = idx === messages.length - 1 && isUser;
              // Xác định đây có phải là cặp message mới nhất (user + assistant) không
              const isLatestPair = (() => {
                if (!isUser) return false;
                if (idx === messages.length - 1) return true;
                if (idx === messages.length - 2 && messages[idx + 1].role === 'assistant') return true;
                return false;
              })();
              // Group messages: user message + next assistant message (if exists)
              if (isUser) {
                const nextAssistantMsg = messages[idx + 1];
                const hasAssistantResponse = nextAssistantMsg && nextAssistantMsg.role === 'assistant';
                return (
                  <div
                    key={msg.id || idx}
                    ref={isLatestPair ? lastUserMessageRef : null}
                    style={{
                      minHeight: isLatestPair ? '100vh' : 'auto',
                      display: 'flex',
                      flexDirection: 'column',
                      padding: '24px',
                      marginBottom: isLatestPair ? 0 : '16px',
                    }}
                  >
                    {/* User message div - fixed height */}
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'flex-end',
                        marginBottom: '16px',
                      }}
                    >
                      <div
                        style={{
                          maxWidth: '80%',
                          borderRadius: '20px',
                          background: '#1890ff',
                          color: '#fff',
                          padding: '12px 14px',
                          fontSize: 15,
                          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
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
                                alignItems: 'flex-start',
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
                                  color: '#fff',
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
                    </div>
                    {/* Assistant message div - takes remaining height only for latest message */}
                    {hasAssistantResponse && (
                      <div
                        style={{
                          flex: isLatestPair ? '1 1 auto' : '0 0 auto',
                          display: 'flex',
                          justifyContent: 'flex-start',
                          alignItems: 'flex-start',
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
                            width: '100%',
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
                                  alignItems: 'flex-start',
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
                            {nextAssistantMsg.content}
                          </ReactMarkdown>
                        </div>
                      </div>
                    )}
                    {/* Nếu là user cuối cùng, đang active và có streamingMessage thì render chunk ngay dưới user */}
                    {isLastUser && streamingMessage && isActive && (
                      <div
                        style={{
                          flex: '1 1 auto',
                          display: 'flex',
                          justifyContent: 'flex-start',
                          alignItems: 'flex-start',
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
                            width: '100%',
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
                                  alignItems: 'flex-start',
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
                      </div>
                    )}
                    {/* Thinking section for last user message */}
                    {isLastUser && isActive && streamingThinking && !streamingMessage && (
                      <div
                        style={{
                          flex: '0 0 auto',
                          marginTop: '16px',
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
                  </div>
                );
              }
              // Skip assistant messages as they're handled above
              return null;
            })}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'center',
          position: 'fixed',
          right: 0,
          left: 130,
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