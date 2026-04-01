import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Layout, Button, List, Typography, Dropdown, Menu, message, Modal, Progress, Input, Form } from 'antd';
import { FileOutlined, MoreOutlined, HistoryOutlined, MenuFoldOutlined, MenuUnfoldOutlined, EditOutlined, UploadOutlined, InboxOutlined, BarChartOutlined, SearchOutlined, DeleteOutlined, SettingOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import isToday from 'dayjs/plugin/isToday';
import isYesterday from 'dayjs/plugin/isYesterday';
import { getConversations, deleteConversation, uploadDocument, getUploadStats, renameConversation } from '../../services/chat';
import { useUser } from '../../hooks/useUser';
import ReportModal from '../ReportModal';
import { useNavigate } from 'react-router-dom';
import logoUrl from '../../assets/logo.svg';

const TFTLogo = ({ size = 32, onClick, style }) => (
  <img src={logoUrl} alt="TFT Logo" width={size} height={size} style={{ objectFit: 'contain', display: 'block', cursor: onClick ? 'pointer' : 'default', ...style }} onClick={onClick} />
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
  const { user, logout, fetchCurrentUser } = useUser();
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
  const scrollContainerRef = useRef(null);
  const didDrag = useRef(false);

  // Report state
  const [reportModalOpen, setReportModalOpen] = useState(false);

  // Search + rename state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchError, setSearchError] = useState('');
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [renames, setRenames] = useState({});

  // Profile settings state
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [profileForm] = Form.useForm();
  const [passwordForm] = Form.useForm();

  const displayName = user
    ? ((user.first_name || '') + ' ' + (user.last_name || '')).trim() || (user.email || '').split('@')[0]
    : '';

  const handleUpdateProfile = async (values) => {
    setProfileLoading(true);
    try {
      const { updateProfile } = await import('../../services/auth');
      await updateProfile(values.first_name || '', values.last_name || '');
      await fetchCurrentUser();
      message.success('Cập nhật tên hiển thị thành công');
    } catch (e) {
      message.error(e?.response?.data?.detail || 'Cập nhật thất bại');
    } finally {
      setProfileLoading(false);
    }
  };

  const handleUpdatePassword = async (values) => {
    if (values.new_password !== values.confirm_password) {
      message.error('Mật khẩu xác nhận không khớp');
      return;
    }
    setPasswordLoading(true);
    try {
      const { updatePassword } = await import('../../services/auth');
      await updatePassword(values.current_password, values.new_password);
      message.success('Đổi mật khẩu thành công');
      passwordForm.resetFields();
    } catch (e) {
      message.error(e?.response?.data?.detail || 'Đổi mật khẩu thất bại');
    } finally {
      setPasswordLoading(false);
    }
  };

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

  // Drag-to-scroll on sidebar chat list
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    let isDragging = false;
    let startY = 0;
    let startScrollTop = 0;
    const onMouseDown = (e) => {
      if (e.button !== 0) return;
      if (e.target === el) return; // scrollbar click
      if (e.target.closest('button, a, input, textarea, .ant-dropdown')) return;
      isDragging = true;
      didDrag.current = false;
      startY = e.clientY;
      startScrollTop = el.scrollTop;
    };
    const onMouseMove = (e) => {
      if (!isDragging) return;
      const dy = e.clientY - startY;
      if (Math.abs(dy) > 5) {
        didDrag.current = true;
        e.preventDefault();
        el.scrollTop = startScrollTop - dy;
      }
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
  }, []);

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

  // Assign sequential IDs: oldest = 1, newest = N
  const convIdMap = useMemo(() => {
    const sorted = [...conversationList].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    const map = {};
    sorted.forEach((c, i) => { map[c.id] = i + 1; });
    return map;
  }, [conversationList]);

  // Filter conversations by search query (name or sequential ID)
  const filteredConversations = searchQuery.trim()
    ? conversationList.filter(c => {
        const name = (renames[c.id] || c.name || '').toLowerCase();
        const q = searchQuery.trim().toLowerCase();
        const idMatch = /^\d+$/.test(q) && convIdMap[c.id] === Number(q);
        return name.includes(q) || idMatch;
      })
    : conversationList;

  const handleSearch = () => {
    const q = searchQuery.trim();
    if (!q) {
      setSearchError('Vui lòng nhập từ khóa tìm kiếm');
      return;
    }
    if (/^\d+$/.test(q)) {
      const idNum = Number(q);
      const found = conversationList.some(c => convIdMap[c.id] === idNum);
      if (!found) {
        setSearchError('ID không hợp lệ');
        return;
      }
    } else {
      const ql = q.toLowerCase();
      const found = conversationList.some(c =>
        (renames[c.id] || c.name || '').toLowerCase().includes(ql)
      );
      if (!found) {
        setSearchError('Tên lịch sử chat không hợp lệ');
        return;
      }
    }
    setSearchError('');
  };

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
        background: '#F0F2FF',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderRight: '1px solid rgba(56,189,248,0.18)',
        position: 'fixed',
        minHeight: '100vh',
        padding: 0,
        zIndex: 20,
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '4px 0 24px rgba(56,189,248,0.10)',
      }}
    >
      {/* Collapsed view */}
      {collapsed && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 24, gap: 12 }}>
          <Button
            className="sider-icon-btn"
            shape="circle"
            icon={<MenuUnfoldOutlined />}
            size="large"
            onClick={onToggle}
            style={{ background: 'rgba(124,58,237,0.08)', border: 'none', color: '#7C3AED' }}
            title="Open sidebar"
          />
          <Button
            className="sider-icon-btn"
            shape="circle"
            icon={<EditOutlined />}
            size="large"
            onClick={onResetChat}
            style={{ background: 'rgba(124,58,237,0.08)', border: 'none', color: '#7C3AED' }}
            title="New Chat"
          />
          <Button
            className="sider-icon-btn"
            shape="circle"
            icon={<UploadOutlined />}
            size="large"
            onClick={openUploadModal}
            style={{ background: 'rgba(124,58,237,0.08)', border: 'none', color: '#7C3AED' }}
            title="Upload Document"
          />
          <Button
            className="sider-icon-btn"
            shape="circle"
            icon={<BarChartOutlined />}
            size="large"
            onClick={() => setReportModalOpen(true)}
            style={{ background: 'rgba(124,58,237,0.08)', border: 'none', color: '#7C3AED' }}
            title="Report"
          />
        </div>
      )}

      {!collapsed && (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
          {/* Header */}
          <div style={{ padding: '20px 16px 12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <TFTLogo size={44} onClick={onResetChat} />
              <span style={{ fontSize: 18, fontWeight: 800, background: 'linear-gradient(135deg, #7C3AED, #6366F1)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', letterSpacing: 0.5 }}>TFTChat</span>
            </div>
            <Button
              className="sider-icon-btn"
              shape="circle"
              icon={<MenuFoldOutlined />}
              size="small"
              onClick={onToggle}
              style={{ background: 'rgba(124,58,237,0.08)', border: 'none', color: '#7C3AED' }}
              title="Close sidebar"
            />
          </div>

          {/* Action buttons */}
          <div style={{ padding: '4px 14px 8px 14px', display: 'flex', gap: 8, flexShrink: 0 }}>
            <button
              onClick={onResetChat}
              style={{
                flex: 1, padding: '9px 0', borderRadius: 10, border: 'none',
                background: 'linear-gradient(135deg, #7C3AED 0%, #9B59FF 100%)',
                color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                boxShadow: '0 2px 10px rgba(124,58,237,0.4)', transition: 'all 0.2s',
              }}
            >
              <EditOutlined /> New Chat
            </button>
            <button
              onClick={openUploadModal}
              style={{
                padding: '9px 12px', borderRadius: 10, border: '1px solid rgba(124,58,237,0.15)',
                background: 'rgba(124,58,237,0.06)', color: '#7C3AED', cursor: 'pointer',
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
                padding: '9px 12px', borderRadius: 10, border: '1px solid rgba(124,58,237,0.15)',
                background: 'rgba(124,58,237,0.06)', color: '#7C3AED', cursor: 'pointer',
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
                onMouseEnter={e => { if (!uploading) e.currentTarget.style.borderColor = '#7C3AED'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#d9d9d9'; }}
              >
                <InboxOutlined style={{ fontSize: 40, color: uploading ? '#bbb' : '#7C3AED', marginBottom: 8 }} />
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

          {/* Search bar - only for logged-in users */}
          {!isGuest && (
            <div style={{ padding: '0 14px 10px 14px', flexShrink: 0 }}>
              <div style={{ display: 'flex', gap: 6 }}>
                <Input
                  placeholder="Tìm kiếm đoạn chat..."
                  prefix={<SearchOutlined style={{ color: '#9B8FCC' }} />}
                  allowClear
                  value={searchQuery}
                  onChange={e => { setSearchQuery(e.target.value); setSearchError(''); }}
                  onPressEnter={handleSearch}
                  size="small"
                  style={{
                    flex: 1,
                    borderRadius: 10,
                    background: '#fff',
                    border: searchError ? '1px solid #ff4d4f' : '1px solid rgba(124,58,237,0.15)',
                    color: '#333',
                  }}
                  className="sider-search"
                />
                <Button
                  type="primary"
                  size="small"
                  icon={<SearchOutlined />}
                  onClick={handleSearch}
                  style={{
                    borderRadius: 10,
                    background: 'linear-gradient(135deg, #7C3AED 0%, #9B59FF 100%)',
                    border: 'none',
                    minWidth: 32,
                    flexShrink: 0,
                  }}
                />
              </div>
              {searchError && (
                <div style={{ color: '#ff4d4f', fontSize: 12, marginTop: 4, paddingLeft: 4 }}>
                  {searchError}
                </div>
              )}
            </div>
          )}

          {/* Chat grouped list - only for logged-in users */}
          <div
            className="sider-scrollbar"
            ref={scrollContainerRef}
            style={{ flex: 1, overflowY: 'auto', padding: '0 8px', minHeight: 0, cursor: 'grab' }}
          >
            {!isGuest && Object.keys(groupedConversations).length === 0 && searchQuery.trim() && (
              <div style={{ textAlign: 'center', color: '#9B8FCC', padding: '24px 0', fontSize: 13 }}>
                Không tìm thấy đoạn chat
              </div>
            )}
            {!isGuest && Object.keys(groupedConversations).map((dateLabel) => (
              <div key={dateLabel}>
                <div style={{ padding: '4px 8px 2px 8px', marginTop: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#8B7FB8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {dateLabel}
                  </span>
                </div>
                {groupedConversations[dateLabel].map(item => {
                  const isSelected = String(selectedConversationId) === String(item.id);
                  return (
                    <div
                      key={item.id}
                      onClick={() => { if (didDrag.current) return; if (renamingId !== item.id) onSelectConversation(item.id); }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '9px 10px',
                        margin: '2px 0',
                        borderRadius: 10,
                        cursor: 'pointer',
                        background: isSelected
                          ? 'linear-gradient(135deg, rgba(124,58,237,0.1) 0%, rgba(139,92,246,0.08) 100%)'
                          : 'transparent',
                        border: isSelected ? '1px solid rgba(124,58,237,0.2)' : '1px solid transparent',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={e => {
                        if (!isSelected) e.currentTarget.style.background = 'rgba(124,58,237,0.04)';
                      }}
                      onMouseLeave={e => {
                        if (!isSelected) e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      <HistoryOutlined style={{ marginRight: 8, color: isSelected ? '#7C3AED' : '#9B8FCC', fontSize: 13, flexShrink: 0 }} />
                      <span style={{
                        flexShrink: 0, minWidth: 20, height: 18, borderRadius: 5,
                        background: isSelected ? 'rgba(124,58,237,0.2)' : 'rgba(124,58,237,0.08)',
                        color: isSelected ? '#7C3AED' : '#8B7FB8',
                        fontSize: 10, fontWeight: 700, display: 'inline-flex',
                        alignItems: 'center', justifyContent: 'center',
                        padding: '0 4px', marginRight: 6, letterSpacing: '0.02em',
                      }}>
                        #{convIdMap[item.id]}
                      </span>
                      {renamingId === item.id ? (
                        <Input
                          size="small"
                          value={renameValue}
                          onChange={e => setRenameValue(e.target.value)}
                          onPressEnter={() => handleRenameSubmit(item.id)}
                          onBlur={() => handleRenameSubmit(item.id)}
                          autoFocus
                          style={{ flex: 1, background: '#fff', border: '1px solid rgba(124,58,237,0.15)', color: '#333', borderRadius: 6 }}
                          onClick={e => e.stopPropagation()}
                        />
                      ) : (
                        <span style={{
                          flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                          fontWeight: isSelected ? 600 : 400, fontSize: 13,
                          color: isSelected ? '#4C1D95' : '#444',
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
                            background: 'none', border: 'none', color: '#9B8FCC', cursor: 'pointer',
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
              padding: '14px 14px', borderTop: '1px solid rgba(124,58,237,0.1)',
              display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0,
            }}>
              <span style={{ color: '#8B7FB8', fontSize: 13 }}>Đang dùng thử</span>
              <button
                onClick={() => { sessionStorage.removeItem('guestMode'); navigate('/login'); }}
                style={{
                  fontSize: 12, color: '#fff', padding: '9px 12px', borderRadius: 10, border: 'none',
                  background: 'linear-gradient(135deg, #7C3AED 0%, #9B59FF 100%)',
                  cursor: 'pointer', fontWeight: 600, boxShadow: '0 2px 8px rgba(124,58,237,0.25)',
                }}
              >
                Đăng nhập / Tạo tài khoản
              </button>
              <button
                onClick={handleGuestExit}
                style={{
                  fontSize: 12, color: '#7C3AED', padding: '7px 12px', borderRadius: 10,
                  border: '1px solid rgba(124,58,237,0.2)', background: 'transparent', cursor: 'pointer',
                }}
              >
                Trang chủ
              </button>
            </div>
          ) : user && (
            <div style={{
              padding: '14px 14px', borderTop: '1px solid rgba(124,58,237,0.1)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'linear-gradient(135deg, #7C3AED, #9B59FF)', color: '#fff', fontWeight: 700, fontSize: 14, flexShrink: 0,
                }}>
                  {(displayName || '?')[0].toUpperCase()}
                </div>
                <span style={{ color: '#333', fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {displayName}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <button
                  onClick={() => {
                    profileForm.setFieldsValue({ first_name: user.first_name || '', last_name: user.last_name || '' });
                    setProfileModalOpen(true);
                  }}
                  title="Cài đặt tài khoản"
                  style={{
                    fontSize: 13, color: '#8B7FB8', padding: '5px 8px', borderRadius: 8,
                    border: '1px solid rgba(124,58,237,0.15)', background: 'transparent',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'all 0.2s',
                  }}
                  onMouseOver={e => { e.currentTarget.style.color = '#7C3AED'; e.currentTarget.style.borderColor = 'rgba(124,58,237,0.3)'; }}
                  onMouseOut={e => { e.currentTarget.style.color = '#8B7FB8'; e.currentTarget.style.borderColor = 'rgba(124,58,237,0.15)'; }}
                >
                  <SettingOutlined />
                </button>
                <button
                  onClick={() => {
                    sessionStorage.setItem('guestMode', 'true');
                    logout();
                    navigate('/home');
                  }}
                  style={{
                    fontSize: 11, color: '#8B7FB8', padding: '6px 12px', borderRadius: 8,
                    border: '1px solid rgba(124,58,237,0.15)', background: 'transparent',
                    cursor: 'pointer', fontWeight: 500, transition: 'all 0.2s',
                  }}
                  onMouseOver={e => { e.currentTarget.style.color = '#ff6b6b'; e.currentTarget.style.borderColor = 'rgba(255,107,107,0.3)'; }}
                  onMouseOut={e => { e.currentTarget.style.color = '#8B7FB8'; e.currentTarget.style.borderColor = 'rgba(124,58,237,0.15)'; }}
                >
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <ReportModal open={reportModalOpen} onClose={() => setReportModalOpen(false)} userId={userId} />

      {/* Profile settings modal */}
      <Modal
        open={profileModalOpen}
        onCancel={() => setProfileModalOpen(false)}
        footer={null}
        title={<span style={{ color: '#1e3a5f', fontWeight: 700 }}>Cài đặt tài khoản</span>}
        width={400}
      >
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 13, color: '#666', marginBottom: 4 }}>Tên đăng nhập</div>
          <div style={{
            padding: '8px 12px', background: '#f5f5f5', borderRadius: 8,
            color: '#999', fontSize: 14, border: '1px solid #e0e0e0',
          }}>
            {user?.username} <span style={{ fontSize: 11, color: '#bbb' }}>(không thể thay đổi)</span>
          </div>
        </div>

        <div style={{ borderBottom: '1px solid #f0f0f0', marginBottom: 20, paddingBottom: 20 }}>
          <div style={{ fontWeight: 600, color: '#1e3a5f', marginBottom: 12, fontSize: 14 }}>Tên hiển thị</div>
          <Form form={profileForm} onFinish={handleUpdateProfile} layout="vertical">
            <div style={{ display: 'flex', gap: 10 }}>
              <Form.Item name="first_name" label="Họ" style={{ flex: 1, marginBottom: 12 }}>
                <Input placeholder="Họ" />
              </Form.Item>
              <Form.Item name="last_name" label="Tên" style={{ flex: 1, marginBottom: 12 }}>
                <Input placeholder="Tên" />
              </Form.Item>
            </div>
            <Form.Item style={{ marginBottom: 0 }}>
              <button
                type="submit"
                disabled={profileLoading}
                style={{
                  width: '100%', padding: '8px 0', borderRadius: 8, border: 'none',
                  background: profileLoading ? '#ccc' : 'linear-gradient(135deg, #7C3AED, #9B59FF)',
                  color: '#fff', fontWeight: 600, cursor: profileLoading ? 'not-allowed' : 'pointer', fontSize: 14,
                }}
              >
                {profileLoading ? 'Đang lưu...' : 'Lưu tên hiển thị'}
              </button>
            </Form.Item>
          </Form>
        </div>

        <div>
          <div style={{ fontWeight: 600, color: '#1e3a5f', marginBottom: 12, fontSize: 14 }}>Đổi mật khẩu</div>
          <Form form={passwordForm} onFinish={handleUpdatePassword} layout="vertical">
            <Form.Item name="current_password" label="Mật khẩu hiện tại" rules={[{ required: true, message: 'Nhập mật khẩu hiện tại' }]} style={{ marginBottom: 10 }}>
              <Input.Password placeholder="Mật khẩu hiện tại" />
            </Form.Item>
            <Form.Item name="new_password" label="Mật khẩu mới" rules={[{ required: true, message: 'Nhập mật khẩu mới' }, { min: 6, message: 'Ít nhất 6 ký tự' }]} style={{ marginBottom: 10 }}>
              <Input.Password placeholder="Mật khẩu mới (tối thiểu 6 ký tự)" />
            </Form.Item>
            <Form.Item name="confirm_password" label="Xác nhận mật khẩu mới" rules={[{ required: true, message: 'Xác nhận mật khẩu mới' }]} style={{ marginBottom: 12 }}>
              <Input.Password placeholder="Nhập lại mật khẩu mới" />
            </Form.Item>
            <Form.Item style={{ marginBottom: 0 }}>
              <button
                type="submit"
                disabled={passwordLoading}
                style={{
                  width: '100%', padding: '8px 0', borderRadius: 8, border: 'none',
                  background: passwordLoading ? '#ccc' : 'linear-gradient(135deg, #2563EB, #3B82F6)',
                  color: '#fff', fontWeight: 600, cursor: passwordLoading ? 'not-allowed' : 'pointer', fontSize: 14,
                }}
              >
                {passwordLoading ? 'Đang đổi...' : 'Đổi mật khẩu'}
              </button>
            </Form.Item>
          </Form>
        </div>
      </Modal>

      <style>{`
        .sider-scrollbar::-webkit-scrollbar { width: 4px; }
        .sider-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .sider-scrollbar::-webkit-scrollbar-thumb { background: rgba(124,58,237,0.15); border-radius: 4px; }
        .sider-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(124,58,237,0.3); }
        .sider-search .ant-input { background: transparent !important; color: #333 !important; }
        .sider-search .ant-input::placeholder { color: #9B8FCC !important; }
        .sider-search .ant-input-clear-icon { color: #9B8FCC !important; }
        .sider-icon-btn { transition: all 0.25s ease !important; }
        .sider-icon-btn:hover { background: rgba(124,58,237,0.1) !important; color: #7C3AED !important; transform: scale(1.1); box-shadow: 0 0 12px rgba(124,58,237,0.15) !important; }
      `}</style>
    </Sider>
  );
};

export default CustomSider;
