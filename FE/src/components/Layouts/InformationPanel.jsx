import React, { useState, useEffect, useRef } from 'react';
import { Layout, Button, Divider, Modal } from 'antd';
import { MenuFoldOutlined, MenuUnfoldOutlined, FileTextOutlined, CloseOutlined } from '@ant-design/icons';

const { Sider } = Layout;

const InformationPanel = ({ info = [], collapsed, onToggle }) => {
  const [width, setWidth] = useState(300);
  const [isResizing, setIsResizing] = useState(false);
  const [selectedSource, setSelectedSource] = useState(null);
  const infoPanelScrollRef = useRef(null);

  const handleMouseDown = (e) => {
    e.preventDefault();
    setIsResizing(true);
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizing) return;
      const newWidth = window.innerWidth - e.clientX;
      if (newWidth > 250 && newWidth < 600) {
        setWidth(newWidth);
      }
    };
    const handleMouseUp = () => {
      setIsResizing(false);
    };
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  // Drag-to-scroll
  useEffect(() => {
    const el = infoPanelScrollRef.current;
    if (!el) return;
    let isDragging = false;
    let startY = 0;
    let startScrollTop = 0;
    const onMouseDown = (e) => {
      if (e.button !== 0) return;
      if (e.target === el) return;
      if (e.target.closest('button, a, input, textarea')) return;
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

  const getScoreColor = (score) => {
    if (!score) return { bg: 'rgba(124,58,237,0.08)', color: '#7C3AED' };
    const s = parseFloat(score);
    if (s >= 0.8) return { bg: 'rgba(22,163,74,0.1)', color: '#16A34A' };
    if (s >= 0.6) return { bg: 'rgba(234,179,8,0.12)', color: '#B45309' };
    return { bg: 'rgba(239,68,68,0.1)', color: '#DC2626' };
  };

  return (
    <>
      <Sider
        width={width}
        collapsed={collapsed}
        collapsible
        trigger={null}
        style={{
          width: width,
          position: 'fixed',
          right: 0,
          minHeight: '100vh',
          height: '100vh',
          zIndex: 20,
          padding: 0,
          display: 'flex',
          flexDirection: 'column',
          userSelect: 'none',
          pointerEvents: collapsed ? 'none' : 'auto',
        }}
        className="bg-slate-50 border-l border-premium-100 shadow-[-4px_0_20px_rgba(124,58,237,0.05)]"
      >
        {/* Resize handle */}
        <div
          style={{
            background: 'transparent',
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: 4,
            cursor: 'col-resize',
            zIndex: 120,
          }}
          onMouseDown={handleMouseDown}
        />
        <Button
          shape="circle"
          icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          size="small"
          onClick={onToggle}
          style={{
            position: 'absolute',
            left: -14,
            top: '10%',
            transform: 'translateY(-50%)',
            zIndex: 100,
            background: '#fff',
            border: '1px solid rgba(124,58,237,0.15)',
            color: '#7C3AED',
            pointerEvents: 'auto',
          }}
        />
        {!collapsed && (
          <div style={{ flex: 1, height: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Header */}
            <div className="pt-4 px-4 pb-0 flex-shrink-0">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg premium-gradient-bg flex items-center justify-center flex-shrink-0 shadow-sm">
                  <FileTextOutlined className="text-white text-sm" />
                </div>
                <div>
                  <div className="font-bold text-premium-900 text-sm leading-tight">Knowledge Panel</div>
                  <div className="text-[11px] text-premium-500">
                    {info.length > 0 ? `${info.length} tài liệu tham khảo` : 'Chưa có tài liệu'}
                  </div>
                </div>
              </div>
              <div className="text-[11px] text-premium-400 mb-2 italic">
                💡 Bấm vào tài liệu để xem nội dung đầy đủ
              </div>
              <Divider className="my-2 border-premium-100" />
            </div>

            {/* Source list */}
            <div
              ref={infoPanelScrollRef}
              style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '8px 12px 16px 12px', cursor: 'grab' }}
            >
              {info.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#9B8FCC', padding: '48px 16px', fontSize: 13 }}>
                  <FileTextOutlined style={{ fontSize: 32, marginBottom: 8, display: 'block', color: '#C4B5FD' }} />
                  Chưa có tài liệu tham khảo
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {info.map((item, idx) => {
                    const scoreStyle = getScoreColor(item.similarity_score);
                    const scoreNum = item.similarity_score ? parseFloat(item.similarity_score) : null;
                    return (
                      <div
                        key={item.name + (item.id || idx)}
                        onClick={() => setSelectedSource({ ...item, idx: idx + 1 })}
                        className="bg-white rounded-xl p-3 border border-premium-100 shadow-sm cursor-pointer select-none transition-all duration-200 hover:border-premium-300 hover:shadow-md hover:-translate-y-[1px]"
                      >
                        {/* Header row */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                          <span style={{
                            width: 26, height: 26, borderRadius: 7,
                            background: 'linear-gradient(135deg, #7C3AED, #9B59FF)',
                            color: '#fff', fontSize: 11, fontWeight: 700,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                          }}>
                            {idx + 1}
                          </span>
                          <span style={{
                            fontWeight: 600, fontSize: 12, color: '#4C1D95',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
                          }}>
                            {item.name}
                          </span>
                          <span style={{ fontSize: 11, color: '#9B8FCC', flexShrink: 0 }}>🔍</span>
                        </div>

                        {/* Snippet preview — 3 lines clamp */}
                        <div style={{
                          fontSize: 11.5, color: '#555', lineHeight: 1.55,
                          display: '-webkit-box', WebkitLineClamp: 3,
                          WebkitBoxOrient: 'vertical', overflow: 'hidden',
                          marginBottom: scoreNum !== null ? 8 : 0,
                        }}>
                          {typeof item.doc === 'string' ? item.doc : ''}
                        </div>

                        {/* Score badge */}
                        {scoreNum !== null && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{
                              display: 'inline-flex', alignItems: 'center', gap: 4,
                              padding: '2px 8px', borderRadius: 10,
                              background: scoreStyle.bg, color: scoreStyle.color,
                              fontSize: 11, fontWeight: 600,
                            }}>
                              <span>●</span>
                              <span>Score: {typeof scoreNum === 'number' ? scoreNum.toFixed(3) : scoreNum}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </Sider>

      {/* Document full-view modal */}
      <Modal
        open={!!selectedSource}
        onCancel={() => setSelectedSource(null)}
        footer={null}
        width={680}
        centered
        styles={{
          content: { borderRadius: 16, padding: 0, overflow: 'hidden' },
          mask: { backdropFilter: 'blur(4px)', background: 'rgba(76,29,149,0.18)' },
        }}
        closeIcon={
          <div style={{
            width: 28, height: 28, borderRadius: '50%',
            background: 'rgba(124,58,237,0.08)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', color: '#7C3AED',
          }}>
            <CloseOutlined style={{ fontSize: 12 }} />
          </div>
        }
      >
        {selectedSource && (
          <div>
            {/* Modal header */}
            <div style={{
              background: 'linear-gradient(135deg, #7C3AED 0%, #9B59FF 100%)',
              padding: '20px 24px',
              display: 'flex', alignItems: 'flex-start', gap: 12,
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10,
                background: 'rgba(255,255,255,0.2)', display: 'flex',
                alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <FileTextOutlined style={{ color: '#fff', fontSize: 18 }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', marginBottom: 2 }}>
                  Tài liệu tham khảo #{selectedSource.idx}
                </div>
                <div style={{
                  fontWeight: 700, color: '#fff', fontSize: 15,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {selectedSource.name}
                </div>
                {selectedSource.similarity_score && (
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    marginTop: 6, padding: '2px 10px', borderRadius: 10,
                    background: 'rgba(255,255,255,0.2)', color: '#fff',
                    fontSize: 11, fontWeight: 600,
                  }}>
                    Similarity Score: {parseFloat(selectedSource.similarity_score).toFixed(4)}
                  </div>
                )}
              </div>
            </div>

            {/* Modal body */}
            <div style={{ padding: '20px 24px' }}>
              <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{
                  width: 3, height: 16, borderRadius: 2,
                  background: 'linear-gradient(135deg, #7C3AED, #9B59FF)',
                }} />
                <span style={{ fontWeight: 600, color: '#4C1D95', fontSize: 13 }}>Nội dung tài liệu</span>
              </div>
              <div style={{
                background: 'linear-gradient(135deg, #F5F3FF 0%, #EEF2FF 100%)',
                border: '1px solid rgba(124,58,237,0.12)',
                borderRadius: 12,
                padding: '16px 18px',
                maxHeight: 420,
                overflowY: 'auto',
                fontSize: 13,
                lineHeight: 1.7,
                color: '#333',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}>
                {typeof selectedSource.doc === 'string'
                  ? selectedSource.doc
                  : JSON.stringify(selectedSource.doc, null, 2)}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
};

export default InformationPanel;
