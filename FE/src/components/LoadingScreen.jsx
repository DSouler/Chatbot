import React from 'react';
import { Spin } from 'antd';
import { LoadingOutlined } from '@ant-design/icons';
import logo from '../assets/logo.svg';

const LoadingScreen = () => {
  const antIcon = (
    <LoadingOutlined
      style={{
        fontSize: 32,
        color: '#7C3AED',
      }}
      spin
    />
  );

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        background: 'white',
        color: '#333',
      }}
    >
      {/* Logo */}
      <div
        style={{
          marginBottom: '40px',
          animation: 'fadeInDown 1s ease-out',
        }}
      >
        <img src={logo} alt="logo" style={{ width: 72, height: 72 }} />
      </div>

      {/* Loading Spinner */}
      <div
        style={{
          marginBottom: '24px',
          animation: 'fadeInUp 1s ease-out 0.3s both',
        }}
      >
        <Spin indicator={antIcon} />
      </div>

      {/* Loading Text */}
      <div
        style={{
          fontSize: '18px',
          fontWeight: '500',
          marginBottom: '8px',
          animation: 'fadeInUp 1s ease-out 0.6s both',
          color: '#333',
        }}
      >
        Loading...
      </div>

      {/* Subtitle */}
      <div
        style={{
          fontSize: '14px',
          opacity: 0.7,
          animation: 'fadeInUp 1s ease-out 0.9s both',
          color: '#666',
        }}
      >
        Please wait while we prepare your workspace
      </div>

      {/* Animated dots */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          marginTop: '20px',
          animation: 'fadeInUp 1s ease-out 1.2s both',
        }}
      >
        {[0, 1, 2].map((index) => (
          <div
            key={index}
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: '#7C3AED',
              animation: `pulse 1.5s ease-in-out infinite ${index * 0.2}s`,
            }}
          />
        ))}
      </div>

      {/* CSS Animations */}
      <style>
        {`
          @keyframes fadeInDown {
            from {
              opacity: 0;
              transform: translateY(-30px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          @keyframes fadeInUp {
            from {
              opacity: 0;
              transform: translateY(30px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          @keyframes pulse {
            0%, 100% {
              opacity: 0.6;
              transform: scale(1);
            }
            50% {
              opacity: 1;
              transform: scale(1.2);
            }
          }
        `}
      </style>
    </div>
  );
};

export default LoadingScreen; 