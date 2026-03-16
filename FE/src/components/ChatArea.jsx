import React, { useRef, useEffect, useLayoutEffect, useState } from 'react';
import { CHAT_MODES } from '../config/chatConfig';
import { List, Input, Spin, Typography, Button, message } from 'antd';
import {
  InboxOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
  SendOutlined,
  PictureOutlined,
  CloseCircleFilled,
  SaveOutlined,
  CheckOutlined,
} from '@ant-design/icons';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import remarkGfm from 'remark-gfm';
import { saveImage } from '../services/chat';


const { Text } = Typography;

// Shared markdown components for bot responses (modern, colorful styling)
const BOT_MD_COMPONENTS = {
  h1: ({ children }) => (
    <div style={{ margin: '24px 0 12px', padding: '10px 16px', background: 'linear-gradient(135deg, #5B4FCF 0%, #7c6fe0 100%)', borderRadius: 10, color: '#fff', fontSize: '1.35em', fontWeight: 700, lineHeight: 1.4, letterSpacing: '0.01em' }}>
      {children}
    </div>
  ),
  h2: ({ children }) => (
    <div style={{ margin: '20px 0 8px', padding: '8px 14px', background: 'linear-gradient(135deg, #ede9ff 0%, #f3f0ff 100%)', borderLeft: '4px solid #5B4FCF', borderRadius: '0 8px 8px 0', fontSize: '1.2em', fontWeight: 700, color: '#3d2e8c', lineHeight: 1.4 }}>
      {children}
    </div>
  ),
  h3: ({ children }) => (
    <div style={{ margin: '14px 0 6px', padding: '6px 12px', background: '#f8f7ff', borderLeft: '3px solid #a89be0', borderRadius: '0 6px 6px 0', fontSize: '1.05em', fontWeight: 600, color: '#4a3d8f', lineHeight: 1.4 }}>
      {children}
    </div>
  ),
  p: ({ children }) => <p style={{ margin: '8px 0', lineHeight: 1.8, color: '#2d2d2d' }}>{children}</p>,
  ul: ({ children }) => <ul className="bot-ul" style={{ paddingLeft: 8, margin: '8px 0', listStyleType: 'none' }}>{children}</ul>,
  ol: ({ children }) => <ol className="bot-ol" style={{ paddingLeft: 8, margin: '8px 0', listStyleType: 'none', counterReset: 'bot-ol' }}>{children}</ol>,
  li: ({ children, node }) => {
    const isOrdered = node?.parentNode?.tagName === 'ol';
    return (
      <li style={{ margin: '6px 0', lineHeight: 1.8, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <span style={{
          flexShrink: 0, width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: isOrdered ? 'linear-gradient(135deg, #5B4FCF, #7c6fe0)' : '#e8e4ff',
          color: isOrdered ? '#fff' : '#5B4FCF', fontSize: 12, fontWeight: 700, marginTop: 3,
        }}>
          {isOrdered ? '✦' : '•'}
        </span>
        <span style={{ flex: 1 }}>{children}</span>
      </li>
    );
  },
  code: ({ node, inline, className, children, ...props }) => {
    if (inline) {
      return <code style={{ background: 'linear-gradient(135deg, #f0edff, #ece8ff)', borderRadius: 5, padding: '2px 7px', fontSize: '0.875em', fontFamily: '"SFMono-Regular", Consolas, monospace', color: '#5B4FCF', fontWeight: 500, border: '1px solid #ddd6ff' }}>{children}</code>;
    }
    return (
      <pre style={{ background: 'linear-gradient(160deg, #1a1b2e 0%, #252640 100%)', borderRadius: 12, padding: '16px 18px', overflowX: 'auto', margin: '12px 0', border: '1px solid #35365a' }}>
        <code style={{ color: '#c9d1d9', fontSize: '0.875em', fontFamily: '"SFMono-Regular", Consolas, monospace', whiteSpace: 'pre' }}>{children}</code>
      </pre>
    );
  },
  blockquote: ({ children }) => (
    <blockquote style={{ borderLeft: '4px solid #5B4FCF', margin: '12px 0', color: '#4a4a6a', background: 'linear-gradient(135deg, #f5f3ff 0%, #ede9ff 100%)', borderRadius: '0 10px 10px 0', padding: '10px 16px', fontStyle: 'italic' }}>
      {children}
    </blockquote>
  ),
  strong: ({ children }) => <strong style={{ fontWeight: 700, color: '#3d2e8c', background: 'linear-gradient(transparent 60%, #e8e4ff 60%)', padding: '0 2px' }}>{children}</strong>,
  hr: () => <hr style={{ margin: '18px 0', border: 'none', height: 2, background: 'linear-gradient(90deg, transparent, #c4bcf0, transparent)' }} />,
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer"
      style={{ color: '#5B4FCF', textDecoration: 'none', fontWeight: 500, borderBottom: '2px solid #c4bcf0', transition: 'all 0.2s' }}
      onClick={e => { e.preventDefault(); window.open(href, '_blank', 'noopener,noreferrer'); }}>
      {children}
    </a>
  ),
  img: ({ src, alt }) => (
    <img src={src} alt={alt} style={{ maxWidth: '100%', maxHeight: 320, borderRadius: 12, display: 'block', margin: '10px 0', boxShadow: '0 4px 16px rgba(91,79,207,0.15)', border: '2px solid #ede9ff' }} />
  ),
  table: ({ children }) => (
    <div style={{ overflowX: 'auto', margin: '14px 0', borderRadius: 10, border: '1px solid #e0ddf5', boxShadow: '0 2px 8px rgba(91,79,207,0.08)' }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.95em' }}>{children}</table>
    </div>
  ),
  th: ({ children }) => <th style={{ border: '1px solid #d8d4f0', padding: '10px 14px', background: 'linear-gradient(135deg, #5B4FCF 0%, #7c6fe0 100%)', color: '#fff', fontWeight: 600, textAlign: 'left', fontSize: '0.9em', letterSpacing: '0.02em' }}>{children}</th>,
  td: ({ children }) => <td style={{ border: '1px solid #e8e4ff', padding: '9px 14px', background: '#faf9ff' }}>{children}</td>,
};

const BotMarkdown = ({ children }) => (
  <ReactMarkdown remarkPlugins={[remarkMath, remarkGfm]} rehypePlugins={[rehypeKatex]} components={BOT_MD_COMPONENTS}>
    {children}
  </ReactMarkdown>
);

const ChatArea = ({
  messages,
  onSend,
  isLoading = false,
  streamingMessage = null,
  streamingType = null,
  streamingThinking = null,
  activeConversationId = null,
  currentConversationId = null,
  chatMode = 'RAG',
  onModeChange = () => {},
  guestLimitReached = false,
  isGuest = false,
}) => {
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const lastUserMessageRef = useRef(null);
  const fileInputRef = useRef(null);
  const [inputValue, setInputValue] = useState('');
  const [showThinking, setShowThinking] = useState(false);
  const [selectedImages, setSelectedImages] = useState([]);
  const [savingIdx, setSavingIdx] = useState(null);
  const [saveNameInput, setSaveNameInput] = useState('');

  const handleSaveImage = async (idx) => {
    const name = saveNameInput.trim();
    if (!name) {
      message.warning('Vui lòng nhập tên cho ảnh');
      return;
    }
    const img = selectedImages[idx];
    try {
      await saveImage(name, img.base64, img.media_type);
      // Ghi tên tướng vào localStorage để auto-detect khi nhắc đến trong chat
      const saved = JSON.parse(localStorage.getItem('savedChampions') || '[]');
      if (!saved.find(c => c.name.toLowerCase() === name.toLowerCase())) {
        saved.push({ name: name.trim() });
        localStorage.setItem('savedChampions', JSON.stringify(saved));
      }
      message.success(`Đã lưu ảnh "${name}"! Bây giờ mỗi khi nhắc đến "${name}" trong chat, ảnh sẽ tự hiện ra.`);
      setSavingIdx(null);
      setSaveNameInput('');
    } catch (e) {
      message.error('Lưu ảnh thất bại: ' + (e.response?.data?.detail || e.message));
    }
  };

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
            const scrollTop = messageDiv.offsetTop - container.offsetTop - 24;
            container.scrollTop = scrollTop;

            if (container.scrollTop === 0) {
              messageDiv.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
          } catch (error) {
            // scroll error, ignore
          }
        }
      }, 300);
    }
  }, [messages]);

  const handleImageSelect = (e) => {
    const files = Array.from(e.target.files);
    files.forEach(file => {
      if (file.size > 5 * 1024 * 1024) {
        message.warning(`"${file.name}" quá lớn (tối đa 5MB)`);
        return;
      }
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target.result;
        const [header, base64] = dataUrl.split(',');
        const mediaType = header.match(/data:(.*);base64/)[1];
        setSelectedImages(prev => [...prev, { preview: dataUrl, base64, media_type: mediaType, name: file.name }]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const handleSend = () => {
    const hasContent = inputValue.trim();
    const hasImages = selectedImages.length > 0;
    if ((!hasContent && !hasImages) || isLoading) return;
    const imagesPayload = selectedImages.map(img => ({ data: img.base64, media_type: img.media_type }));
    onSend(inputValue, imagesPayload);
    setInputValue('');
    setSelectedImages([]);
  };

  const handlePaste = (e) => {
    if (isGuest) return;
    const items = Array.from(e.clipboardData?.items || []);
    const imageItems = items.filter(item => item.type.startsWith('image/'));
    if (imageItems.length === 0) return;
    e.preventDefault();
    imageItems.forEach(item => {
      const file = item.getAsFile();
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target.result;
        const [header, base64] = dataUrl.split(',');
        const mediaType = header.match(/data:(.*);base64/)[1];
        setSelectedImages(prev => [...prev, { preview: dataUrl, base64, media_type: mediaType, name: `paste-${Date.now()}.png` }]);
      };
      reader.readAsDataURL(file);
    });
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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* Messages */}
      <div
        ref={messagesContainerRef}
        style={{
          flex: 1,
          minHeight: 0,
          width: '100%',
          overflowY: 'auto',
        }}
      >
        <div style={{
          maxWidth: 965,
          margin: '0 auto',
          width: '100%',
          padding: '24px 24px 16px 24px',
          position: 'relative',
        }}>
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
                          background: 'linear-gradient(135deg, #5B4FCF 0%, #7c6fe0 100%)',
                          color: '#fff',
                          padding: '12px 16px',
                          fontSize: 15,
                          boxShadow: '0 3px 12px rgba(91,79,207,0.25)',
                          whiteSpace: 'normal',
                          lineHeight: 1.4,
                        }}
                      >
                        {/* Render ảnh đính kèm trong message */}
                        {msg.images && msg.images.length > 0 && (
                          <div style={{ display: 'flex', gap: 6, marginBottom: msg.content ? 8 : 0, flexWrap: 'wrap' }}>
                            {msg.images.map((img, imgIdx) => (
                              <img
                                key={imgIdx}
                                src={`data:${img.media_type};base64,${img.data}`}
                                alt={`attachment-${imgIdx}`}
                                style={{ maxWidth: 200, maxHeight: 200, borderRadius: 8, objectFit: 'cover', display: 'block' }}
                              />
                            ))}
                          </div>
                        )}
                        <ReactMarkdown
                          remarkPlugins={[remarkMath, remarkGfm]}
                          rehypePlugins={[rehypeKatex]}
                          components={{
                            p: ({ children }) => <p style={{ margin: '4px 0', lineHeight: 1.6 }}>{children}</p>,
                            ul: ({ children }) => <ul style={{ paddingLeft: 20, margin: '4px 0', listStyleType: 'disc' }}>{children}</ul>,
                            ol: ({ children }) => <ol style={{ paddingLeft: 20, margin: '4px 0' }}>{children}</ol>,
                            li: ({ children }) => <li style={{ lineHeight: 1.6, margin: '2px 0' }}>{children}</li>,
                            hr: () => <hr style={{ margin: '12px 0', borderColor: 'rgba(255,255,255,0.4)' }} />,
                            a: ({ href, children }) => (
                              <a href={href} target="_blank" rel="noopener noreferrer"
                                style={{ color: '#fff', textDecoration: 'underline', cursor: 'pointer' }}
                                onClick={(e) => { e.preventDefault(); window.open(href, '_blank', 'noopener,noreferrer'); }}>
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
                            borderRadius: 16,
                            background: 'rgba(255,255,255,0.75)',
                            backdropFilter: 'blur(8px)',
                            color: '#222',
                            padding: '16px 20px',
                            fontSize: 15,
                            boxShadow: '0 2px 12px rgba(91,79,207,0.08)',
                            border: '1px solid rgba(91,79,207,0.1)',
                            whiteSpace: 'normal',
                            lineHeight: 1.4,
                            width: '100%',
                          }}
                        >
                        <BotMarkdown>{nextAssistantMsg.content}</BotMarkdown>
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
                            borderRadius: 16,
                            background: 'rgba(255,255,255,0.75)',
                            backdropFilter: 'blur(8px)',
                            color: '#222',
                            padding: '16px 20px',
                            fontSize: 15,
                            boxShadow: '0 2px 12px rgba(91,79,207,0.08)',
                            border: '1px solid rgba(91,79,207,0.1)',
                            whiteSpace: 'normal',
                            lineHeight: 1.4,
                            width: '100%',
                          }}
                        >
                          <BotMarkdown>{streamingMessage}</BotMarkdown>
                          {isLoading && isActive && <span className="streaming-cursor" />}
                        </div>
                      </div>
                    )}
                    {/* Thinking section for last user message */}
                    {isLastUser && isActive && streamingThinking && !streamingMessage && (
                      <div
                        style={{
                          flex: '0 0 auto',
                          marginTop: '16px',
                          background: 'linear-gradient(135deg, #f5f3ff 0%, #ede9ff 100%)',
                          borderRadius: 16,
                          padding: 16,
                          boxShadow: '0 2px 8px rgba(91,79,207,0.08)',
                          border: '1px solid rgba(91,79,207,0.1)',
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
                            <span style={{ color: '#5B4FCF', fontWeight: 600 }}>Thinking</span>
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
                              color: '#5B4FCF',
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
      </div>

      {/* Input */}
      <div
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'center',
          flexShrink: 0,
          padding: '8px 0 16px',
        }}
      >
        <div style={{ width: '100%', maxWidth: '950px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            {CHAT_MODES.map(m => (
              <button
                key={m.value}
                onClick={() => onModeChange(m.value)}
                style={{
                  padding: '4px 14px',
                  borderRadius: 20,
                  border: '1px solid',
                  borderColor: chatMode === m.value ? '#5B4FCF' : 'rgba(255,255,255,0.6)',
                  background: chatMode === m.value ? '#5B4FCF' : 'rgba(255,255,255,0.45)',
                  color: chatMode === m.value ? '#fff' : '#555',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: chatMode === m.value ? 600 : 400,
                  transition: 'all 0.2s',
                }}
              >{m.label}</button>
            ))}
          </div>
          {guestLimitReached ? (
            <div style={{
              width: '100%',
              background: 'linear-gradient(135deg, #f0edff 0%, #ede8ff 100%)',
              border: '1.5px solid #b9acf5',
              borderRadius: 16,
              padding: '14px 20px',
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              boxShadow: '0 4px 20px rgba(91,79,207,0.13)',
            }}>
              <span style={{ fontSize: 22 }}>🔒</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, color: '#4c3dbf', fontSize: 14, marginBottom: 2 }}>Đã đến giới hạn lượt dùng thử</div>
                <div style={{ color: '#6b5fc7', fontSize: 12 }}>Vui lòng đăng nhập để có trải nghiệm tốt hơn và không giới hạn.</div>
              </div>
              <button
                onClick={() => { sessionStorage.removeItem('guestMode'); window.location.href = '/login'; }}
                style={{ padding: '7px 18px', borderRadius: 10, border: 'none', background: '#5B4FCF', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}
              >Đăng nhập</button>
            </div>
          ) : (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {/* Hidden file input */}
            <input
              type="file"
              ref={fileInputRef}
              accept="image/jpeg,image/png,image/gif,image/webp"
              multiple
              style={{ display: 'none' }}
              onChange={handleImageSelect}
            />
            {/* Image preview strip */}
            {selectedImages.length > 0 && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: '4px 8px' }}>
                {selectedImages.map((img, idx) => (
                  <div key={idx} style={{ position: 'relative' }}>
                    <img
                      src={img.preview}
                      alt={img.name}
                      style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 8, display: 'block' }}
                    />
                    <CloseCircleFilled
                      onClick={() => { setSelectedImages(prev => prev.filter((_, i) => i !== idx)); if (savingIdx === idx) setSavingIdx(null); }}
                      style={{ position: 'absolute', top: -6, right: -6, color: '#ff4d4f', cursor: 'pointer', fontSize: 16, background: '#fff', borderRadius: '50%' }}
                    />
                    {!isGuest && (
                      <SaveOutlined
                        onClick={() => { setSavingIdx(idx); setSaveNameInput(''); }}
                        style={{ position: 'absolute', bottom: -6, right: -6, color: '#1890ff', cursor: 'pointer', fontSize: 14, background: '#fff', borderRadius: '50%', padding: 2 }}
                        title="Lưu ảnh với tên"
                      />
                    )}
                    {savingIdx === idx && (
                      <div style={{ position: 'absolute', bottom: 72, left: 0, background: '#fff', border: '1px solid #d9d9d9', borderRadius: 8, padding: 8, display: 'flex', gap: 4, zIndex: 100, boxShadow: '0 2px 8px rgba(0,0,0,0.15)', minWidth: 200 }}>
                        <Input
                          size="small"
                          placeholder="Nhập tên (vd: Annie)"
                          value={saveNameInput}
                          onChange={e => setSaveNameInput(e.target.value)}
                          onKeyPress={e => { if (e.key === 'Enter') handleSaveImage(idx); }}
                          autoFocus
                          style={{ flex: 1 }}
                        />
                        <Button size="small" type="primary" icon={<CheckOutlined />} onClick={() => handleSaveImage(idx)} />
                        <Button size="small" onClick={() => setSavingIdx(null)}>✕</Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            {/* Input row */}
            <div
              style={{
                width: '100%',
                padding: '12px',
                background: 'rgba(255,255,255,0.72)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                borderRadius: 24,
                display: 'flex',
                alignItems: 'center',
                border: '1px solid rgba(255,255,255,0.5)',
                boxShadow: '0 2px 16px rgba(140,120,200,0.12)',
              }}
            >
              {!isGuest && (
                <Button
                  icon={<PictureOutlined />}
                  type="text"
                  shape="circle"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isLoading}
                  style={{ marginRight: 4, color: '#8c8c8c', flexShrink: 0 }}
                  title="Đính kèm ảnh"
                />
              )}
              <Input.TextArea
                placeholder="Type your message..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                onPaste={handlePaste}
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
                disabled={!inputValue.trim() && selectedImages.length === 0}
              />
            </div>
          </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(5px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .thinking-dots { display: flex; gap: 3px; }
        .thinking-dots .dot {
          width: 5px; height: 5px; border-radius: 50%;
          background-color: #5B4FCF;
          animation: thinkingPulse 1.4s infinite ease-in-out;
        }
        .thinking-dots .dot:nth-child(1) { animation-delay: -0.32s; }
        .thinking-dots .dot:nth-child(2) { animation-delay: -0.16s; }
        .thinking-dots .dot:nth-child(3) { animation-delay: 0s; }
        @keyframes thinkingPulse {
          0%, 80%, 100% { transform: scale(0.7); opacity: 0.5; }
          40% { transform: scale(1); opacity: 1; }
        }
        .streaming-cursor {
          display: inline-block; width: 2px; height: 1em;
          background: #5B4FCF; margin-left: 2px;
          animation: blink 1s step-start infinite; vertical-align: text-bottom;
        }
        @keyframes blink { 50% { opacity: 0; } }
      `}</style>
    </div>
  );
};

export default ChatArea;