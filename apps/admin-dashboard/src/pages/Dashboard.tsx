import { useState, useEffect } from 'react';
import { 
  Users, 
  Store, 
  ShoppingBag, 
  DollarSign,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Clock,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import Sidebar from '../components/layout/Sidebar';
import Header from '../components/layout/Header';

interface DashboardStats {
  totalUsers: number;
  totalSellers: number;
  totalOrders: number;
  totalRevenue: number;
  pendingSellers: number;
  pendingDisputes: number;
  userGrowth: number;
  revenueGrowth: number;
}

interface SalesReport {
  date: string;
  sales: number;
  orders: number;
  platformFee: number;
}

interface CategorySales {
  name: string;
  value: number;
  color: string;
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    totalSellers: 0,
    totalOrders: 0,
    totalRevenue: 0,
    pendingSellers: 0,
    pendingDisputes: 0,
    userGrowth: 0,
    revenueGrowth: 0,
  });
  const [salesData, setSalesData] = useState<SalesReport[]>([]);
  const [categorySales, setCategorySales] = useState<CategorySales[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<'week' | 'month' | 'year'>('month');

  useEffect(() => {
    fetchDashboardData();
  }, [dateRange]);

  const getToken = () => localStorage.getItem('accessToken');

  const fetchDashboardData = async () => {
    try {
      const token = getToken();
      if (!token) {
        window.location.href = 'http://localhost:3001/auth/login?redirect=http://localhost:3003';
        return;
      }

      const res = await fetch(`${process.env.VITE_API_URL}/api/v1/admin/dashboard?range=${dateRange}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setStats(data.data.stats);
        setSalesData(data.data.salesData || []);
        setCategorySales(data.data.categorySales || []);
      }
    } catch (error) {
      console.error('Error fetching admin dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('id-ID').format(price);
  };

  const COLORS = ['#8B5CF6', '#7C3AED', '#6D28D9', '#A78BFA', '#C4B5FD'];

  const StatCard = ({ title, value, icon: Icon, growth, subtitle }: any) => (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="p-3 bg-purple-100 rounded-lg">
          <Icon className="w-6 h-6 text-purple-600" />
        </div>
        {growth !== undefined && (
          <div className={`flex items-center gap-1 text-sm ${growth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {growth >= 0 ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
            <span>{Math.abs(growth)}%</span>
          </div>
        )}
      </div>
      <h3 className="text-2xl font-bold text-gray-800">{value}</h3>
      <p className="text-gray-500 text-sm mt-1">{title}</p>
      {subtitle && <p className="text-xs text-gray-400 mt-2">{subtitle}</p>}
    </div>
  );

  if (loading) {
    return (
      <div className="flex h-screen bg-gray-50">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      
      <div className="flex-1 overflow-auto">
        <Header title="Admin Dashboard" />

        <main className="p-6">
          {/* Date Range Filter */}
          <div className="flex justify-end mb-6">
            <div className="flex bg-white rounded-lg shadow-sm p-1">
              {(['week', 'month', 'year'] as const).map((range) => (
                <button
                  key={range}
                  onClick={() => setDateRange(range)}
                  className={`px-4 py-2 text-sm rounded-lg transition ${
                    dateRange === range
                      ? 'bg-purple-600 text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {range === 'week' ? 'Minggu Ini' : range === 'month' ? 'Bulan Ini' : 'Tahun Ini'}
                </button>
              ))}
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <StatCard
              title="Total Pengguna"
              value={stats.totalUsers.toLocaleString()}
              icon={Users}
              growth={stats.userGrowth}
            />
            <StatCard
              title="Total Penjual"
              value={stats.totalSellers.toLocaleString()}
              icon={Store}
            />
            <StatCard
              title="Total Pesanan"
              value={stats.totalOrders.toLocaleString()}
              icon={ShoppingBag}
            />
            <StatCard
              title="Pendapatan Platform"
              value={`Rp${formatPrice(stats.totalRevenue)}`}
              icon={DollarSign}
              growth={stats.revenueGrowth}
            />
          </div>

          {/* Alert Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="bg-yellow-50 rounded-xl shadow-sm p-6 border-l-4 border-yellow-500">
              <div className="flex items-center gap-3 mb-2">
                <Clock className="w-5 h-5 text-yellow-600" />
                <h3 className="font-semibold text-yellow-800">Verifikasi Penjual Pending</h3>
              </div>
              <p className="text-2xl font-bold text-yellow-700">{stats.pendingSellers}</p>
              <p className="text-sm text-yellow-600 mt-2">Menunggu verifikasi dokumen</p>
            </div>
            
            <div className="bg-red-50 rounded-xl shadow-sm p-6 border-l-4 border-red-500">
              <div className="flex items-center gap-3 mb-2">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                <h3 className="font-semibold text-red-800">Dispute Aktif</h3>
              </div>
              <p className="text-2xl font-bold text-red-700">{stats.pendingDisputes}</p>
              <p className="text-sm text-red-600 mt-2">Perlu ditangani segera</p>
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            {/* Sales Chart */}
            <div className="lg:col-span-2 bg-white rounded-xl shadow-sm p-6">
              <h3 className="text-lg font-bold text-gray-800 mb-4">Grafik Pendapatan Platform</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={salesData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip formatter={(value: number) => `Rp${formatPrice(value)}`} />
                  <Line
                    type="monotone"
                    dataKey="platformFee"
                    stroke="#8B5CF6"
                    strokeWidth={2}
                    dot={{ fill: '#8B5CF6', r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Category Sales Pie */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="text-lg font-bold text-gray-800 mb-4">Penjualan per Kategori</h3>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={categorySales}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {categorySales.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => `${value}%`} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-4 space-y-2">
                {categorySales.map((cat, idx) => (
                  <div key={idx} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                      <span>{cat.name}</span>
                    </div>
                    <span className="font-medium">{cat.value}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="font-semibold text-gray-800 mb-3">Aksi Cepat</h3>
              <div className="space-y-2">
                <button className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-purple-50 rounded-lg transition">
                  Verifikasi Penjual Baru
                </button>
                <button className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-purple-50 rounded-lg transition">
                  Buat Voucher Marketplace
                </button>
                <button className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-purple-50 rounded-lg transition">
                  Kelola Dispute
                </button>
                <button className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-purple-50 rounded-lg transition">
                  Export Laporan Bulanan
                </button>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="font-semibold text-gray-800 mb-3">Ringkasan Hari Ini</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-500">Pesanan Baru</span>
                  <span className="font-medium text-gray-800">-</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Pengguna Baru</span>
                  <span className="font-medium text-gray-800">-</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Pendapatan Platform</span>
                  <span className="font-medium text-gray-800">-</span>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-r from-purple-600 to-purple-800 rounded-xl shadow-sm p-6 text-white">
              <h3 className="font-semibold mb-2">Total Pendapatan Platform</h3>
              <p className="text-3xl font-bold">Rp{formatPrice(stats.totalRevenue)}</p>
              <p className="text-purple-200 text-sm mt-2">Year to Date</p>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}