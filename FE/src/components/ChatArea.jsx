import React, { useRef, useEffect, useLayoutEffect, useState, useMemo, useCallback, memo } from 'react';
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
import { submitFeedback, getBatchFeedback } from '../services/chat';


const { Text } = Typography;

// Shared markdown components for bot responses (modern, colorful styling)
const BOT_MD_COMPONENTS = {
  h1: ({ children }) => (
    <div style={{ margin: '28px 0 16px', padding: '14px 20px', background: 'linear-gradient(135deg, #7C3AED 0%, #9B59FF 100%)', borderRadius: 14, color: '#fff', fontSize: '1.5em', fontWeight: 800, lineHeight: 1.4, letterSpacing: '0.01em', boxShadow: '0 6px 20px rgba(124,58,237,0.25)' }}>
      {children}
    </div>
  ),
  h2: ({ children }) => (
    <div style={{ margin: '24px 0 14px', padding: '14px 20px', background: 'linear-gradient(135deg, #F0EBFF 0%, #E8E0FF 100%)', borderLeft: '6px solid #7C3AED', borderRadius: '0 14px 14px 0', fontSize: '1.45em', fontWeight: 800, color: '#3B0764', lineHeight: 1.4, boxShadow: '0 4px 16px rgba(124,58,237,0.13)' }}>
      {children}
    </div>
  ),
  h3: ({ children }) => (
    <div style={{ margin: '18px 0 10px', padding: '10px 16px', background: '#f3eeff', borderLeft: '5px solid #8B5CF6', borderRadius: '0 10px 10px 0', fontSize: '1.25em', fontWeight: 700, color: '#4C1D95', lineHeight: 1.4, boxShadow: '0 2px 8px rgba(124,58,237,0.09)' }}>
      {children}
    </div>
  ),
  p: ({ children }) => <p style={{ margin: '8px 0', lineHeight: 1.8, color: '#2d2d2d' }}>{children}</p>,
  ul: ({ children }) => <ul className="bot-ul" style={{ paddingLeft: 18, margin: '8px 0', listStyleType: 'none' }}>{children}</ul>,
  ol: ({ children }) => <ol className="bot-ol" style={{ paddingLeft: 18, margin: '8px 0', listStyleType: 'none', counterReset: 'bot-ol' }}>{children}</ol>,
  li: ({ children, node }) => {
    const isOrdered = node?.parentNode?.tagName === 'ol';
    // Detect header-like li: first child is strong, or paragraph whose first child is strong
    const astFirst = node?.children?.[0];
    const isHeaderItem =
      astFirst?.tagName === 'strong' ||
      (astFirst?.tagName === 'p' && astFirst?.children?.[0]?.tagName === 'strong');
    return (
      <li style={{ margin: '6px 0', lineHeight: 1.8, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        {!isHeaderItem && (
          <span style={{
            flexShrink: 0, width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: isOrdered ? 'linear-gradient(135deg, #7C3AED, #9B59FF)' : '#F0EBFF',
            color: isOrdered ? '#fff' : '#7C3AED', fontSize: 12, fontWeight: 700, marginTop: 3,
          }}>
            {isOrdered ? '✦' : '•'}
          </span>
        )}
        <span style={{ flex: 1 }}>{children}</span>
      </li>
    );
  },
  code: ({ node, inline, className, children, ...props }) => {
    if (inline) {
      return <code style={{ background: 'linear-gradient(135deg, #F0EBFF, #E8E0FF)', borderRadius: 5, padding: '2px 7px', fontSize: '0.875em', fontFamily: '"SFMono-Regular", Consolas, monospace', color: '#7C3AED', fontWeight: 500, border: '1px solid #DDD6FE' }}>{children}</code>;
    }
    return (
      <pre style={{ background: 'linear-gradient(160deg, #1a1b2e 0%, #252640 100%)', borderRadius: 12, padding: '16px 18px', overflowX: 'auto', margin: '12px 0', border: '1px solid #35365a' }}>
        <code style={{ color: '#c9d1d9', fontSize: '0.875em', fontFamily: '"SFMono-Regular", Consolas, monospace', whiteSpace: 'pre' }}>{children}</code>
      </pre>
    );
  },
  blockquote: ({ children }) => (
    <blockquote style={{ borderLeft: '4px solid #7C3AED', margin: '12px 0', color: '#4a4a6a', background: 'linear-gradient(135deg, #F5F3FF 0%, #EDE9FE 100%)', borderRadius: '0 10px 10px 0', padding: '10px 16px', fontStyle: 'italic' }}>
      {children}
    </blockquote>
  ),
  strong: ({ children }) => <strong style={{ fontWeight: 700, color: '#3B0764', background: 'linear-gradient(transparent 55%, #E8E0FF 55%)', padding: '0 2px', fontSize: '1.02em' }}>{children}</strong>,
  hr: () => <hr style={{ margin: '18px 0', border: 'none', height: 2, background: 'linear-gradient(90deg, transparent, #C4B5FD, transparent)' }} />,
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer"
      style={{ color: '#7C3AED', textDecoration: 'none', fontWeight: 500, borderBottom: '2px solid #C4B5FD', transition: 'all 0.2s' }}
      onClick={e => { e.preventDefault(); window.open(href, '_blank', 'noopener,noreferrer'); }}>
      {children}
    </a>
  ),
  img: ({ src, alt }) => {
    const isItemIcon = src && src.includes('/image/item_');
    if (isItemIcon) {
      return (
        <img src={src} alt={alt} title={alt}
          style={{
            width: 40, height: 40, borderRadius: 8, display: 'inline-block',
            verticalAlign: 'middle', margin: '2px 4px',
            boxShadow: '0 2px 8px rgba(124,58,237,0.18)',
            border: '2px solid #DDD6FE',
            background: '#1a1b2e',
          }} />
      );
    }
    return (
      <img src={src} alt={alt}
        style={{ maxWidth: '100%', maxHeight: 320, borderRadius: 12, display: 'block', margin: '10px 0', boxShadow: '0 4px 16px rgba(124,58,237,0.15)', border: '2px solid #E8E0FF' }} />
    );
  },
  table: ({ children }) => (
    <div style={{ overflowX: 'auto', margin: '14px 0', borderRadius: 10, border: '1px solid #DDD6FE', boxShadow: '0 2px 8px rgba(124,58,237,0.08)' }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.95em' }}>{children}</table>
    </div>
  ),
  th: ({ children }) => <th style={{ border: '1px solid #C0D8E8', padding: '10px 14px', background: 'linear-gradient(135deg, #7C3AED 0%, #9B59FF 100%)', color: '#fff', fontWeight: 600, textAlign: 'left', fontSize: '0.9em', letterSpacing: '0.02em' }}>{children}</th>,
  td: ({ children }) => <td style={{ border: '1px solid #EDE9FE', padding: '9px 14px', background: '#faf9ff' }}>{children}</td>,
};

const BotMarkdown = memo(({ children }) => (
  <ReactMarkdown remarkPlugins={[remarkMath, remarkGfm]} rehypePlugins={[rehypeKatex]} components={BOT_MD_COMPONENTS}>
    {children}
  </ReactMarkdown>
));

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
  userId = null,
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
  const [inputFocused, setInputFocused] = useState(false);

  // Feedback state: { [msgId]: 'up' | 'down' | null }
  const [feedbacks, setFeedbacks] = useState({});
  // Feedback counts: { [msgId]: { up: number, down: number } }
  const [feedbackCounts, setFeedbackCounts] = useState({});

  // Stable key derived from message IDs — only changes when messages are added/removed, not during streaming
  const messageIdsKey = useMemo(
    () => messages.map(m => m.id).join(','),
    [messages]
  );

  // Load feedback stats when messages change (not during streaming)
  useEffect(() => {
    const isDbId = id => id && typeof id !== 'string' && !String(id).startsWith('b-') && !String(id).startsWith('u-') && !String(id).startsWith('guest-') && /^\d+$/.test(String(id));
    const assistantIds = messages
      .filter(m => m.role === 'assistant' && isDbId(m.id))
      .map(m => Number(m.id));
    if (assistantIds.length === 0) return;
    getBatchFeedback(assistantIds, userId)
      .then(res => {
        const data = res.data || {};
        const counts = {};
        const votes = {};
        for (const [id, stats] of Object.entries(data)) {
          counts[id] = { up: stats.up || 0, down: stats.down || 0 };
          votes[id] = stats.user_vote || null;
        }
        setFeedbackCounts(prev => ({ ...prev, ...counts }));
        setFeedbacks(prev => {
          const next = { ...prev };
          for (const [id, vote] of Object.entries(votes)) {
            if (next[id] === undefined) next[id] = vote;
          }
          return next;
        });
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messageIdsKey, userId]);

  const handleFeedback = async (msgId, vote) => {
    const current = feedbacks[msgId];
    const newVote = current === vote ? null : vote;
    // Optimistic UI update
    setFeedbacks(prev => ({ ...prev, [msgId]: newVote }));
    setFeedbackCounts(prev => {
      const old = prev[msgId] || { up: 0, down: 0 };
      const updated = { ...old };
      if (current === 'up') updated.up = Math.max(0, updated.up - 1);
      if (current === 'down') updated.down = Math.max(0, updated.down - 1);
      if (newVote === 'up') updated.up++;
      if (newVote === 'down') updated.down++;
      return { ...prev, [msgId]: updated };
    });
    if (newVote && userId) {
      try {
        await submitFeedback(msgId, userId, newVote);
      } catch {
        // Revert on error
        setFeedbacks(prev => ({ ...prev, [msgId]: current }));
        setFeedbackCounts(prev => {
          const now = prev[msgId] || { up: 0, down: 0 };
          const reverted = { ...now };
          if (newVote === 'up') reverted.up = Math.max(0, reverted.up - 1);
          if (newVote === 'down') reverted.down = Math.max(0, reverted.down - 1);
          if (current === 'up') reverted.up++;
          if (current === 'down') reverted.down++;
          return { ...prev, [msgId]: reverted };
        });
      }
    }
  };

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

  // Drag-to-scroll on messages container
  useEffect(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    let isDragging = false;
    let startY = 0;
    let startScrollTop = 0;
    const onMouseDown = (e) => {
      if (e.button !== 0) return;
      // If click target is the scroll container itself (not a child), it means
      // the user clicked on the scrollbar track/thumb — let browser handle it
      if (e.target === el) return;
      const tag = e.target.tagName.toUpperCase();
      if (['INPUT', 'TEXTAREA', 'BUTTON', 'A', 'SVG', 'PATH'].includes(tag)) return;
      if (e.target.closest('button, a, input, textarea, svg')) return;
      isDragging = true;
      startY = e.clientY;
      startScrollTop = el.scrollTop;
    };
    const onMouseMove = (e) => {
      if (!isDragging) return;
      e.preventDefault();
      el.scrollTop = startScrollTop - (e.clientY - startY);
    };
    const onMouseUp = () => {
      isDragging = false;
    };
    el.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    return () => {
      el.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* Messages */}
      <div
        ref={messagesContainerRef}
        className="custom-scrollbar"
        style={{
          flex: 1,
          minHeight: 0,
          width: '100%',
          overflowY: 'auto',
          cursor: 'grab',
        }}
      >
        <div
          style={{
            maxWidth: 965,
            margin: '0 auto',
            width: '100%',
            padding: '24px 24px 16px 24px',
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
                          borderRadius: '24px',
                          background: 'linear-gradient(135deg, #7C3AED 0%, #9B59FF 100%)',
                          color: '#fff',
                          padding: '14px 20px',
                          fontSize: 15,
                          boxShadow: '0 4px 18px rgba(124,58,237,0.28)',
                          whiteSpace: 'normal',
                          lineHeight: 1.5,
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
                            borderRadius: 20,
                            background: 'rgba(255,255,255,0.65)',
                            backdropFilter: 'blur(20px)',
                            WebkitBackdropFilter: 'blur(20px)',
                            color: '#222',
                            padding: '20px 24px',
                            fontSize: 15,
                            boxShadow: '0 4px 24px rgba(124,58,237,0.06), 0 1px 4px rgba(124,58,237,0.08)',
                            border: '1.5px solid rgba(124,58,237,0.12)',
                            whiteSpace: 'normal',
                            lineHeight: 1.5,
                            width: '100%',
                          }}
                        >
                        <BotMarkdown>{nextAssistantMsg.content}</BotMarkdown>
                        {/* Feedback buttons */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, paddingTop: 10, borderTop: '1px solid rgba(124,58,237,0.08)' }}>
                          <span style={{ fontSize: 12, color: '#999' }}>Phản hồi hữu ích?</span>
                          <button
                            onClick={() => handleFeedback(nextAssistantMsg.id, 'up')}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 4,
                              padding: '3px 10px', borderRadius: 20, border: 'none', cursor: 'pointer',
                              fontSize: 13, fontWeight: 600, transition: 'all 0.2s',
                              background: feedbacks[nextAssistantMsg.id] === 'up'
                                ? 'linear-gradient(135deg, #7C3AED, #9B59FF)'
                                : 'rgba(124,58,237,0.08)',
                              color: feedbacks[nextAssistantMsg.id] === 'up' ? '#fff' : '#7C3AED',
                              boxShadow: feedbacks[nextAssistantMsg.id] === 'up' ? '0 2px 8px rgba(124,58,237,0.35)' : 'none',
                            }}
                            title="Hữu ích"
                          >
                            👍 {feedbackCounts[nextAssistantMsg.id]?.up || 0}
                          </button>
                          <button
                            onClick={() => handleFeedback(nextAssistantMsg.id, 'down')}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 4,
                              padding: '3px 10px', borderRadius: 20, border: 'none', cursor: 'pointer',
                              fontSize: 13, fontWeight: 600, transition: 'all 0.2s',
                              background: feedbacks[nextAssistantMsg.id] === 'down'
                                ? 'linear-gradient(135deg, #cf4f4f, #e07c7c)'
                                : 'rgba(207,79,79,0.08)',
                              color: feedbacks[nextAssistantMsg.id] === 'down' ? '#fff' : '#cf4f4f',
                              boxShadow: feedbacks[nextAssistantMsg.id] === 'down' ? '0 2px 8px rgba(207,79,79,0.3)' : 'none',
                            }}
                            title="Không hữu ích"
                          >
                            👎 {feedbackCounts[nextAssistantMsg.id]?.down || 0}
                          </button>
                        </div>
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
                            borderRadius: 20,
                            background: 'rgba(255,255,255,0.65)',
                            backdropFilter: 'blur(20px)',
                            WebkitBackdropFilter: 'blur(20px)',
                            color: '#222',
                            padding: '20px 24px',
                            fontSize: 15,
                            boxShadow: '0 4px 24px rgba(124,58,237,0.06), 0 1px 4px rgba(124,58,237,0.08)',
                            border: '1.5px solid rgba(124,58,237,0.12)',
                            whiteSpace: 'normal',
                            lineHeight: 1.5,
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
                          background: 'linear-gradient(135deg, #F0EBFF 0%, #E8E0FF 100%)',
                          borderRadius: 16,
                          padding: 16,
                          boxShadow: '0 2px 8px rgba(124,58,237,0.08)',
                          border: '1px solid rgba(124,58,237,0.1)',
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
                            <span style={{ color: '#7C3AED', fontWeight: 600 }}>Thinking</span>
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
                              color: '#7C3AED',
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
                className="chat-mode-btn"
                style={{
                  padding: '5px 16px',
                  borderRadius: 20,
                  background: chatMode === m.value
                    ? 'linear-gradient(135deg, #7C3AED, #9B59FF)'
                    : '#ffffff',
                  color: chatMode === m.value ? '#fff' : '#555',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: chatMode === m.value ? 600 : 500,
                  transition: 'all 0.25s ease',
                  boxShadow: chatMode === m.value
                    ? '0 2px 10px rgba(124,58,237,0.25)'
                    : '0 1px 4px rgba(0,0,0,0.08)',
                  border: chatMode === m.value ? 'none' : '1px solid #D4E4F0',
                  letterSpacing: 0.2,
                }}
              >{m.label}</button>
            ))}
          </div>
          {guestLimitReached ? (
            <div style={{
              width: '100%',
              background: 'linear-gradient(135deg, #F0EBFF 0%, #E8E0FF 100%)',
              border: '1.5px solid #C4B5FD',
              borderRadius: 16,
              padding: '14px 20px',
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              boxShadow: '0 4px 20px rgba(124,58,237,0.13)',
            }}>
              <span style={{ fontSize: 22 }}>🔒</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, color: '#4C1D95', fontSize: 14, marginBottom: 2 }}>Đã đến giới hạn lượt dùng thử</div>
                <div style={{ color: '#7C3AED', fontSize: 12 }}>Vui lòng đăng nhập để có trải nghiệm tốt hơn và không giới hạn.</div>
              </div>
              <button
                onClick={() => { sessionStorage.removeItem('guestMode'); window.location.href = '/login'; }}
                style={{ padding: '7px 18px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #7C3AED, #9B59FF)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}
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
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: '8px 12px', background: 'rgba(240,235,255,0.6)', borderRadius: 12 }}>
                {selectedImages.map((img, idx) => (
                  <div key={idx} style={{ position: 'relative' }}>
                    <img
                      src={img.preview}
                      alt={img.name}
                      style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 10, display: 'block', border: '2px solid rgba(124,58,237,0.15)', transition: 'border-color 0.2s' }}
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
              className="chat-input-wrapper"
              style={{
                width: '100%',
                padding: '12px 14px 12px 18px',
                background: '#ffffff',
                borderRadius: 24,
                display: 'flex',
                alignItems: 'center',
                border: inputFocused
                  ? '1.5px solid #7C3AED'
                  : '1.5px solid #C8DCF0',
                boxShadow: inputFocused
                  ? '0 8px 32px rgba(124,58,237,0.12), 0 0 0 3px rgba(124,58,237,0.06)'
                  : '0 2px 12px rgba(0,0,0,0.07), 0 1px 3px rgba(0,0,0,0.04)',
                transition: 'border-color 0.25s ease, box-shadow 0.25s ease',
              }}
            >
              {!isGuest && (
                <Button
                  icon={<PictureOutlined />}
                  type="text"
                  shape="circle"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isLoading}
                  className="img-btn"
                  style={{ marginRight: 6, color: '#7BAAC4', flexShrink: 0, fontSize: 18 }}
                  title="Đính kèm ảnh"
                />
              )}
              <Input.TextArea
                placeholder="Nhập tin nhắn..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                onPaste={handlePaste}
                onFocus={() => setInputFocused(true)}
                onBlur={() => setInputFocused(false)}
                disabled={isLoading}
                autoSize={{ minRows: 1, maxRows: 6 }}
                style={{
                  border: 'none',
                  background: 'transparent',
                  resize: 'none',
                  fontSize: 15,
                  flex: 1,
                  lineHeight: 1.5,
                }}
              />
              <button
                className="send-btn"
                onClick={handleSend}
                disabled={(!inputValue.trim() && selectedImages.length === 0) || isLoading}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  border: 'none',
                  background: (!inputValue.trim() && selectedImages.length === 0)
                    ? 'rgba(200,200,200,0.3)'
                    : 'linear-gradient(135deg, #7C3AED, #9B59FF)',
                  color: '#fff',
                  cursor: (!inputValue.trim() && selectedImages.length === 0) ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  boxShadow: (!inputValue.trim() && selectedImages.length === 0)
                    ? 'none'
                    : '0 3px 12px rgba(124,58,237,0.35)',
                  transition: 'all 0.25s ease',
                  marginLeft: 8,
                }}
              >
                {isLoading ? <Spin size="small" /> : <SendOutlined style={{ fontSize: 16 }} />}
              </button>
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
        .chat-input-wrapper .ant-input:focus,
        .chat-input-wrapper .ant-input-focused,
        .chat-input-wrapper textarea:focus {
          box-shadow: none !important;
        }
        .send-btn:hover:not(:disabled) {
          transform: scale(1.08);
          box-shadow: 0 4px 16px rgba(124,58,237,0.45) !important;
        }
        .send-btn:active:not(:disabled) {
          transform: scale(0.95);
        }
        .img-btn:hover {
          color: #7C3AED !important;
          background: rgba(124,58,237,0.08) !important;
        }
        .chat-mode-btn:hover {
          opacity: 0.85;
          transform: translateY(-1px);
        }
        .thinking-dots { display: flex; gap: 3px; }
        .thinking-dots .dot {
          width: 5px; height: 5px; border-radius: 50%;
          background-color: #7C3AED;
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
          background: #7C3AED; margin-left: 2px;
          animation: blink 1s step-start infinite; vertical-align: text-bottom;
        }
        @keyframes blink { 50% { opacity: 0; } }
      `}</style>
    </div>
  );
};

export default ChatArea;