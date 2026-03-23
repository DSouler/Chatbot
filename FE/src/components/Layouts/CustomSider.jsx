import React, { useState, useEffect, useRef } from 'react';
import { Layout, Button, List, Typography, Dropdown, Menu, message, Modal, Progress, Input } from 'antd';
import { FileOutlined, MoreOutlined, HistoryOutlined, MenuFoldOutlined, MenuUnfoldOutlined, EditOutlined, UploadOutlined, InboxOutlined, BarChartOutlined, SearchOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import isToday from 'dayjs/plugin/isToday';
import isYesterday from 'dayjs/plugin/isYesterday';
import { getConversations, deleteConversation, uploadDocument, getUploadStats, renameConversation } from '../../services/chat';
import { useUser } from '../../hooks/useUser';
import ReportModal from '../ReportModal';
import { useNavigate } from 'react-router-dom';

// TFT Logo inline SVG component
const TFTLogo = ({ size = 32, onClick, style }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width={size} height={size} style={{ cursor: onClick ? 'pointer' : 'default', ...style }} onClick={onClick}>
    <polygon points="60,4 110,32 110,88 60,116 10,88 10,32" fill="#5B4FCF"/>
    <polygon points="60,10 104,35 104,85 60,110 16,85 16,35" fill="none" stroke="white" strokeWidth="5"/>
    <path d="M30,44 L38,60 L48,50 L55,36 L60,30 L65,36 L72,50 L82,60 L90,44 L90,76 L30,76 Z" fill="white"/>
    <rect x="36" y="60" width="48" height="16" rx="4" fill="#5B4FCF"/>
    <rect x="39" y="63" width="18" height="9" rx="2" fill="white"/>
    <rect x="63" y="63" width="18" height="9" rx="2" fill="white"/>
    <polygon points="60,75 55,81 60,84 65,81" fill="white"/>
  </svg>
);

dayjs.extend(isToday);
dayjs.extend(isYesterday);

const { Sider } = Layout;
const { Text } = Typography;

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
  const userId = user?.user_id;
  const navigate = useNavigate();
  const isGuest = sessionStorage.getItem('guestMode') === 'true';

  const handleGuestExit = () => {
    sessionStorage.removeItem('guestMode');
    navigate('/');
  };

  // Upload state
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [collectionStats, setCollectionStats] = useState(null);
  const fileInputRef = useRef(null);

  // Report state
  const [reportModalOpen, setReportModalOpen] = useState(false);

  // Search + rename state
  const [searchQuery, setSearchQuery] = useState('');
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [renames, setRenames] = useState({});

  const refreshStats = () => {
    getUploadStats().then(setCollectionStats).catch(() => {});
  };

  const openUploadModal = () => {
    refreshStats();
    setUploadModalOpen(true);
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    setUploading(true);
    setUploadProgress(null);
    try {
      const result = await uploadDocument(file);
      setUploadProgress({ filename: result.filename, chunks: result.chunks_uploaded });
      message.success(`"${result.filename}" uploaded — ${result.chunks_uploaded} chunks indexed`);
      refreshStats();
    } catch (err) {
      message.error(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => {
    if (!userId || isGuest) return;
    getConversations(userId).then((res) => {
      setChatHistory(res.conversations || []);
    });
  }, [userId]);

  const handleDelete = (conversationId) => {
    if (!userId) return;
    deleteConversation(userId, conversationId).then(() => {
      if (onDeleteConversation) onDeleteConversation(conversationId);
    });
  };

  const handleRenameSubmit = async (id) => {
    const newName = renameValue.trim();
    setRenamingId(null);
    if (!newName || !userId) return;
    try {
      await renameConversation(userId, id, newName);
      setRenames(prev => ({ ...prev, [id]: newName }));
    } catch {
      message.error('Đổi tên thất bại');
    }
  };

  // Filter conversations by search query
  const filteredConversations = searchQuery.trim()
    ? conversationList.filter(c =>
        (renames[c.id] || c.name || '').toLowerCase().includes(searchQuery.toLowerCase())
      )
    : conversationList;

  // Group conversations by date
  const groupedConversations = filteredConversations.reduce((acc, conv) => {
    const createdAt = dayjs(conv.created_at);
    let groupLabel = createdAt.format('YYYY-MM-DD');
    if (createdAt.isToday()) groupLabel = 'Hôm nay';
    else if (createdAt.isYesterday()) groupLabel = 'Hôm qua';
    else groupLabel = createdAt.format('DD/MM/YYYY');
    if (!acc[groupLabel]) acc[groupLabel] = [];
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
        background: 'linear-gradient(180deg, #1a1040 0%, #2d1f6e 50%, #1a1040 100%)',
        borderRight: 'none',
        position: 'fixed',
        minHeight: '100vh',
        padding: 0,
        zIndex: 20,
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '4px 0 24px rgba(26,16,64,0.3)',
      }}
    >
      {/* Collapsed view */}
      {collapsed && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 24, gap: 12 }}>
          <Button
            shape="circle"
            icon={<MenuUnfoldOutlined />}
            size="large"
            onClick={onToggle}
            style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#c4bcf0' }}
            title="Open sidebar"
          />
          <Button
            shape="circle"
            icon={<EditOutlined />}
            size="large"
            onClick={onResetChat}
            style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#c4bcf0' }}
            title="New Chat"
          />
          <Button
            shape="circle"
            icon={<UploadOutlined />}
            size="large"
            onClick={openUploadModal}
            style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#c4bcf0' }}
            title="Upload Document"
          />
          <Button
            shape="circle"
            icon={<BarChartOutlined />}
            size="large"
            onClick={() => setReportModalOpen(true)}
            style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#c4bcf0' }}
            title="Report"
          />
        </div>
      )}

      {!collapsed && (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
          {/* Header */}
          <div style={{ padding: '20px 16px 12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <TFTLogo size={34} onClick={onResetChat} />
              <span style={{ fontSize: 18, fontWeight: 800, color: '#fff', letterSpacing: 0.5 }}>TFTChat</span>
            </div>
            <Button
              shape="circle"
              icon={<MenuFoldOutlined />}
              size="small"
              onClick={onToggle}
              style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#a89be0' }}
              title="Close sidebar"
            />
          </div>

          {/* Action buttons */}
          <div style={{ padding: '4px 14px 8px 14px', display: 'flex', gap: 8, flexShrink: 0 }}>
            <button
              onClick={onResetChat}
              style={{
                flex: 1, padding: '9px 0', borderRadius: 10, border: 'none',
                background: 'linear-gradient(135deg, #5B4FCF 0%, #7c6fe0 100%)',
                color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                boxShadow: '0 2px 10px rgba(91,79,207,0.4)', transition: 'all 0.2s',
              }}
            >
              <EditOutlined /> New Chat
            </button>
            <button
              onClick={openUploadModal}
              style={{
                padding: '9px 12px', borderRadius: 10, border: '1px solid rgba(168,155,224,0.3)',
                background: 'rgba(255,255,255,0.08)', color: '#c4bcf0', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15,
                transition: 'all 0.2s',
              }}
              title="Upload Document"
            >
              <UploadOutlined />
            </button>
            <button
              onClick={() => setReportModalOpen(true)}
              style={{
                padding: '9px 12px', borderRadius: 10, border: '1px solid rgba(168,155,224,0.3)',
                background: 'rgba(255,255,255,0.08)', color: '#c4bcf0', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15,
                transition: 'all 0.2s',
              }}
              title="Report"
            >
              <BarChartOutlined />
            </button>
          </div>

          {/* Hidden file input */}
          <input ref={fileInputRef} type="file" accept=".pdf,.txt,.docx" style={{ display: 'none' }} onChange={handleFileSelect} />

          {/* Upload Modal */}
          <Modal
            title="Upload Document to Knowledge Base"
            open={uploadModalOpen}
            onCancel={() => { if (!uploading) setUploadModalOpen(false); }}
            footer={null}
            width={420}
          >
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              {collectionStats && (
                <div style={{ marginBottom: 16, padding: '8px 12px', background: '#f6f8fa', borderRadius: 6, textAlign: 'left', fontSize: 13 }}>
                  <strong>Collection:</strong> {collectionStats.collection}<br />
                  <strong>Indexed chunks:</strong> {collectionStats.points_count ?? 0}
                  {collectionStats.error && <span style={{ color: 'red' }}> — {collectionStats.error}</span>}
                </div>
              )}
              <div
                style={{ border: '2px dashed #d9d9d9', borderRadius: 8, padding: '32px 16px', cursor: uploading ? 'not-allowed' : 'pointer', background: uploading ? '#fafafa' : '#fff', transition: 'border-color 0.2s' }}
                onClick={() => !uploading && fileInputRef.current?.click()}
                onMouseEnter={e => { if (!uploading) e.currentTarget.style.borderColor = '#5B4FCF'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#d9d9d9'; }}
              >
                <InboxOutlined style={{ fontSize: 40, color: uploading ? '#bbb' : '#5B4FCF', marginBottom: 8 }} />
                <div style={{ fontWeight: 600, fontSize: 15 }}>{uploading ? 'Uploading…' : 'Click to select a file'}</div>
                <div style={{ color: '#888', fontSize: 13, marginTop: 4 }}>Supported: PDF, TXT, DOCX</div>
              </div>
              {uploading && (
                <div style={{ marginTop: 16 }}>
                  <Progress percent={100} status="active" showInfo={false} />
                  <div style={{ color: '#888', fontSize: 13, marginTop: 4 }}>Processing and indexing…</div>
                </div>
              )}
              {uploadProgress && !uploading && (
                <div style={{ marginTop: 16, padding: '10px 12px', background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 6, textAlign: 'left', fontSize: 13 }}>
                  <strong>{uploadProgress.filename}</strong> indexed as <strong>{uploadProgress.chunks}</strong> chunks
                </div>
              )}
            </div>
          </Modal>

          {/* Search bar */}
          <div style={{ padding: '0 14px 10px 14px', flexShrink: 0 }}>
            <Input
              placeholder="Tìm kiếm đoạn chat..."
              prefix={<SearchOutlined style={{ color: '#8b7fc0' }} />}
              allowClear
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              size="small"
              style={{
                borderRadius: 10,
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(168,155,224,0.2)',
                color: '#ddd',
              }}
              className="sider-search"
            />
          </div>

          {/* Chat grouped list */}
          <div
            className="sider-scrollbar"
            style={{ flex: 1, overflowY: 'auto', padding: '0 8px', minHeight: 0 }}
          >
            {Object.keys(groupedConversations).length === 0 && searchQuery.trim() && (
              <div style={{ textAlign: 'center', color: '#8b7fc0', padding: '24px 0', fontSize: 13 }}>
                Không tìm thấy đoạn chat
              </div>
            )}
            {Object.keys(groupedConversations).map((dateLabel) => (
              <div key={dateLabel}>
                <div style={{ padding: '4px 8px 2px 8px', marginTop: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#8b7fc0', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {dateLabel}
                  </span>
                </div>
                {groupedConversations[dateLabel].map(item => {
                  const isSelected = String(selectedConversationId) === String(item.id);
                  return (
                    <div
                      key={item.id}
                      onClick={() => { if (renamingId !== item.id) onSelectConversation(item.id); }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '9px 10px',
                        margin: '2px 0',
                        borderRadius: 10,
                        cursor: 'pointer',
                        background: isSelected
                          ? 'linear-gradient(135deg, rgba(91,79,207,0.35) 0%, rgba(124,111,224,0.25) 100%)'
                          : 'transparent',
                        border: isSelected ? '1px solid rgba(168,155,224,0.3)' : '1px solid transparent',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={e => {
                        if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                      }}
                      onMouseLeave={e => {
                        if (!isSelected) e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      <HistoryOutlined style={{ marginRight: 8, color: isSelected ? '#c4bcf0' : '#6b5fa0', fontSize: 13, flexShrink: 0 }} />
                      {renamingId === item.id ? (
                        <Input
                          size="small"
                          value={renameValue}
                          onChange={e => setRenameValue(e.target.value)}
                          onPressEnter={() => handleRenameSubmit(item.id)}
                          onBlur={() => handleRenameSubmit(item.id)}
                          autoFocus
                          style={{ flex: 1, background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', borderRadius: 6 }}
                          onClick={e => e.stopPropagation()}
                        />
                      ) : (
                        <span style={{
                          flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                          fontWeight: isSelected ? 600 : 400, fontSize: 13,
                          color: isSelected ? '#fff' : '#c4bcf0',
                        }}>
                          {renames[item.id] || item.name}
                        </span>
                      )}
                      <Dropdown
                        menu={{
                          items: [
                            { key: 'rename', icon: <EditOutlined />, label: 'Đổi tên' },
                            { key: 'delete', icon: <DeleteOutlined />, label: 'Xóa', danger: true },
                          ],
                          onClick: ({ key }) => {
                            if (key === 'rename') { setRenamingId(item.id); setRenameValue(renames[item.id] || item.name); }
                            else if (key === 'delete') handleDelete(item.id);
                          },
                        }}
                        trigger={['click']}
                        placement="bottomRight"
                      >
                        <button
                          style={{
                            background: 'none', border: 'none', color: '#8b7fc0', cursor: 'pointer',
                            padding: '2px 4px', borderRadius: 4, marginLeft: 4, flexShrink: 0,
                            display: 'flex', alignItems: 'center', fontSize: 14,
                            opacity: 0.6, transition: 'opacity 0.2s',
                          }}
                          onClick={e => e.stopPropagation()}
                          onMouseEnter={e => { e.currentTarget.style.opacity = '1'; }}
                          onMouseLeave={e => { e.currentTarget.style.opacity = '0.6'; }}
                        >
                          <MoreOutlined />
                        </button>
                      </Dropdown>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {/* User section */}
          {isGuest ? (
            <div style={{
              padding: '14px 14px', borderTop: '1px solid rgba(168,155,224,0.15)',
              display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0,
            }}>
              <span style={{ color: '#8b7fc0', fontSize: 13 }}>Đang dùng thử</span>
              <button
                onClick={() => { sessionStorage.removeItem('guestMode'); navigate('/login'); }}
                style={{
                  fontSize: 12, color: '#fff', padding: '9px 12px', borderRadius: 10, border: 'none',
                  background: 'linear-gradient(135deg, #5B4FCF 0%, #7c6fe0 100%)',
                  cursor: 'pointer', fontWeight: 600, boxShadow: '0 2px 8px rgba(91,79,207,0.3)',
                }}
              >
                Đăng nhập / Tạo tài khoản
              </button>
              <button
                onClick={handleGuestExit}
                style={{
                  fontSize: 12, color: '#c4bcf0', padding: '7px 12px', borderRadius: 10,
                  border: '1px solid rgba(168,155,224,0.2)', background: 'transparent', cursor: 'pointer',
                }}
              >
                Trang chủ
              </button>
            </div>
          ) : user && (
            <div style={{
              padding: '14px 14px', borderTop: '1px solid rgba(168,155,224,0.15)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'linear-gradient(135deg, #5B4FCF, #7c6fe0)', color: '#fff', fontWeight: 700, fontSize: 14,
                }}>
                  {(user.email || '?')[0].toUpperCase()}
                </div>
                <span style={{ color: '#e0dbf5', fontWeight: 600, fontSize: 13 }}>
                  {user.email.split('@')[0]}
                </span>
              </div>
              <button
                onClick={() => {
                  sessionStorage.setItem('guestMode', 'true');
                  logout();
                  navigate('/home');
                }}
                style={{
                  fontSize: 11, color: '#8b7fc0', padding: '6px 12px', borderRadius: 8,
                  border: '1px solid rgba(168,155,224,0.2)', background: 'transparent',
                  cursor: 'pointer', fontWeight: 500, transition: 'all 0.2s',
                }}
                onMouseOver={e => { e.target.style.color = '#ff6b6b'; e.target.style.borderColor = 'rgba(255,107,107,0.3)'; }}
                onMouseOut={e => { e.target.style.color = '#8b7fc0'; e.target.style.borderColor = 'rgba(168,155,224,0.2)'; }}
              >
                Sign Out
              </button>
            </div>
          )}
        </div>
      )}

      <ReportModal open={reportModalOpen} onClose={() => setReportModalOpen(false)} userId={userId} />

      <style>{`
        .sider-scrollbar::-webkit-scrollbar { width: 4px; }
        .sider-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .sider-scrollbar::-webkit-scrollbar-thumb { background: rgba(168,155,224,0.3); border-radius: 4px; }
        .sider-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(168,155,224,0.5); }
        .sider-search .ant-input { background: transparent !important; color: #ddd !important; }
        .sider-search .ant-input::placeholder { color: #8b7fc0 !important; }
        .sider-search .ant-input-clear-icon { color: #8b7fc0 !important; }
      `}</style>
    </Sider>
  );
};

export default CustomSider;
