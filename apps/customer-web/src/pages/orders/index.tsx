import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/router';
import { Package, ChevronRight, Clock, CheckCircle, Truck, XCircle, Eye } from 'lucide-react';
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
  createdAt: string;
}

interface Order {
  id: string;
  grandTotal: number;
  status: string;
  createdAt: string;
  expiresAt?: string;
  paidAt?: string;
  subOrders: SubOrder[];
}

const statusConfig: Record<string, { label: string; color: string; icon: JSX.Element }> = {
  PENDING_PAYMENT: { label: 'Menunggu Pembayaran', color: 'bg-yellow-100 text-yellow-800', icon: <Clock className="w-4 h-4" /> },
  PAID: { label: 'Sudah Dibayar', color: 'bg-blue-100 text-blue-800', icon: <CheckCircle className="w-4 h-4" /> },
  READY_TO_SHIP: { label: 'Siap Dikirim', color: 'bg-purple-100 text-purple-800', icon: <Package className="w-4 h-4" /> },
  IN_TRANSIT: { label: 'Dalam Pengiriman', color: 'bg-orange-100 text-orange-800', icon: <Truck className="w-4 h-4" /> },
  DELIVERED: { label: 'Telah Diterima', color: 'bg-green-100 text-green-800', icon: <CheckCircle className="w-4 h-4" /> },
  COMPLETED: { label: 'Selesai', color: 'bg-green-100 text-green-800', icon: <CheckCircle className="w-4 h-4" /> },
  CANCELLED: { label: 'Dibatalkan', color: 'bg-red-100 text-red-800', icon: <XCircle className="w-4 h-4" /> },
};

const statusTabs = [
  { key: 'all', label: 'Semua' },
  { key: 'PENDING_PAYMENT', label: 'Menunggu Bayar' },
  { key: 'PAID', label: 'Dibayar' },
  { key: 'IN_TRANSIT', label: 'Dikirim' },
  { key: 'DELIVERED', label: 'Diterima' },
  { key: 'COMPLETED', label: 'Selesai' },
  { key: 'CANCELLED', label: 'Dibatalkan' },
];

