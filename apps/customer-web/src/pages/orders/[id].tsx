import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/router';
import { ChevronRight, Package, Truck, Clock, CheckCircle, XCircle, MapPin, CreditCard, Receipt, MessageCircle, FileText } from 'lucide-react';
import Navbar from '../../components/layout/Navbar';
import Footer from '../../components/layout/Footer';

interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  variantName?: string;
  quantity: number;
  price: number;
  totalPrice: number;
  image: string;
}

interface SubOrder {
  id: string;
  sellerId: string;
  sellerName: string;
  items: OrderItem[];
  totalAmount: number;
  shippingFee: number;
  grandTotal: number;
  status: string;
  courierName?: string;
  trackingNumber?: string;
  shippedAt?: string;
  deliveredAt?: string;
  createdAt: string;
}

interface Address {
  recipientName: string;
  phone: string;
  addressLine: string;
  city: string;
  postalCode: string;
}

interface OrderDetail {
  id: string;
  buyerName: string;
  address: Address;
  subOrders: SubOrder[];
  totalAmount: number;
  shippingFee: number;
  platformFee: number;
  discountAmount: number;
  voucherCode?: string;
  grandTotal: number;
  status: string;
  paymentMethod?: string;
  paidAt?: string;
  createdAt: string;
  expiresAt: string;
}

const statusSteps = [
  { key: 'PENDING_PAYMENT', label: 'Pesanan Dibuat', icon: Package },
  { key: 'PAID', label: 'Pembayaran Dikonfirmasi', icon: CheckCircle },
  { key: 'READY_TO_SHIP', label: 'Pesanan Diproses', icon: Package },
  { key: 'IN_TRANSIT', label: 'Dalam Pengiriman', icon: Truck },
  { key: 'DELIVERED', label: 'Pesanan Diterima', icon: CheckCircle },
  { key: 'COMPLETED', label: 'Selesai', icon: CheckCircle },
];

