import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/router';
import { Trash2, Minus, Plus, ShoppingBag, ArrowLeft, ChevronRight } from 'lucide-react';
import Navbar from '../components/layout/Navbar';
import Footer from '../components/layout/Footer';

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
  stock: number;
}

interface CartData {
  items: CartItem[];
  totalPrice: number;
  totalItems: number;
}

export default function CartPage() {
  const router = useRouter();
  const [cart, setCart] = useState<CartData>({ items: [], totalPrice: 0, totalItems: 0 });
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    fetchCart();
  }, []);

  const getSessionId = () => {
    let sessionId = localStorage.getItem('sessionId');
    if (!sessionId) {
      sessionId = crypto.randomUUID();
      localStorage.setItem('sessionId', sessionId);
    }
    return sessionId;
  };

  const fetchCart = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const sessionId = getSessionId();
      
      let url = `${process.env.NEXT_PUBLIC_API_URL}/api/v1/cart`;
      if (!token && sessionId) {
        url += `?sessionId=${sessionId}`;
      }
      
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      
      if (res.ok) {
        const data = await res.json();
        setCart(data.data);
      }
    } catch (error) {
      console.error('Error fetching cart:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateQuantity = async (itemId: string, newQuantity: number, productId?: string, variantId?: string) => {
    if (newQuantity < 1) {
      await removeItem(itemId, productId, variantId);
      return;
    }

    setUpdating(itemId);
    
    try {
      const token = localStorage.getItem('accessToken');
      const sessionId = getSessionId();
      
      let url = `${process.env.NEXT_PUBLIC_API_URL}/api/v1/cart/items/${itemId}`;
      if (!token && sessionId) {
        url += `?sessionId=${sessionId}`;
      }
      
      const res = await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ quantity: newQuantity }),
      });
      
      if (res.ok) {
        await fetchCart();
      }
    } catch (error) {
      console.error('Error updating quantity:', error);
    } finally {
      setUpdating(null);
    }
  };

  const removeItem = async (itemId: string, productId?: string, variantId?: string) => {
    setUpdating(itemId);
    
    try {
      const token = localStorage.getItem('accessToken');
      const sessionId = getSessionId();
      
      let url = `${process.env.NEXT_PUBLIC_API_URL}/api/v1/cart/items/${itemId}`;
      if (!token && sessionId) {
        url += `?sessionId=${sessionId}`;
      }
      
      const res = await fetch(url, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      
      if (res.ok) {
        await fetchCart();
      }
    } catch (error) {
      console.error('Error removing item:', error);
    } finally {
      setUpdating(null);
    }
  };

  const clearCart = async () => {
    if (!confirm('Apakah Anda yakin ingin menghapus semua item dari keranjang?')) return;
    
    try {
      const token = localStorage.getItem('accessToken');
      const sessionId = getSessionId();
      
      let url = `${process.env.NEXT_PUBLIC_API_URL}/api/v1/cart`;
      if (!token && sessionId) {
        url += `?sessionId=${sessionId}`;
      }
      
      const res = await fetch(url, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      
      if (res.ok) {
        await fetchCart();
      }
    } catch (error) {
      console.error('Error clearing cart:', error);
    }
  };

  const handleCheckout = () => {
    if (cart.items.length === 0) return;
    router.push('/checkout');
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('id-ID').format(price);
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
        <title>Keranjang Belanja - Daka Store</title>
      </Head>

      <Navbar />

      <main className="min-h-screen bg-gray-50 py-8">
        <div className="container mx-auto px-4">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
            <Link href="/" className="hover:text-purple-600">Beranda</Link>
            <ChevronRight className="w-4 h-4" />
            <span className="text-gray-800">Keranjang</span>
          </div>

          <h1 className="text-2xl font-bold text-gray-800 mb-6">Keranjang Belanja</h1>

          {cart.items.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm p-12 text-center">
              <ShoppingBag className="w-20 h-20 text-gray-300 mx-auto mb-4" />
              <h2 className="text-xl font-medium text-gray-600 mb-2">Keranjang Kosong</h2>
              <p className="text-gray-400 mb-6">Yuk, belanja produk menarik di Daka Store!</p>
              <Link
                href="/products"
                className="inline-flex items-center gap-2 bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 transition"
              >
                Mulai Belanja <ArrowLeft className="w-5 h-5" />
              </Link>
            </div>
          ) : (
            <div className="flex flex-col lg:flex-row gap-6">
              {/* Cart Items */}
              <div className="flex-1">
                <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                  <div className="hidden md:grid grid-cols-12 gap-4 p-4 bg-gray-50 border-b text-sm font-medium text-gray-600">
                    <div className="col-span-6">Produk</div>
                    <div className="col-span-2 text-center">Harga</div>
                    <div className="col-span-2 text-center">Jumlah</div>
                    <div className="col-span-2 text-center">Subtotal</div>
                  </div>

                  {cart.items.map((item) => (
                    <div
                      key={item.id}
                      className="grid grid-cols-1 md:grid-cols-12 gap-4 p-4 border-b last:border-b-0 items-center"
                    >
                      {/* Product Info */}
                      <div className="col-span-6 flex gap-4">
                        <div className="relative w-20 h-20 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                          <Image
                            src={item.productImage || '/placeholder.png'}
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
                          <button
                            onClick={() => removeItem(item.id, item.productId, item.variantId)}
                            className="mt-2 text-sm text-red-500 hover:text-red-600 flex items-center gap-1"
                          >
                            <Trash2 className="w-4 h-4" />
                            Hapus
                          </button>
                        </div>
                      </div>

                      {/* Price */}
                      <div className="col-span-2 text-center">
                        <span className="md:hidden text-sm text-gray-500 block">Harga</span>
                        <span className="font-medium text-gray-800">Rp{formatPrice(item.price)}</span>
                      </div>

                      {/* Quantity */}
                      <div className="col-span-2">
                        <div className="md:text-center">
                          <span className="md:hidden text-sm text-gray-500 block mb-2">Jumlah</span>
                          <div className="inline-flex items-center border border-gray-300 rounded-lg">
                            <button
                              onClick={() => updateQuantity(item.id, item.quantity - 1, item.productId, item.variantId)}
                              disabled={updating === item.id}
                              className="px-3 py-1 text-gray-600 hover:bg-gray-100 disabled:opacity-50"
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                            <span className="w-12 text-center py-1">{item.quantity}</span>
                            <button
                              onClick={() => updateQuantity(item.id, item.quantity + 1, item.productId, item.variantId)}
                              disabled={updating === item.id || item.quantity >= item.stock}
                              className="px-3 py-1 text-gray-600 hover:bg-gray-100 disabled:opacity-50"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                          {item.quantity >= item.stock && (
                            <p className="text-xs text-red-500 mt-1">Stok tersisa {item.stock}</p>
                          )}
                        </div>
                      </div>

                      {/* Subtotal */}
                      <div className="col-span-2 text-center">
                        <span className="md:hidden text-sm text-gray-500 block">Subtotal</span>
                        <span className="font-bold text-purple-600">Rp{formatPrice(item.totalPrice)}</span>
                      </div>
                    </div>
                  ))}

                  <div className="p-4 bg-gray-50 flex justify-between items-center">
                    <button
                      onClick={clearCart}
                      className="text-red-500 hover:text-red-600 text-sm flex items-center gap-1"
                    >
                      <Trash2 className="w-4 h-4" />
                      Hapus Semua
                    </button>
                    <Link href="/products" className="text-purple-600 hover:text-purple-700 text-sm">
                      + Tambah Produk Lain
                    </Link>
                  </div>
                </div>
              </div>

              {/* Order Summary */}
              <div className="lg:w-80">
                <div className="bg-white rounded-lg shadow-sm p-6 sticky top-20">
                  <h3 className="text-lg font-bold text-gray-800 mb-4">Ringkasan Belanja</h3>
                  
                  <div className="space-y-3 mb-4">
                    <div className="flex justify-between text-gray-600">
                      <span>Total Harga ({cart.totalItems} item)</span>
                      <span>Rp{formatPrice(cart.totalPrice)}</span>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>Biaya Pengiriman</span>
                      <span>Akan dihitung di checkout</span>
                    </div>
                  </div>

                  <div className="border-t border-gray-200 pt-4 mb-6">
                    <div className="flex justify-between text-lg font-bold text-gray-800">
                      <span>Total</span>
                      <span className="text-purple-600">Rp{formatPrice(cart.totalPrice)}</span>
                    </div>
                  </div>

                  <button
                    onClick={handleCheckout}
                    disabled={cart.items.length === 0}
                    className="w-full bg-purple-600 text-white py-3 rounded-lg font-semibold hover:bg-purple-700 transition disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    Checkout Sekarang
                  </button>

                  <p className="text-xs text-gray-400 text-center mt-4">
                    Dengan melanjutkan, Anda menyetujui <Link href="/terms" className="text-purple-600">Syarat dan Ketentuan</Link>
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </>
  );
}