export default function OrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeTab, setActiveTab] = useState('all');
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      router.push('/auth/login?redirect=/orders');
      return;
    }
    fetchOrders();
  }, [activeTab, page]);

  const fetchOrders = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const url = `${process.env.NEXT_PUBLIC_API_URL}/api/v1/orders?page=${page}&limit=10${activeTab !== 'all' ? `&status=${activeTab}` : ''}`;
      
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setOrders(data.data || []);
        setTotalPages(data.meta?.totalPages || 1);
      }
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('id-ID').format(price);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const getStatusConfig = (status: string) => {
    return statusConfig[status] || { label: status, color: 'bg-gray-100 text-gray-800', icon: <Package className="w-4 h-4" /> };
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

  return (
    <>
      <Head>
        <title>Pesanan Saya - Daka Store</title>
      </Head>

      <Navbar />

      <main className="min-h-screen bg-gray-50 py-8">
        <div className="container mx-auto px-4">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
            <Link href="/" className="hover:text-purple-600">Beranda</Link>
            <ChevronRight className="w-4 h-4" />
            <span className="text-gray-800">Pesanan Saya</span>
          </div>

          <h1 className="text-2xl font-bold text-gray-800 mb-6">Pesanan Saya</h1>

          {/* Tabs */}
          <div className="flex overflow-x-auto gap-1 mb-6 bg-white rounded-lg p-1 shadow-sm">
            {statusTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap ${
                  activeTab === tab.key
                    ? 'bg-purple-600 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Orders List */}
          {orders.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm p-12 text-center">
              <Package className="w-20 h-20 text-gray-300 mx-auto mb-4" />
              <h2 className="text-xl font-medium text-gray-600 mb-2">Belum Ada Pesanan</h2>
              <p className="text-gray-400 mb-6">Yuk, mulai belanja di Daka Store!</p>
              <Link
                href="/products"
                className="inline-flex items-center gap-2 bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 transition"
              >
                Mulai Belanja
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {orders.map((order) => {
                const status = getStatusConfig(order.status);
                return (
                  <div key={order.id} className="bg-white rounded-lg shadow-sm overflow-hidden">
                    {/* Order Header */}
                    <div className="flex flex-wrap items-center justify-between p-4 border-b border-gray-100 bg-gray-50">
                      <div className="flex items-center gap-4">
                        <span className="text-sm text-gray-500">
                          Order ID: <span className="font-mono">{order.id.slice(-8)}</span>
                        </span>
                        <span className="text-sm text-gray-500">
                          {formatDate(order.createdAt)}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${status.color}`}>
                          {status.icon}
                          {status.label}
                        </span>
                        <Link
                          href={`/orders/${order.id}`}
                          className="flex items-center gap-1 text-purple-600 hover:text-purple-700 text-sm"
                        >
                          <Eye className="w-4 h-4" />
                          Detail
                        </Link>
                      </div>
                    </div>

                    {/* Order Items */}
                    <div className="p-4 space-y-4">
                      {order.subOrders.map((subOrder) => (
                        <div key={subOrder.id} className="space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-gray-700">{subOrder.sellerName}</span>
                              <span className="text-xs text-gray-400">•</span>
                              <span className="text-xs text-gray-500">{subOrder.items.length} produk</span>
                            </div>
                            <span className="text-sm font-medium text-purple-600">
                              Rp{formatPrice(subOrder.grandTotal)}
                            </span>
                          </div>

                          <div className="flex gap-3 overflow-x-auto pb-2">
                            {subOrder.items.slice(0, 3).map((item) => (
                              <div key={item.id} className="flex-shrink-0 w-20">
                                <div className="relative w-20 h-20 bg-gray-100 rounded-lg overflow-hidden">
                                  <Image
                                    src={item.image || '/placeholder.png'}
                                    alt={item.productName}
                                    fill
                                    className="object-cover"
                                  />
                                </div>
                                <p className="text-xs text-gray-600 mt-1 line-clamp-1">{item.productName}</p>
                                <p className="text-xs text-gray-400">{item.quantity}x</p>
                              </div>
                            ))}
                            {subOrder.items.length > 3 && (
                              <div className="flex-shrink-0 w-20 h-20 bg-gray-100 rounded-lg flex items-center justify-center">
                                <span className="text-sm text-gray-500">+{subOrder.items.length - 3}</span>
                              </div>
                            )}
                          </div>

                          {/* Action Buttons */}
                          <div className="flex gap-2 justify-end">
                            {order.status === 'PENDING_PAYMENT' && (
                              <button
                                onClick={() => router.push(`/payment/${order.id}`)}
                                className="px-4 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 transition"
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
                                  fetchOrders();
                                }}
                                className="px-4 py-2 border border-purple-600 text-purple-600 text-sm rounded-lg hover:bg-purple-50 transition"
                              >
                                Pesanan Diterima
                              </button>
                            )}
                            {order.status === 'PENDING_PAYMENT' && (
                              <button
                                onClick={async () => {
                                  if (confirm('Batalkan pesanan ini?')) {
                                    const token = localStorage.getItem('accessToken');
                                    await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/orders/${order.id}/cancel`, {
                                      method: 'POST',
                                      headers: {
                                        'Content-Type': 'application/json',
                                        Authorization: `Bearer ${token}`,
                                      },
                                      body: JSON.stringify({ reason: 'Dibatalkan oleh pembeli' }),
                                    });
                                    fetchOrders();
                                  }
                                }}
                                className="px-4 py-2 border border-red-500 text-red-500 text-sm rounded-lg hover:bg-red-50 transition"
                              >
                                Batalkan
                              </button>
                            )}
                            {order.status === 'COMPLETED' && (
                              <Link
                                href={`/products/${subOrder.items[0]?.productId}/review`}
                                className="px-4 py-2 border border-purple-600 text-purple-600 text-sm rounded-lg hover:bg-purple-50 transition"
                              >
                                Beri Review
                              </Link>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex justify-center gap-2 mt-6">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-1 border border-gray-300 rounded-lg disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <span className="px-3 py-1 text-gray-600">
                    Halaman {page} dari {totalPages}
                  </span>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-3 py-1 border border-gray-300 rounded-lg disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      <Footer />
    </>
  );
}