export default function OrderDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSubOrder, setActiveSubOrder] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      fetchOrderDetail();
    }
  }, [id]);

  const fetchOrderDetail = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/orders/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setOrder(data.data);
        if (data.data.subOrders?.length > 0) {
          setActiveSubOrder(data.data.subOrders[0].id);
        }
      } else if (res.status === 404) {
        router.push('/404');
      }
    } catch (error) {
      console.error('Error fetching order:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('id-ID').format(price);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getCurrentStepIndex = () => {
    if (!order) return 0;
    const currentIndex = statusSteps.findIndex(step => step.key === order.status);
    return currentIndex >= 0 ? currentIndex : 0;
  };

  const handleChat = (sellerId: string, sellerName: string) => {
    // Redirect ke halaman chat
    router.push(`/chat?sellerId=${sellerId}&sellerName=${encodeURIComponent(sellerName)}&orderId=${order?.id}`);
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

  if (!order) {
    return (
      <>
        <Navbar />
        <main className="min-h-screen bg-gray-50 py-12">
          <div className="container mx-auto px-4 text-center">
            <h1 className="text-2xl font-bold text-gray-800 mb-4">Pesanan Tidak Ditemukan</h1>
            <Link href="/orders" className="text-purple-600 hover:text-purple-700">
              Kembali ke Pesanan Saya
            </Link>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  const activeSubOrderData = order.subOrders.find(so => so.id === activeSubOrder);
  const currentStep = getCurrentStepIndex();

  return (
    <>
      <Head>
        <title>Detail Pesanan #{order.id.slice(-8)} - Daka Store</title>
      </Head>

      <Navbar />

      <main className="min-h-screen bg-gray-50 py-8">
        <div className="container mx-auto px-4">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
            <Link href="/" className="hover:text-purple-600">Beranda</Link>
            <ChevronRight className="w-4 h-4" />
            <Link href="/orders" className="hover:text-purple-600">Pesanan Saya</Link>
            <ChevronRight className="w-4 h-4" />
            <span className="text-gray-800">#{order.id.slice(-8)}</span>
          </div>

          <div className="flex flex-col lg:flex-row gap-6">
            {/* Main Content */}
            <div className="flex-1 space-y-6">
              {/* Status Tracker */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h2 className="text-lg font-bold text-gray-800 mb-6">Status Pesanan</h2>
                <div className="relative">
                  <div className="absolute top-5 left-0 right-0 h-0.5 bg-gray-200">
                    <div
                      className="h-full bg-purple-600 transition-all duration-500"
                      style={{ width: `${(currentStep / (statusSteps.length - 1)) * 100}%` }}
                    />
                  </div>
                  <div className="relative flex justify-between">
                    {statusSteps.map((step, idx) => {
                      const Icon = step.icon;
                      const isCompleted = idx <= currentStep;
                      const isCurrent = idx === currentStep;
                      return (
                        <div key={step.key} className="flex flex-col items-center">
                          <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center z-10 ${
                              isCompleted
                                ? 'bg-purple-600 text-white'
                                : 'bg-gray-200 text-gray-400'
                            } ${isCurrent ? 'ring-4 ring-purple-200' : ''}`}
                          >
                            <Icon className="w-5 h-5" />
                          </div>
                          <span className={`text-xs mt-2 text-center ${isCompleted ? 'text-purple-600 font-medium' : 'text-gray-400'}`}>
                            {step.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Sub Orders Selector */}
              {order.subOrders.length > 1 && (
                <div className="bg-white rounded-lg shadow-sm p-4">
                  <div className="flex gap-2 overflow-x-auto">
                    {order.subOrders.map((so) => (
                      <button
                        key={so.id}
                        onClick={() => setActiveSubOrder(so.id)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${
                          activeSubOrder === so.id
                            ? 'bg-purple-600 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {so.sellerName}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Seller Info */}
              {activeSubOrderData && (
                <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between p-4 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                        <span className="text-purple-600 text-sm font-medium">
                          {activeSubOrderData.sellerName.charAt(0)}
                        </span>
                      </div>
                      <span className="font-medium text-gray-800">{activeSubOrderData.sellerName}</span>
                    </div>
                    <button
                      onClick={() => handleChat(activeSubOrderData.sellerId, activeSubOrderData.sellerName)}
                      className="flex items-center gap-1 text-purple-600 text-sm hover:text-purple-700"
                    >
                      <MessageCircle className="w-4 h-4" />
                      Chat Penjual
                    </button>
                  </div>

                  {/* Items */}
                  <div className="divide-y divide-gray-100">
                    {activeSubOrderData.items.map((item) => (
                      <div key={item.id} className="flex gap-4 p-4">
                        <div className="relative w-20 h-20 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                          <Image
                            src={item.image || '/placeholder.png'}
                            alt={item.productName}
                            fill
                            className="object-cover"
                          />
                        </div>
                        <div className="flex-1">
                          <Link
                            href={`/products/${item.productId}`}
                            className="font-medium text-gray-800 hover:text-purple-600 line-clamp-2"
                          >
                            {item.productName}
                          </Link>
                          {item.variantName && (
                            <p className="text-sm text-gray-500 mt-1">Varian: {item.variantName}</p>
                          )}
                          <div className="flex justify-between items-center mt-2">
                            <span className="text-gray-600">
                              {item.quantity}x Rp{formatPrice(item.price)}
                            </span>
                            <span className="font-medium text-purple-600">
                              Rp{formatPrice(item.totalPrice)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Tracking Info */}
                  {activeSubOrderData.trackingNumber && (
                    <div className="p-4 bg-gray-50 border-t border-gray-100">
                      <div className="flex items-center gap-2 mb-2">
                        <Truck className="w-4 h-4 text-purple-600" />
                        <span className="text-sm font-medium text-gray-700">Informasi Pengiriman</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-gray-500">Kurir:</span>
                          <span className="ml-2 text-gray-700">{activeSubOrderData.courierName}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">No. Resi:</span>
                          <span className="ml-2 text-gray-700 font-mono">{activeSubOrderData.trackingNumber}</span>
                        </div>
                        {activeSubOrderData.shippedAt && (
                          <div>
                            <span className="text-gray-500">Tgl Kirim:</span>
                            <span className="ml-2 text-gray-700">{formatDate(activeSubOrderData.shippedAt)}</span>
                          </div>
                        )}
                        {activeSubOrderData.deliveredAt && (
                          <div>
                            <span className="text-gray-500">Tgl Diterima:</span>
                            <span className="ml-2 text-gray-700">{formatDate(activeSubOrderData.deliveredAt)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Sidebar */}
            <div className="lg:w-96 space-y-6">
              {/* Order Summary */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-bold text-gray-800 mb-4">Ringkasan Pesanan</h3>
                <div className="space-y-3">
                  <div className="flex justify-between text-gray-600">
                    <span>Total Harga</span>
                    <span>Rp{formatPrice(order.totalAmount)}</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>Ongkos Kirim</span>
                    <span>Rp{formatPrice(order.shippingFee)}</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>Biaya Platform</span>
                    <span>Rp{formatPrice(order.platformFee)}</span>
                  </div>
                  {order.discountAmount > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Diskon Voucher</span>
                      <span>-Rp{formatPrice(order.discountAmount)}</span>
                    </div>
                  )}
                  <div className="border-t border-gray-200 pt-3 mt-3">
                    <div className="flex justify-between text-lg font-bold text-gray-800">
                      <span>Total Dibayar</span>
                      <span className="text-purple-600">Rp{formatPrice(order.grandTotal)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Shipping Address */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-center gap-2 mb-4">
                  <MapPin className="w-5 h-5 text-purple-600" />
                  <h3 className="text-lg font-bold text-gray-800">Alamat Pengiriman</h3>
                </div>
                <div className="space-y-1">
                  <p className="font-medium text-gray-800">{order.address.recipientName}</p>
                  <p className="text-gray-500 text-sm">{order.address.phone}</p>
                  <p className="text-gray-600 text-sm">{order.address.addressLine}</p>
                  <p className="text-gray-500 text-sm">{order.address.city} {order.address.postalCode}</p>
                </div>
              </div>

              {/* Payment Info */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-center gap-2 mb-4">
                  <CreditCard className="w-5 h-5 text-purple-600" />
                  <h3 className="text-lg font-bold text-gray-800">Informasi Pembayaran</h3>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Metode:</span>
                    <span className="text-gray-700">{order.paymentMethod || 'Belum dipilih'}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Status:</span>
                    <span className="text-gray-700">
                      {order.status === 'PENDING_PAYMENT' ? 'Menunggu pembayaran' : 'Lunas'}
                    </span>
                  </div>
                  {order.paidAt && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Waktu Bayar:</span>
                      <span className="text-gray-700">{formatDate(order.paidAt)}</span>
                    </div>
                  )}
                  {order.expiresAt && order.status === 'PENDING_PAYMENT' && (
                    <div className="flex justify-between text-sm text-red-500">
                      <span>Batas Bayar:</span>
                      <span>{formatDate(order.expiresAt)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2">
                {order.status === 'PENDING_PAYMENT' && (
                  <button
                    onClick={() => router.push(`/payment/${order.id}`)}
                    className="w-full bg-purple-600 text-white py-3 rounded-lg font-semibold hover:bg-purple-700 transition"
                  >
                    Bayar Sekarang
                  </button>
                )}
                {order.status === 'DELIVERED' && (
                  <button
                    onClick={async () => {
                      const token = localStorage.getItem('accessToken');
                      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/orders/${order.id}/complete`, {
                        method: 'POST',
                        headers: { Authorization: `Bearer ${token}` },
                      });
                      fetchOrderDetail();
                    }}
                    className="w-full border border-purple-600 text-purple-600 py-3 rounded-lg font-semibold hover:bg-purple-50 transition"
                  >
                    Pesanan Diterima
                  </button>
                )}
                <Link
                  href={`/invoice/${order.id}`}
                  className="w-full flex items-center justify-center gap-2 border border-gray-300 text-gray-600 py-3 rounded-lg font-semibold hover:bg-gray-50 transition"
                >
                  <FileText className="w-4 h-4" />
                  Lihat Invoice
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </>
  );
}