import React, { useState, useEffect, useRef, useContext } from 'react';
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

const { Content } = Layout;
const { Title, Text } = Typography;

const GuestLimitBanner = ({ navigate }) => (
  <div style={{
    width: '100%',
    maxWidth: 600,
    background: 'linear-gradient(135deg, #f0edff 0%, #ede8ff 100%)',
    border: '1.5px solid #b9acf5',
    borderRadius: 16,
    padding: '18px 24px',
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    boxShadow: '0 4px 20px rgba(91,79,207,0.13)',
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
        background: '#5B4FCF',
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
  const isFetchingConversationsRef = useRef(false); // prevent duplicate fetchConversations calls
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
      fetchConversations();
    } else {
      // Clear conversation list when user logs out or in guest mode
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
    try {
      const res = await getConversations(userId);
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
      setConversationList([]);
      setIsRestoringConversation(false);
    } finally {
      isFetchingConversationsRef.current = false;
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
      setStreamingMessage(botMessageRef.current);

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
          setStreamingThinking(thinkingRef.current);
        } else if (data.type === 'token') {
          setStreamingType('token');
          botMessageRef.current += data.content;
          setStreamingMessage(botMessageRef.current);
        } else if (data.type === 'status') {
          setStreamingStatus(data.message);
        } else if (data.type === 'info') {
          setStreamingInfo(data.message);
        } else if (data.type === 'usage') {
          setStreamingUsage(data.data);
        } else if (data.type === 'error') {
          setStreamingError(data.message);
          botMessageRef.current = `⚠️ **Lỗi:** ${data.message}`;
          setStreamingMessage(botMessageRef.current);
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
    <Layout style={{ height: '100vh', background: 'linear-gradient(135deg, #b8cde6 0%, #c8b8dc 100%)' }}>
      <CustomSider 
        collapsed={collapsedSider} 
        onToggle={() => setCollapsedSider(!collapsedSider)} 
        onSelectConversation={handleSelectConversation}
        selectedConversationId={selectedConversationId}
        onResetChat={handleResetChat}
        conversationList={conversationList}
        onDeleteConversation={handleDeleteConversation}
      />
      <Layout style={{ position: 'relative', height: '100%', marginLeft: collapsedSider ? '79px' : '259px', background: 'transparent', overflow: 'hidden' }}>
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
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width={64} height={64}>
                  <polygon points="60,4 110,32 110,88 60,116 10,88 10,32" fill="#5B4FCF"/>
                  <polygon points="60,10 104,35 104,85 60,110 16,85 16,35" fill="none" stroke="white" strokeWidth="5"/>
                  <path d="M30,44 L38,60 L48,50 L55,36 L60,30 L65,36 L72,50 L82,60 L90,44 L90,76 L30,76 Z" fill="white"/>
                  <rect x="36" y="60" width="48" height="16" rx="4" fill="#5B4FCF"/>
                  <rect x="39" y="63" width="18" height="9" rx="2" fill="white"/>
                  <rect x="63" y="63" width="18" height="9" rx="2" fill="white"/>
                  <polygon points="60,75 55,81 60,84 65,81" fill="white"/>
                </svg>
                <Title level={2} style={{ marginBottom: 0, color: '#5B4FCF' }}>Welcome to TFTChat!</Title>
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
                          style={{
                            padding: '4px 14px',
                            borderRadius: 20,
                            border: '1px solid',
                            borderColor: chatMode === m.value ? '#5B4FCF' : '#d9d9d9',
                            background: chatMode === m.value ? '#5B4FCF' : '#fff',
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
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: '4px 8px' }}>
                          {welcomeImages.map((img, idx) => (
                            <div key={idx} style={{ position: 'relative' }}>
                              <img src={img.preview} alt={img.name} style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 8, display: 'block' }} />
                              <CloseCircleFilled
                                onClick={() => setWelcomeImages(prev => prev.filter((_, i) => i !== idx))}
                                style={{ position: 'absolute', top: -6, right: -6, color: '#ff4d4f', cursor: 'pointer', fontSize: 16, background: '#fff', borderRadius: '50%' }}
                              />
                            </div>
                          ))}
                        </div>
                      )}
                      <div style={{ padding: '12px', background: '#fff', borderRadius: 24, boxShadow: '0 2px 12px rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', border: '1px solid #f0f0f0' }}>
                      {!isGuest && (
                        <Button
                          icon={<PictureOutlined />}
                          type="text"
                          shape="circle"
                          onClick={() => welcomeFileInputRef.current?.click()}
                          disabled={isLoading}
                          style={{ marginRight: 4, color: '#8c8c8c', flexShrink: 0 }}
                          title="Đính kèm ảnh"
                        />
                      )}
                      <Input.TextArea
                        placeholder="Type your message..."
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
                        onPressEnter={(e) => {
                          if (e.shiftKey) return;
                          if (inputValue.trim() || welcomeImages.length > 0) {
                            const imgs = welcomeImages.map(img => ({ data: img.base64, media_type: img.media_type }));
                            setWelcomeImages([]);
                            handleSend(inputValue, imgs);
                          }
                        }}
                        autoSize={{ minRows: 1, maxRows: 6 }}
                        style={{ border: 'none', background: 'transparent', resize: 'none', fontSize: 16, flex: 1 }}
                        disabled={isLoading}
                      />
                      <Button
                        icon={isLoading ? <Spin size="small" /> : <SendOutlined />}
                        type="primary"
                        shape="circle"
                        onClick={() => {
                          if (inputValue.trim() || welcomeImages.length > 0) {
                            const imgs = welcomeImages.map(img => ({ data: img.base64, media_type: img.media_type }));
                            setWelcomeImages([]);
                            handleSend(inputValue, imgs);
                          }
                        }}
                        disabled={!inputValue.trim() && welcomeImages.length === 0}
                      />
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
