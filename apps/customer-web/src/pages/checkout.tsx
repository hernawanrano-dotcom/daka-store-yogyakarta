import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/router';
import { ChevronRight, Truck, CreditCard, Tag, MapPin, CheckCircle } from 'lucide-react';
import Navbar from '../components/layout/Navbar';
import Footer from '../components/layout/Footer';

interface Address {
  id: string;
  label: string;
  recipientName: string;
  phone: string;
  addressLine: string;
  city: string;
  postalCode: string;
  isPrimary: boolean;
}

interface CartItem {
  id: string;
  productId: string;
  productName: string;
  productImage: string;
  variantId?: string;
  variantName?: string;
  quantity: number;
  price: number;
  totalPrice: number;
}

interface Courier {
  name: string;
  service: string;
  price: number;
  estimatedDays: number;
}

interface Voucher {
  id: string;
  code: string;
  name: string;
  discountType: string;
  discountValue: number;
  maxDiscount?: number;
  minSpend: number;
}

export default function CheckoutPage() {
  const router = useRouter();
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string>('');
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [selectedCourier, setSelectedCourier] = useState<Courier | null>(null);
  const [voucherCode, setVoucherCode] = useState('');
  const [voucherDiscount, setVoucherDiscount] = useState(0);
  const [appliedVoucher, setAppliedVoucher] = useState<Voucher | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchCheckoutData();
  }, []);

  const getToken = () => localStorage.getItem('accessToken');

  const fetchCheckoutData = async () => {
    try {
      const token = getToken();
      if (!token) {
        router.push('/auth/login?redirect=/checkout');
        return;
      }

      // Fetch cart
      const cartRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/cart`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const cartData = await cartRes.json();
      setCartItems(cartData.data?.items || []);

      // Fetch addresses
      const addrRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/users/addresses`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const addrData = await addrRes.json();
      const userAddresses = addrData.data || [];
      setAddresses(userAddresses);
      
      const primary = userAddresses.find((a: Address) => a.isPrimary);
      if (primary) setSelectedAddressId(primary.id);
      else if (userAddresses.length > 0) setSelectedAddressId(userAddresses[0].id);

      // Fetch courier rates (mock for now)
      setCouriers([
        { name: 'JNT', service: 'Reguler', price: 15000, estimatedDays: 2 },
        { name: 'JNE', service: 'OKE', price: 12000, estimatedDays: 3 },
        { name: 'SiCepat', service: 'Reguler', price: 13000, estimatedDays: 2 },
        { name: 'GOJEK', service: 'Instant', price: 25000, estimatedDays: 0 },
        { name: 'GRAB', service: 'Instant', price: 25000, estimatedDays: 0 },
      ]);
    } catch (error) {
      console.error('Error fetching checkout data:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyVoucher = async () => {
    if (!voucherCode.trim()) return;

    try {
      const token = getToken();
      const cartTotal = cartItems.reduce((sum, i) => sum + i.totalPrice, 0);
      
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/vouchers/apply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ voucherCode, cartTotal }),
      });

      if (res.ok) {
        const data = await res.json();
        setVoucherDiscount(data.data.discountAmount);
        setAppliedVoucher(data.data.voucher);
        setError('');
      } else {
        const errorData = await res.json();
        setError(errorData.message);
      }
    } catch (error) {
      setError('Gagal menerapkan voucher');
    }
  };

  const removeVoucher = () => {
    setVoucherCode('');
    setVoucherDiscount(0);
    setAppliedVoucher(null);
    setError('');
  };

  const handleCheckout = async () => {
    if (!selectedAddressId) {
      setError('Silakan pilih alamat pengiriman');
      return;
    }
    if (!selectedCourier) {
      setError('Silakan pilih kurir pengiriman');
      return;
    }

    setCheckoutLoading(true);
    setError('');

    try {
      const token = getToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/orders/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          addressId: selectedAddressId,
          courierName: selectedCourier.name,
          courierService: selectedCourier.service,
          shippingFee: selectedCourier.price,
          paymentMethod: 'QRIS',
          voucherCode: appliedVoucher?.code,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        // Redirect ke payment page
        if (data.data.paymentUrl) {
          window.location.href = data.data.paymentUrl;
        } else {
          router.push(`/orders/${data.data.orderId}`);
        }
      } else {
        const errorData = await res.json();
        setError(errorData.message || 'Checkout gagal');
      }
    } catch (error) {
      setError('Terjadi kesalahan, silakan coba lagi');
    } finally {
      setCheckoutLoading(false);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('id-ID').format(price);
  };

  const subtotal = cartItems.reduce((sum, i) => sum + i.totalPrice, 0);
  const shippingCost = selectedCourier?.price || 0;
  const total = subtotal + shippingCost - voucherDiscount;

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

  if (cartItems.length === 0) {
    return (
      <>
        <Navbar />
        <main className="min-h-screen bg-gray-50 py-12">
          <div className="container mx-auto px-4 text-center">
            <h1 className="text-2xl font-bold text-gray-800 mb-4">Keranjang Kosong</h1>
            <Link href="/products" className="text-purple-600 hover:text-purple-700">
              Kembali Belanja
            </Link>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Head>
        <title>Checkout - Daka Store</title>
      </Head>

      <Navbar />

      <main className="min-h-screen bg-gray-50 py-8">
        <div className="container mx-auto px-4">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
            <Link href="/" className="hover:text-purple-600">Beranda</Link>
            <ChevronRight className="w-4 h-4" />
            <Link href="/cart" className="hover:text-purple-600">Keranjang</Link>
            <ChevronRight className="w-4 h-4" />
            <span className="text-gray-800">Checkout</span>
          </div>

          <div className="flex flex-col lg:flex-row gap-6">
            {/* Left Column */}
            <div className="flex-1 space-y-6">
              {/* Alamat Pengiriman */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-purple-600" />
                    <h2 className="text-lg font-bold text-gray-800">Alamat Pengiriman</h2>
                  </div>
                  <Link href="/profile/addresses" className="text-sm text-purple-600 hover:text-purple-700">
                    + Tambah Alamat
                  </Link>
                </div>

                {addresses.length === 0 ? (
                  <p className="text-gray-500">Belum ada alamat. Silakan tambah alamat terlebih dahulu.</p>
                ) : (
                  <div className="space-y-3">
                    {addresses.map((addr) => (
                      <label
                        key={addr.id}
                        className={`flex items-start gap-3 p-4 border rounded-lg cursor-pointer transition ${
                          selectedAddressId === addr.id
                            ? 'border-purple-500 bg-purple-50'
                            : 'border-gray-200 hover:border-purple-300'
                        }`}
                      >
                        <input
                          type="radio"
                          name="address"
                          value={addr.id}
                          checked={selectedAddressId === addr.id}
                          onChange={() => setSelectedAddressId(addr.id)}
                          className="mt-1"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{addr.label}</span>
                            {addr.isPrimary && (
                              <span className="text-xs bg-purple-100 text-purple-600 px-2 py-0.5 rounded">Utama</span>
                            )}
                          </div>
                          <p className="text-gray-600">{addr.recipientName} | {addr.phone}</p>
                          <p className="text-gray-500 text-sm">{addr.addressLine}, {addr.city} {addr.postalCode}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* Metode Pengiriman */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Truck className="w-5 h-5 text-purple-600" />
                  <h2 className="text-lg font-bold text-gray-800">Metode Pengiriman</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {couriers.map((courier) => (
                    <label
                      key={`${courier.name}-${courier.service}`}
                      className={`flex items-center justify-between p-4 border rounded-lg cursor-pointer transition ${
                        selectedCourier?.name === courier.name && selectedCourier?.service === courier.service
                          ? 'border-purple-500 bg-purple-50'
                          : 'border-gray-200 hover:border-purple-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="courier"
                          checked={selectedCourier?.name === courier.name && selectedCourier?.service === courier.service}
                          onChange={() => setSelectedCourier(courier)}
                          className="w-4 h-4"
                        />
                        <div>
                          <p className="font-medium">{courier.name}</p>
                          <p className="text-sm text-gray-500">{courier.service}</p>
                          {courier.estimatedDays > 0 ? (
                            <p className="text-xs text-gray-400">{courier.estimatedDays} hari</p>
                          ) : (
                            <p className="text-xs text-green-600">Same Day</p>
                          )}
                        </div>
                      </div>
                      <span className="font-medium">Rp{formatPrice(courier.price)}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Voucher */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Tag className="w-5 h-5 text-purple-600" />
                  <h2 className="text-lg font-bold text-gray-800">Voucher</h2>
                </div>

                {appliedVoucher ? (
                  <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                    <div>
                      <p className="font-medium text-purple-600">{appliedVoucher.name}</p>
                      <p className="text-sm text-purple-500">
                        {appliedVoucher.discountType === 'PERCENTAGE'
                          ? `Diskon ${appliedVoucher.discountValue}%`
                          : `Diskon Rp${formatPrice(appliedVoucher.discountValue)}`}
                      </p>
                    </div>
                    <button onClick={removeVoucher} className="text-red-500 text-sm hover:text-red-600">
                      Batalkan
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={voucherCode}
                      onChange={(e) => setVoucherCode(e.target.value.toUpperCase())}
                      placeholder="Masukkan kode voucher"
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500"
                    />
                    <button
                      onClick={applyVoucher}
                      className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
                    >
                      Pakai
                    </button>
                  </div>
                )}
                {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
              </div>

              {/* Payment Method */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-center gap-2 mb-4">
                  <CreditCard className="w-5 h-5 text-purple-600" />
                  <h2 className="text-lg font-bold text-gray-800">Metode Pembayaran</h2>
                </div>
                <div className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg">
                  <div className="w-12 h-8 bg-blue-500 rounded flex items-center justify-center">
                    <span className="text-white text-xs">QRIS</span>
                  </div>
                  <div>
                    <p className="font-medium">QRIS</p>
                    <p className="text-sm text-gray-500">Bayar pakai QRIS, OVO, GoPay, ShopeePay, Dana</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column - Order Summary */}
            <div className="lg:w-96">
              <div className="bg-white rounded-lg shadow-sm p-6 sticky top-20">
                <h3 className="text-lg font-bold text-gray-800 mb-4">Ringkasan Pesanan</h3>

                <div className="max-h-64 overflow-y-auto mb-4 space-y-3">
                  {cartItems.map((item) => (
                    <div key={item.id} className="flex gap-3">
                      <div className="relative w-12 h-12 bg-gray-100 rounded overflow-hidden flex-shrink-0">
                        <Image src={item.productImage || '/placeholder.png'} alt={item.productName} fill className="object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 line-clamp-1">{item.productName}</p>
                        <p className="text-xs text-gray-500">{item.quantity}x Rp{formatPrice(item.price)}</p>
                      </div>
                      <span className="text-sm font-medium">Rp{formatPrice(item.totalPrice)}</span>
                    </div>
                  ))}
                </div>

                <div className="space-y-2 border-t border-gray-200 pt-4">
                  <div className="flex justify-between text-gray-600">
                    <span>Subtotal</span>
                    <span>Rp{formatPrice(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>Ongkos Kirim</span>
                    <span>Rp{formatPrice(shippingCost)}</span>
                  </div>
                  {voucherDiscount > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Diskon Voucher</span>
                      <span>-Rp{formatPrice(voucherDiscount)}</span>
                    </div>
                  )}
                </div>

                <div className="border-t border-gray-200 mt-4 pt-4">
                  <div className="flex justify-between text-lg font-bold text-gray-800">
                    <span>Total</span>
                    <span className="text-purple-600">Rp{formatPrice(total)}</span>
                  </div>
                </div>

                <button
                  onClick={handleCheckout}
                  disabled={checkoutLoading || addresses.length === 0 || !selectedCourier}
                  className="w-full mt-6 bg-purple-600 text-white py-3 rounded-lg font-semibold hover:bg-purple-700 transition disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  {checkoutLoading ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      Memproses...
                    </div>
                  ) : (
                    'Buat Pesanan'
                  )}
                </button>

                <p className="text-xs text-gray-400 text-center mt-4">
                  Dengan melanjutkan, Anda menyetujui <Link href="/terms" className="text-purple-600">Syarat dan Ketentuan</Link>
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </>
  );
}