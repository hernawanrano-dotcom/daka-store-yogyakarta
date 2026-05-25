import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AdminLayout from './layouts/AdminLayout';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AdminLayout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<div>Admin Dashboard</div>} />
          <Route path="sellers" element={<div>Seller Management</div>} />
          <Route path="users" element={<div>User Management</div>} />
          <Route path="products" element={<div>Product Management</div>} />
          <Route path="disputes" element={<div>Dispute Management</div>} />
          <Route path="reports" element={<div>Reports</div>} />
          <Route path="settings" element={<div>Settings</div>} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;