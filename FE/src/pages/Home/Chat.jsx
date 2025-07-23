import React, { useState, useEffect, useRef } from 'react';
import { Layout, Input, Typography, Button, message, Spin } from 'antd';
import { SendOutlined } from '@ant-design/icons';
import CustomSider from '../../components/Layouts/CustomSider';
import Footer from '../../components/Layouts/Footer';
import ChatWithInfoLayout from '../../layouts/ChatWithInfoLayout';
import { getMessages, getConversations, createConversation, sendMessageStream } from '../../services/chat';
import { createRequestData, getCurrentChatConfig } from '../../config/chatConfig';
import { useUser } from '../../hooks/useUser';

const { Content } = Layout;
const { Title, Text } = Typography;

const Chat = () => {
  const [collapsedSider, setCollapsedSider] = useState(false);
  const [collapsedInfoPanel, setCollapsedInfoPanel] = useState(true);
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

  const { user } = useUser();
  const userId = user?.user_id;

  const botMessageRef = useRef('');
  const thinkingRef = useRef('');
  const streamingConversationIdRef = useRef(null);
  const isCreatingConversationRef = useRef(false);
  const currentStreamRef = useRef(null); // Thêm ref để kiểm soát luồng streaming hợp lệ

  const currentMessages = conversationMessages[selectedConversationId] || [];

  useEffect(() => {
    if (userId) fetchConversations();
    // eslint-disable-next-line
  }, [userId]);

  const fetchConversations = async () => {
    try {
      const res = await getConversations(userId);
      setConversationList(res.conversations || []);
    } catch (err) {
      setConversationList([]);
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
        setShowWelcome(false);
        fetchConversations().catch(console.error);
      } catch (err) {
        console.error('Error creating conversation:', err);
        message.error('Failed to create new conversation');
        setIsLoading(false);
        return;
      } finally {
        isCreatingConversationRef.current = false;
      }
    }
    
    // Set active conversation and streaming reference
    setActiveConversationId(conversationId);
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
        <Content className="relative bg-gray-50" style={{ height: '100%' }}>
          {showWelcome || isComposingNewMessage ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}>
              <div style={{ width: '100%', maxWidth: 420, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}>
                <img src="/logo.png" alt="VTI" style={{ height: 64 }} />
                <Title level={2} style={{ marginBottom: 0 }}>Welcome to VTI!</Title>
                <Text style={{ color: '#6b7280', marginBottom: 0 }}>
                  We're here to help. Type your message below to get instant support.
                </Text>
                <div style={{ width: '200%', display: 'flex', justifyContent: 'center', position: 'sticky', bottom: 0, padding: '24px 0' }}>
                  <div style={{ width: '100%', padding: '12px', maxWidth: '950px', margin: '0px auto', background: '#fff', borderRadius: 24, boxShadow: '0 2px 12px rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', border: '1px solid #f0f0f0' }}>
                    <Input.TextArea
                      placeholder="Type your message..."
                      onChange={e => {
                        setInputValue(e.target.value);
                        // setSelectedConversationId(id);
                        setIsComposingNewMessage(true);
                      }}
                      onPressEnter={() => {
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
                      onClick={() => handleSend(inputValue)}
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
