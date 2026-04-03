import React from 'react';
import { useNavigate } from 'react-router-dom';
import logoUrl from '../../assets/logo.svg';

const TFTLogo = ({ size = 48 }) => (
  <img src={logoUrl} alt="TFT Logo" width={size} height={size} style={{ objectFit: 'contain', display: 'block' }} />
);

const AnimatedBackground = () => (
  <div style={{
    position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
    background: 'linear-gradient(135deg, #A8D4F5 0%, #EBF0FF 50%, #E5D4F8 80%, #F5F0FF 100%)',
  }}>
    <div style={{ position: 'absolute', top: '15%', left: '10%', width: 320, height: 320, borderRadius: '50%', background: 'radial-gradient(circle, rgba(200,232,255,0.6) 0%, transparent 70%)' }} />
    <div style={{ position: 'absolute', bottom: '20%', right: '8%', width: 380, height: 380, borderRadius: '50%', background: 'radial-gradient(circle, rgba(229,212,248,0.5) 0%, transparent 70%)' }} />
    <div style={{ position: 'absolute', top: '40%', right: '25%', width: 220, height: 220, borderRadius: '50%', background: 'radial-gradient(circle, rgba(245,240,255,0.4) 0%, transparent 70%)' }} />
  </div>
);

const Landing = () => {
  const navigate = useNavigate();

  const handleGuest = () => {
    sessionStorage.setItem('guestMode', 'true');
    navigate('/home');
  };

  const handleLogin = () => {
    navigate('/login');
  };

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden">
      <AnimatedBackground />

      {/* Logo + Title */}
      <div className="relative z-10 flex flex-col items-center mb-10 gap-4">
        <TFTLogo size={120} />
        <h1 className="text-4xl font-bold tracking-tight" style={{color:'#3B0764'}}>TFTChat</h1>
        <p className="text-base text-center max-w-sm" style={{color:'#5B21B6'}}>
          Trợ lý AI chuyên biệt về Teamfight Tactics — tra cứu meta, đánh giá đội hình và nhiều hơn nữa.
        </p>
      </div>

      {/* Cards */}
      <div className="relative z-10 flex flex-col sm:flex-row gap-6 w-full max-w-lg px-4">
        {/* Dùng thử */}
        <button
          onClick={handleGuest}
          className="flex-1 flex flex-col items-center gap-3 p-8 rounded-2xl border-2 backdrop-blur-md shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-200 group cursor-pointer"
          style={{borderColor:'#A78BFA', background:'rgba(255,255,255,0.55)'}}
        >
          <span className="text-4xl">🎮</span>
          <span className="text-xl font-semibold transition-colors" style={{color:'#3B0764'}}>
            Dùng thử
          </span>
          <span className="text-sm text-center" style={{color:'#6D28D9'}}>
            Trải nghiệm ngay, không cần tài khoản
          </span>
        </button>

        {/* Đăng nhập */}
        <button
          onClick={handleLogin}
          className="flex-1 flex flex-col items-center gap-3 p-8 rounded-2xl border-2 backdrop-blur-md shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-200 group cursor-pointer"
          style={{borderColor:'#A78BFA', background:'rgba(255,255,255,0.55)'}}
        >
          <span className="text-4xl">🔐</span>
          <span className="text-xl font-semibold transition-colors" style={{color:'#3B0764'}}>
            Đăng nhập
          </span>
          <span className="text-sm text-center" style={{color:'#6D28D9'}}>
            Lưu lịch sử, đồng bộ trên nhiều thiết bị
          </span>
        </button>
      </div>

      <p className="relative z-10 mt-8 text-xs" style={{color:'#A78BFA'}}>TFTChat © 2026</p>
    </div>
  );
};

export default Landing;
