import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/router';
import { Heart, ShoppingCart, Trash2, ChevronRight, Star } from 'lucide-react';
import Navbar from '../components/layout/Navbar';
import Footer from '../components/layout/Footer';

interface WishlistItem {
  id: string;
  productId: string;
  productName: string;
  price: number;
  image: string;
  sellerName: string;
  ratingAvg: number;
  soldCount: number;
  stock: number;
}

export default function WishlistPage() {
  const router = useRouter();
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingToCart, setAddingToCart] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      router.push('/auth/login?redirect=/wishlist');
      return;
    }
    fetchWishlist();
  }, []);

  const fetchWishlist = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/users/me/wishlist`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setItems(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching wishlist:', error);
    } finally {
      setLoading(false);
    }
  };

  const removeFromWishlist = async (productId: string) => {
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/products/${productId}/wishlist`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        setItems(items.filter(item => item.productId !== productId));
      }
    } catch (error) {
      console.error('Error removing from wishlist:', error);
    }
  };

  const addToCart = async (item: WishlistItem) => {
    setAddingToCart(item.productId);
    
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/cart/items`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          productId: item.productId,
          quantity: 1,
        }),
      });

      if (res.ok) {
        // Optional: show success toast
        console.log('Added to cart');
      }
    } catch (error) {
      console.error('Error adding to cart:', error);
    } finally {
      setAddingToCart(null);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('id-ID').format(price);
  };

  const renderStars = (rating: number) => {
    return (
      <div className="flex items-center gap-0.5">
        {[...Array(5)].map((_, i) => (
          <Star
            key={i}
            className={`w-3 h-3 ${i < Math.floor(rating) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
          />
        ))}
      </div>
    );
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
        <title>Wishlist - Daka Store</title>
      </Head>

      <Navbar />

      <main className="min-h-screen bg-gray-50 py-8">
        <div className="container mx-auto px-4">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
            <Link href="/" className="hover:text-purple-600">Beranda</Link>
            <ChevronRight className="w-4 h-4" />
            <span className="text-gray-800">Wishlist</span>
          </div>

          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-gray-800">Wishlist Saya</h1>
            <span className="text-sm text-gray-500">{items.length} produk</span>
          </div>

          {items.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm p-12 text-center">
              <Heart className="w-20 h-20 text-gray-300 mx-auto mb-4" />
              <h2 className="text-xl font-medium text-gray-600 mb-2">Wishlist Kosong</h2>
              <p className="text-gray-400 mb-6">Simpan produk favoritmu di sini!</p>
              <Link
                href="/products"
                className="inline-flex items-center gap-2 bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 transition"
              >
                Jelajahi Produk
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {items.map((item) => (
                <div key={item.productId} className="bg-white rounded-lg shadow-sm overflow-hidden group">
                  <Link href={`/products/${item.productId}`}>
                    <div className="relative aspect-square bg-gray-100">
                      <Image
                        src={item.image || '/placeholder.png'}
                        alt={item.productName}
                        fill
                        className="object-cover group-hover:scale-105 transition duration-300"
                      />
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          removeFromWishlist(item.productId);
                        }}
                        className="absolute top-2 right-2 p-1.5 bg-white rounded-full shadow-md hover:bg-red-50 transition"
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </button>
                    </div>
                  </Link>
                  
                  <div className="p-3">
                    <Link href={`/products/${item.productId}`}>
                      <h3 className="font-medium text-gray-800 line-clamp-2 min-h-[48px] hover:text-purple-600">
                        {item.productName}
                      </h3>
                    </Link>
                    
                    <div className="mt-2">
                      <span className="text-lg font-bold text-purple-600">
                        Rp{formatPrice(item.price)}
                      </span>
                    </div>
                    
                    <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                      {renderStars(item.ratingAvg)}
                      <span>({item.soldCount})</span>
                    </div>
                    
                    <p className="text-xs text-gray-400 mt-1 line-clamp-1">{item.sellerName}</p>
                    
                    <button
                      onClick={() => addToCart(item)}
                      disabled={addingToCart === item.productId || item.stock <= 0}
                      className="w-full mt-3 flex items-center justify-center gap-2 bg-purple-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-purple-700 transition disabled:bg-gray-300 disabled:cursor-not-allowed"
                    >
                      {addingToCart === item.productId ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      ) : (
                        <>
                          <ShoppingCart className="w-4 h-4" />
                          {item.stock <= 0 ? 'Stok Habis' : 'Masukkan Keranjang'}
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      <Footer />
    </>
  );
}