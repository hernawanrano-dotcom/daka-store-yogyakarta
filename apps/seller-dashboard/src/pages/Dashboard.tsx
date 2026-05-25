import { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  ShoppingBag, 
  Users, 
  Package, 
  DollarSign,
  ArrowUp,
  ArrowDown,
  Eye,
  Calendar
} from 'lucide-react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
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
  totalSales: number;
  totalOrders: number;
  totalProducts: number;
  totalCustomers: number;
  salesGrowth: number;
  ordersGrowth: number;
  productsGrowth: number;
  customersGrowth: number;
}

interface SalesData {
  date: string;
  sales: number;
  orders: number;
}

interface TopProduct {
  productName: string;
  soldCount: number;
  revenue: number;
  image: string;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    totalSales: 0,
    totalOrders: 0,
    totalProducts: 0,
    totalCustomers: 0,
    salesGrowth: 0,
    ordersGrowth: 0,
    productsGrowth: 0,
    customersGrowth: 0,
  });
  const [salesData, setSalesData] = useState<SalesData[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
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
        window.location.href = 'http://localhost:3001/auth/login?redirect=http://localhost:3002';
        return;
      }

      const res = await fetch(`${process.env.VITE_API_URL}/api/v1/seller/dashboard?range=${dateRange}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setStats(data.data.stats);
        setSalesData(data.data.salesData || []);
        setTopProducts(data.data.topProducts || []);
        setRecentOrders(data.data.recentOrders || []);
      }
    } catch (error) {
      console.error('Error fetching dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('id-ID').format(price);
  };

  const StatCard = ({ title, value, icon: Icon, growth, color }: any) => (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <div className={`p-3 rounded-lg ${color}`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
        <div className={`flex items-center gap-1 text-sm ${growth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          {growth >= 0 ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
          <span>{Math.abs(growth)}%</span>
        </div>
      </div>
      <h3 className="text-2xl font-bold text-gray-800">{value}</h3>
      <p className="text-gray-500 text-sm mt-1">{title}</p>
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
        <Header title="Dashboard" />

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
              title="Total Pendapatan"
              value={`Rp${formatPrice(stats.totalSales)}`}
              icon={DollarSign}
              growth={stats.salesGrowth}
              color="bg-green-500"
            />
            <StatCard
              title="Total Pesanan"
              value={stats.totalOrders.toLocaleString()}
              icon={ShoppingBag}
              growth={stats.ordersGrowth}
              color="bg-blue-500"
            />
            <StatCard
              title="Total Produk"
              value={stats.totalProducts.toLocaleString()}
              icon={Package}
              growth={stats.productsGrowth}
              color="bg-purple-500"
            />
            <StatCard
              title="Total Customer"
              value={stats.totalCustomers.toLocaleString()}
              icon={Users}
              growth={stats.customersGrowth}
              color="bg-orange-500"
            />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            {/* Sales Chart */}
            <div className="lg:col-span-2 bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-800">Grafik Penjualan</h3>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Calendar className="w-4 h-4" />
                  <span>Per Hari</span>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={salesData}>
                  <defs>
                    <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip formatter={(value: number) => `Rp${formatPrice(value)}`} />
                  <Area
                    type="monotone"
                    dataKey="sales"
                    stroke="#8B5CF6"
                    fillOpacity={1}
                    fill="url(#colorSales)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Top Products */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="text-lg font-bold text-gray-800 mb-4">Produk Terlaris</h3>
              <div className="space-y-4">
                {topProducts.slice(0, 5).map((product, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <div className="relative w-10 h-10 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                      <img src={product.image || '/placeholder.png'} alt={product.productName} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 line-clamp-1">{product.productName}</p>
                      <p className="text-xs text-gray-500">Terjual {product.soldCount}</p>
                    </div>
                    <span className="text-sm font-medium text-purple-600">Rp{formatPrice(product.revenue)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Recent Orders */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-800">Pesanan Terbaru</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pembeli</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tanggal</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {recentOrders.map((order) => (
                    <tr key={order.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-mono text-gray-600">{order.id.slice(-8)}</td>
                      <td className="px-6 py-4 text-sm text-gray-800">{order.buyerName}</td>
                      <td className="px-6 py-4 text-sm font-medium text-purple-600">Rp{formatPrice(order.grandTotal)}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2 py-1 text-xs rounded-full ${
                          order.status === 'PAID' ? 'bg-blue-100 text-blue-800' :
                          order.status === 'IN_TRANSIT' ? 'bg-orange-100 text-orange-800' :
                          order.status === 'DELIVERED' ? 'bg-green-100 text-green-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {order.status === 'PAID' ? 'Dibayar' :
                           order.status === 'IN_TRANSIT' ? 'Dikirim' :
                           order.status === 'DELIVERED' ? 'Diterima' : order.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {new Date(order.createdAt).toLocaleDateString('id-ID')}
                      </td>
                      <td className="px-6 py-4">
                        <button className="text-purple-600 hover:text-purple-700">
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}