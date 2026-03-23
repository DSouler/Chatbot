import React, { useState, useEffect, useRef, useContext, useCallback } from 'react';
import { Layout, Input, Typography, Button, message, Spin } from 'antd';
import { SendOutlined, PictureOutlined, CloseCircleFilled } from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import CustomSider from '../../components/Layouts/CustomSider';
import Footer from '../../components/Layouts/Footer';
import ChatWithInfoLayout from '../../layouts/ChatWithInfoLayout';
import { getMessages, getConversations, createConversation, sendMessageStream, getImageUrl, getSavedImages, updateLastBotMessage } from '../../services/chat';
import { createRequestData, getCurrentChatConfig, CHAT_MODES } from '../../config/chatConfig';
import { useUser } from '../../hooks/useUser';
import { SiderContext } from '../../contexts/SiderContext';
import logoUrl from '../../assets/logo.svg';

const { Content } = Layout;
const { Title, Text } = Typography;

const GuestLimitBanner = ({ navigate }) => (
  <div style={{
    width: '100%',
    maxWidth: 600,
    background: 'linear-gradient(135deg, #E5F0F8 0%, #ede8ff 100%)',
    border: '1.5px solid #b9acf5',
    borderRadius: 16,
    padding: '18px 24px',
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    boxShadow: '0 4px 20px rgba(59,130,196,0.13)',
  }}>
    <span style={{ fontSize: 28 }}>🔒</span>
    <div style={{ flex: 1 }}>
      <div style={{ fontWeight: 700, color: '#4c3dbf', fontSize: 15, marginBottom: 4 }}>
        Đã đến giới hạn lượt dùng thử
      </div>
      <div style={{ color: '#6b5fc7', fontSize: 13 }}>
        Vui lòng đăng nhập để có trải nghiệm tốt hơn và không giới hạn.
      </div>
    </div>
    <button
      onClick={() => { sessionStorage.removeItem('guestMode'); navigate('/login'); }}
      style={{
        padding: '8px 20px',
        borderRadius: 10,
        border: 'none',
        background: '#3B82C4',
        color: '#fff',
        fontWeight: 700,
        fontSize: 13,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}
    >
      Đăng nhập
    </button>
  </div>
);

const Chat = () => {
  const { collapsedSider, setCollapsedSider, collapsedInfoPanel, setCollapsedInfoPanel } = useContext(SiderContext);
  const { conversationId: urlConversationId } = useParams();
  const navigate = useNavigate();
  const [selectedConversationId, setSelectedConversationId] = useState(null);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [conversationMessages, setConversationMessages] = useState({});
  const [showWelcome, setShowWelcome] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState('');
  const [streamingThinking, setStreamingThinking] = useState('');
  const [streamingType, setStreamingType] = useState(null); 
  const [conversationList, setConversationList] = useState([]);
  const [streamingStatus, setStreamingStatus] = useState('');
  const [streamingInfo, setStreamingInfo] = useState('');
  const [streamingUsage, setStreamingUsage] = useState(null);
  const [streamingError, setStreamingError] = useState(null);
  const [pendingUserMessage, setPendingUserMessage] = useState(null);
  const [infoSources, setInfoSources] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [welcomeImages, setWelcomeImages] = useState([]);
  const welcomeFileInputRef = useRef(null);
  const [isComposingNewMessage, setIsComposingNewMessage] = useState(false);
  const [isRestoringConversation, setIsRestoringConversation] = useState(false);
  const [chatMode, setChatMode] = useState('RAG');
  const [welcomeInputFocused, setWelcomeInputFocused] = useState(false);
  const [serverChampions, setServerChampions] = useState([]);


  const { user } = useUser();
  const skipAuth = import.meta.env.VITE_APP_SKIP_AUTH === 'true';
  const isGuest = !user && !skipAuth && sessionStorage.getItem('guestMode') === 'true';
  const userId = user?.user_id ?? (skipAuth ? 1 : undefined);

  const GUEST_MSG_LIMIT = 2;
  const [guestMsgCount, setGuestMsgCount] = useState(() => {
    return isGuest ? parseInt(sessionStorage.getItem('guestMsgCount') || '0', 10) : 0;
  });
  const guestLimitReached = isGuest && guestMsgCount >= GUEST_MSG_LIMIT;

  const botMessageRef = useRef('');
  const thinkingRef = useRef('');
  const streamingConversationIdRef = useRef(null);
  const isCreatingConversationRef = useRef(false);
  const currentStreamRef = useRef(null);
  const pendingAbilityImageRef = useRef(null); // URL ảnh kỹ năng cần inject vào response
  const streamSourcesRef = useRef([]); // sources from current stream for DB persistence

  // Throttled streaming updates — batch token renders at ~30ms intervals
  const streamingRafRef = useRef(null);
  const pendingStreamRef = useRef(null);
  const pendingThinkingStreamRef = useRef(null);

  const flushStreaming = useCallback(() => {
    streamingRafRef.current = null;
    if (pendingStreamRef.current !== null) {
      setStreamingMessage(pendingStreamRef.current);
      pendingStreamRef.current = null;
    }
    if (pendingThinkingStreamRef.current !== null) {
      setStreamingThinking(pendingThinkingStreamRef.current);
      pendingThinkingStreamRef.current = null;
    }
  }, []);

  const scheduleStreamingUpdate = useCallback((content, type) => {
    if (type === 'thinking') {
      pendingThinkingStreamRef.current = content;
    } else {
      pendingStreamRef.current = content;
    }
    if (!streamingRafRef.current) {
      streamingRafRef.current = requestAnimationFrame(flushStreaming);
    }
  }, [flushStreaming]);
  const isFetchingConversationsRef = useRef(false); // prevent duplicate fetchConversations calls
  const fetchConvGenRef = useRef(0); // generation counter to discard stale responses
  const lastLoadedConvIdRef = useRef(null); // prevent duplicate getMessages on int→string id change

  const currentMessages = conversationMessages[selectedConversationId] || [];

  // Fetch danh sách tướng đã có ảnh từ server khi load
  useEffect(() => {
    getSavedImages()
      .then(data => setServerChampions(data.names || []))
      .catch(() => {});
  }, []);

  // Khôi phục conversation từ URL khi component mount
  useEffect(() => {
    if (urlConversationId && userId) {
      if (conversationList.length === 0) {
        // Nếu chưa có conversationList, set trạng thái đang khôi phục
        setIsRestoringConversation(true);
      } else {
        // Kiểm tra xem conversation có tồn tại trong danh sách không
        const conversationExists = conversationList.some(conv => String(conv.id) === String(urlConversationId));
        if (!conversationExists) {
          // Nếu conversation không tồn tại, chuyển về trang chủ
          navigate('/home');
        }
      }
    }
  }, [urlConversationId, conversationList, userId, navigate]);

  useEffect(() => {
    if (userId && !isGuest) {
      // Reset guard và tăng gen để hủy fetch cũ (if any) khi userId thay đổi
      isFetchingConversationsRef.current = false;
      fetchConvGenRef.current++;
      fetchConversations();
    } else {
      // Hủy fetch đang chạy và xóa list khi logout / guest mode
      fetchConvGenRef.current++;
      setConversationList([]);
    }
  }, [userId, urlConversationId, isGuest]);

  // Đảm bảo hiển thị welcome screen khi không có conversation nào được chọn
  // Chỉ hiển thị welcome khi đã fetch xong conversationList và không có conversation hợp lệ
  // Và không đang trong quá trình khôi phục conversation
  useEffect(() => {
    if (!selectedConversationId && !urlConversationId && conversationList.length > 0 && !isRestoringConversation) {
      setShowWelcome(true);
      setIsComposingNewMessage(true);
    }
  }, [selectedConversationId, urlConversationId, conversationList.length, isRestoringConversation]);

  // Reset trạng thái khôi phục khi không có URL params
  useEffect(() => {
    if (!urlConversationId) {
      setIsRestoringConversation(false);
    } else if (!userId) {
      // Nếu có URL params nhưng chưa có userId, set trạng thái đang khôi phục
      setIsRestoringConversation(true);
    }
  }, [urlConversationId, userId]);

  const fetchConversations = async () => {
    if (isFetchingConversationsRef.current) return;
    isFetchingConversationsRef.current = true;
    const myGen = fetchConvGenRef.current; // snapshot gen tại thời điểm bắt đầu fetch
    try {
      const res = await getConversations(userId);
      // Bỏ qua nếu đã có fetch mới hơn được kích hoạt (userId thay đổi)
      if (myGen !== fetchConvGenRef.current) return;
      const conversations = res.conversations || [];
      setConversationList(conversations);

      // Nếu có URL params và conversationList vừa được fetch, kiểm tra ngay
      if (urlConversationId && conversations.length > 0) {
        const conversationExists = conversations.some(conv => String(conv.id) === String(urlConversationId));
        if (conversationExists) {
          setSelectedConversationId(urlConversationId);
          setActiveConversationId(urlConversationId);
          setShowWelcome(false);
          setIsComposingNewMessage(false);
        }
        setIsRestoringConversation(false);
      }
    } catch (err) {
      if (myGen !== fetchConvGenRef.current) return;
      setConversationList([]);
      setIsRestoringConversation(false);
    } finally {
      if (myGen === fetchConvGenRef.current) {
        isFetchingConversationsRef.current = false;
      }
    }
  };

  const handleSelectConversation = (id) => {
    if (streamingConversationIdRef.current && streamingConversationIdRef.current !== id) {
      streamingConversationIdRef.current = null;
    }
    lastLoadedConvIdRef.current = null; // allow fresh load for the selected conversation
    setSelectedConversationId(id);
    setIsComposingNewMessage(false); // Đảm bảo chuyển sang màn chat cũ
    setShowWelcome(false);
    setStreamingMessage('');
    setStreamingThinking('');
    setStreamingType(null); 
    setStreamingStatus('');
    setStreamingInfo('');
    setStreamingError(null);
    setPendingUserMessage(null);
    setIsLoading(false);
    streamingConversationIdRef.current = null;
    currentStreamRef.current = null; // Reset ref streaming khi chuyển conversation
    setStreamingUsage(null);
    setInfoSources([]);
    setActiveConversationId(id);
    setIsRestoringConversation(false);
    
    // Cập nhật URL
    navigate(`/home/${id}`);
  };

  const handleSend = async (content, images = []) => {
    // Validate input and prevent multiple submissions
    if ((!content.trim() && images.length === 0) || isLoading || isCreatingConversationRef.current) {
      return;
    }

    // Handle image retrieval commands — /img <name> OR ảnh <name> OR xem ảnh <name>
    const imgMatch = content.trim().match(/^(?:\/img|ảnh|xem ảnh|hiện ảnh|cho xem ảnh)\s+(.+)$/i);
    if (imgMatch) {
      const imgName = imgMatch[1].trim();
      const imgUrl = getImageUrl(imgName);
      // Verify image exists before showing
      fetch(imgUrl, { method: 'HEAD' }).then(res => {
        const userMsg = { id: `u-${Date.now()}`, role: 'user', content };
        const botMsg = res.ok
          ? { id: `b-${Date.now()}`, role: 'assistant', content: `![${imgName}](${imgUrl})` }
          : { id: `b-${Date.now()}`, role: 'assistant', content: `Không tìm thấy ảnh **"${imgName}"**. Hãy lưu ảnh trước bằng cách đính kèm ảnh và click 💾 để đặt tên.` };
        const convId = selectedConversationId || `local-${Date.now()}`;
        setConversationMessages(prev => ({
          ...prev,
          [convId]: [...(prev[convId] || []), userMsg, botMsg],
        }));
        if (!selectedConversationId) {
          setSelectedConversationId(convId);
          setActiveConversationId(convId);
          setShowWelcome(false);
        }
      }).catch(() => {
        const userMsg = { id: `u-${Date.now()}`, role: 'user', content };
        const botMsg = { id: `b-${Date.now()}`, role: 'assistant', content: `Không tìm thấy ảnh **"${imgName}"**.` };
        const convId = selectedConversationId || `local-${Date.now()}`;
        setConversationMessages(prev => ({
          ...prev,
          [convId]: [...(prev[convId] || []), userMsg, botMsg],
        }));
      });
      return;
    }

    // Block guest if limit reached
    if (isGuest && guestMsgCount >= GUEST_MSG_LIMIT) {
      return;
    }
    // Increment guest message count
    if (isGuest) {
      const next = guestMsgCount + 1;
      setGuestMsgCount(next);
      sessionStorage.setItem('guestMsgCount', String(next));
    }
  
    setIsLoading(true);
    
    // Clear input immediately
    setInputValue('');
    
    // Reset streaming states
    setStreamingMessage('');
    setStreamingThinking('');
    setStreamingStatus('');
    setStreamingInfo('');
    setStreamingUsage(null);
    setStreamingError(null);
  
    let conversationId = selectedConversationId;
    
    // Create new conversation if needed
    if (!conversationId) {
      isCreatingConversationRef.current = true;

      try {
        if (isGuest) {
          // Guest mode: use a local temp ID, no DB storage
          conversationId = `guest-${Date.now()}`;
        } else {
          const res = await createConversation(userId, content.slice(0, 20));
          conversationId = res.conversation_id || res.id;
    
          if (!conversationId) {
            throw new Error('Failed to create conversation');
          }
    
          fetchConversations().catch(console.error);
          // Cập nhật URL với conversation mới
          navigate(`/home/${conversationId}`);
        }
    
        // Đặt conversation mới vào trạng thái active
        setSelectedConversationId(conversationId);
        setActiveConversationId(conversationId);
        setShowWelcome(false);
        setIsRestoringConversation(false);
      } catch (err) {
        console.error('Error creating conversation:', err);
        message.error('Failed to create new conversation');
        setIsLoading(false);
        return;
      } finally {
        isCreatingConversationRef.current = false;
      }
    }
    
    // Set active conversation và streaming reference
    setActiveConversationId(conversationId); // Đảm bảo luôn đồng bộ
    streamingConversationIdRef.current = conversationId;
  
    // Create user message
    const userMessage = {
      id: Date.now(),
      role: 'user',
      content: content,
      images: images || [],
      created_at: new Date().toISOString()
    };

    // Cache images to localStorage BEFORE state update (outside state updater to avoid strict mode double-invoke)
    if (images && images.length > 0) {
      try {
        const cacheKey = `chat_imgs_${conversationId}`;
        const cache = JSON.parse(localStorage.getItem(cacheKey) || '{}');
        const currentMsgs = conversationMessages[conversationId] || [];
        const userMsgIdx = currentMsgs.filter(m => m.role === 'user').length;
        cache[userMsgIdx] = images;
        localStorage.setItem(cacheKey, JSON.stringify(cache));
      } catch { /* localStorage full or unavailable */ }
    }

    // Add user message to conversation immediately
    setConversationMessages(prev => {
      const prevMsgs = prev[conversationId] || [];
      return {
        ...prev,
        [conversationId]: [...prevMsgs, userMessage]
      };
    });
  
    // Ensure conversation is selected
    if (selectedConversationId !== conversationId) {
      setSelectedConversationId(conversationId);
    }
  
    // Set pending message to trigger streaming
    setPendingUserMessage({ ...userMessage, conversationId, images: images || [] });
    setIsComposingNewMessage(false);
  };

  const handleDeleteConversation = async (conversationId) => {
    try { localStorage.removeItem(`chat_imgs_${conversationId}`); } catch { /* ignore */ }
    await fetchConversations();
    if (selectedConversationId === conversationId) {
      handleResetChat();
    }
  };

  useEffect(() => {
    if (!selectedConversationId || isGuest) return;
    // Normalize to string to prevent duplicate load when int→string type change happens
    const convIdStr = String(selectedConversationId);
    if (lastLoadedConvIdRef.current === convIdStr) return;
    lastLoadedConvIdRef.current = convIdStr;

    getMessages(selectedConversationId).then(res => {
        const msgs = res.messages || [];

        let imgCache = {};
        try {
          imgCache = JSON.parse(localStorage.getItem(`chat_imgs_${selectedConversationId}`) || '{}');
        } catch { /* ignore */ }

        // Parse images field robustly - handles: array, JSON string (some psycopg2 configs), null
        const parseDbImages = (raw) => {
          if (Array.isArray(raw) && raw.length > 0) return raw;
          if (typeof raw === 'string' && raw.trim().startsWith('[')) {
            try { const parsed = JSON.parse(raw); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
          }
          return [];
        };

        let userMsgIdx = 0;
        const restoredMsgs = msgs.map(msg => {
          if (msg.role === 'user') {
            const dbImages = parseDbImages(msg.images);
            const cachedImages = Array.isArray(imgCache[userMsgIdx]) ? imgCache[userMsgIdx] : [];
            userMsgIdx++;
            return { ...msg, images: dbImages.length > 0 ? dbImages : cachedImages };
          }
          return { ...msg, images: [] };
        });

        setConversationMessages(prev => ({
          ...prev,
          [selectedConversationId]: restoredMsgs,
        }));
        setShowWelcome(false);

        // Restore sources from the last assistant message
        const lastAssistant = [...restoredMsgs].reverse().find(m => m.role === 'assistant' && m.sources);
        if (lastAssistant && Array.isArray(lastAssistant.sources) && lastAssistant.sources.length > 0) {
          setInfoSources(lastAssistant.sources);
        } else {
          setInfoSources([]);
        }
      }).catch(() => {
        message.error('Unable to load messages');
      });
  }, [selectedConversationId]);

  useEffect(() => {
    if (!pendingUserMessage) return;

    const chatHistory = (conversationMessages[pendingUserMessage.conversationId] || []).map(msg => ({
      role: msg.role,
      content: msg.content
    }));

    const requestData = createRequestData(
      pendingUserMessage.content,
      pendingUserMessage.conversationId,
      userId,
      chatHistory,
      getCurrentChatConfig(),
      chatMode,
      pendingUserMessage.images
    );

    botMessageRef.current = '';
    thinkingRef.current = '';
    streamSourcesRef.current = [];

    // Auto-prepend champion portrait + chuẩn bị inject ảnh kỹ năng vào response
    const localChampions = JSON.parse(localStorage.getItem('savedChampions') || '[]').map(c => c.name);
    const allChampionNames = [...new Set([...serverChampions, ...localChampions])];
    const textLower = (pendingUserMessage.content || '').toLowerCase();

    pendingAbilityImageRef.current = null;

    // Tìm tên tướng đơn giản (không có _) xuất hiện trong tin nhắn
    const matchedChampion = allChampionNames.find(name =>
      !name.includes('_') && textLower.includes(name.toLowerCase())
    );

    if (matchedChampion) {
      // Hiện portrait ở đầu response
      botMessageRef.current = `![${matchedChampion}](${getImageUrl(matchedChampion)})\n\n`;
      scheduleStreamingUpdate(botMessageRef.current, 'token');

      // Chuẩn bị inject ảnh kỹ năng sau phần trang bị
      const abilityImg = allChampionNames.find(n =>
        n.startsWith(matchedChampion + '_ky') || n.startsWith(matchedChampion + '_abi')
      );
      if (abilityImg) {
        pendingAbilityImageRef.current = getImageUrl(abilityImg);
      }
    }

    currentStreamRef.current = pendingUserMessage.conversationId;

    sendMessageStream(
      requestData,
      (data) => {
        if (currentStreamRef.current !== pendingUserMessage.conversationId) return;

        if (data.type === 'thinking') {
          setStreamingType('thinking');
          thinkingRef.current += data.content;
          scheduleStreamingUpdate(thinkingRef.current, 'thinking');
        } else if (data.type === 'token') {
          setStreamingType('token');
          botMessageRef.current += data.content;
          scheduleStreamingUpdate(botMessageRef.current, 'token');
        } else if (data.type === 'status') {
          setStreamingStatus(data.message);
        } else if (data.type === 'info') {
          setStreamingInfo(data.message);
        } else if (data.type === 'usage') {
          setStreamingUsage(data.data);
        } else if (data.type === 'error') {
          setStreamingError(data.message);
          botMessageRef.current = `⚠️ **Lỗi:** ${data.message}`;
          scheduleStreamingUpdate(botMessageRef.current, 'token');
        } else if (data.type === 'sources') {
          const mapped = (data.data || []).map((src, idx) => ({
            name: src.metadata?.file_name || `Source ${idx + 1}`,
            doc: src.content,
            id: src.metadata?._id || idx,
            similarity_score: src.embedding_score,
            ...src
          }));
          setInfoSources(mapped);
          streamSourcesRef.current = mapped;
        }
      },
      () => {
        if (currentStreamRef.current !== pendingUserMessage.conversationId) return;
        // Cancel any pending RAF and flush final content
        if (streamingRafRef.current) {
          cancelAnimationFrame(streamingRafRef.current);
          streamingRafRef.current = null;
        }
        if (botMessageRef.current.trim()) {
          let finalContent = botMessageRef.current;

          // Inject ảnh kỹ năng vào đúng vị trí trong response
          const abilityUrl = pendingAbilityImageRef.current;
          if (abilityUrl) {
            const abilityImgMd = `\n\n![kỹ năng](${abilityUrl})\n`;
            // Tìm dòng bắt đầu phần kỹ năng (header markdown hoặc text)
            const abilityPattern = /(\n#{1,4}\s*kỹ\s*năng|\n\*{1,2}kỹ\s*năng|\nkỹ\s*năng\s*:|enraged inferno)/i;
            if (abilityPattern.test(finalContent)) {
              finalContent = finalContent.replace(abilityPattern, `${abilityImgMd}$1`);
            } else {
              // Không tìm thấy header → append ở cuối
              finalContent += `\n\n---\n${abilityImgMd}`;
            }
            pendingAbilityImageRef.current = null;
          }

          const botMessage = {
            id: Date.now() + 1,
            role: 'assistant',
            content: finalContent,
            created_at: new Date().toISOString()
          };

          setConversationMessages(prev => {
            const prevMsgs = prev[pendingUserMessage.conversationId] || [];
            return {
              ...prev,
              [pendingUserMessage.conversationId]: [...prevMsgs, botMessage]
            };
          });

          // Update DB with full content (including injected images) and sources
          const convId = pendingUserMessage.conversationId;
          if (convId && !isGuest && !String(convId).startsWith('guest-')) {
            const sourcesToSave = streamSourcesRef.current.length > 0 ? streamSourcesRef.current : null;
            updateLastBotMessage(convId, finalContent, sourcesToSave).catch(() => {});
          }
        }

        setActiveConversationId(pendingUserMessage.conversationId);

        setStreamingMessage('');
        setStreamingType(null);
        setIsLoading(false);
        setTimeout(() => {
          setStreamingStatus('');
          setStreamingInfo('');
          setStreamingUsage(null);
        }, 3000);
      },
      (error) => {
        if (currentStreamRef.current !== pendingUserMessage.conversationId) return;
        setStreamingError(error.message || 'An error occurred while sending message');
        message.error('An error occurred while sending message');
        setStreamingMessage('');
        setStreamingType(null);
        setIsLoading(false);
        setTimeout(() => {
          setStreamingError(null);
        }, 5000);
      }
    );

    setPendingUserMessage(null);
    // eslint-disable-next-line
  }, [pendingUserMessage]);

  const handleResetChat = () => {
    streamingConversationIdRef.current = null;
    currentStreamRef.current = null;
    // Reset toàn bộ state về mặc định
    setSelectedConversationId(null);
    setActiveConversationId(null);
    setShowWelcome(true);
    setIsComposingNewMessage(true);
    setWelcomeImages([]);
    setStreamingMessage('');
    setStreamingThinking('');
    setStreamingType(null);
    setStreamingStatus('');
    setStreamingInfo('');
    setStreamingUsage(null);
    setStreamingError(null);
    setPendingUserMessage(null);
    setIsLoading(false);
    setInfoSources([]);
    setInputValue('');
    setIsRestoringConversation(false);
    
    // Cập nhật URL về trang chủ
    navigate('/home');
  };

  return (
    <Layout style={{ height: '100vh', background: 'linear-gradient(160deg, #7EB3D4 0%, #96C6E2 30%, #A8D2EA 60%, #B4DAF0 100%)', position: 'relative' }}>
      {/* Subtle geometric background pattern */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none',
        backgroundImage: `
          radial-gradient(circle at 20% 30%, rgba(59,130,196,0.04) 0%, transparent 50%),
          radial-gradient(circle at 80% 70%, rgba(96,165,224,0.04) 0%, transparent 50%),
          radial-gradient(circle at 50% 50%, rgba(255,255,255,0.15) 0%, transparent 70%)`,
        backgroundSize: '100% 100%',
      }} />
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 0, pointerEvents: 'none', opacity: 0.025 }}>
        <defs>
          <pattern id="geo-pattern" x="0" y="0" width="160" height="160" patternUnits="userSpaceOnUse">
            <polygon points="80,15 88,38 112,38 93,52 100,75 80,62 60,75 67,52 48,38 72,38" fill="currentColor" opacity="0.6" />
            <circle cx="30" cy="120" r="6" fill="currentColor" opacity="0.3" />
            <rect x="130" y="110" width="14" height="14" rx="3" fill="currentColor" opacity="0.25" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#geo-pattern)" />
      </svg>
      <style>{`
        .chat-input-wrapper .ant-input:focus,
        .chat-input-wrapper .ant-input-focused,
        .chat-input-wrapper textarea:focus { box-shadow: none !important; }
        .send-btn:hover:not(:disabled) { transform: scale(1.08); box-shadow: 0 4px 16px rgba(124,58,237,0.45) !important; }
        .send-btn:active:not(:disabled) { transform: scale(0.95); }
        .img-btn:hover { color: #3B82C4 !important; background: rgba(59,130,196,0.08) !important; }
        .chat-mode-btn:hover { opacity: 0.85; transform: translateY(-1px); }
      `}</style>
      <CustomSider 
        collapsed={collapsedSider} 
        onToggle={() => setCollapsedSider(!collapsedSider)} 
        onSelectConversation={handleSelectConversation}
        selectedConversationId={selectedConversationId}
        onResetChat={handleResetChat}
        conversationList={conversationList}
        onDeleteConversation={handleDeleteConversation}
      />
      <Layout style={{
          position: 'relative',
          height: 'calc(100vh - 24px)',
          marginLeft: collapsedSider ? '91px' : '271px',
          marginTop: 12,
          marginRight: 12,
          marginBottom: 12,
          background: '#EEF4FA',
          overflow: 'hidden',
          zIndex: 1,
          borderRadius: 20,
          boxShadow: '0 10px 40px rgba(0,0,0,0.12), 0 2px 10px rgba(0,0,0,0.06)',
          border: '2px solid #A8CCE8',
        }}>
        <Content className="relative" style={{ height: '100%', background: 'transparent', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {isRestoringConversation ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}>
              <div style={{ textAlign: 'center' }}>
                <Spin size="large" />
                <div style={{ marginTop: 16, color: '#6b7280' }}>Loading conversation...</div>
              </div>
            </div>
          ) : (showWelcome || isComposingNewMessage) ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}>
              <div style={{ width: '100%', maxWidth: 420, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}>
                <img src={logoUrl} alt="TFT Logo" width={120} height={120} style={{ objectFit: 'contain', display: 'block' }} />
                <Title level={2} style={{ marginBottom: 0, color: '#3B82C4' }}>Welcome to TFTChat!</Title>
                <Text style={{ color: '#6b7280', marginBottom: 0 }}>
                Chatbot hỗ trợ thông tin nội bộ – luôn sẵn sàng giải đáp thắc mắc của bạn!
                </Text>
                <div style={{ width: '200%', display: 'flex', justifyContent: 'center', position: 'sticky', bottom: 0, padding: '24px 0' }}>
                  <div style={{ width: '100%', maxWidth: '950px', margin: '0px auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {CHAT_MODES.map(m => (
                        <button
                          key={m.value}
                          onClick={() => setChatMode(m.value)}
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
                      <GuestLimitBanner navigate={navigate} />
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <input
                        type="file"
                        ref={welcomeFileInputRef}
                        accept="image/jpeg,image/png,image/gif,image/webp"
                        multiple
                        style={{ display: 'none' }}
                        onChange={e => {
                          Array.from(e.target.files).forEach(file => {
                            if (file.size > 5 * 1024 * 1024) { message.warning(`"${file.name}" quá lớn (tối đa 5MB)`); return; }
                            const reader = new FileReader();
                            reader.onload = ev => {
                              const [header, base64] = ev.target.result.split(',');
                              const media_type = header.match(/data:(.*);base64/)[1];
                              setWelcomeImages(prev => [...prev, { preview: ev.target.result, base64, media_type, name: file.name }]);
                            };
                            reader.readAsDataURL(file);
                          });
                          e.target.value = '';
                        }}
                      />
                      {welcomeImages.length > 0 && (
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: '8px 12px', background: 'rgba(235,245,255,0.6)', borderRadius: 12 }}>
                          {welcomeImages.map((img, idx) => (
                            <div key={idx} style={{ position: 'relative' }}>
                              <img src={img.preview} alt={img.name} style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 10, display: 'block', border: '2px solid rgba(59,130,196,0.15)' }} />
                              <CloseCircleFilled
                                onClick={() => setWelcomeImages(prev => prev.filter((_, i) => i !== idx))}
                                style={{ position: 'absolute', top: -6, right: -6, color: '#ff4d4f', cursor: 'pointer', fontSize: 16, background: '#fff', borderRadius: '50%' }}
                              />
                            </div>
                          ))}
                        </div>
                      )}
                      <div
                        className="chat-input-wrapper"
                        style={{
                          padding: '12px 14px 12px 18px',
                          background: '#ffffff',
                          borderRadius: 24,
                          display: 'flex',
                          alignItems: 'center',
                          border: welcomeInputFocused
                            ? '1.5px solid #7C3AED'
                            : '1.5px solid #C8DCF0',
                          boxShadow: welcomeInputFocused
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
                          onClick={() => welcomeFileInputRef.current?.click()}
                          disabled={isLoading}
                          className="img-btn"
                          style={{ marginRight: 6, color: '#7BAAC4', flexShrink: 0, fontSize: 18 }}
                          title="Đính kèm ảnh"
                        />
                      )}
                      <Input.TextArea
                        placeholder="Nhập tin nhắn..."
                        value={inputValue}
                        onChange={e => {
                          setInputValue(e.target.value);
                          setIsComposingNewMessage(true);
                        }}
                        onPaste={e => {
                          if (isGuest) return;
                          const items = Array.from(e.clipboardData?.items || []);
                          const imageItems = items.filter(item => item.type.startsWith('image/'));
                          if (imageItems.length === 0) return;
                          e.preventDefault();
                          imageItems.forEach(item => {
                            const file = item.getAsFile();
                            if (!file) return;
                            const reader = new FileReader();
                            reader.onload = ev => {
                              const [header, base64] = ev.target.result.split(',');
                              const media_type = header.match(/data:(.*);base64/)[1];
                              setWelcomeImages(prev => [...prev, { preview: ev.target.result, base64, media_type, name: `paste-${Date.now()}.png` }]);
                            };
                            reader.readAsDataURL(file);
                          });
                        }}
                        onFocus={() => setWelcomeInputFocused(true)}
                        onBlur={() => setWelcomeInputFocused(false)}
                        onPressEnter={(e) => {
                          if (e.shiftKey) return;
                          if (inputValue.trim() || welcomeImages.length > 0) {
                            const imgs = welcomeImages.map(img => ({ data: img.base64, media_type: img.media_type }));
                            setWelcomeImages([]);
                            handleSend(inputValue, imgs);
                          }
                        }}
                        autoSize={{ minRows: 1, maxRows: 6 }}
                        style={{ border: 'none', background: 'transparent', resize: 'none', fontSize: 15, flex: 1, lineHeight: 1.5 }}
                        disabled={isLoading}
                      />
                      <button
                        className="send-btn"
                        onClick={() => {
                          if (inputValue.trim() || welcomeImages.length > 0) {
                            const imgs = welcomeImages.map(img => ({ data: img.base64, media_type: img.media_type }));
                            setWelcomeImages([]);
                            handleSend(inputValue, imgs);
                          }
                        }}
                        disabled={(!inputValue.trim() && welcomeImages.length === 0) || isLoading}
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: '50%',
                          border: 'none',
                          background: (!inputValue.trim() && welcomeImages.length === 0)
                            ? 'rgba(200,200,200,0.3)'
                            : 'linear-gradient(135deg, #7C3AED, #9B59FF)',
                          color: '#fff',
                          cursor: (!inputValue.trim() && welcomeImages.length === 0) ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          boxShadow: (!inputValue.trim() && welcomeImages.length === 0)
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
              </div>
            </div>
          ) : (
            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', position: 'relative' }}>
              <ChatWithInfoLayout
                messages={currentMessages}
                info={infoSources}
                collapsedInfoPanel={collapsedInfoPanel}
                onToggleInfoPanel={() => setCollapsedInfoPanel(!collapsedInfoPanel)}
                onSend={handleSend}
                isLoading={isLoading}
                streamingMessage={streamingMessage}
                streamingThinking={streamingThinking}
                activeConversationId={activeConversationId}
                currentConversationId={selectedConversationId}
                chatMode={chatMode}
                onModeChange={setChatMode}
                guestLimitReached={guestLimitReached}
                isGuest={isGuest}
                userId={userId}
              />
              {guestLimitReached && (
                <div style={{ position: 'absolute', bottom: 80, left: collapsedSider ? '79px' : '259px', right: 0, display: 'flex', justifyContent: 'center', zIndex: 10, padding: '0 24px' }}>
                  <GuestLimitBanner navigate={navigate} />
                </div>
              )}
            </div>
          )}
        </Content>
        <Footer />
      </Layout>
    </Layout>
  );
};

export default Chat;
