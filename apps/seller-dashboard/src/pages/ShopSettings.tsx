import { useState, useEffect } from 'react';
import { Store, Upload, Save, AlertCircle } from 'lucide-react';
import Sidebar from '../components/layout/Sidebar';
import Header from '../components/layout/Header';

interface ShopData {
  name: string;
  description: string;
  logo?: string;
  banner?: string;
  address: string;
  phone: string;
  email: string;
  isActive: boolean;
}

export default function ShopSettingsPage() {
  const [shop, setShop] = useState<ShopData>({
    name: '',
    description: '',
    address: '',
    phone: '',
    email: '',
    isActive: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchShopData();
  }, []);

  const fetchShopData = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/v1/seller/shop`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setShop(data.data);
        setLogoPreview(data.data.logo);
        setBannerPreview(data.data.banner);
      }
    } catch (error) {
      console.error('Error fetching shop data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccess('');

    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/v1/seller/shop`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(shop),
      });

      if (res.ok) {
        setSuccess('Pengaturan toko berhasil disimpan');
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (error) {
      console.error('Error saving shop settings:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleImageUpload = async (file: File, type: 'logo' | 'banner') => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);

    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/v1/upload/shop-image`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        if (type === 'logo') {
          setShop({ ...shop, logo: data.data.url });
          setLogoPreview(data.data.url);
        } else {
          setShop({ ...shop, banner: data.data.url });
          setBannerPreview(data.data.url);
        }
      }
    } catch (error) {
      console.error('Error uploading image:', error);
    }
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
        <Header title="Pengaturan Toko" />

        <main className="p-6">
          <div className="max-w-3xl mx-auto">
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              {/* Banner Preview */}
              <div className="relative h-48 bg-gradient-to-r from-purple-600 to-purple-800">
                {bannerPreview && (
                  <img src={bannerPreview} alt="Banner" className="w-full h-48 object-cover" />
                )}
                <label className="absolute bottom-4 right-4 bg-black bg-opacity-50 text-white px-3 py-1 rounded-lg text-sm cursor-pointer hover:bg-opacity-70 transition">
                  <Upload className="w-4 h-4 inline mr-1" />
                  Ganti Banner
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleImageUpload(file, 'banner');
                    }}
                  />
                </label>
              </div>

              {/* Logo */}
              <div className="px-6 pb-6">
                <div className="flex justify-between items-start -mt-12 mb-6">
                  <div className="relative">
                    <div className="w-24 h-24 bg-white rounded-xl shadow-lg overflow-hidden border-4 border-white">
                      {logoPreview ? (
                        <img src={logoPreview} alt="Logo" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                          <Store className="w-10 h-10 text-gray-400" />
                        </div>
                      )}
                    </div>
                    <label className="absolute -bottom-2 -right-2 bg-purple-600 text-white p-1 rounded-full cursor-pointer hover:bg-purple-700 transition">
                      <Upload className="w-3 h-3" />
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleImageUpload(file, 'logo');
                        }}
                      />
                    </label>
                  </div>
                </div>

                {success && (
                  <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-600 text-sm flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    {success}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nama Toko
                    </label>
                    <input
                      type="text"
                      value={shop.name}
                      onChange={(e) => setShop({ ...shop, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Deskripsi Toko
                    </label>
                    <textarea
                      rows={4}
                      value={shop.description}
                      onChange={(e) => setShop({ ...shop, description: e.target.value })}
                      placeholder="Ceritakan tentang toko Anda..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Alamat Toko
                    </label>
                    <textarea
                      rows={2}
                      value={shop.address}
                      onChange={(e) => setShop({ ...shop, address: e.target.value })}
                      placeholder="Alamat lengkap toko Anda"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Nomor Telepon
                      </label>
                      <input
                        type="tel"
                        value={shop.phone}
                        onChange={(e) => setShop({ ...shop, phone: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Email
                      </label>
                      <input
                        type="email"
                        value={shop.email}
                        onChange={(e) => setShop({ ...shop, email: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="isActive"
                      checked={shop.isActive}
                      onChange={(e) => setShop({ ...shop, isActive: e.target.checked })}
                      className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                    />
                    <label htmlFor="isActive" className="text-sm text-gray-700">
                      Toko Aktif (dapat dilihat oleh pembeli)
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={saving}
                    className="w-full bg-purple-600 text-white py-3 rounded-lg font-semibold hover:bg-purple-700 transition disabled:bg-gray-300"
                  >
                    {saving ? (
                      <div className="flex items-center justify-center gap-2">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        Menyimpan...
                      </div>
                    ) : (
                      <span className="flex items-center justify-center gap-2">
                        <Save className="w-4 h-4" />
                        Simpan Pengaturan
                      </span>
                    )}
                  </button>
                </form>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}