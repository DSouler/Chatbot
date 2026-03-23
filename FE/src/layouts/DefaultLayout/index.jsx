import { useState } from 'react';
import logoUrl from '../../assets/logo.svg';
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
                  <img src={logoUrl} alt="TFT Logo" width={48} height={48} style={{ objectFit: 'contain' }} />
                  <span style={{ color: '#3B82C4', fontWeight: 800, fontSize: 18, letterSpacing: 0.5 }}>TFTChat</span>
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