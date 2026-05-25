import { useState, useEffect } from 'react';
import { 
  Truck, 
  CheckCircle, 
  XCircle, 
  Edit, 
  Save,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import Sidebar from '../components/layout/Sidebar';
import Header from '../components/layout/Header';

interface Courier {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  hasWebhook: boolean;
  basePrice: number;
  pricePerKg: number;
  estimatedDaysMin: number;
  estimatedDaysMax: number;
  supportedPaymentMethods: string[];
  apiStatus: 'healthy' | 'degraded' | 'down';
  lastCheckAt?: string;
}

export default function CouriersPage() {
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Courier>>({});
  const [testing, setTesting] = useState<string | null>(null);

  useEffect(() => {
    fetchCouriers();
  }, []);

  const fetchCouriers = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/v1/admin/couriers`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setCouriers(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching couriers:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateCourier = async (id: string, data: Partial<Courier>) => {
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/v1/admin/couriers/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        fetchCouriers();
        setEditingId(null);
      }
    } catch (error) {
      console.error('Error updating courier:', error);
    }
  };

  const toggleCourierStatus = async (id: string, currentStatus: boolean) => {
    await updateCourier(id, { isActive: !currentStatus });
  };

  const testCourierAPI = async (code: string) => {
    setTesting(code);
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/v1/admin/couriers/${code}/test`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        fetchCouriers();
        alert(`API ${code} berhasil diuji dan responsif`);
      } else {
        alert(`API ${code} gagal dihubungi`);
      }
    } catch (error) {
      alert(`Error: ${error}`);
    } finally {
      setTesting(null);
    }
  };

  const getApiStatusBadge = (status: string) => {
    switch (status) {
      case 'healthy':
        return { label: 'Normal', color: 'bg-green-100 text-green-700', icon: CheckCircle };
      case 'degraded':
        return { label: 'Gangguan', color: 'bg-yellow-100 text-yellow-700', icon: AlertCircle };
      case 'down':
        return { label: 'Down', color: 'bg-red-100 text-red-700', icon: XCircle };
      default:
        return { label: 'Unknown', color: 'bg-gray-100 text-gray-700', icon: AlertCircle };
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('id-ID').format(price);
  };

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
        <Header title="Manajemen Kurir" />

        <main className="p-6">
          {/* Info Card */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
            <div className="flex items-start gap-3">
              <Truck className="w-5 h-5 text-blue-600 mt-0.5" />
              <div>
                <h3 className="font-semibold text-blue-800">Informasi Kurir</h3>
                <p className="text-sm text-blue-700">
                  Kelola kurir yang tersedia untuk pengiriman. Nonaktifkan kurir yang sedang bermasalah.
                  Kurir dengan webhook akan menerima notifikasi otomatis, kurir tanpa webhook akan di-polling setiap 5 menit.
                </p>
              </div>
            </div>
          </div>

          {/* Couriers List */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {couriers.map((courier) => {
              const status = getApiStatusBadge(courier.apiStatus);
              const StatusIcon = status.icon;
              const isEditing = editingId === courier.id;
              
              return (
                <div key={courier.id} className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100">
                  <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                          <Truck className="w-5 h-5 text-purple-600" />
                        </div>
                        <div>
                          <h3 className="font-bold text-gray-800">{courier.name}</h3>
                          <p className="text-xs text-gray-400 font-mono">{courier.code}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleCourierStatus(courier.id, courier.isActive)}
                          className={`px-2 py-1 text-xs rounded-full ${
                            courier.isActive
                              ? 'bg-green-100 text-green-700'
                              : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {courier.isActive ? 'Aktif' : 'Nonaktif'}
                        </button>
                        <button
                          onClick={() => testCourierAPI(courier.code)}
                          disabled={testing === courier.code}
                          className="p-1 text-gray-400 hover:text-purple-600 transition"
                        >
                          {testing === courier.code ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : (
                            <RefreshCw className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Status API</span>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${status.color}`}>
                        <StatusIcon className="w-3 h-3" />
                        {status.label}
                      </span>
                    </div>

                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Webhook</span>
                      <span className={courier.hasWebhook ? 'text-green-600' : 'text-yellow-600'}>
                        {courier.hasWebhook ? 'Tersedia' : 'Polling (5 menit)'}
                      </span>
                    </div>

                    {isEditing ? (
                      <>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Harga Dasar (Rp)</label>
                          <input
                            type="number"
                            value={editForm.basePrice ?? courier.basePrice}
                            onChange={(e) => setEditForm({ ...editForm, basePrice: parseInt(e.target.value) })}
                            className="w-full px-3 py-1 text-sm border border-gray-300 rounded-lg"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Harga per Kg (Rp)</label>
                          <input
                            type="number"
                            value={editForm.pricePerKg ?? courier.pricePerKg}
                            onChange={(e) => setEditForm({ ...editForm, pricePerKg: parseInt(e.target.value) })}
                            className="w-full px-3 py-1 text-sm border border-gray-300 rounded-lg"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Min Hari</label>
                            <input
                              type="number"
                              value={editForm.estimatedDaysMin ?? courier.estimatedDaysMin}
                              onChange={(e) => setEditForm({ ...editForm, estimatedDaysMin: parseInt(e.target.value) })}
                              className="w-full px-3 py-1 text-sm border border-gray-300 rounded-lg"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Max Hari</label>
                            <input
                              type="number"
                              value={editForm.estimatedDaysMax ?? courier.estimatedDaysMax}
                              onChange={(e) => setEditForm({ ...editForm, estimatedDaysMax: parseInt(e.target.value) })}
                              className="w-full px-3 py-1 text-sm border border-gray-300 rounded-lg"
                            />
                          </div>
                        </div>
                        <div className="flex gap-2 pt-2">
                          <button
                            onClick={() => setEditingId(null)}
                            className="flex-1 px-3 py-1 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50 transition"
                          >
                            Batal
                          </button>
                          <button
                            onClick={() => updateCourier(courier.id, editForm)}
                            className="flex-1 bg-purple-600 text-white py-1 rounded-lg text-sm hover:bg-purple-700 transition flex items-center justify-center gap-1"
                          >
                            <Save className="w-3 h-3" />
                            Simpan
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">Tarif Dasar</span>
                          <span className="font-medium">Rp{formatPrice(courier.basePrice)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">Per Kg</span>
                          <span className="font-medium">Rp{formatPrice(courier.pricePerKg)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">Estimasi</span>
                          <span>{courier.estimatedDaysMin} - {courier.estimatedDaysMax} hari</span>
                        </div>
                        <button
                          onClick={() => {
                            setEditingId(courier.id);
                            setEditForm({});
                          }}
                          className="w-full mt-2 flex items-center justify-center gap-1 text-purple-600 text-sm hover:text-purple-700 transition"
                        >
                          <Edit className="w-3 h-3" />
                          Edit Tarif
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </main>
      </div>
    </div>
  );
}