import { useUser } from '../../hooks/useUser';
import logo from '../../assets/vti-logo-horiz.png';

const AppLayout = ({ children }) => {
  const { user, logout } = useUser();

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <header className="bg-white fixed top-0 left-0 z-30 shadow-sm w-full">
        <div className="px-6 flex justify-between h-16 items-center">
          <div className="flex items-center space-x-6">
            <img 
              src={logo}
              alt="VTI Chatbot"
              className="h-8 w-auto"
            />
            {/* <Navigation /> */}
          </div>
          {user && (
            <div className="flex items-center space-x-4">
              <span className="text-gray-700 font-medium">{user.email}</span>
              <button
                onClick={logout}
                className="text-gray-600 hover:text-red-600 px-3 py-2 rounded-md text-sm font-medium border border-gray-200 bg-gray-100 hover:bg-red-50 transition"
              >
                Sign Out
              </button>
            </div>
          )}
        </div>
      </header>
      <main className="flex-1 relative mt-[64px] w-full min-h-[calc(100vh - 88px)]">
        {children}
      </main>
    </div>
  );
};

export default AppLayout; 