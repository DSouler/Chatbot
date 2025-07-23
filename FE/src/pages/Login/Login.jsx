import React, { useState, useEffect } from 'react';
import { Form, Input, Button, Typography, Card, Row, Col, message } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useUser } from '../../hooks/useUser';
import { useNavigate, Link } from 'react-router-dom';
import cover from '../../assets/cover.png';
import companyLogo from '../../assets/vti-logo-horiz.png';

const { Title, Text } = Typography;

const Login = () => {
  const [form] = Form.useForm();
  const [showError, setShowError] = useState(false);
  const { login, loading, error, isAuthenticated, user, clearUserError } = useUser();
  const navigate = useNavigate();

  // Handle authentication state changes
  useEffect(() => {
    if (isAuthenticated && user) {
      if (user.role === 'ADMIN') {
        navigate('/admin');
      } else {
        navigate('/');
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
    <Row>
      {/* Left side - Cover Image */}
      <Col 
        lg={12}
        xs={0}
        style={{
          flex: 1,
          backgroundImage: `url(${cover})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          minHeight: '100vh'
        }}
      />

      {/* Right side - Login Form */}
      <Col 
        lg={12}
        xs={24}
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f5f5f5',
          padding: '40px',
          minHeight: '100vh'
        }}
      >
        <Card
          style={{
            width: '100%',
            maxWidth: '400px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
            borderRadius: '12px',
            border: 'none'
          }}
          bodyStyle={{ padding: '40px' }}
        >
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            marginBottom: '32px' 
            }}>
            <img 
              src={companyLogo} 
              alt="Company Logo"
              style={{
                marginBottom: '16px'
              }}
            />
            
            <Text 
              type="secondary" 
              style={{ 
                fontSize: '16px',
                marginBottom: showError ? '8px' : '0'
              }}
            >
              Please login with your LDAP account
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
                Wrong account or incorrect password
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
                  Account
                </Text>
              }
              name="account"
              rules={[
                { required: true, message: 'Please input your account!' },
              ]}
              style={{ marginBottom: '24px' }}
            >
              <Input
                prefix={<UserOutlined style={{ color: '#bfbfbf' }} />}
                placeholder="Account"
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
                  Password
                </Text>
              }
              name="password"
              rules={[
                { required: true, message: 'Please input your password!' },
                { min: 6, message: 'Password must be at least 6 characters!' }
              ]}
              style={{ marginBottom: '32px' }}
            >
              <Input.Password
                prefix={<LockOutlined style={{ color: '#bfbfbf' }} />}
                placeholder="Password"
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
                {loading ? 'Logging in...' : 'Login'}
              </Button>
            </Form.Item>
          </Form>
        </Card>
      </Col>
    </Row>
  );
};

export default Login;