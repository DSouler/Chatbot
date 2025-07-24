import React, { useState, useEffect, useRef, useContext } from 'react';
import { Layout, Input, Typography, Button, message, Spin } from 'antd';
import { SendOutlined } from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import CustomSider from '../../components/Layouts/CustomSider';
import Footer from '../../components/Layouts/Footer';
import ChatWithInfoLayout from '../../layouts/ChatWithInfoLayout';
import { getMessages, getConversations, createConversation, sendMessageStream } from '../../services/chat';
import { createRequestData, getCurrentChatConfig } from '../../config/chatConfig';
import { useUser } from '../../hooks/useUser';
import { SiderContext } from '../../contexts/SiderContext';

const { Content } = Layout;
const { Title, Text } = Typography;

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
  const [isComposingNewMessage, setIsComposingNewMessage] = useState(false);
  const [isRestoringConversation, setIsRestoringConversation] = useState(false);

  const { user } = useUser();
  const userId = user?.user_id;

  const botMessageRef = useRef('');
  const thinkingRef = useRef('');
  const streamingConversationIdRef = useRef(null);
  const isCreatingConversationRef = useRef(false);
  const currentStreamRef = useRef(null); // Thêm ref để kiểm soát luồng streaming hợp lệ

  const currentMessages = conversationMessages[selectedConversationId] || [];

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
    if (userId) {
      fetchConversations();
    }
  }, [userId, urlConversationId]);

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
    }
  };

  const handleSelectConversation = (id) => {
    if (streamingConversationIdRef.current && streamingConversationIdRef.current !== id) {
      streamingConversationIdRef.current = null;
    }
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

  const handleSend = async (content) => {
    // Validate input and prevent multiple submissions
    if (!content.trim() || isLoading || isCreatingConversationRef.current) {
      return;
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
        const res = await createConversation(userId, content.slice(0, 20));
        conversationId = res.conversation_id || res.id;
    
        if (!conversationId) {
          throw new Error('Failed to create conversation');
        }
    
        // Đặt conversation mới vào trạng thái active
        setSelectedConversationId(conversationId);
        setActiveConversationId(conversationId);
        setShowWelcome(false);
        setIsRestoringConversation(false);
        fetchConversations().catch(console.error);
        
        // Cập nhật URL với conversation mới
        navigate(`/home/${conversationId}`);
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
      created_at: new Date().toISOString()
    };
  
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
    setPendingUserMessage({ ...userMessage, conversationId });
    setIsComposingNewMessage(false);
  };

  const handleDeleteConversation = async (conversationId) => {
    await fetchConversations();
    if (selectedConversationId === conversationId) {
      handleResetChat();
    }
  };

  useEffect(() => {
    if (selectedConversationId) {
      getMessages(selectedConversationId).then(res => {
        setConversationMessages(prev => ({
          ...prev,
          [selectedConversationId]: res.messages || []
        }));
        setShowWelcome(false);
      }).catch(err => {
        message.error('Unable to load messages');
      });
    }
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
      getCurrentChatConfig()
    );

    botMessageRef.current = '';
    thinkingRef.current = '';

    currentStreamRef.current = pendingUserMessage.conversationId; // Đánh dấu luồng streaming hợp lệ

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
        } else if (data.type === 'sources') {
          const mapped = (data.data || []).map((src, idx) => ({
            name: src.metadata?.file_name || `Source ${idx + 1}`,
            doc: src.content,
            id: src.metadata?._id || idx,
            similarity_score: src.embedding_score,
            ...src
          }));
          setInfoSources(mapped);
        }
      },
      () => {
        if (currentStreamRef.current !== pendingUserMessage.conversationId) return;
        if (botMessageRef.current.trim()) {
          const botMessage = {
            id: Date.now() + 1,
            role: 'assistant',
            content: botMessageRef.current,
            created_at: new Date().toISOString()
          };

          setConversationMessages(prev => {
            const prevMsgs = prev[pendingUserMessage.conversationId] || [];
            return {
              ...prev,
              [pendingUserMessage.conversationId]: [...prevMsgs, botMessage]
            };
          });
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
    <Layout style={{ minHeight: 'calc(100vh - 88px)', height: '100%' }}>
      <CustomSider 
        collapsed={collapsedSider} 
        onToggle={() => setCollapsedSider(!collapsedSider)} 
        onSelectConversation={handleSelectConversation}
        selectedConversationId={selectedConversationId}
        onResetChat={handleResetChat}
        conversationList={conversationList}
        onDeleteConversation={handleDeleteConversation}
      />
      <Layout style={{ position: 'relative', height: '100%', marginLeft: collapsedSider ? '79px' : '259px'}}>
        <Content className="relative bg-white" style={{ height: '100%' }}>
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
                <img src="/logo.png" alt="VTI" style={{ height: 64 }} />
                <Title level={2} style={{ marginBottom: 0 }}>Welcome to VTI!</Title>
                <Text style={{ color: '#6b7280', marginBottom: 0 }}>
                Chatbot hỗ trợ thông tin nội bộ – luôn sẵn sàng giải đáp thắc mắc của bạn!
                </Text>
                <div style={{ width: '200%', display: 'flex', justifyContent: 'center', position: 'sticky', bottom: 0, padding: '24px 0' }}>
                  <div style={{ width: '100%', padding: '12px', maxWidth: '950px', margin: '0px auto', background: '#fff', borderRadius: 24, boxShadow: '0 2px 12px rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', border: '1px solid #f0f0f0' }}>
                    <Input.TextArea
                      placeholder="Type your message..."
                      onChange={e => {
                        setInputValue(e.target.value);
                        setIsComposingNewMessage(true);
                      }}
                      onPressEnter={(e) => {
                        if (e.shiftKey) return; // Cho phép xuống dòng với Shift+Enter
                        if (inputValue.trim()) handleSend(inputValue);
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
                        if (inputValue.trim()) handleSend(inputValue);
                      }}
                      disabled={!inputValue.trim()}
                    />
                  </div>
                </div>
              </div>
            </div>
          ) : (
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
            />
          )}
        </Content>
        <Footer />
      </Layout>
    </Layout>
  );
};

export default Chat;
