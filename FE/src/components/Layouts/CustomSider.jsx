import React, { useState, useEffect } from 'react';
import { Layout, Button, List, Typography, Dropdown, Menu, message } from 'antd';
import { FileOutlined, MoreOutlined, HistoryOutlined, MenuFoldOutlined, MenuUnfoldOutlined, EditOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import isToday from 'dayjs/plugin/isToday';
import isYesterday from 'dayjs/plugin/isYesterday';
import { getConversations, deleteConversation } from '../../services/chat';

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
        background: '#fff',
        borderRight: '1px solid #f0f0f0',
        position: 'fixed',
        minHeight: 'calc(100vh - 64px)',
        padding: 0,
        zIndex: 20,
      }}
    >
      <Button
        shape="circle"
        icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
        size="small"
        onClick={onToggle}
        style={{
          position: 'absolute',
          right: -16,
          top: '7%',
          transform: 'translateY(-50%)',
          zIndex: 100,
          boxShadow: '0 0 4px rgba(0,0,0,0.2)',
          background: '#fff',
          border: '1px solid #eee',
        }}
      />
      {/* Show Edit when collapsed */}
      {collapsed && (
        <EditOutlined
          style={{
            position: 'absolute',
            left: '50%',
            top: 32,
            transform: 'translateX(-50%)',
            fontSize: 18,
            color: '#131313',
            cursor: 'pointer',
            zIndex: 101,
            background: '#fff',
            borderRadius: '50%',
            boxShadow: '0 0 4px rgba(0,0,0,0.08)',
          }}
          onClick={onResetChat}
        />
      )}
      {!collapsed && (
        <>
          {/* Header */}
          <div
            style={{
              padding: '20px 16px 8px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <HistoryOutlined style={{ fontSize: 16, color: '#bfbfbf' }} />
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
            <EditOutlined
              style={{
                fontSize: 18,
                color: '#131313',
                marginLeft: 4,
                cursor: 'pointer',
              }}
              onClick={onResetChat}
            />
          </div>

          {/* Chat grouped list */}
          <div
            className="custom-scrollbar"
            style={{
              height: 'calc(100vh - 80px)',
              overflowY: 'auto',
              padding: '0 8px',
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
        </>
      )}
    </Sider>
  );
};

export default CustomSider;