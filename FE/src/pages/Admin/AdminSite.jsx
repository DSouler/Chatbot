// import React from "react";
// import { Layout } from "antd";
// import { Routes, Route, Navigate } from "react-router-dom";
// import TenantTable from "./Tenant/TenantTable";
// import UserTable from "./Account/User/UserTable";
// import GroupTable from "./Account/Group/GroupTable";

// const AdminSite = () => (
//   <Layout style={{ minHeight: "100vh", background: "#f5f6fa" }}>
//     <Sitebar />
//     <Layout>
//       <Layout.Content style={{ minHeight: "100vh", background: "#f5f6fa", padding: 24 }}>
//         <Routes>
//           <Route path="company" element={<TenantTable />} />
//           <Route path="account/user" element={<UserTable />} />
//           <Route path="account/group" element={<GroupTable />} />
//           <Route path="settings" element={<div>Coming soon...</div>} />
//           <Route index element={<Navigate to="company" replace />} />
//         </Routes>
//       </Layout.Content>
//     </Layout>
//   </Layout>
// );

// export default AdminSite;