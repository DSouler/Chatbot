import { Layout, Menu } from 'antd';
import {
  UserOutlined,
  TeamOutlined,
  FileOutlined,
  DatabaseOutlined,
  SettingOutlined,
  BarChartOutlined,
  MessageOutlined,
} from '@ant-design/icons';
import { useUser } from '../../hooks/useUser';
import Footer from '../../components/Layouts/Footer';
import { useNavigate, Outlet } from 'react-router-dom';
import logoUrl from '../../assets/logo.svg';

const TFTLogo = ({ size = 48 }) => (
  <img src={logoUrl} alt="TFT Logo" width={size} height={size} style={{ objectFit: 'contain', display: 'block' }} />
);

const { Header, Content, Sider } = Layout;

const AdminLayout = ({ children }) => {
  const { user, logout } = useUser();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

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
    {
      key: 'report',
      icon: <BarChartOutlined />,
      label: 'Report & Statistics',
      path: '/admin/report',
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
          <TFTLogo size={48} />
        </div>
        {user && (
          <div className="flex items-center space-x-4">
            <span className="text-gray-700 font-medium">{user.email}</span>
            <button
              onClick={() => navigate('/home')}
              className="flex items-center gap-1 text-blue-600 hover:text-blue-800 px-3 py-2 rounded-md text-sm font-medium border border-blue-200 bg-blue-50 hover:bg-blue-100 transition"
            >
              <MessageOutlined /> Vào Chat
            </button>
            <button
              onClick={handleLogout}
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
            {children || <Outlet />}
          </Content>
          <Footer />
        </Layout>
      </Layout>
    </Layout>
  );
};

export default AdminLayout;