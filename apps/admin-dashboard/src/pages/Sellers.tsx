import { useState, useEffect } from 'react';
import { Search, CheckCircle, XCircle, Eye, Clock } from 'lucide-react';
import Sidebar from '../components/layout/Sidebar';
import Header from '../components/layout/Header';

interface Seller {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  shopName: string;
  status: 'pending' | 'approved' | 'rejected';
  submittedAt: string;
  documents?: string[];
}

export default function SellersPage() {
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [selectedSeller, setSelectedSeller] = useState<Seller | null>(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    fetchSellers();
  }, [filter]);

  const fetchSellers = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const url = `${import.meta.env.VITE_API_URL}/api/v1/admin/sellers${filter !== 'all' ? `?status=${filter}` : ''}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSellers(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching sellers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleVerification = async (sellerId: string, status: 'approved' | 'rejected', notes?: string) => {
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/v1/admin/sellers/${sellerId}/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status, notes }),
      });
      if (res.ok) {
        fetchSellers();
        setShowModal(false);
        setSelectedSeller(null);
      }
    } catch (error) {
      console.error('Error verifying seller:', error);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return { label: 'Menunggu', icon: Clock, color: 'bg-yellow-100 text-yellow-800' };
      case 'approved':
        return { label: 'Disetujui', icon: CheckCircle, color: 'bg-green-100 text-green-800' };
      case 'rejected':
        return { label: 'Ditolak', icon: XCircle, color: 'bg-red-100 text-red-800' };
      default:
        return { label: status, icon: Clock, color: 'bg-gray-100 text-gray-800' };
    }
  };

  const filteredSellers = sellers.filter(seller =>
    seller.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    seller.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    seller.shopName.toLowerCase().includes(searchQuery.toLowerCase())
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
        <Header title="Verifikasi Penjual" />

        <main className="p-6">
          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-yellow-50 rounded-xl p-4 border-l-4 border-yellow-500">
              <p className="text-sm text-yellow-700">Menunggu Verifikasi</p>
              <p className="text-2xl font-bold text-yellow-800">
                {sellers.filter(s => s.status === 'pending').length}
              </p>
            </div>
            <div className="bg-green-50 rounded-xl p-4 border-l-4 border-green-500">
              <p className="text-sm text-green-700">Terverifikasi</p>
              <p className="text-2xl font-bold text-green-800">
                {sellers.filter(s => s.status === 'approved').length}
              </p>
            </div>
            <div className="bg-blue-50 rounded-xl p-4 border-l-4 border-blue-500">
              <p className="text-sm text-blue-700">Total Penjual</p>
              <p className="text-2xl font-bold text-blue-800">{sellers.length}</p>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari penjual..."
                className="pl-10 pr-4 py-2 w-80 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500"
              />
            </div>
            <div className="flex gap-2">
              {(['all', 'pending', 'approved', 'rejected'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                    filter === f
                      ? 'bg-purple-600 text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {f === 'all' ? 'Semua' : f === 'pending' ? 'Menunggu' : f === 'approved' ? 'Disetujui' : 'Ditolak'}
                </button>
              ))}
            </div>
          </div>

          {/* Sellers Table */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Penjual</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nama Toko</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kontak</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tanggal Daftar</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredSellers.map((seller) => {
                    const status = getStatusBadge(seller.status);
                    const StatusIcon = status.icon;
                    return (
                      <tr key={seller.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div>
                            <p className="font-medium text-gray-800">{seller.fullName}</p>
                            <p className="text-sm text-gray-500">{seller.email}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-gray-600">{seller.shopName}</td>
                        <td className="px-6 py-4 text-gray-600">{seller.phone || '-'}</td>
                        <td className="px-6 py-4 text-sm text-gray-500">{formatDate(seller.submittedAt)}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs ${status.color}`}>
                            <StatusIcon className="w-3 h-3" />
                            {status.label}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {seller.status === 'pending' && (
                            <button
                              onClick={() => {
                                setSelectedSeller(seller);
                                setShowModal(true);
                              }}
                              className="text-purple-600 hover:text-purple-700 text-sm"
                            >
                              Verifikasi
                            </button>
                          )}
                          {seller.status !== 'pending' && (
                            <button className="text-gray-400 text-sm">Lihat Detail</button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {filteredSellers.length === 0 && (
              <div className="text-center py-12">
                <Store className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">Tidak ada data penjual</p>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Verification Modal */}
      {showModal && selectedSeller && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full">
            <div className="p-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-800">Verifikasi Penjual</h2>
            </div>
            <div className="p-4 space-y-4">
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-sm text-gray-500">Nama</p>
                <p className="font-medium">{selectedSeller.fullName}</p>
                <p className="text-sm text-gray-500 mt-2">Email</p>
                <p className="font-medium">{selectedSeller.email}</p>
                <p className="text-sm text-gray-500 mt-2">Nama Toko</p>
                <p className="font-medium">{selectedSeller.shopName}</p>
                <p className="text-sm text-gray-500 mt-2">Tanggal Daftar</p>
                <p className="font-medium">{formatDate(selectedSeller.submittedAt)}</p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => handleVerification(selectedSeller.id, 'rejected', 'Dokumen tidak lengkap')}
                  className="flex-1 bg-red-600 text-white py-2 rounded-lg hover:bg-red-700 transition"
                >
                  Tolak
                </button>
                <button
                  onClick={() => handleVerification(selectedSeller.id, 'approved')}
                  className="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition"
                >
                  Setujui
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}