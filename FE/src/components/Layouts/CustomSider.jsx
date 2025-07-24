import React, { useState, useEffect } from 'react';
import { Layout, Button, List, Typography, Dropdown, Menu, message } from 'antd';
import { FileOutlined, MoreOutlined, HistoryOutlined, MenuFoldOutlined, MenuUnfoldOutlined, EditOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import isToday from 'dayjs/plugin/isToday';
import isYesterday from 'dayjs/plugin/isYesterday';
import { getConversations, deleteConversation } from '../../services/chat';
import { useUser } from '../../hooks/useUser';
import logo from '../../../public/logo.png';

dayjs.extend(isToday);
dayjs.extend(isYesterday);

const { Sider } = Layout;
const { Text } = Typography;

const userId = 1; // mock user id

const CustomSider = ({
  collapsed,
  onToggle,
  onSelectConversation,
  selectedConversationId,
  onResetChat,
  conversationList = [],
  onDeleteConversation,
}) => {
  const [chatHistory, setChatHistory] = useState([]);
  const { user, logout } = useUser();

  useEffect(() => {
    getConversations(userId).then((res) => {
      setChatHistory(res.conversations || []);
    });
  }, []);

  const handleDelete = (conversationId) => {
    deleteConversation(userId, conversationId).then(() => {
      if (onDeleteConversation) onDeleteConversation(conversationId);
    });
  };

  // Group conversations by date
  const groupedConversations = conversationList.reduce((acc, conv) => {
    const createdAt = dayjs(conv.created_at);
    let groupLabel = createdAt.format('YYYY-MM-DD');

    if (createdAt.isToday()) {
      groupLabel = 'Today';
    } else if (createdAt.isYesterday()) {
      groupLabel = 'Yesterday';
    } else {
      groupLabel = createdAt.format('DD/MM/YYYY');
    }

    if (!acc[groupLabel]) {
      acc[groupLabel] = [];
    }
    acc[groupLabel].push(conv);
    return acc;
  }, {});

  return (
    <Sider
      width={260}
      collapsed={collapsed}
      collapsible
      trigger={null}
      style={{
        background: '#fafafa',
        borderRight: '1px solid #f0f0f0',
        position: 'fixed',
        minHeight: '100vh',
        padding: 0,
        zIndex: 20,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Show icons when collapsed */}
      {collapsed && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 24, gap: 16 }}>
          <Button
            shape="circle"
            icon={<MenuUnfoldOutlined />}
            size="large"
            onClick={onToggle}
            style={{ marginBottom: 8 }}
            title="Open sidebar"
          />
          <Button
            shape="circle"
            icon={<EditOutlined />}
            size="large"
            onClick={onResetChat}
            title="New Chat"
          />
        </div>
      )}
      
      {!collapsed && (
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          height: '100vh' 
        }}>
          {/* Header: Logo + History + Collapse button */}
          <div
            style={{
              padding: '20px 16px 8px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexShrink: 0,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <img 
                src={logo} 
                alt="logo" 
                style={{ 
                  width: 20, 
                  height: 30, 
                  objectFit: 'contain', 
                  opacity: 1,
                  cursor: 'pointer',
                  transition: 'opacity 0.2s'
                }}
                onClick={onResetChat}
                onMouseOver={(e) => {
                  e.target.style.opacity = 0.7;
                }}
                onMouseOut={(e) => {
                  e.target.style.opacity = 1;
                }}
                title="New Chat"
              />
              <Text
                type="secondary"
                style={{
                  fontSize: 14,
                  color: '#131313',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: 1,
                }}
              >
                History
              </Text>
            </div>
            <Button
              shape="circle"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              size="small"
              onClick={onToggle}
              style={{
                marginLeft: 8,
                boxShadow: '0 0 4px rgba(0,0,0,0.2)',
                background: '#fafafa',
                border: '1px solid #eee',
              }}
              title={collapsed ? 'Open sidebar' : 'Close sidebar'}
            />
          </div>

          {/* New Chat button*/}
          <div style={{ 
            padding: '8px 16px 8px 16px',
            flexShrink: 0,
          }}>
            <Button
              type="primary"
              icon={<EditOutlined />}
              block
              style={{ fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              onClick={onResetChat}
              title="New Chat"
            >
              New Chat
            </Button>
          </div>

          {/* Chat grouped list */}
          <div
            className="custom-scrollbar"
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '0 8px',
              minHeight: 0,
            }}
          >
            {Object.keys(groupedConversations).map((dateLabel) => (
              <div key={dateLabel}>
                <div
                  style={{
                    padding: '0 8px',
                    textAlign: 'left',
                    marginTop: 8,
                  }}
                >
                  <Text
                    type="secondary"
                    style={{ fontSize: 12, fontWeight: 700 }}
                  >
                    {dateLabel}
                  </Text>
                </div>
                <List
                  dataSource={groupedConversations[dateLabel]}
                  renderItem={(item) => (
                    <List.Item
                      className={`cursor-pointer hover:bg-gray-100 rounded px-2 py-1 ${
                        selectedConversationId === item.id
                          ? 'bg-blue-100'
                          : ''
                      }`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '8px 8px',
                      }}
                      onClick={() => onSelectConversation(item.id)}
                    >
                      <HistoryOutlined
                        className="mr-2 text-gray-400"
                        style={{ marginRight: 8 }}
                      />
                      <span
                        className="truncate"
                        style={{
                          flex: 1,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          fontWeight: 600,
                        }}
                      >
                        {item.name}
                      </span>
                      <Button
                        type="text"
                        icon={<MoreOutlined />}
                        style={{ marginLeft: 8 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(item.id);
                        }}
                      />
                    </List.Item>
                  )}
                />
              </div>
            ))}
          </div>
          
          {/* User section - luôn ở cuối */}
          {user && (
            <div 
              style={{
                padding: '14px 16px',
                borderTop: '1px solid #f0f0f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexShrink: 0,
                backgroundColor: '#fafafa',
              }}
            >
              <span style={{ 
                color: '#000', 
                fontWeight: 600, 
                fontSize: 15 
              }}>
                {user.email.split('@')[0]}
              </span>
              <button
                onClick={logout}
                style={{
                  fontSize: 12,
                  color: '#666',
                  padding: '8px 12px',
                  borderRadius: 6,
                  border: '1px solid #e5e5e5',
                  backgroundColor: '#fafafa',
                  cursor: 'pointer',
                  fontWeight: 500,
                  transition: 'all 0.2s',
                }}
                onMouseOver={(e) => {
                  e.target.style.color = '#dc2626';
                  e.target.style.backgroundColor = '#fef2f2';
                }}
                onMouseOut={(e) => {
                  e.target.style.color = '#666';
                  e.target.style.backgroundColor = '#fafafa';
                }}
              >
                Sign Out
              </button>
            </div>
          )}
        </div>
      )}
    </Sider>
  );
};

export default CustomSider;