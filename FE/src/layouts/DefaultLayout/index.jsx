// logo import removed - using inline SVG
import { useState } from 'react';
import { SiderContext } from '../../contexts/SiderContext';

const AppLayout = ({ children }) => {
  const [collapsedSider, setCollapsedSider] = useState(false);
  const [collapsedInfoPanel, setCollapsedInfoPanel] = useState(true);

  return (
    <SiderContext.Provider value={{ collapsedSider, setCollapsedSider, collapsedInfoPanel, setCollapsedInfoPanel }}>
      <div className="h-screen flex flex-col">
        <main className="flex-1 relative w-full min-h-[calc(100vh - 88px)]">
          <header
            className="fixed top-0 z-30"
            style={{
              left: collapsedSider ? '79px' : '259px',
              right: collapsedInfoPanel ? '79px' : '0',
              transition: 'left 0.3s cubic-bezier(0.4,0,0.2,1)'
            }}
          >
            <div className="px-6 flex justify-between h-16 items-center">
              <div className="flex items-center space-x-6">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width={32} height={32}>
                    <polygon points="60,4 110,32 110,88 60,116 10,88 10,32" fill="#5B4FCF"/>
                    <polygon points="60,10 104,35 104,85 60,110 16,85 16,35" fill="none" stroke="white" strokeWidth="5"/>
                    <path d="M30,44 L38,60 L48,50 L55,36 L60,30 L65,36 L72,50 L82,60 L90,44 L90,76 L30,76 Z" fill="white"/>
                    <rect x="36" y="60" width="48" height="16" rx="4" fill="#5B4FCF"/>
                    <rect x="39" y="63" width="18" height="9" rx="2" fill="white"/>
                    <rect x="63" y="63" width="18" height="9" rx="2" fill="white"/>
                    <polygon points="60,75 55,81 60,84 65,81" fill="white"/>
                  </svg>
                  <span style={{ color: '#5B4FCF', fontWeight: 800, fontSize: 18, letterSpacing: 0.5 }}>TFTChat</span>
                </div>
                {/* <Navigation /> */}
              </div>
              
            </div>
          </header>
          {children}
        </main>
      </div>
    </SiderContext.Provider>
  );
};

export default AppLayout; 