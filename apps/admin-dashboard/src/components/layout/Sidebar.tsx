import { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  Store, 
  Package, 
  Ticket, 
  Truck, 
  AlertTriangle, 
  FileText, 
  Settings, 
  LogOut,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

interface MenuItem {
  icon: React.ReactNode;
  label: string;
  href: string;
}

const menuItems: MenuItem[] = [
  { icon: <LayoutDashboard className="w-5 h-5" />, label: 'Dashboard', href: '/' },
  { icon: <Users className="w-5 h-5" />, label: 'Pengguna', href: '/users' },
  { icon: <Store className="w-5 h-5" />, label: 'Verifikasi Penjual', href: '/sellers' },
  { icon: <Package className="w-5 h-5" />, label: 'Produk', href: '/products' },
  { icon: <Ticket className="w-5 h-5" />, label: 'Voucher', href: '/vouchers' },
  { icon: <Truck className="w-5 h-5" />, label: 'Kurir', href: '/couriers' },
  { icon: <AlertTriangle className="w-5 h-5" />, label: 'Dispute', href: '/disputes' },
  { icon: <FileText className="w-5 h-5" />, label: 'Laporan', href: '/reports' },
  { icon: <Settings className="w-5 h-5" />, label: 'Pengaturan', href: '/settings' },
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);

  const handleLogout = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      await fetch(`${import.meta.env.VITE_API_URL}/api/v1/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (error) {
      console.error('Error logging out:', error);
    } finally {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      window.location.href = 'http://localhost:3001/auth/login?redirect=http://localhost:3003';
    }
  };

  return (
    <aside className={`bg-gray-900 text-white transition-all duration-300 ${collapsed ? 'w-20' : 'w-64'} flex flex-col`}>
      {/* Logo */}
      <div className={`flex items-center ${collapsed ? 'justify-center' : 'justify-between'} p-4 border-b border-gray-800`}>
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-r from-purple-600 to-purple-800 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">D</span>
            </div>
            <span className="font-bold text-white">
              Daka<span className="text-purple-500">Admin</span>
            </span>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1 rounded-lg hover:bg-gray-800 transition"
        >
          {collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4">
        <ul className="space-y-1">
          {menuItems.map((item, idx) => (
            <li key={idx}>
              <Link
                to={item.href}
                className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3'} px-4 py-3 text-gray-300 hover:bg-gray-800 hover:text-white transition group`}
              >
                {item.icon}
                {!collapsed && <span>{item.label}</span>}
                {collapsed && (
                  <span className="absolute left-full ml-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition whitespace-nowrap z-50">
                    {item.label}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* Logout */}
      <div className="p-4 border-t border-gray-800">
        <button
          onClick={handleLogout}
          className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3'} w-full px-4 py-3 text-gray-300 hover:bg-gray-800 hover:text-white rounded-lg transition`}
        >
          <LogOut className="w-5 h-5" />
          {!collapsed && <span>Keluar</span>}
        </button>
      </div>
    </aside>
  );
}