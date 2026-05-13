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
import ChampionTooltip from './ChampionTooltip';
import { getChampionRegex, getChampionImage } from '../data/championData';
import ItemTooltip from './ItemTooltip';
import { getItemRegex, getItemImage } from '../data/itemData';


const { Text } = Typography;

// Helper: recursively process React children to detect and wrap champion names with tooltips
const processChampionNames = (children) => {
  if (!children) return children;
  return React.Children.map(children, (child) => {
    // Only process plain text strings
    if (typeof child === 'string') {
      const regex = getChampionRegex();
      const parts = [];
      let lastIndex = 0;
      let match;
      while ((match = regex.exec(child)) !== null) {
        if (match.index > lastIndex) {
          parts.push(child.slice(lastIndex, match.index));
        }
        const matchedText = match[0];
        // Normalize curly quotes → straight quote cho lookup trong CHAMPION_DATA
        const normalizedName = matchedText.replace(/[\u2018\u2019]/g, "'");
        parts.push(
          <ChampionTooltip key={`champ-${matchedText}-${match.index}`} name={normalizedName}>
            {matchedText}
          </ChampionTooltip>
        );
        lastIndex = regex.lastIndex;
      }
      if (parts.length === 0) return child; // no champion found
      if (lastIndex < child.length) parts.push(child.slice(lastIndex));
      return <>{parts}</>;
    }
    // If it's a React element with children, recurse into it
    if (React.isValidElement(child) && child.props?.children) {
      return React.cloneElement(child, {}, processChampionNames(child.props.children));
    }
    return child;
  });
};

// Helper: recursively process React children to detect and wrap item names with tooltips
const processItemNames = (children) => {
  if (!children) return children;
  return React.Children.map(children, (child) => {
    if (typeof child === 'string') {
      const regex = getItemRegex();
      const parts = [];
      let lastIndex = 0;
      let match;
      while ((match = regex.exec(child)) !== null) {
        if (match.index > lastIndex) {
          parts.push(child.slice(lastIndex, match.index));
        }
        const matchedText = match[0];
        const normalizedName = matchedText.replace(/[\u2018\u2019]/g, "'");
        parts.push(
          <ItemTooltip key={`item-${matchedText}-${match.index}`} name={normalizedName}>
            {matchedText}
          </ItemTooltip>
        );
        lastIndex = regex.lastIndex;
      }
      if (parts.length === 0) return child;
      if (lastIndex < child.length) parts.push(child.slice(lastIndex));
      return <>{parts}</>;
    }
    if (React.isValidElement(child) && child.props?.children) {
      return React.cloneElement(child, {}, processItemNames(child.props.children));
    }
    return child;
  });
};

// Xử lý cả champion và item tooltips (champion trước, item sau)
const processTooltips = (children) => {
  const withChampions = processChampionNames(children);
  return processItemNames(withChampions);
};

