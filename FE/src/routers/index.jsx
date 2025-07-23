import Chat from "../pages/Home/Chat";
import NotFoundPage from "../pages/NotFoundPage/NotFoundPage";
import Login from "../pages/Login/Login";

import ProtectedRoute from "../components/ProtectedRoute";
import AppLayout from "../layouts/DefaultLayout";
import AdminLayout from "../layouts/AdminLayout";
import { Navigate } from "react-router-dom";
import Tenant from "../pages/Admin/Tenant/Tenant";
import User from "../pages/Admin/Account/User/User";
import Group from "../pages/Admin/Account/Group/Group";
import Settings from "../pages/Admin/Settings/Settings";

const createProtectedRoute = (component) => (
  <ProtectedRoute>
    <AppLayout>{component}</AppLayout>
  </ProtectedRoute>
);

const createAdminProtectedRoute = (component) => (
  <ProtectedRoute>
    <AdminLayout>{component}</AdminLayout>
  </ProtectedRoute>
);

const routes = [
  { path: "/login", component: <Login/> },
  { 
    path: "/", 
    component: createProtectedRoute(<Navigate to="/home" replace />) 
  },
  { 
    path: "/home", 
    component: createProtectedRoute(<Chat/>) 
  },
  {
    path: "/admin",
    element: <AdminLayout/>,
    children: [
      { path: "/admin", component: createProtectedRoute(<Navigate to="/admin/tenant" replace />) },
      { path: "/admin/tenant", component: createAdminProtectedRoute(<Tenant/>) },
      { path: "/admin/account/user", component: createAdminProtectedRoute(<User />) },
      { path: "/admin/account/group", component: createAdminProtectedRoute(<Group />) },
      { path: "/admin/settings", component: createAdminProtectedRoute(<Settings/>) }
    ]
  },
  { path: "*", element: <NotFoundPage /> }
];

export default routes;