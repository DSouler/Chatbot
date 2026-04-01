import { useState } from 'react';
import logoUrl from '../../assets/logo.svg';
import { SiderContext } from '../../contexts/SiderContext';
import { useUser } from '../../hooks/useUser';
import { useNavigate } from 'react-router-dom';

const AppLayout = ({ children }) => {
  const [collapsedSider, setCollapsedSider] = useState(false);
  const [collapsedInfoPanel, setCollapsedInfoPanel] = useState(true);
  const { user } = useUser();
  const navigate = useNavigate();

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
                  <span style={{ background: 'linear-gradient(135deg, #7C3AED, #6366F1)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontWeight: 800, fontSize: 18, letterSpacing: 0.5 }}>TFTChat</span>
                </div>
              </div>
              {user && (user.role || '').toUpperCase() === 'ADMIN' && (
                <button
                  onClick={() => navigate('/admin')}
                  style={{
                    fontSize: 13, color: '#fff', padding: '7px 16px', borderRadius: 8, border: 'none',
                    background: 'linear-gradient(135deg, #7C3AED 0%, #9B59FF 100%)',
                    cursor: 'pointer', fontWeight: 600, boxShadow: '0 2px 8px rgba(124,58,237,0.25)',
                  }}
                >
                  ⚙ Admin Panel
                </button>
              )}
            </div>
          </header>
          {children}
        </main>
      </div>
    </SiderContext.Provider>
  );
};

export default AppLayout;