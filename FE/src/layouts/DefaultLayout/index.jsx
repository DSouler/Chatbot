import logo from '../../assets/vti-logo-horiz.png';
import { useState } from 'react';
import { SiderContext } from '../../contexts/SiderContext';

const AppLayout = ({ children }) => {
  const [collapsedSider, setCollapsedSider] = useState(false);
  const [collapsedInfoPanel, setCollapsedInfoPanel] = useState(true);

  return (
    <SiderContext.Provider value={{ collapsedSider, setCollapsedSider, collapsedInfoPanel, setCollapsedInfoPanel }}>
      <div className="h-screen flex flex-col bg-gray-50">
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
                <img 
                  src={logo}
                  alt="VTI Chatbot"
                  className="h-8 w-auto"
                />
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