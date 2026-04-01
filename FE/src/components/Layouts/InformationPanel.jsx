import React, { useState, useEffect, useRef } from 'react';
import { Layout, Table, Button, Divider, Tooltip } from 'antd';
import { MenuFoldOutlined, MenuUnfoldOutlined } from '@ant-design/icons';

const { Sider } = Layout;

const InformationPanel = ({ info = [], collapsed, onToggle }) => {
  const [width, setWidth] = useState(300);
  const [isResizing, setIsResizing] = useState(false);
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
      if (e.target === el) return; // scrollbar click
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

  const columns = [
    {
      title: 'File Name',
      dataIndex: 'name',
      key: 'name',
      width: 160,
      ellipsis: true,
      render: text => (
        <Tooltip title={text}>
          <span>{text}</span>
        </Tooltip>
      ),
    },
    {
      title: 'Document Snippet',
      dataIndex: 'doc',
      key: 'doc',
      render: text => <div style={{ wordBreak: 'break-word' }}>{text}</div>,
    },
    {
      title: 'Similarity',
      dataIndex: 'similarity_score',
      key: 'similarity_score',
      width: 80,
    },
  ];
  
  return (
    <Sider
      width={width}
      collapsed={collapsed}
      collapsible
      trigger={null}
      style={{
        background: '#F0F2FF',
        borderLeft: '1px solid rgba(56,189,248,0.18)',
        position: 'fixed',
        right: 0,
        minHeight: '100vh',
        height: '100vh',
        zIndex: 20,
        padding: 0,
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '-2px 0 12px rgba(124,58,237,0.06)',
        userSelect: 'none',
        pointerEvents: collapsed ? 'none' : 'auto',
      }}
    >
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
          <div style={{ padding: '16px 16px 0 16px', flexShrink: 0 }}>
            <h3 style={{ fontWeight: 700, marginBottom: 8, color: '#4C1D95', fontSize: 16 }}>Knowledge Panel: References</h3>
            <Divider style={{ margin: '8px 0', borderColor: 'rgba(124,58,237,0.1)' }} />
          </div>
          <div
            ref={infoPanelScrollRef}
            style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '8px 12px', cursor: 'grab' }}
          >
            {info.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#9B8FCC', padding: '32px 0', fontSize: 13 }}>
                No references yet
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {info.map((item, idx) => (
                  <div key={item.name + (item.id || idx)} style={{
                    background: '#fff',
                    borderRadius: 12,
                    padding: '14px 16px',
                    border: '1px solid rgba(124,58,237,0.1)',
                    boxShadow: '0 2px 8px rgba(124,58,237,0.04)',
                    transition: 'all 0.2s',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <span style={{
                        width: 28, height: 28, borderRadius: 8,
                        background: 'linear-gradient(135deg, #7C3AED, #9B59FF)',
                        color: '#fff', fontSize: 12, fontWeight: 700,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}>📄</span>
                      <span style={{ fontWeight: 600, fontSize: 13, color: '#4C1D95', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.name}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: '#666', lineHeight: 1.5, marginBottom: 8, maxHeight: 60, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {typeof item.doc === 'string' ? item.doc.slice(0, 150) + (item.doc.length > 150 ? '...' : '') : ''}
                    </div>
                    {item.similarity_score && (
                      <div style={{
                        display: 'inline-block', padding: '2px 10px', borderRadius: 12,
                        background: 'rgba(124,58,237,0.08)', color: '#7C3AED',
                        fontSize: 11, fontWeight: 600,
                      }}>
                        Score: {item.similarity_score}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </Sider>
  );
};

export default InformationPanel;
