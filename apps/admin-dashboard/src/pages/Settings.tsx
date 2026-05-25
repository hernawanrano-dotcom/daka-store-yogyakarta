import { useState, useEffect } from 'react';
import { 
  DollarSign, 
  Percent, 
  Shield, 
  Mail, 
  CreditCard,
  Save,
  RefreshCw,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import Sidebar from '../components/layout/Sidebar';
import Header from '../components/layout/Header';

interface PlatformSettings {
  platformFeePercentage: number;
  platformFeeMin: number;
  platformFeeMax: number;
  withdrawMinAmount: number;
  withdrawMaxAmount: number;
  withdrawProcessingDays: number;
  disputeResponseDays: number;
  disputeAutoResolveDays: number;
  autoCompleteDays: number;
  checkoutExpiryMinutes: number;
  maxCartItems: number;
  maxQuantityPerItem: number;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<PlatformSettings>({
    platformFeePercentage: 3,
    platformFeeMin: 1000,
    platformFeeMax: 50000,
    withdrawMinAmount: 50000,
    withdrawMaxAmount: 10000000,
    withdrawProcessingDays: 3,
    disputeResponseDays: 3,
    disputeAutoResolveDays: 14,
    autoCompleteDays: 7,
    checkoutExpiryMinutes: 1440,
    maxCartItems: 50,
    maxQuantityPerItem: 999,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/v1/admin/settings`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSettings(data.data);
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSuccess('');
    setError('');

    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/v1/admin/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(settings),
      });

      if (res.ok) {
        setSuccess('Pengaturan berhasil disimpan');
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError('Gagal menyimpan pengaturan');
      }
    } catch (error) {
      setError('Terjadi kesalahan');
    } finally {
      setSaving(false);
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
        <Header title="Pengaturan Platform" />

        <main className="p-6">
          <div className="max-w-4xl mx-auto">
            {/* Success/Error Messages */}
            {success && (
              <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-600 text-sm flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                {success}
              </div>
            )}
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}

            {/* Platform Fee Settings */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-6">
              <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-purple-50 to-white">
                <div className="flex items-center gap-2">
                  <Percent className="w-5 h-5 text-purple-600" />
                  <h2 className="text-lg font-bold text-gray-800">Biaya Platform</h2>
                </div>
              </div>
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Fee Percentage (%)
                    </label>
                    <input
                      type="number"
                      value={settings.platformFeePercentage}
                      onChange={(e) => setSettings({ ...settings, platformFeePercentage: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500"
                      step="0.5"
                    />
                    <p className="text-xs text-gray-400 mt-1">Persentase dari total transaksi</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Minimum Fee (Rp)
                    </label>
                    <input
                      type="number"
                      value={settings.platformFeeMin}
                      onChange={(e) => setSettings({ ...settings, platformFeeMin: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500"
                    />
                    <p className="text-xs text-gray-400 mt-1">Fee minimal per transaksi</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Maksimum Fee (Rp)
                    </label>
                    <input
                      type="number"
                      value={settings.platformFeeMax}
                      onChange={(e) => setSettings({ ...settings, platformFeeMax: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500"
                    />
                    <p className="text-xs text-gray-400 mt-1">Fee maksimal per transaksi</p>
                  </div>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600">
                    Contoh: Transaksi Rp100.000 → Fee = Rp{formatPrice(Math.min(
                      Math.max(Math.floor(100000 * settings.platformFeePercentage / 100), settings.platformFeeMin),
                      settings.platformFeeMax
                    ))}
                  </p>
                </div>
              </div>
            </div>

            {/* Withdraw Settings */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-6">
              <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-purple-50 to-white">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-purple-600" />
                  <h2 className="text-lg font-bold text-gray-800">Penarikan Saldo</h2>
                </div>
              </div>
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Minimal Penarikan (Rp)
                    </label>
                    <input
                      type="number"
                      value={settings.withdrawMinAmount}
                      onChange={(e) => setSettings({ ...settings, withdrawMinAmount: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Maksimal Penarikan (Rp)
                    </label>
                    <input
                      type="number"
                      value={settings.withdrawMaxAmount}
                      onChange={(e) => setSettings({ ...settings, withdrawMaxAmount: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Hari Proses
                    </label>
                    <input
                      type="number"
                      value={settings.withdrawProcessingDays}
                      onChange={(e) => setSettings({ ...settings, withdrawProcessingDays: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Dispute & Auto Complete Settings */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-6">
              <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-purple-50 to-white">
                <div className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-purple-600" />
                  <h2 className="text-lg font-bold text-gray-800">Dispute & Auto Complete</h2>
                </div>
              </div>
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Respon Dispute (hari)
                    </label>
                    <input
                      type="number"
                      value={settings.disputeResponseDays}
                      onChange={(e) => setSettings({ ...settings, disputeResponseDays: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500"
                    />
                    <p className="text-xs text-gray-400 mt-1">Waktu seller untuk merespon dispute</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Auto Resolve Dispute (hari)
                    </label>
                    <input
                      type="number"
                      value={settings.disputeAutoResolveDays}
                      onChange={(e) => setSettings({ ...settings, disputeAutoResolveDays: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500"
                    />
                    <p className="text-xs text-gray-400 mt-1">Dispute akan auto resolve jika tidak ada respon</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Auto Complete Order (hari)
                    </label>
                    <input
                      type="number"
                      value={settings.autoCompleteDays}
                      onChange={(e) => setSettings({ ...settings, autoCompleteDays: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500"
                    />
                    <p className="text-xs text-gray-400 mt-1">Order auto complete setelah delivered</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Checkout Settings */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-6">
              <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-purple-50 to-white">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-purple-600" />
                  <h2 className="text-lg font-bold text-gray-800">Checkout</h2>
                </div>
              </div>
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Expiry Checkout (menit)
                    </label>
                    <input
                      type="number"
                      value={settings.checkoutExpiryMinutes}
                      onChange={(e) => setSettings({ ...settings, checkoutExpiryMinutes: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Max Item per Cart
                    </label>
                    <input
                      type="number"
                      value={settings.maxCartItems}
                      onChange={(e) => setSettings({ ...settings, maxCartItems: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Max Qty per Item
                    </label>
                    <input
                      type="number"
                      value={settings.maxQuantityPerItem}
                      onChange={(e) => setSettings({ ...settings, maxQuantityPerItem: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 bg-purple-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-purple-700 transition disabled:bg-gray-300"
              >
                {saving ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Simpan Semua Pengaturan
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}