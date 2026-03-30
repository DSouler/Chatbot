import Chat from "../pages/Home/Chat";
import NotFoundPage from "../pages/NotFoundPage/NotFoundPage";
import Login from "../pages/Login/Login";
import Register from "../pages/Register/Register";
import Landing from "../pages/Landing/Landing";

import ProtectedRoute from "../components/ProtectedRoute";
import AppLayout from "../layouts/DefaultLayout";
import AdminLayout from "../layouts/AdminLayout";
import { Navigate } from "react-router-dom";
import Tenant from "../pages/Admin/Tenant/Tenant";
import User from "../pages/Admin/Account/User/User";
import Group from "../pages/Admin/Account/Group/Group";
import Settings from "../pages/Admin/Settings/Settings";
import Report from "../pages/Admin/Report/Report";

const createProtectedRoute = (component) => (
  <ProtectedRoute>
    <AppLayout>{component}</AppLayout>
  </ProtectedRoute>
);

const createAdminProtectedRoute = (component) => (
  <ProtectedRoute>
    {component}
  </ProtectedRoute>
);

const routes = [
  { path: "/", element: <Landing /> },
  { path: "/login", element: <Login/> },
  { path: "/register", element: <Register/> },
  { 
    path: "/home", 
    element: createProtectedRoute(<Chat/>) 
  },
  { 
    path: "/home/:conversationId", 
    element: createProtectedRoute(<Chat/>) 
  },
  {
    path: "/admin",
    element: <ProtectedRoute><AdminLayout/></ProtectedRoute>,
    children: [
      { path: "/admin", element: <Navigate to="/admin/tenant" replace /> },
      { path: "/admin/tenant", element: <Tenant/> },
      { path: "/admin/account/user", element: <User /> },
      { path: "/admin/account/group", element: <Group /> },
      { path: "/admin/settings", element: <Settings/> },
      { path: "/admin/report", element: <Report/> }
    ]
  },
  { path: "*", element: <NotFoundPage /> }
];

export default routes;