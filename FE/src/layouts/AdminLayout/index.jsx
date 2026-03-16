import { Layout, Menu } from 'antd';
import {
  UserOutlined,
  TeamOutlined,
  FileOutlined,
  DatabaseOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { useUser } from '../../hooks/useUser';
import Footer from '../../components/Layouts/Footer';
import { useNavigate } from 'react-router-dom';

const TFTLogo = ({ size = 32 }) => (
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

const { Header, Content, Sider } = Layout;

const AdminLayout = ({ children }) => {
  const { user, logout } = useUser();
  const navigate = useNavigate();

  const menuItems = [
    {
      key: 'company-management',
      icon: <TeamOutlined />,
      label: 'Company Management',
      path: '/admin/tenant',
    },
    {
      key: 'account-management',
      icon: <UserOutlined />,
      label: 'Account Management',
      children: [
        {
          key: 'user-management',
          label: 'User Management',
          path: '/admin/account/user',
        },
        {
          key: 'group-management',
          label: 'Group Management',
          path: '/admin/account/group',
        },
      ],
    },
    // {
    //   key: 'file-management',
    //   icon: <FileOutlined />,
    //   label: 'File Management',
    //   path: '/admin/file',
    // },
    // {
    //   key: 'resources-management',
    //   icon: <DatabaseOutlined />,
    //   label: 'Resources Management',
    //   path: '/admin/resources',
    // },
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: 'Settings',
      path: '/admin/settings',
    },
  ];

  const handleMenuClick = ({ key }) => {
    // Find the clicked item (could be in children)
    const findItemByKey = (items, targetKey) => {
      for (const item of items) {
        if (item.key === targetKey) {
          return item;
        }
        if (item.children) {
          const found = findItemByKey(item.children, targetKey);
          if (found) return found;
        }
      }
      return null;
    };

    const clickedItem = findItemByKey(menuItems, key);
    if (clickedItem && clickedItem.path) {
      navigate(clickedItem.path);
    }
  };

  return (
    <Layout className="h-screen">
      <Header className="bg-white shadow-sm px-6 flex justify-between items-center">
        <div className="flex items-center space-x-6">
          <TFTLogo size={32} />
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
      </Header>
      
      <Layout>
        <Sider 
          width={250} 
          className="bg-white"
          style={{
            overflow: 'auto',
            height: '100vh',
            position: 'fixed',
            left: 0,
            top: 64, // Header height
            bottom: 0,
          }}
        >
          <Menu
            mode="inline"
            defaultSelectedKeys={['company-management']}
            style={{ height: '100%', borderRight: 0 }}
            items={menuItems}
            onClick={handleMenuClick}
          />
        </Sider>
        
        <Layout style={{ marginLeft: 250 }}>
          <Content className="bg-gray-50 overflow-auto">
            {children}
          </Content>
          <Footer />
        </Layout>
      </Layout>
    </Layout>
  );
};

export default AdminLayout;