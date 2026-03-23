import React from 'react';
import { useNavigate } from 'react-router-dom';

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

const AnimatedBackground = () => (
  <>
    <style>{`
      @keyframes bgSunPulse {
        0%, 100% { opacity: 0.88; }
        50% { opacity: 1; }
      }
      @keyframes bgGlowPulse {
        0%, 100% { opacity: 0.52; }
        50% { opacity: 0.76; }
      }
      @keyframes bgMistDrift1 {
        0%, 100% { transform: translateX(0px); }
        50% { transform: translateX(55px); }
      }
      @keyframes bgMistDrift2 {
        0%, 100% { transform: translateX(0px); }
        50% { transform: translateX(-45px); }
      }
      @keyframes bgMistDrift3 {
        0%, 100% { transform: translateX(-28px); }
        50% { transform: translateX(28px); }
      }
      .bg-sun-glow  { animation: bgGlowPulse  5s ease-in-out infinite; }
      .bg-sun-core  { animation: bgSunPulse   5s ease-in-out infinite; }
      .bg-mist-1    { animation: bgMistDrift1 10s ease-in-out infinite; }
      .bg-mist-2    { animation: bgMistDrift2 13s ease-in-out infinite; }
      .bg-mist-3    { animation: bgMistDrift3 17s ease-in-out infinite; }
    `}</style>
    <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMid slice"
        style={{ width: '100%', height: '100%' }}
      >
        <defs>
          <linearGradient id="bgSkyGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#a8cce8"/>
            <stop offset="38%"  stopColor="#dcc0e0"/>
            <stop offset="100%" stopColor="#bcaad4"/>
          </linearGradient>
          <radialGradient id="bgSunGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor="white"   stopOpacity="1"/>
            <stop offset="40%"  stopColor="white"   stopOpacity="0.85"/>
            <stop offset="65%"  stopColor="#f4eeff" stopOpacity="0.45"/>
            <stop offset="100%" stopColor="#ddd0f4" stopOpacity="0"/>
          </radialGradient>
        </defs>

        {/* Sky */}
        <rect width="1440" height="900" fill="url(#bgSkyGrad)"/>

        {/* Sun glow */}
        <circle className="bg-sun-glow" cx="300" cy="188" r="170" fill="url(#bgSunGrad)"/>
        {/* Sun core */}
        <circle className="bg-sun-core" cx="300" cy="188" r="82" fill="white"/>

        {/* Mountain 1 — farthest, palest */}
        <path
          d="M0,900 L0,338 C160,305 340,322 520,308 C700,294 880,306 1060,292 C1200,282 1340,288 1440,283 L1440,900 Z"
          fill="#d4bcd8"/>

        {/* Mist 1 */}
        <path className="bg-mist-1"
          d="M-120,900 L-120,360 C180,345 500,362 820,350 C1100,340 1320,354 1580,348 L1580,900 Z"
          fill="#e8d4ec" opacity="0.3"/>

        {/* Mountain 2 */}
        <path
          d="M0,900 L0,432 C130,405 300,420 460,406 C620,392 780,378 940,390 C1100,402 1260,396 1400,386 L1440,388 L1440,900 Z"
          fill="#b49ac4"/>

        {/* Mist 2 */}
        <path className="bg-mist-2"
          d="M-80,900 L-80,455 C260,438 600,452 920,440 C1160,430 1360,442 1580,436 L1580,900 Z"
          fill="#ccb4e0" opacity="0.22"/>

        {/* Mountain 3 */}
        <path
          d="M0,900 L0,510 C110,484 255,498 395,483 C535,468 668,454 805,466 C942,478 1090,474 1230,462 C1348,452 1418,458 1440,461 L1440,900 Z"
          fill="#8e76ac"/>

        {/* Mountain 4 — darker foreground ridge */}
        <path
          d="M0,900 L0,578 C95,553 210,568 330,553 C468,537 608,522 750,538 C892,554 1032,548 1172,535 C1293,524 1390,532 1440,536 L1440,900 Z"
          fill="#6a508c"/>

        {/* Mist 3 — low-lying valley fog */}
        <path className="bg-mist-3"
          d="M-60,900 L-60,595 C300,578 660,592 1000,580 C1220,572 1380,580 1520,578 L1520,900 Z"
          fill="#c0a0d8" opacity="0.18"/>

        {/* Back tree silhouette */}
        <path
          d="M0,900 L0,603
          L30,570 L60,594 L90,558 L120,582 L150,545 L180,570 L210,536 L240,563 L270,530 L300,558
          L330,523 L360,552 L390,519 L420,548 L450,515 L480,544 L510,511 L540,541 L570,507 L600,537
          L630,503 L660,534 L690,500 L720,531 L750,497 L780,528 L810,494 L840,525 L870,491 L900,522
          L930,488 L960,519 L990,485 L1020,516 L1050,482 L1080,513 L1110,479 L1140,510 L1170,476 L1200,507
          L1230,473 L1260,504 L1290,470 L1320,501 L1350,466 L1380,498 L1410,464 L1440,490
          L1440,900 Z"
          fill="#48406e"/>

        {/* Front tree silhouette */}
        <path
          d="M0,900 L0,703
          L25,670 L50,695 L75,662 L100,688 L125,656 L150,683 L175,650 L200,678 L225,644 L250,673
          L275,640 L300,669 L325,636 L350,666 L375,632 L400,662 L425,628 L450,659 L475,625 L500,656
          L525,622 L550,654 L575,619 L600,651 L625,616 L650,649 L675,613 L700,646 L725,610 L750,644
          L775,607 L800,641 L825,604 L850,638 L875,601 L900,635 L925,598 L950,632 L975,595 L1000,629
          L1025,592 L1050,626 L1075,589 L1100,623 L1125,586 L1150,620 L1175,583 L1200,617 L1225,580 L1250,614
          L1275,577 L1300,611 L1325,574 L1350,608 L1375,572 L1400,606 L1425,569 L1440,598
          L1440,900 Z"
          fill="#2e2448"/>
      </svg>
    </div>
  </>
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
        <TFTLogo size={56} />
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
