import { Outlet } from 'react-router-dom';

export default function DashboardLayout() {
  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <aside className="w-64 bg-primary-700 text-white">
        <div className="p-4 text-xl font-bold border-b border-primary-600">
          Daka Seller
        </div>
        <nav className="p-4">
          <ul className="space-y-2">
            <li><a href="/dashboard" className="block p-2 hover:bg-primary-600 rounded">Dashboard</a></li>
            <li><a href="/products" className="block p-2 hover:bg-primary-600 rounded">Produk</a></li>
            <li><a href="/orders" className="block p-2 hover:bg-primary-600 rounded">Pesanan</a></li>
            <li><a href="/withdraw" className="block p-2 hover:bg-primary-600 rounded">Penarikan</a></li>
            <li><a href="/settings" className="block p-2 hover:bg-primary-600 rounded">Pengaturan</a></li>
          </ul>
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        <header className="bg-white shadow p-4">
          <h1 className="text-xl font-semibold">Seller Dashboard</h1>
        </header>
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}