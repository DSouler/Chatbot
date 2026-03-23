import React from 'react';
import { Card, Typography, Tag, Space } from 'antd';
import { LoadingOutlined, CheckCircleOutlined, InfoCircleOutlined } from '@ant-design/icons';

const { Text, Title } = Typography;

const StreamingInfo = ({ 
  isStreaming = false, 
  status = '', 
  info = '', 
  usage = null,
  error = null 
}) => {
  if (!isStreaming && !status && !info && !usage && !error) {
    return null;
  }

  return (
    <div style={{ 
      position: 'fixed', 
      bottom: 20, 
      right: 20, 
      zIndex: 1000,
      maxWidth: 300
    }}>
      <Card 
        size="small" 
        style={{ 
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          borderRadius: 8
        }}
      >
        <Space direction="vertical" size="small" style={{ width: '100%' }}>
          {/* Status */}
          {status && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <LoadingOutlined style={{ color: '#1890ff' }} />
              <Text type="secondary" style={{ fontSize: 12 }}>
                {status}
              </Text>
            </div>
          )}

          {/* Info */}
          {info && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <InfoCircleOutlined style={{ color: '#52c41a' }} />
              <Text type="secondary" style={{ fontSize: 12 }}>
                {info}
              </Text>
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <InfoCircleOutlined style={{ color: '#ff4d4f' }} />
              <Text type="danger" style={{ fontSize: 12 }}>
                {error}
              </Text>
            </div>
          )}

          {/* Usage */}
          {usage && (
            <div>
              <Text strong style={{ fontSize: 12, marginBottom: 4, display: 'block' }}>
                Token Usage:
              </Text>
              {Object.entries(usage).map(([model, data]) => (
                <div key={model} style={{ marginBottom: 4 }}>
                  <Tag size="small" color="blue">
                    {model}
                  </Tag>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    Prompt: {data.prompt_tokens || 0} | 
                    Completion: {data.completion_tokens || 0} | 
                    Total: {data.total_tokens || 0}
                  </Text>
                </div>
              ))}
            </div>
          )}

          {/* Streaming indicator */}
          {isStreaming && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 8,
                height: 8,
                backgroundColor: '#1890ff',
                borderRadius: '50%',
                animation: 'pulse 1.5s infinite'
              }} />
              <Text type="secondary" style={{ fontSize: 12 }}>
                Processing...
              </Text>
            </div>
          )}

          {/* Complete indicator */}
          {!isStreaming && (status || info) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <CheckCircleOutlined style={{ color: '#52c41a' }} />
              <Text type="success" style={{ fontSize: 12 }}>
                Completed
              </Text>
            </div>
          )}
        </Space>
      </Card>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
};

export default StreamingInfo; 