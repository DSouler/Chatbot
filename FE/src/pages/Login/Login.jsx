import React, { useState, useEffect } from 'react';
import { Form, Input, Button, Typography, Card, message } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useUser } from '../../hooks/useUser';
import { useNavigate, Link } from 'react-router-dom';
import logoUrl from '../../assets/logo.svg';

const TFTLogo = ({ size = 48 }) => (
  <img src={logoUrl} alt="TFT Logo" width={size} height={size} style={{ objectFit: 'contain', display: 'block' }} />
);

const { Title, Text } = Typography;

const Login = () => {
  const [form] = Form.useForm();
  const [showError, setShowError] = useState(false);
  const { login, loading, error, isAuthenticated, user, clearUserError } = useUser();
  const navigate = useNavigate();

  // Handle authentication state changes
  useEffect(() => {
    if (isAuthenticated && user) {
      sessionStorage.removeItem('guestMode');
      if (user.role === 'ADMIN') {
        navigate('/admin');
      } else {
        navigate('/home');
      }
    }
  }, [isAuthenticated, user, navigate]);

  // Handle error messages
  useEffect(() => {
    if (error) {
      setShowError(true);
      
    } else {
      setShowError(false);
    }
  }, [error, clearUserError]);

  const onFinish = async (values) => {
    try {
      setShowError(false); // Clear any previous error
      await login(values.account, values.password);
    } catch (error) {
      console.error('Login error:', error);
    }
  };

  const onFinishFailed = (errorInfo) => {
    console.log('Failed:', errorInfo);
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100%',
        background: 'linear-gradient(135deg, #A8D4F5 0%, #EBF0FF 50%, #E5D4F8 80%, #F5F0FF 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
        padding: '40px 16px',
      }}
    >
      {/* Decorative orbs */}
      <div style={{ position: 'absolute', top: '8%', left: '5%', width: 260, height: 260, borderRadius: '50%', background: 'radial-gradient(circle, rgba(147,197,253,0.5) 0%, transparent 70%)' }} />
      <div style={{ position: 'absolute', bottom: '10%', right: '6%', width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(196,181,253,0.45) 0%, transparent 70%)' }} />
      <div style={{ position: 'absolute', top: '45%', right: '18%', width: 160, height: 160, borderRadius: '50%', background: 'radial-gradient(circle, rgba(221,214,254,0.4) 0%, transparent 70%)' }} />
      <div style={{ position: 'absolute', top: '20%', left: '30%', width: 130, height: 130, borderRadius: '50%', background: 'radial-gradient(circle, rgba(186,230,253,0.35) 0%, transparent 70%)' }} />

      {/* TFT Branding */}
      <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', marginBottom: 32 }}>
        <div style={{ marginBottom: 16 }}>
          <img src={logoUrl} alt="TFT Logo" width={140} height={140} style={{ objectFit: 'contain', display: 'block', margin: '0 auto' }} />
        </div>
        <div style={{ fontFamily: "'Georgia', serif", fontSize: 32, fontWeight: 900, color: '#4C1D95', letterSpacing: 4, lineHeight: 1.1, textShadow: '0 1px 8px rgba(100,60,180,0.15)', marginBottom: 4 }}>
          TEAMFIGHT TACTICS
        </div>
        <div style={{ color: 'rgba(100,60,180,0.75)', fontSize: 14, letterSpacing: 1 }}>
          Trợ lý AI chuyên biệt cho game TFT
        </div>
      </div>

      <Card
        style={{
          position: 'relative',
          zIndex: 1,
          width: '100%',
          maxWidth: '420px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.35)',
          borderRadius: '16px',
          border: 'none',
          background: 'rgba(255,255,255,0.97)',
        }}
        bodyStyle={{ padding: '40px' }}
      >
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            marginBottom: '32px' 
            }}>
            <TFTLogo size={80} />
            
            <Text 
              type="secondary" 
              style={{ 
                fontSize: '16px',
                marginBottom: showError ? '8px' : '0'
              }}
            >
              Đăng nhập vào TFTChat
            </Text>

            {/* Error message display */}
            {showError && (
              <Text 
                type="danger" 
                style={{ 
                  fontSize: '14px',
                  textAlign: 'center',
                  marginTop: '8px',
                  padding: '8px 16px',
                  backgroundColor: '#fff2f0',
                  border: '1px solid #ffccc7',
                  borderRadius: '6px',
                  display: 'block',
                  width: '100%'
                }}
              >
                Sai tài khoản hoặc mật khẩu
              </Text>
            )}
          </div>

          <Form
            form={form}
            name="login"
            onFinish={onFinish}
            onFinishFailed={onFinishFailed}
            layout="vertical"
            size="large"
            autoComplete="off"
          >
            <Form.Item
              label={
                <Text style={{ fontSize: '14px', color: '#666', fontWeight: '500' }}>
                  Tài khoản
                </Text>
              }
              name="account"
              rules={[
                { required: true, message: 'Vui lòng nhập tài khoản!' },
              ]}
              style={{ marginBottom: '24px' }}
            >
              <Input
                prefix={<UserOutlined style={{ color: '#bfbfbf' }} />}
                placeholder="Tên tài khoản"
                style={{
                  height: '50px',
                  borderRadius: '8px',
                  fontSize: '16px'
                }}
              />
            </Form.Item>

            <Form.Item
              label={
                <Text style={{ fontSize: '14px', color: '#666', fontWeight: '500' }}>
                  Mật khẩu
                </Text>
              }
              name="password"
              rules={[
                { required: true, message: 'Vui lòng nhập mật khẩu!' },
                { min: 6, message: 'Mật khẩu phải ít nhất 6 ký tự!' }
              ]}
              style={{ marginBottom: '32px' }}
            >
              <Input.Password
                prefix={<LockOutlined style={{ color: '#bfbfbf' }} />}
                placeholder="Mật khẩu"
                style={{
                  height: '50px',
                  borderRadius: '8px',
                  fontSize: '16px'
                }}
              />
            </Form.Item>

            <Form.Item style={{ marginBottom: '0' }}>
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                style={{
                  width: '100%',
                  height: '50px',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: '500',
                  boxShadow: '0 2px 8px rgba(255, 122, 69, 0.3)'
                }}
                onMouseEnter={(e) => {
                  if (!loading) {
                    e.target.style.transform = 'translateY(-1px)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!loading) {
                    e.target.style.transform = 'translateY(0)';
                  }
                }}
              >
                {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
              </Button>
            </Form.Item>
          </Form>

          {/* Register link */}
          <div style={{ marginTop: 24, textAlign: 'center', borderTop: '1px solid #f0f0f0', paddingTop: 20 }}>
            <Text type="secondary" style={{ fontSize: 14 }}>Chưa có tài khoản? </Text>
            <Link to="/register" style={{ fontSize: 14, color: '#7C3AED', fontWeight: 600 }}>
              Đăng ký ngay
            </Link>
          </div>
        </Card>
    </div>
  );
};

export default Login;