import { useState, useEffect } from 'react';
import { Wallet, Banknote, History, CheckCircle, XCircle, Clock } from 'lucide-react';
import Sidebar from '../components/layout/Sidebar';
import Header from '../components/layout/Header';

interface WalletData {
  balance: number;
  pendingBalance: number;
  withdrawnBalance: number;
}

interface WithdrawHistory {
  id: string;
  amount: number;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'REJECTED';
  bankName: string;
  bankAccount: string;
  bankAccountName: string;
  notes?: string;
  createdAt: string;
  processedAt?: string;
}

export default function WithdrawPage() {
  const [wallet, setWallet] = useState<WalletData>({ balance: 0, pendingBalance: 0, withdrawnBalance: 0 });
  const [history, setHistory] = useState<WithdrawHistory[]>([]);
  const [amount, setAmount] = useState('');
  const [bankName, setBankName] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [bankAccountName, setBankAccountName] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchWalletData();
    fetchWithdrawHistory();
  }, []);

  const fetchWalletData = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/v1/wallet/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setWallet(data.data);
      }
    } catch (error) {
      console.error('Error fetching wallet:', error);
    }
  };

  const fetchWithdrawHistory = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/v1/wallet/withdraw/history`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setHistory(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching withdraw history:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    const withdrawAmount = parseInt(amount);
    const minWithdraw = 50000;
    const maxWithdraw = 10000000;

    if (withdrawAmount < minWithdraw) {
      setError(`Minimal penarikan Rp${formatPrice(minWithdraw)}`);
      return;
    }
    if (withdrawAmount > maxWithdraw) {
      setError(`Maksimal penarikan Rp${formatPrice(maxWithdraw)}`);
      return;
    }
    if (withdrawAmount > wallet.balance) {
      setError('Saldo tidak mencukupi');
      return;
    }

    setSubmitting(true);
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/v1/wallet/withdraw`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          amount: withdrawAmount,
          bankName,
          bankAccount,
          bankAccountName,
        }),
      });

      if (res.ok) {
        setAmount('');
        fetchWalletData();
        fetchWithdrawHistory();
        alert('Permintaan penarikan berhasil diajukan');
      } else {
        const data = await res.json();
        setError(data.message || 'Gagal mengajukan penarikan');
      }
    } catch (error) {
      setError('Terjadi kesalahan, silakan coba lagi');
    } finally {
      setSubmitting(false);
    }
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return { label: 'Menunggu', icon: Clock, color: 'bg-yellow-100 text-yellow-800' };
      case 'PROCESSING':
        return { label: 'Diproses', icon: Clock, color: 'bg-blue-100 text-blue-800' };
      case 'COMPLETED':
        return { label: 'Berhasil', icon: CheckCircle, color: 'bg-green-100 text-green-800' };
      case 'REJECTED':
        return { label: 'Ditolak', icon: XCircle, color: 'bg-red-100 text-red-800' };
      default:
        return { label: status, icon: Clock, color: 'bg-gray-100 text-gray-800' };
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
        <Header title="Penarikan Saldo" />

        <main className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - Withdraw Form */}
            <div className="lg:col-span-2">
              {/* Wallet Balance Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-gradient-to-r from-purple-600 to-purple-700 rounded-xl p-4 text-white">
                  <p className="text-sm opacity-80">Saldo Tersedia</p>
                  <p className="text-2xl font-bold">Rp{formatPrice(wallet.balance)}</p>
                </div>
                <div className="bg-white rounded-xl shadow-sm p-4">
                  <p className="text-sm text-gray-500">Saldo Ditahan</p>
                  <p className="text-xl font-bold text-gray-800">Rp{formatPrice(wallet.pendingBalance)}</p>
                  <p className="text-xs text-gray-400 mt-1">Dana akan cair setelah pesanan selesai</p>
                </div>
                <div className="bg-white rounded-xl shadow-sm p-4">
                  <p className="text-sm text-gray-500">Total Penarikan</p>
                  <p className="text-xl font-bold text-gray-800">Rp{formatPrice(wallet.withdrawnBalance)}</p>
                </div>
              </div>

              {/* Withdraw Form */}
              <div className="bg-white rounded-xl shadow-sm p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Banknote className="w-5 h-5 text-purple-600" />
                  <h2 className="text-lg font-bold text-gray-800">Form Penarikan Saldo</h2>
                </div>

                {error && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                    {error}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Jumlah Penarikan (Min Rp50.000)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">Rp</span>
                      <input
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="0"
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500"
                        required
                      />
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      Maksimal penarikan Rp10.000.000 per transaksi
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nama Bank</label>
                    <select
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500"
                      required
                    >
                      <option value="">Pilih Bank</option>
                      <option value="BCA">BCA</option>
                      <option value="Mandiri">Mandiri</option>
                      <option value="BRI">BRI</option>
                      <option value="BNI">BNI</option>
                      <option value="CIMB Niaga">CIMB Niaga</option>
                      <option value="Danamon">Danamon</option>
                      <option value="Permata">Permata</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nomor Rekening</label>
                    <input
                      type="text"
                      value={bankAccount}
                      onChange={(e) => setBankAccount(e.target.value)}
                      placeholder="1234567890"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nama Pemilik Rekening</label>
                    <input
                      type="text"
                      value={bankAccountName}
                      onChange={(e) => setBankAccountName(e.target.value)}
                      placeholder="Sesuai dengan nama rekening"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submitting || wallet.balance < 50000}
                    className="w-full bg-purple-600 text-white py-3 rounded-lg font-semibold hover:bg-purple-700 transition disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    {submitting ? (
                      <div className="flex items-center justify-center gap-2">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        Memproses...
                      </div>
                    ) : (
                      'Ajukan Penarikan'
                    )}
                  </button>
                </form>

                <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-700">
                    💡 Informasi: Penarikan diproses dalam 1-3 hari kerja. 
                    Biaya admin ditanggung oleh platform.
                  </p>
                </div>
              </div>
            </div>

            {/* Right Column - History */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-xl shadow-sm p-6 sticky top-20">
                <div className="flex items-center gap-2 mb-4">
                  <History className="w-5 h-5 text-purple-600" />
                  <h2 className="text-lg font-bold text-gray-800">Riwayat Penarikan</h2>
                </div>

                {history.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">Belum ada riwayat penarikan</p>
                ) : (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {history.map((item) => {
                      const status = getStatusBadge(item.status);
                      const StatusIcon = status.icon;
                      return (
                        <div key={item.id} className="border-b border-gray-100 pb-3 last:border-0">
                          <div className="flex justify-between items-start mb-1">
                            <span className="font-medium text-purple-600">
                              Rp{formatPrice(item.amount)}
                            </span>
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${status.color}`}>
                              <StatusIcon className="w-3 h-3" />
                              {status.label}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500">
                            {item.bankName} - {item.bankAccount}
                          </p>
                          <p className="text-xs text-gray-400 mt-1">
                            {formatDate(item.createdAt)}
                          </p>
                          {item.notes && (
                            <p className="text-xs text-red-500 mt-1">{item.notes}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}