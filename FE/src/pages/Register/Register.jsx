import React, { useState } from 'react';
import { Form, Input, Button, Typography, Card, Row, Col, message } from 'antd';
import { UserOutlined, LockOutlined, MailOutlined } from '@ant-design/icons';
import { useNavigate, Link } from 'react-router-dom';
import { register } from '../../services/auth';
import { syncUser } from '../../services/chat';

const TFTLogo = ({ size = 48 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width={size} height={size}>
    <polygon points="60,4 110,32 110,88 60,116 10,88 10,32" fill="#5B4FCF"/>
    <polygon points="60,10 104,35 104,85 60,110 16,85 16,35" fill="none" stroke="white" strokeWidth="5"/>
    <path d="M30,44 L38,60 L48,50 L55,36 L60,30 L65,36 L72,50 L82,60 L90,44 L90,76 L30,76 Z" fill="white"/>
    <rect x="36" y="60" width="48" height="16" rx="4" fill="#5B4FCF"/>
    <rect x="39" y="63" width="18" height="9" rx="2" fill="white"/>
    <rect x="63" y="63" width="18" height="9" rx="2" fill="white"/>
    <polygon points="60,75 55,81 60,84 65,81" fill="white"/>
  </svg>
);

const { Title, Text } = Typography;

const Register = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const onFinish = async (values) => {
    setLoading(true);
    try {
      const response = await register(values.account, values.password, values.email);

      // Sync user to vchatbot database
      try {
        await syncUser(response.user_id, response.username);
        console.log('User synced to vchatbot successfully');
      } catch (syncErr) {
        console.error('Failed to sync user:', syncErr);
        // Don't block registration if sync fails
      }

      message.success('Đăng ký thành công! Vui lòng đăng nhập.');
      navigate('/login');
    } catch (err) {
      const msg = err?.response?.data?.detail || err?.message || 'Đăng ký thất bại. Vui lòng thử lại.';
      message.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Row>
      {/* Left side - TFT Cover */}
      <Col
        lg={12}
        xs={0}
        style={{
          flex: 1,
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #1a0533 0%, #2d1b69 30%, #c4506a 65%, #e8a87c 100%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div style={{ position: 'absolute', top: '15%', left: '10%', width: 180, height: 180, borderRadius: '50%', background: 'radial-gradient(circle, rgba(180,100,220,0.45) 0%, transparent 70%)' }} />
        <div style={{ position: 'absolute', bottom: '20%', right: '8%', width: 220, height: 220, borderRadius: '50%', background: 'radial-gradient(circle, rgba(100,160,255,0.35) 0%, transparent 70%)' }} />
        <div style={{ position: 'absolute', top: '40%', right: '25%', width: 120, height: 120, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,180,100,0.3) 0%, transparent 70%)' }} />
        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', padding: '0 40px' }}>
          <div style={{ marginBottom: 24 }}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width={90} height={90}>
              <polygon points="60,4 110,32 110,88 60,116 10,88 10,32" fill="rgba(255,255,255,0.15)"/>
              <polygon points="60,10 104,35 104,85 60,110 16,85 16,35" fill="none" stroke="white" strokeWidth="4"/>
              <path d="M30,44 L38,60 L48,50 L55,36 L60,30 L65,36 L72,50 L82,60 L90,44 L90,76 L30,76 Z" fill="white"/>
              <rect x="36" y="60" width="48" height="16" rx="4" fill="rgba(255,255,255,0.15)"/>
              <rect x="39" y="63" width="18" height="9" rx="2" fill="white"/>
              <rect x="63" y="63" width="18" height="9" rx="2" fill="white"/>
              <polygon points="60,75 55,81 60,84 65,81" fill="white"/>
            </svg>
          </div>
          <div style={{ fontFamily: "'Georgia', serif", fontSize: 42, fontWeight: 900, color: 'white', letterSpacing: 4, lineHeight: 1.1, textShadow: '0 2px 20px rgba(0,0,0,0.5)', marginBottom: 8 }}>
            TEAMFIGHT
          </div>
          <div style={{ fontFamily: "'Georgia', serif", fontSize: 42, fontWeight: 900, color: 'white', letterSpacing: 4, lineHeight: 1.1, textShadow: '0 2px 20px rgba(0,0,0,0.5)', marginBottom: 24 }}>
            TACTICS
          </div>
          <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 15, letterSpacing: 1 }}>
            Trợ lý AI chuyên biệt cho game TFT
          </div>
        </div>
      </Col>

      {/* Right side - Register Form */}
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
          minHeight: '100vh',
        }}
      >
        <Card
          style={{
            width: '100%',
            maxWidth: '400px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
            borderRadius: '12px',
            border: 'none',
          }}
          bodyStyle={{ padding: '40px' }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '28px' }}>
            <TFTLogo size={52} />
            <Title level={4} style={{ marginTop: 12, marginBottom: 0, color: '#5B4FCF' }}>Tạo tài khoản</Title>
            <Text type="secondary" style={{ fontSize: 14, marginTop: 4 }}>
              Đăng ký để lưu lịch sử chat của bạn
            </Text>
          </div>

          <Form
            form={form}
            name="register"
            onFinish={onFinish}
            layout="vertical"
            size="large"
            autoComplete="off"
          >
            <Form.Item
              label={<Text style={{ fontSize: 14, color: '#666', fontWeight: 500 }}>Tên tài khoản</Text>}
              name="account"
              rules={[
                { required: true, message: 'Vui lòng nhập tên tài khoản!' },
                { min: 3, message: 'Tên tài khoản phải có ít nhất 3 ký tự!' },
              ]}
              style={{ marginBottom: 20 }}
            >
              <Input
                prefix={<UserOutlined style={{ color: '#bfbfbf' }} />}
                placeholder="Tên tài khoản"
                style={{ height: 50, borderRadius: 8, fontSize: 16 }}
              />
            </Form.Item>

            <Form.Item
              label={<Text style={{ fontSize: 14, color: '#666', fontWeight: 500 }}>Email</Text>}
              name="email"
              rules={[
                { required: true, message: 'Vui lòng nhập email!' },
                { type: 'email', message: 'Email không hợp lệ!' },
              ]}
              style={{ marginBottom: 20 }}
            >
              <Input
                prefix={<MailOutlined style={{ color: '#bfbfbf' }} />}
                placeholder="Email"
                style={{ height: 50, borderRadius: 8, fontSize: 16 }}
              />
            </Form.Item>

            <Form.Item
              label={<Text style={{ fontSize: 14, color: '#666', fontWeight: 500 }}>Mật khẩu</Text>}
              name="password"
              rules={[
                { required: true, message: 'Vui lòng nhập mật khẩu!' },
                { min: 6, message: 'Mật khẩu phải có ít nhất 6 ký tự!' },
              ]}
              style={{ marginBottom: 20 }}
            >
              <Input.Password
                prefix={<LockOutlined style={{ color: '#bfbfbf' }} />}
                placeholder="Mật khẩu"
                style={{ height: 50, borderRadius: 8, fontSize: 16 }}
              />
            </Form.Item>

            <Form.Item
              label={<Text style={{ fontSize: 14, color: '#666', fontWeight: 500 }}>Xác nhận mật khẩu</Text>}
              name="confirmPassword"
              dependencies={['password']}
              rules={[
                { required: true, message: 'Vui lòng xác nhận mật khẩu!' },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue('password') === value) return Promise.resolve();
                    return Promise.reject(new Error('Mật khẩu xác nhận không khớp!'));
                  },
                }),
              ]}
              style={{ marginBottom: 28 }}
            >
              <Input.Password
                prefix={<LockOutlined style={{ color: '#bfbfbf' }} />}
                placeholder="Xác nhận mật khẩu"
                style={{ height: 50, borderRadius: 8, fontSize: 16 }}
              />
            </Form.Item>

            <Form.Item style={{ marginBottom: 0 }}>
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                style={{
                  width: '100%',
                  height: 50,
                  borderRadius: 8,
                  fontSize: 16,
                  fontWeight: 600,
                  background: '#5B4FCF',
                  borderColor: '#5B4FCF',
                }}
              >
                {loading ? 'Đang đăng ký...' : 'Đăng ký'}
              </Button>
            </Form.Item>
          </Form>

          {/* Back to login */}
          <div style={{ marginTop: 24, textAlign: 'center', borderTop: '1px solid #f0f0f0', paddingTop: 20 }}>
            <Text type="secondary" style={{ fontSize: 14 }}>Đã có tài khoản? </Text>
            <Link to="/login" style={{ fontSize: 14, color: '#5B4FCF', fontWeight: 600 }}>
              Đăng nhập
            </Link>
          </div>
        </Card>
      </Col>
    </Row>
  );
};

export default Register;
