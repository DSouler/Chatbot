import React from 'react';
import { Spin } from 'antd';
import { LoadingOutlined } from '@ant-design/icons';
const TFTLogo = ({ size = 60 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width={size} height={size}>
    <polygon points="60,4 110,32 110,88 60,116 10,88 10,32" fill="#3B82C4"/>
    <polygon points="60,10 104,35 104,85 60,110 16,85 16,35" fill="none" stroke="white" strokeWidth="5"/>
    <path d="M30,44 L38,60 L48,50 L55,36 L60,30 L65,36 L72,50 L82,60 L90,44 L90,76 L30,76 Z" fill="white"/>
    <rect x="36" y="60" width="48" height="16" rx="4" fill="#3B82C4"/>
    <rect x="39" y="63" width="18" height="9" rx="2" fill="white"/>
    <rect x="63" y="63" width="18" height="9" rx="2" fill="white"/>
    <polygon points="60,75 55,81 60,84 65,81" fill="white"/>
  </svg>
);

const LoadingScreen = () => {
  const antIcon = (
    <LoadingOutlined
      style={{
        fontSize: 32,
        color: '#ff7a45',
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
        <TFTLogo size={60} />
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
              backgroundColor: '#ff7a45',
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