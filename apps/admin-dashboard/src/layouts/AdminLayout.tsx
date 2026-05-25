import { Outlet } from 'react-router-dom';

export default function AdminLayout() {
  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-900 text-white">
        <div className="p-4 text-xl font-bold border-b border-gray-700">
          Daka Admin
        </div>
        <nav className="p-4">
          <ul className="space-y-2">
            <li><a href="/dashboard" className="block p-2 hover:bg-gray-700 rounded">Dashboard</a></li>
            <li><a href="/sellers" className="block p-2 hover:bg-gray-700 rounded">Verifikasi Seller</a></li>
            <li><a href="/users" className="block p-2 hover:bg-gray-700 rounded">Manajemen User</a></li>
            <li><a href="/products" className="block p-2 hover:bg-gray-700 rounded">Manajemen Produk</a></li>
            <li><a href="/disputes" className="block p-2 hover:bg-gray-700 rounded">Dispute</a></li>
            <li><a href="/reports" className="block p-2 hover:bg-gray-700 rounded">Laporan</a></li>
            <li><a href="/settings" className="block p-2 hover:bg-gray-700 rounded">Pengaturan</a></li>
          </ul>
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        <header className="bg-white shadow p-4">
          <h1 className="text-xl font-semibold">Admin Dashboard</h1>
        </header>
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}