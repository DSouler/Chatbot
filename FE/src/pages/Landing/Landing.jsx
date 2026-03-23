import React from 'react';
import { useNavigate } from 'react-router-dom';
import logoUrl from '../../assets/logo.svg';

const TFTLogo = ({ size = 48 }) => (
  <img src={logoUrl} alt="TFT Logo" width={size} height={size} style={{ objectFit: 'contain', display: 'block' }} />
);

const AnimatedBackground = () => (
  <div style={{
    position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
    background: 'linear-gradient(135deg, #0B2A4A 0%, #1B4B6E 30%, #5BA8D4 65%, #B8E0F5 100%)',
  }}>
    <div style={{ position: 'absolute', top: '15%', left: '10%', width: 320, height: 320, borderRadius: '50%', background: 'radial-gradient(circle, rgba(100,180,230,0.45) 0%, transparent 70%)' }} />
    <div style={{ position: 'absolute', bottom: '20%', right: '8%', width: 380, height: 380, borderRadius: '50%', background: 'radial-gradient(circle, rgba(100,160,255,0.35) 0%, transparent 70%)' }} />
    <div style={{ position: 'absolute', top: '40%', right: '25%', width: 220, height: 220, borderRadius: '50%', background: 'radial-gradient(circle, rgba(180,220,255,0.3) 0%, transparent 70%)' }} />
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
        <h1 className="text-4xl font-bold text-white drop-shadow-lg tracking-tight">TFTChat</h1>
        <p className="text-white/75 text-base text-center max-w-sm drop-shadow">
          Trợ lý AI chuyên biệt về Teamfight Tactics — tra cứu meta, đánh giá đội hình và nhiều hơn nữa.
        </p>
      </div>

      {/* Cards */}
      <div className="relative z-10 flex flex-col sm:flex-row gap-6 w-full max-w-lg px-4">
        {/* Dùng thử */}
        <button
          onClick={handleGuest}
          className="flex-1 flex flex-col items-center gap-3 p-8 rounded-2xl border-2 border-white/30 bg-white/15 backdrop-blur-md shadow-lg hover:shadow-2xl hover:bg-white/25 hover:-translate-y-1 transition-all duration-200 group cursor-pointer"
        >
          <span className="text-4xl">🎮</span>
          <span className="text-xl font-semibold text-white drop-shadow group-hover:text-indigo-100 transition-colors">
            Dùng thử
          </span>
          <span className="text-sm text-white/65 text-center">
            Trải nghiệm ngay, không cần tài khoản
          </span>
        </button>

        {/* Đăng nhập */}
        <button
          onClick={handleLogin}
          className="flex-1 flex flex-col items-center gap-3 p-8 rounded-2xl border-2 border-white/30 bg-white/15 backdrop-blur-md shadow-lg hover:shadow-2xl hover:bg-white/25 hover:-translate-y-1 transition-all duration-200 group cursor-pointer"
        >
          <span className="text-4xl">🔐</span>
          <span className="text-xl font-semibold text-white drop-shadow group-hover:text-purple-100 transition-colors">
            Đăng nhập
          </span>
          <span className="text-sm text-white/65 text-center">
            Lưu lịch sử, đồng bộ trên nhiều thiết bị
          </span>
        </button>
      </div>

      <p className="relative z-10 mt-8 text-xs text-white/35">TFTChat © 2026</p>
    </div>
  );
};

export default Landing;