// Shared markdown components for bot responses (modern, colorful styling)
const BOT_MD_COMPONENTS = {
  h1: ({ children }) => (
    <div className="my-6 px-5 py-3.5 premium-gradient-bg rounded-xl font-extrabold text-2xl tracking-wide">
      {children}
    </div>
  ),
  h2: ({ children }) => (
    <div className="my-5 px-5 py-3.5 bg-premium-50 border-l-4 border-premium-600 rounded-r-xl font-extrabold text-premium-900 text-xl shadow-sm">
      {children}
    </div>
  ),
  h3: ({ children }) => (
    <div className="my-4 px-4 py-2.5 bg-premium-50/50 border-l-4 border-premium-500 rounded-r-lg font-bold text-premium-800 text-lg shadow-sm">
      {children}
    </div>
  ),
  p: ({ children }) => <p className="my-2 leading-relaxed text-slate-700">{processTooltips(children)}</p>,
  ul: ({ children }) => <ul className="pl-5 my-2 list-none">{children}</ul>,
  ol: ({ children }) => <ol className="pl-5 my-2 list-none" style={{ counterReset: 'bot-ol' }}>{children}</ol>,
  li: ({ children, node }) => {
    const isOrdered = node?.parentNode?.tagName === 'ol';
    const astFirst = node?.children?.[0];
    const isHeaderItem =
      astFirst?.tagName === 'strong' ||
      (astFirst?.tagName === 'p' && astFirst?.children?.[0]?.tagName === 'strong');
    return (
      <li className="my-1.5 leading-relaxed flex items-start gap-2.5">
        {!isHeaderItem && (
          <span className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold mt-1 ${isOrdered ? 'premium-gradient-bg' : 'bg-premium-100 text-premium-600'}`}>
            {isOrdered ? '✦' : '•'}
          </span>
        )}
        <span className="flex-1 text-slate-700">{processTooltips(children)}</span>
      </li>
    );
  },
  code: ({ node, inline, className, children, ...props }) => {
    if (inline) {
      return <code className="bg-premium-50 border border-premium-200 rounded px-1.5 py-0.5 text-sm font-mono text-premium-600 font-medium">{children}</code>;
    }
    return (
      <pre className="bg-slate-900 rounded-xl p-4 overflow-x-auto my-3 border border-slate-800 shadow-inner custom-scrollbar">
        <code className="text-slate-300 text-sm font-mono whitespace-pre">{children}</code>
      </pre>
    );
  },
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-premium-600 my-3 bg-premium-50 rounded-r-lg px-4 py-2.5 italic text-slate-600">
      {children}
    </blockquote>
  ),
  strong: ({ children }) => <strong className="font-bold text-premium-900 bg-premium-100/50 px-1 rounded-sm">{processTooltips(children)}</strong>,
  hr: () => <hr className="my-5 border-t-2 border-premium-200/50" />,
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer"
      className="text-premium-600 font-medium border-b border-premium-300 hover:border-premium-600 hover:text-premium-700 transition-colors"
      onClick={e => { e.preventDefault(); window.open(href, '_blank', 'noopener,noreferrer'); }}>
      {children}
    </a>
  ),
  img: ({ src, alt }) => {
    const isItemIcon = src && src.includes('/image/item_');
    if (isItemIcon) {
      return (
        <img src={src} alt={alt} title={alt}
          className="w-10 h-10 rounded-lg inline-block align-middle mx-1 shadow-sm border border-premium-200 bg-slate-900" />
      );
    }
    return (
      <img src={src} alt={alt}
        className="max-w-full max-h-80 rounded-xl block my-2 shadow-md border border-premium-100" />
    );
  },
  table: ({ children }) => (
    <div className="overflow-x-auto my-3 rounded-xl border border-premium-200 shadow-sm custom-scrollbar">
      <table className="w-full text-sm border-collapse">{children}</table>
    </div>
  ),
  th: ({ children }) => <th className="border-b border-premium-200 px-4 py-2.5 premium-gradient-bg font-semibold text-left tracking-wide">{children}</th>,
  td: ({ children }) => <td className="border-b border-premium-100 px-4 py-2 bg-slate-50/50 text-slate-700">{processTooltips(children)}</td>,
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
      .then(data => {
        if (!data || typeof data !== 'object') return;
        const counts = {};
        const votes = {};
        for (const [id, stats] of Object.entries(data)) {
          counts[id] = { up: stats.up || 0, down: stats.down || 0 };
          votes[id] = stats.user_vote || null;
        }
        setFeedbackCounts(prev => ({ ...prev, ...counts }));
        setFeedbacks(prev => ({ ...prev, ...votes }));
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messageIdsKey, userId]);

  // Temp IDs are Date.now() values (~1.7e12), real DB IDs are small auto-increment numbers
  const isTempId = (id) => typeof id === 'number' && id > 1e12;

  const handleFeedback = async (msgId, vote) => {
    // Block feedback if the message ID hasn't been resolved to a real DB id yet
    if (isTempId(msgId)) return;
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
    if (userId) {
      try {
        const data = await submitFeedback(msgId, userId, newVote || 'none');
        // Update with backend truth (cumulative counts across users)
        if (data && typeof data === 'object') {
          setFeedbackCounts(prev => ({ ...prev, [msgId]: { up: data.up || 0, down: data.down || 0 } }));
          setFeedbacks(prev => ({ ...prev, [msgId]: data.user_vote || null }));
        }
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
                    <div className="flex justify-end mb-4 animate-fade-in-up">
                      <div className="max-w-[80%] rounded-[24px] bg-white text-slate-900 px-5 py-3.5 text-[15px] border-2 border-premium-600 shadow-[0_4px_18px_rgba(124,58,237,0.12)] whitespace-normal leading-relaxed">
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
                            p: ({ children }) => <p style={{ margin: '4px 0', lineHeight: 1.6, color: '#1a1a1a' }}>{children}</p>,
                            ul: ({ children }) => <ul style={{ paddingLeft: 20, margin: '4px 0', listStyleType: 'disc', color: '#1a1a1a' }}>{children}</ul>,
                            ol: ({ children }) => <ol style={{ paddingLeft: 20, margin: '4px 0', color: '#1a1a1a' }}>{children}</ol>,
                            li: ({ children }) => <li style={{ lineHeight: 1.6, margin: '2px 0', color: '#1a1a1a' }}>{children}</li>,
                            hr: () => <hr style={{ margin: '12px 0', borderColor: 'rgba(124,58,237,0.3)' }} />,
                            a: ({ href, children }) => (
                              <a href={href} target="_blank" rel="noopener noreferrer"
                                style={{ color: '#7C3AED', textDecoration: 'underline', cursor: 'pointer', fontWeight: 500 }}
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
                      <div className={`flex justify-start items-start ${isLatestPair ? 'flex-auto' : 'flex-none'} animate-fade-in-up`}>
                        <div className="max-w-full rounded-[20px] glass-panel text-slate-800 px-6 py-5 text-[15px] w-full border border-premium-200 shadow-sm leading-relaxed">
                        <BotMarkdown>{nextAssistantMsg.content}</BotMarkdown>
                        {/* Feedback buttons */}
                        {(() => {
                          const mid = nextAssistantMsg.id;
                          const pending = isTempId(mid);
                          return (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, paddingTop: 10, borderTop: '1px solid rgba(124,58,237,0.08)' }}>
                            <span style={{ fontSize: 12, color: '#999' }}>Phản hồi hữu ích?</span>
                            <button
                              onClick={() => handleFeedback(mid, 'up')}
                              disabled={pending}
                              style={{
                                display: 'flex', alignItems: 'center', gap: 4,
                                padding: '3px 10px', borderRadius: 20, border: 'none',
                                cursor: pending ? 'not-allowed' : 'pointer',
                                fontSize: 13, fontWeight: 600, transition: 'all 0.2s',
                                opacity: pending ? 0.45 : 1,
                                background: feedbacks[mid] === 'up'
                                  ? 'linear-gradient(135deg, #7C3AED, #9B59FF)'
                                  : 'rgba(124,58,237,0.08)',
                                color: feedbacks[mid] === 'up' ? '#fff' : '#7C3AED',
                                boxShadow: feedbacks[mid] === 'up' ? '0 2px 8px rgba(124,58,237,0.35)' : 'none',
                              }}
                              title={pending ? 'Đang lưu tin nhắn...' : 'Hữu ích'}
                            >
                              👍 {feedbackCounts[mid]?.up || 0}
                            </button>
                            <button
                              onClick={() => handleFeedback(mid, 'down')}
                              disabled={pending}
                              style={{
                                display: 'flex', alignItems: 'center', gap: 4,
                                padding: '3px 10px', borderRadius: 20, border: 'none',
                                cursor: pending ? 'not-allowed' : 'pointer',
                                fontSize: 13, fontWeight: 600, transition: 'all 0.2s',
                                opacity: pending ? 0.45 : 1,
                                background: feedbacks[mid] === 'down'
                                  ? 'linear-gradient(135deg, #cf4f4f, #e07c7c)'
                                  : 'rgba(207,79,79,0.08)',
                                color: feedbacks[mid] === 'down' ? '#fff' : '#cf4f4f',
                                boxShadow: feedbacks[mid] === 'down' ? '0 2px 8px rgba(207,79,79,0.3)' : 'none',
                              }}
                              title={pending ? 'Đang lưu tin nhắn...' : 'Không hữu ích'}
                            >
                              👎 {feedbackCounts[mid]?.down || 0}
                            </button>
                          </div>
                          );
                        })()}
                        </div>
                      </div>
                    )}
                    {/* Nếu là user cuối cùng, đang active và có streamingMessage thì render chunk ngay dưới user */}
                    {isLastUser && streamingMessage && isActive && (
                      <div className="flex-auto flex justify-start items-start animate-fade-in-up">
                        <div className="max-w-full rounded-[20px] glass-panel text-slate-800 px-6 py-5 text-[15px] w-full border border-premium-200 shadow-sm leading-relaxed">
                          <BotMarkdown>{streamingMessage}</BotMarkdown>
                          {isLoading && isActive && <span className="streaming-cursor" />}
                        </div>
                      </div>
                    )}
                    {/* Thinking section for last user message */}
                    {isLastUser && isActive && streamingThinking && !streamingMessage && (
                      <div
                        className="flex-none mt-4 premium-gradient-bg rounded-2xl p-4 shadow-md border border-premium-400 transition-all duration-300 animate-fade-in-up"
                        style={{ maxWidth: showThinking ? '100%' : 360 }}
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
                onClick={() => { window.location.href = '/login'; }}
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
              className={`chat-input-wrapper w-full px-5 py-3.5 bg-white/80 backdrop-blur-md rounded-full flex items-center transition-all duration-300 ${
                inputFocused
                  ? 'border-2 border-premium-500 shadow-[0_8px_32px_rgba(124,58,237,0.15)] ring-4 ring-premium-500/10'
                  : 'border-2 border-slate-200 shadow-sm hover:border-premium-300 hover:shadow-md'
              }`}
            >
              {!isGuest && (
                <Button
                  icon={<PictureOutlined />}
                  type="text"
                  shape="circle"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isLoading}
                  className="img-btn flex-shrink-0 text-slate-400 hover:text-premium-600 hover:bg-premium-50 transition-colors mr-2 text-lg"
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
                className="flex-1 text-[15px] leading-relaxed bg-transparent border-none resize-none placeholder-slate-400 text-slate-800 focus:ring-0 custom-scrollbar"
              />
              <button
                className={`send-btn w-10 h-10 rounded-full border-none flex items-center justify-center flex-shrink-0 ml-2 transition-all duration-300 ${
                  (!inputValue.trim() && selectedImages.length === 0)
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    : 'premium-gradient-bg cursor-pointer hover:scale-105 active:scale-95'
                }`}
              >
                {isLoading ? <Spin size="small" /> : <SendOutlined style={{ fontSize: 16 }} />}
              </button>
            </div>
          </div>
          )}
        </div>
      </div>

      <style>{`
        .chat-input-wrapper .ant-input:focus,
        .chat-input-wrapper .ant-input-focused,
        .chat-input-wrapper textarea:focus {
          box-shadow: none !important;
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
        @keyframes championTooltipFadeIn {
          from { opacity: 0; transform: translate(-50%, -90%); }
          to { opacity: 1; transform: translate(-50%, -100%); }
        }
      `}</style>
    </div>
  );
};

export default ChatArea;