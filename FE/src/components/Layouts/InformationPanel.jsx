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
        background: 'transparent',
        borderRight: '1px solid #f0f0f0',
        position: 'fixed',
        right: 0,
        minHeight: '100vh',
        height: '100vh',
        zIndex: 20,
        padding: 0,
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '-2px 0 4px rgba(0,0,0,0.05)',
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
          border: '1px solid #ddd',
          pointerEvents: 'auto',
        }}
      />
      {!collapsed && (
        <div style={{ flex: 1, height: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '0 12px', flexShrink: 0 }}>
            <h3 style={{ fontWeight: 600, marginBottom: 8 }}>Information Panel</h3>
            <Divider style={{ margin: '8px 0' }} />
          </div>
          <div
            ref={infoPanelScrollRef}
            style={{ flex: 1, minHeight: 0, overflow: 'auto', cursor: 'grab' }}
          >
            <Table
              columns={columns}
              dataSource={info}
              rowKey={record => record.name + (record.id || '')}
              size="small"
              pagination={false}
              style={{
                background: 'transparent',
                borderRadius: 8,
              }}
              bordered={false}
              scroll={{ x: 500 }}
              sticky
            />
          </div>
        </div>
      )}
    </Sider>
  );
};

export default InformationPanel;
