import { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { 
  CreditCard, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  Copy,
  Check,
  QrCode
} from 'lucide-react';
import Navbar from '../../components/layout/Navbar';
import Footer from '../../components/layout/Footer';

interface PaymentData {
  orderId: string;
  amount: number;
  paymentUrl: string;
  qrCode?: string;
  virtualAccount?: string;
  expiresAt: string;
  status: 'pending' | 'success' | 'failed' | 'expired';
}

export default function PaymentPage() {
  const router = useRouter();
  const { id } = router.query;
  
  const [payment, setPayment] = useState<PaymentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [countdown, setCountdown] = useState<string>('');

  useEffect(() => {
    if (id) {
      fetchPaymentStatus();
      startPolling();
    }
  }, [id]);

  useEffect(() => {
    if (payment?.expiresAt) {
      updateCountdown();
      const interval = setInterval(updateCountdown, 1000);
      return () => clearInterval(interval);
    }
  }, [payment?.expiresAt]);

  const fetchPaymentStatus = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/payments/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setPayment(data.data);
        
        // If payment success, redirect to order detail
        if (data.data.status === 'success') {
          setTimeout(() => {
            router.push(`/orders/${data.data.orderId}`);
          }, 3000);
        }
      }
    } catch (error) {
      console.error('Error fetching payment:', error);
    } finally {
      setLoading(false);
    }
  };

  const startPolling = () => {
    const interval = setInterval(async () => {
      if (payment?.status === 'success' || payment?.status === 'expired') {
        clearInterval(interval);
        return;
      }
      
      try {
        const token = localStorage.getItem('accessToken');
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/payments/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setPayment(data.data);
          
          if (data.data.status === 'success') {
            clearInterval(interval);
            setTimeout(() => {
              router.push(`/orders/${data.data.orderId}`);
            }, 3000);
          }
        }
      } catch (error) {
        console.error('Error polling payment:', error);
      }
    }, 5000); // Check every 5 seconds
    
    return () => clearInterval(interval);
  };

  const updateCountdown = () => {
    if (!payment?.expiresAt) return;
    
    const expiry = new Date(payment.expiresAt).getTime();
    const now = new Date().getTime();
    const diff = expiry - now;
    
    if (diff <= 0) {
      setCountdown('Expired');
      return;
    }
    
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    setCountdown(`${minutes}:${seconds.toString().padStart(2, '0')}`);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('id-ID').format(price);
  };

  const handleRetry = async () => {
    setCheckingStatus(true);
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/payments/${id}/retry`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        window.location.href = data.data.paymentUrl;
      }
    } catch (error) {
      console.error('Error retrying payment:', error);
    } finally {
      setCheckingStatus(false);
    }
  };

  if (loading) {
    return (
      <>
        <Navbar />
        <main className="min-h-screen bg-gray-50 py-12">
          <div className="container mx-auto px-4">
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
            </div>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  if (!payment) {
    return (
      <>
        <Navbar />
        <main className="min-h-screen bg-gray-50 py-12">
          <div className="container mx-auto px-4 text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h1 className="text-xl font-bold text-gray-800 mb-2">Pembayaran Tidak Ditemukan</h1>
            <p className="text-gray-500 mb-6">Data pembayaran tidak valid atau sudah kadaluwarsa</p>
            <button
              onClick={() => router.push('/orders')}
              className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 transition"
            >
              Lihat Pesanan Saya
            </button>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  if (payment.status === 'success') {
    return (
      <>
        <Navbar />
        <main className="min-h-screen bg-gray-50 py-12">
          <div className="container mx-auto px-4 max-w-md">
            <div className="bg-white rounded-xl shadow-sm p-8 text-center">
              <CheckCircle className="w-20 h-20 text-green-500 mx-auto mb-4" />
              <h1 className="text-2xl font-bold text-gray-800 mb-2">Pembayaran Berhasil!</h1>
              <p className="text-gray-500 mb-4">
                Pesanan #{payment.orderId.slice(-8)} akan segera diproses oleh penjual
              </p>
              <div className="animate-pulse text-sm text-gray-400 mb-6">
                Mengalihkan ke halaman pesanan...
              </div>
              <button
                onClick={() => router.push(`/orders/${payment.orderId}`)}
                className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 transition"
              >
                Lihat Pesanan
              </button>
            </div>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  if (payment.status === 'expired') {
    return (
      <>
        <Navbar />
        <main className="min-h-screen bg-gray-50 py-12">
          <div className="container mx-auto px-4 max-w-md">
            <div className="bg-white rounded-xl shadow-sm p-8 text-center">
              <AlertCircle className="w-20 h-20 text-red-500 mx-auto mb-4" />
              <h1 className="text-2xl font-bold text-gray-800 mb-2">Pembayaran Kadaluwarsa</h1>
              <p className="text-gray-500 mb-6">
                Waktu pembayaran telah habis. Silakan buat pesanan ulang.
              </p>
              <button
                onClick={() => router.push(`/cart`)}
                className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 transition"
              >
                Kembali ke Keranjang
              </button>
            </div>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Head>
        <title>Pembayaran #{payment.orderId.slice(-8)} - Daka Store</title>
      </Head>

      <Navbar />

      <main className="min-h-screen bg-gray-50 py-8">
        <div className="container mx-auto px-4 max-w-lg">
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            {/* Header */}
            <div className="p-4 bg-gradient-to-r from-purple-600 to-purple-800 text-white text-center">
              <h1 className="text-lg font-bold">Selesaikan Pembayaran</h1>
              <p className="text-purple-200 text-sm mt-1">Pesanan #{payment.orderId.slice(-8)}</p>
            </div>

            <div className="p-6">
              {/* Amount */}
              <div className="text-center mb-6">
                <p className="text-sm text-gray-500 mb-1">Total Pembayaran</p>
                <p className="text-3xl font-bold text-gray-800">Rp{formatPrice(payment.amount)}</p>
              </div>

              {/* Countdown */}
              <div className="bg-yellow-50 rounded-lg p-3 text-center mb-6">
                <div className="flex items-center justify-center gap-2 text-yellow-700">
                  <Clock className="w-5 h-5" />
                  <span className="font-medium">Selesaikan pembayaran sebelum</span>
                </div>
                <p className="text-2xl font-bold text-yellow-700 mt-1">{countdown}</p>
              </div>

              {/* Payment Method Selection */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Metode Pembayaran
                </label>
                <div className="space-y-2">
                  <div className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg">
                    <input type="radio" name="method" defaultChecked className="text-purple-600" />
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-blue-500 rounded flex items-center justify-center">
                        <span className="text-white text-xs font-bold">QRIS</span>
                      </div>
                      <div>
                        <p className="font-medium text-gray-800">QRIS</p>
                        <p className="text-xs text-gray-500">Bayar pakai QRIS, OVO, GoPay, ShopeePay, Dana</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Pay Button */}
              <button
                onClick={() => window.location.href = payment.paymentUrl}
                className="w-full bg-purple-600 text-white py-3 rounded-lg font-semibold hover:bg-purple-700 transition flex items-center justify-center gap-2"
              >
                <CreditCard className="w-5 h-5" />
                Bayar Sekarang
              </button>

              <p className="text-xs text-gray-400 text-center mt-4">
                Pembayaran aman melalui Midtrans. Data Anda terenkripsi.
              </p>
            </div>
          </div>

          {/* Instruction */}
          <div className="bg-white rounded-xl shadow-sm p-4 mt-4">
            <h3 className="font-medium text-gray-800 mb-2">Instruksi Pembayaran</h3>
            <ol className="text-sm text-gray-600 space-y-2 list-decimal list-inside">
              <li>Klik tombol "Bayar Sekarang"</li>
              <li>Anda akan diarahkan ke halaman pembayaran Midtrans</li>
              <li>Pilih metode pembayaran yang diinginkan (QRIS, Transfer Bank, Kartu Kredit)</li>
              <li>Selesaikan pembayaran sesuai instruksi</li>
              <li>Pesanan akan otomatis terproses setelah pembayaran sukses</li>
            </ol>
          </div>
        </div>
      </main>

      <Footer />
    </>
  );
}