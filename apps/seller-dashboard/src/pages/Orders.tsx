import { useState, useEffect } from 'react';
import { 
  Search, 
  Eye, 
  Truck, 
  CheckCircle, 
  XCircle,
  Package as PackageIcon
} from 'lucide-react';
import Sidebar from '../components/layout/Sidebar';
import Header from '../components/layout/Header';

interface OrderItem {
  id: string;
  productName: string;
  variantName?: string;
  quantity: number;
  price: number;
  totalPrice: number;
  image: string;
}

interface Order {
  id: string;
  masterOrderId: string;
  buyerName: string;
  address: {
    recipientName: string;
    phone: string;
    addressLine: string;
    city: string;
  };
  items: OrderItem[];
  totalAmount: number;
  shippingFee: number;
  grandTotal: number;
  status: string;
  courierName?: string;
  trackingNumber?: string;
  createdAt: string;
}

const statusOptions = [
  { value: 'PENDING_PAYMENT', label: 'Menunggu Pembayaran', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'PAID', label: 'Dibayar', color: 'bg-blue-100 text-blue-800' },
  { value: 'READY_TO_SHIP', label: 'Siap Dikirim', color: 'bg-purple-100 text-purple-800' },
  { value: 'IN_TRANSIT', label: 'Dikirim', color: 'bg-orange-100 text-orange-800' },
  { value: 'DELIVERED', label: 'Diterima', color: 'bg-green-100 text-green-800' },
  { value: 'COMPLETED', label: 'Selesai', color: 'bg-green-100 text-green-800' },
  { value: 'CANCELLED', label: 'Dibatalkan', color: 'bg-red-100 text-red-800' },
];

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showTrackingModal, setShowTrackingModal] = useState(false);
  const [trackingNumber, setTrackingNumber] = useState('');
  const [courierName, setCourierName] = useState('');

  useEffect(() => {
    fetchOrders();
  }, [statusFilter]);

  const fetchOrders = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const url = `${import.meta.env.VITE_API_URL}/api/v1/orders/seller/orders${statusFilter ? `?status=${statusFilter}` : ''}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setOrders(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = async (orderId: string, status: string, trackingNumber?: string, courierName?: string) => {
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/v1/orders/seller/orders/${orderId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status, trackingNumber, courierName }),
      });
      if (res.ok) {
        fetchOrders();
        setShowTrackingModal(false);
      }
    } catch (error) {
      console.error('Error updating order status:', error);
    }
  };

  const handleShipOrder = (order: Order) => {
    setSelectedOrder(order);
    setTrackingNumber('');
    setCourierName('');
    setShowTrackingModal(true);
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('id-ID').format(price);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusConfig = (status: string) => {
    return statusOptions.find(s => s.value === status) || statusOptions[0];
  };

  const filteredOrders = orders.filter(order =>
    order.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    order.buyerName.toLowerCase().includes(searchQuery.toLowerCase())
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
        <Header title="Pesanan Masuk" />

        <main className="p-6">
          {/* Filters */}
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari order ID atau nama pembeli..."
                className="pl-10 pr-4 py-2 w-80 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500"
            >
              <option value="">Semua Status</option>
              {statusOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Orders List */}
          <div className="space-y-4">
            {filteredOrders.map((order) => {
              const status = getStatusConfig(order.status);
              return (
                <div key={order.id} className="bg-white rounded-xl shadow-sm overflow-hidden">
                  {/* Order Header */}
                  <div className="flex flex-wrap items-center justify-between p-4 border-b border-gray-100 bg-gray-50">
                    <div>
                      <p className="text-sm text-gray-500">
                        Order ID: <span className="font-mono">{order.id.slice(-8)}</span>
                      </p>
                      <p className="text-sm text-gray-500">{formatDate(order.createdAt)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${status.color}`}>
                        {status.label}
                      </span>
                      <button
                        onClick={() => window.open(`http://localhost:3001/orders/${order.masterOrderId}`, '_blank')}
                        className="p-1 text-gray-400 hover:text-purple-600 transition"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Order Content */}
                  <div className="p-4">
                    <div className="mb-3">
                      <p className="font-medium text-gray-800">{order.buyerName}</p>
                      <p className="text-sm text-gray-500">{order.address.addressLine}, {order.address.city}</p>
                      <p className="text-sm text-gray-500">📞 {order.address.phone}</p>
                    </div>

                    {/* Items */}
                    <div className="space-y-2 mb-4">
                      {order.items.map((item) => (
                        <div key={item.id} className="flex gap-3">
                          <div className="w-12 h-12 bg-gray-100 rounded overflow-hidden flex-shrink-0">
                            <img src={item.image || '/placeholder.png'} alt={item.productName} className="w-full h-full object-cover" />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-800">{item.productName}</p>
                            {item.variantName && <p className="text-xs text-gray-500">Varian: {item.variantName}</p>}
                            <p className="text-xs text-gray-400">{item.quantity}x Rp{formatPrice(item.price)}</p>
                          </div>
                          <span className="text-sm font-medium">Rp{formatPrice(item.totalPrice)}</span>
                        </div>
                      ))}
                    </div>

                    {/* Total */}
                    <div className="flex justify-end border-t border-gray-100 pt-3">
                      <div className="text-right">
                        <p className="text-sm text-gray-500">
                          Subtotal: Rp{formatPrice(order.totalAmount)}
                        </p>
                        <p className="text-sm text-gray-500">
                          Ongkir: Rp{formatPrice(order.shippingFee)}
                        </p>
                        <p className="text-lg font-bold text-purple-600">
                          Total: Rp{formatPrice(order.grandTotal)}
                        </p>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex justify-end gap-2 mt-4">
                      {order.status === 'PAID' && (
                        <button
                          onClick={() => updateOrderStatus(order.id, 'READY_TO_SHIP')}
                          className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 transition"
                        >
                          Proses Pesanan
                        </button>
                      )}
                      {order.status === 'READY_TO_SHIP' && (
                        <button
                          onClick={() => handleShipOrder(order)}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition"
                        >
                          <Truck className="w-4 h-4 inline mr-1" />
                          Input Resi
                        </button>
                      )}
                      {order.status === 'IN_TRANSIT' && (
                        <span className="px-4 py-2 bg-gray-100 text-gray-500 rounded-lg text-sm">
                          Sedang Dikirim
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {filteredOrders.length === 0 && (
              <div className="bg-white rounded-xl shadow-sm p-12 text-center">
                <PackageIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">Belum ada pesanan</p>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Tracking Modal */}
      {showTrackingModal && selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full">
            <div className="p-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-800">Input Nomor Resi</h2>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Kurir</label>
                <select
                  value={courierName}
                  onChange={(e) => setCourierName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500"
                >
                  <option value="">Pilih Kurir</option>
                  <option value="JNE">JNE</option>
                  <option value="JNT">JNT</option>
                  <option value="POS">POS Indonesia</option>
                  <option value="SiCepat">SiCepat</option>
                  <option value="GOJEK">GOJEK</option>
                  <option value="GRAB">GRAB</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nomor Resi</label>
                <input
                  type="text"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  placeholder="Contoh: JT1234567890"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowTrackingModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                >
                  Batal
                </button>
                <button
                  onClick={() => updateOrderStatus(selectedOrder.id, 'IN_TRANSIT', trackingNumber, courierName)}
                  disabled={!trackingNumber || !courierName}
                  className="flex-1 bg-purple-600 text-white py-2 rounded-lg hover:bg-purple-700 transition disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  Kirim Pesanan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}