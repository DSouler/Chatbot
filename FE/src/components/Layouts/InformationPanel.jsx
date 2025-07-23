import React, { useState, useEffect } from 'react';
import { Layout, Table, Button, Divider, Tooltip } from 'antd';
import { MenuFoldOutlined, MenuUnfoldOutlined } from '@ant-design/icons';

const { Sider } = Layout;

const InformationPanel = ({ info = [], collapsed, onToggle }) => {
  const [width, setWidth] = useState(400);
  const [isResizing, setIsResizing] = useState(false);

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
        background: '#fff',
        borderRight: '1px solid #f0f0f0',
        position: 'fixed',
        right: 0,
        top: 64,
        minHeight: 'calc(100vh - 64px)',
        height: 'calc(100vh - 64px)',
        zIndex: 20,
        padding: 0,
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '-2px 0 4px rgba(0,0,0,0.05)',
        userSelect: 'none',
      }}
    >
      <div
        style={{
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
        }}
      />
      {!collapsed && (
        <div style={{ flex: 1, height: '90vh', overflowY: 'auto' }}>
          <h3 style={{ fontWeight: 600, marginBottom: 8 }}>Information Panel</h3>
          <Divider style={{ margin: '8px 0' }} />
          <Table
            columns={columns}
            dataSource={info}
            rowKey={record => record.name + (record.id || '')}
            size="small"
            pagination={false}
            style={{
              borderRadius: 8,
            }}
            bordered={false}
            scroll={{ x: 500 }}
          />
        </div>
      )}
    </Sider>
  );
};

export default InformationPanel;
