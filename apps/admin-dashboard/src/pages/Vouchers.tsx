import { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  Tag, 
  X,
  Calendar,
  Users,
  Infinity
} from 'lucide-react';
import Sidebar from '../components/layout/Sidebar';
import Header from '../components/layout/Header';

interface Voucher {
  id: string;
  code: string;
  name: string;
  type: 'MARKETPLACE' | 'SELLER';
  discountType: 'PERCENTAGE' | 'FIXED_AMOUNT' | 'FREE_SHIPPING';
  discountValue: number;
  maxDiscount?: number;
  minSpend: number;
  usageLimit?: number;
  usedCount: number;
  perUserLimit: number;
  startDate: string;
  endDate: string;
  isActive: boolean;
  sellerId?: string;
  sellerName?: string;
}

export default function VouchersPage() {
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingVoucher, setEditingVoucher] = useState<Voucher | null>(null);
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    discountType: 'PERCENTAGE',
    discountValue: '',
    maxDiscount: '',
    minSpend: '',
    usageLimit: '',
    perUserLimit: '1',
    startDate: '',
    endDate: '',
  });

  useEffect(() => {
    fetchVouchers();
  }, []);

  const fetchVouchers = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/v1/admin/vouchers`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setVouchers(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching vouchers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('accessToken');
      const url = editingVoucher 
        ? `${import.meta.env.VITE_API_URL}/api/v1/admin/vouchers/${editingVoucher.id}`
        : `${import.meta.env.VITE_API_URL}/api/v1/admin/vouchers`;
      
      const res = await fetch(url, {
        method: editingVoucher ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          code: formData.code.toUpperCase(),
          name: formData.name,
          discountType: formData.discountType,
          discountValue: parseInt(formData.discountValue),
          maxDiscount: formData.maxDiscount ? parseInt(formData.maxDiscount) : undefined,
          minSpend: parseInt(formData.minSpend),
          usageLimit: formData.usageLimit ? parseInt(formData.usageLimit) : undefined,
          perUserLimit: parseInt(formData.perUserLimit),
          startDate: new Date(formData.startDate),
          endDate: new Date(formData.endDate),
          type: 'MARKETPLACE',
        }),
      });

      if (res.ok) {
        fetchVouchers();
        setShowModal(false);
        setEditingVoucher(null);
        resetForm();
      }
    } catch (error) {
      console.error('Error saving voucher:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus voucher ini?')) return;
    
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/v1/admin/vouchers/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        fetchVouchers();
      }
    } catch (error) {
      console.error('Error deleting voucher:', error);
    }
  };

  const toggleStatus = async (id: string, currentStatus: boolean) => {
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/v1/admin/vouchers/${id}/toggle`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ isActive: !currentStatus }),
      });
      if (res.ok) {
        fetchVouchers();
      }
    } catch (error) {
      console.error('Error toggling voucher status:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      code: '',
      name: '',
      discountType: 'PERCENTAGE',
      discountValue: '',
      maxDiscount: '',
      minSpend: '',
      usageLimit: '',
      perUserLimit: '1',
      startDate: '',
      endDate: '',
    });
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('id-ID').format(price);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const getDiscountText = (voucher: Voucher) => {
    if (voucher.discountType === 'PERCENTAGE') {
      return `${voucher.discountValue}% ${voucher.maxDiscount ? `(Max Rp${formatPrice(voucher.maxDiscount)})` : ''}`;
    } else if (voucher.discountType === 'FIXED_AMOUNT') {
      return `Rp${formatPrice(voucher.discountValue)}`;
    } else {
      return 'Gratis Ongkir';
    }
  };

  const filteredVouchers = vouchers.filter(v =>
    v.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.name.toLowerCase().includes(searchQuery.toLowerCase())
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
        <Header title="Manajemen Voucher" />

        <main className="p-6">
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari voucher..."
                className="pl-10 pr-4 py-2 w-80 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500"
              />
            </div>
            <button
              onClick={() => {
                setEditingVoucher(null);
                resetForm();
                setShowModal(true);
              }}
              className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition"
            >
              <Plus className="w-4 h-4" />
              Buat Voucher
            </button>
          </div>

          {/* Vouchers Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredVouchers.map((voucher) => (
              <div key={voucher.id} className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100">
                <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-purple-50 to-white">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs text-purple-600 font-mono">{voucher.code}</span>
                      <h3 className="font-bold text-gray-800 mt-1">{voucher.name}</h3>
                    </div>
                    <button
                      onClick={() => toggleStatus(voucher.id, voucher.isActive)}
                      className={`px-2 py-1 text-xs rounded-full ${
                        voucher.isActive
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {voucher.isActive ? 'Aktif' : 'Nonaktif'}
                    </button>
                  </div>
                </div>
                
                <div className="p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Diskon</span>
                    <span className="font-medium text-purple-600">{getDiscountText(voucher)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Min. Belanja</span>
                    <span>Rp{formatPrice(voucher.minSpend)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Periode</span>
                    <span className="text-xs">
                      {formatDate(voucher.startDate)} - {formatDate(voucher.endDate)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Penggunaan</span>
                    <span>
                      {voucher.usedCount} / {voucher.usageLimit || '∞'}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Per User</span>
                    <span>{voucher.perUserLimit} kali</span>
                  </div>
                </div>

                <div className="flex border-t border-gray-100">
                  <button
                    onClick={() => {
                      setEditingVoucher(voucher);
                      setFormData({
                        code: voucher.code,
                        name: voucher.name,
                        discountType: voucher.discountType,
                        discountValue: voucher.discountValue.toString(),
                        maxDiscount: voucher.maxDiscount?.toString() || '',
                        minSpend: voucher.minSpend.toString(),
                        usageLimit: voucher.usageLimit?.toString() || '',
                        perUserLimit: voucher.perUserLimit.toString(),
                        startDate: voucher.startDate.split('T')[0],
                        endDate: voucher.endDate.split('T')[0],
                      });
                      setShowModal(true);
                    }}
                    className="flex-1 py-2 text-center text-sm text-gray-600 hover:bg-gray-50 transition"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(voucher.id)}
                    className="flex-1 py-2 text-center text-sm text-red-600 hover:bg-red-50 transition"
                  >
                    Hapus
                  </button>
                </div>
              </div>
            ))}
          </div>

          {filteredVouchers.length === 0 && (
            <div className="bg-white rounded-xl shadow-sm p-12 text-center">
              <Tag className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Belum ada voucher</p>
              <button
                onClick={() => setShowModal(true)}
                className="mt-4 text-purple-600 hover:text-purple-700"
              >
                + Buat Voucher Pertama
              </button>
            </div>
          )}
        </main>
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-auto">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-800">
                {editingVoucher ? 'Edit Voucher' : 'Buat Voucher Baru'}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Kode Voucher</label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  placeholder="CONTOH10"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500 uppercase"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nama Voucher</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Diskon 10%"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipe Diskon</label>
                  <select
                    value={formData.discountType}
                    onChange={(e) => setFormData({ ...formData, discountType: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500"
                  >
                    <option value="PERCENTAGE">Persentase (%)</option>
                    <option value="FIXED_AMOUNT">Nominal (Rp)</option>
                    <option value="FREE_SHIPPING">Gratis Ongkir</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {formData.discountType === 'PERCENTAGE' ? 'Diskon (%)' : 
                     formData.discountType === 'FIXED_AMOUNT' ? 'Diskon (Rp)' : 'Keterangan'}
                  </label>
                  <input
                    type="number"
                    value={formData.discountValue}
                    onChange={(e) => setFormData({ ...formData, discountValue: e.target.value })}
                    placeholder={formData.discountType === 'PERCENTAGE' ? '10' : '50000'}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500"
                    required={formData.discountType !== 'FREE_SHIPPING'}
                    disabled={formData.discountType === 'FREE_SHIPPING'}
                  />
                </div>
              </div>

              {formData.discountType === 'PERCENTAGE' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Maksimal Diskon (Rp)</label>
                  <input
                    type="number"
                    value={formData.maxDiscount}
                    onChange={(e) => setFormData({ ...formData, maxDiscount: e.target.value })}
                    placeholder="50000"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Minimal Belanja (Rp)</label>
                <input
                  type="number"
                  value={formData.minSpend}
                  onChange={(e) => setFormData({ ...formData, minSpend: e.target.value })}
                  placeholder="100000"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Batas Penggunaan</label>
                  <input
                    type="number"
                    value={formData.usageLimit}
                    onChange={(e) => setFormData({ ...formData, usageLimit: e.target.value })}
                    placeholder="1000"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Per User (kali)</label>
                  <input
                    type="number"
                    value={formData.perUserLimit}
                    onChange={(e) => setFormData({ ...formData, perUserLimit: e.target.value })}
                    placeholder="1"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal Mulai</label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal Berakhir</label>
                  <input
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500"
                    required
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-purple-600 text-white py-2 rounded-lg hover:bg-purple-700 transition"
                >
                  {editingVoucher ? 'Simpan Perubahan' : 'Buat Voucher'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}