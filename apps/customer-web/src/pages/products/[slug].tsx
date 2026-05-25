import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/router';
import { 
  Star, 
  Minus, 
  Plus, 
  ShoppingCart, 
  Heart, 
  Share2, 
  Truck, 
  RefreshCw, 
  Shield,
  ChevronLeft,
  ChevronRight,
  MessageCircle,
  CheckCircle
} from 'lucide-react';
import Navbar from '../../components/layout/Navbar';
import Footer from '../../components/layout/Footer';

interface Variant {
  id: string;
  name: string;
  priceAdjust: number;
  stock: number;
}

interface ProductImage {
  id: string;
  imageUrl: string;
  isPrimary: boolean;
}

interface Review {
  id: string;
  userName: string;
  rating: number;
  comment: string;
  images: string[];
  createdAt: string;
  sellerReply?: string;
}

interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  stock: number;
  weightGram: number;
  images: ProductImage[];
  variants: Variant[];
  seller: {
    id: string;
    fullName: string;
    rating: number;
  };
  ratingAvg: number;
  ratingCount: number;
  soldCount: number;
  isInWishlist: boolean;
}

export default function ProductDetailPage() {
  const router = useRouter();
  const { slug } = router.query;
  
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedVariant, setSelectedVariant] = useState<Variant | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [inWishlist, setInWishlist] = useState(false);
  const [addingToCart, setAddingToCart] = useState(false);
  const [showAddedToast, setShowAddedToast] = useState(false);
  const [activeTab, setActiveTab] = useState<'detail' | 'review'>('detail');

  useEffect(() => {
    if (slug) {
      fetchProduct();
      fetchReviews();
    }
  }, [slug]);

  const fetchProduct = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/products/${slug}`);
      if (res.ok) {
        const data = await res.json();
        setProduct(data.data);
        setInWishlist(data.data.isInWishlist || false);
        
        if (data.data.variants?.length > 0) {
          setSelectedVariant(data.data.variants[0]);
        }
      } else if (res.status === 404) {
        router.push('/404');
      }
    } catch (error) {
      console.error('Error fetching product:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchReviews = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/products/${slug}/reviews?limit=5`);
      if (res.ok) {
        const data = await res.json();
        setReviews(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching reviews:', error);
    }
  };

  const getSessionId = () => {
    let sessionId = localStorage.getItem('sessionId');
    if (!sessionId) {
      sessionId = crypto.randomUUID();
      localStorage.setItem('sessionId', sessionId);
    }
    return sessionId;
  };

  const addToCart = async () => {
    const token = localStorage.getItem('accessToken');
    const sessionId = getSessionId();
    
    setAddingToCart(true);
    
    try {
      let url = `${process.env.NEXT_PUBLIC_API_URL}/api/v1/cart/items`;
      if (!token && sessionId) {
        url += `?sessionId=${sessionId}`;
      }
      
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          productId: product?.id,
          variantId: selectedVariant?.id,
          quantity,
        }),
      });
      
      if (res.ok) {
        setShowAddedToast(true);
        setTimeout(() => setShowAddedToast(false), 3000);
      } else {
        const error = await res.json();
        alert(error.message || 'Gagal menambahkan ke keranjang');
      }
    } catch (error) {
      console.error('Error adding to cart:', error);
      alert('Terjadi kesalahan, silakan coba lagi');
    } finally {
      setAddingToCart(false);
    }
  };

  const toggleWishlist = async () => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      router.push('/auth/login?redirect=' + encodeURIComponent(`/products/${slug}`));
      return;
    }
    
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/products/${product?.id}/wishlist`, {
        method: inWishlist ? 'DELETE' : 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (res.ok) {
        setInWishlist(!inWishlist);
      }
    } catch (error) {
      console.error('Error toggling wishlist:', error);
    }
  };

  const handleChat = () => {
    if (product) {
      router.push(`/chat?sellerId=${product.seller.id}&sellerName=${encodeURIComponent(product.seller.fullName)}&productId=${product.id}`);
    }
  };

  const getCurrentPrice = () => {
    if (!product) return 0;
    if (selectedVariant) {
      return product.price + selectedVariant.priceAdjust;
    }
    return product.price;
  };

  const getCurrentStock = () => {
    if (!product) return 0;
    if (selectedVariant) {
      return selectedVariant.stock;
    }
    return product.stock;
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
            className={`w-4 h-4 ${i < Math.floor(rating) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
          />
        ))}
        <span className="ml-1 text-sm text-gray-600">({rating})</span>
      </div>
    );
  };

  if (loading) {
    return (
      <>
        <Navbar />
        <main className="min-h-screen bg-gray-50 py-12">
          <div className="container mx-auto px-4">
            <div className="flex justify-center items-center h-96">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
            </div>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  if (!product) {
    return (
      <>
        <Navbar />
        <main className="min-h-screen bg-gray-50 py-12">
          <div className="container mx-auto px-4 text-center">
            <h1 className="text-2xl font-bold text-gray-800 mb-4">Produk Tidak Ditemukan</h1>
            <Link href="/products" className="text-purple-600 hover:text-purple-700">
              Kembali ke Katalog
            </Link>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  const currentPrice = getCurrentPrice();
  const currentStock = getCurrentStock();
  const isOutOfStock = currentStock <= 0;

  return (
    <>
      <Head>
        <title>{product.name} - Daka Store</title>
        <meta name="description" content={product.description?.slice(0, 160)} />
      </Head>

      <Navbar />

      {/* Toast Notification */}
      {showAddedToast && (
        <div className="fixed bottom-4 right-4 z-50 bg-green-500 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-slide-up">
          <CheckCircle className="w-5 h-5" />
          Berhasil ditambahkan ke keranjang
        </div>
      )}

      <main className="min-h-screen bg-gray-50 py-8">
        <div className="container mx-auto px-4">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
            <Link href="/" className="hover:text-purple-600">Beranda</Link>
            <ChevronLeft className="w-3 h-3" />
            <Link href="/products" className="hover:text-purple-600">Produk</Link>
            <ChevronLeft className="w-3 h-3" />
            <span className="text-gray-800 line-clamp-1">{product.name}</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Product Images */}
            <div>
              <div className="relative aspect-square bg-white rounded-lg shadow-sm overflow-hidden mb-4">
                {product.images && product.images.length > 0 && (
                  <Image
                    src={product.images[selectedImageIndex]?.imageUrl || '/placeholder.png'}
                    alt={product.name}
                    fill
                    className="object-cover"
                    priority
                  />
                )}
              </div>
              
              {/* Thumbnails */}
              {product.images && product.images.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {product.images.map((img, idx) => (
                    <button
                      key={img.id}
                      onClick={() => setSelectedImageIndex(idx)}
                      className={`relative w-20 h-20 flex-shrink-0 rounded-md overflow-hidden border-2 transition ${
                        selectedImageIndex === idx ? 'border-purple-600' : 'border-transparent'
                      }`}
                    >
                      <Image
                        src={img.imageUrl}
                        alt={`${product.name} ${idx + 1}`}
                        fill
                        className="object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Product Info */}
            <div>
              <div className="bg-white rounded-lg shadow-sm p-6">
                {/* Title & Rating */}
                <h1 className="text-2xl font-bold text-gray-800 mb-2">{product.name}</h1>
                
                <div className="flex items-center gap-4 mb-4">
                  {renderStars(product.ratingAvg)}
                  <span className="text-sm text-gray-500">| Terjual {product.soldCount}</span>
                  <Link
                    href={`/seller/${product.seller.id}`}
                    className="text-sm text-purple-600 hover:text-purple-700"
                  >
                    {product.seller.fullName}
                  </Link>
                </div>

                {/* Price */}
                <div className="mb-4">
                  <span className="text-3xl font-bold text-purple-600">
                    Rp{formatPrice(currentPrice)}
                  </span>
                  {selectedVariant && selectedVariant.priceAdjust !== 0 && (
                    <span className="ml-2 text-sm text-gray-400 line-through">
                      Rp{formatPrice(product.price)}
                    </span>
                  )}
                </div>

                {/* Variants */}
                {product.variants && product.variants.length > 0 && (
                  <div className="mb-6">
                    <p className="text-sm font-medium text-gray-700 mb-2">Varian:</p>
                    <div className="flex flex-wrap gap-2">
                      {product.variants.map((variant) => (
                        <button
                          key={variant.id}
                          onClick={() => setSelectedVariant(variant)}
                          className={`px-4 py-2 rounded-lg border text-sm transition ${
                            selectedVariant?.id === variant.id
                              ? 'border-purple-600 bg-purple-50 text-purple-600'
                              : 'border-gray-300 text-gray-600 hover:border-purple-300'
                          }`}
                        >
                          {variant.name}
                          {variant.priceAdjust > 0 && ` (+${formatPrice(variant.priceAdjust)})`}
                          {variant.priceAdjust < 0 && ` (${formatPrice(variant.priceAdjust)})`}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Quantity */}
                <div className="mb-6">
                  <p className="text-sm font-medium text-gray-700 mb-2">Jumlah:</p>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      disabled={quantity <= 1}
                      className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center disabled:opacity-50"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="w-12 text-center font-medium">{quantity}</span>
                    <button
                      onClick={() => setQuantity(Math.min(currentStock, quantity + 1))}
                      disabled={quantity >= currentStock}
                      className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center disabled:opacity-50"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                    <span className="text-sm text-gray-500">
                      Stok: {currentStock}
                    </span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 mb-6">
                  <button
                    onClick={addToCart}
                    disabled={isOutOfStock || addingToCart}
                    className="flex-1 bg-purple-600 text-white py-3 rounded-lg font-semibold hover:bg-purple-700 transition disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {addingToCart ? (
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    ) : (
                      <>
                        <ShoppingCart className="w-5 h-5" />
                        {isOutOfStock ? 'Stok Habis' : 'Masukkan Keranjang'}
                      </>
                    )}
                  </button>
                  
                  <button
                    onClick={toggleWishlist}
                    className="px-4 py-3 rounded-lg border border-gray-300 hover:border-purple-300 transition"
                  >
                    <Heart className={`w-5 h-5 ${inWishlist ? 'fill-red-500 text-red-500' : 'text-gray-600'}`} />
                  </button>
                  
                  <button className="px-4 py-3 rounded-lg border border-gray-300 hover:border-purple-300 transition">
                    <Share2 className="w-5 h-5 text-gray-600" />
                  </button>
                </div>

                {/* Delivery Info */}
                <div className="border-t border-gray-100 pt-4 space-y-2">
                  <div className="flex items-center gap-3 text-sm">
                    <Truck className="w-5 h-5 text-purple-600" />
                    <span className="text-gray-600">Pengiriman ke seluruh Indonesia</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <RefreshCw className="w-5 h-5 text-purple-600" />
                    <span className="text-gray-600">Garansi 7 hari</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <Shield className="w-5 h-5 text-purple-600" />
                    <span className="text-gray-600">Pembayaran aman via Midtrans</span>
                  </div>
                </div>

                {/* Chat Button */}
                <button
                  onClick={handleChat}
                  className="w-full mt-4 flex items-center justify-center gap-2 border border-purple-600 text-purple-600 py-2 rounded-lg hover:bg-purple-50 transition"
                >
                  <MessageCircle className="w-5 h-5" />
                  Chat Penjual
                </button>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="mt-8">
            <div className="flex gap-4 border-b border-gray-200">
              <button
                onClick={() => setActiveTab('detail')}
                className={`px-4 py-2 font-medium transition ${
                  activeTab === 'detail'
                    ? 'text-purple-600 border-b-2 border-purple-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Detail Produk
              </button>
              <button
                onClick={() => setActiveTab('review')}
                className={`px-4 py-2 font-medium transition ${
                  activeTab === 'review'
                    ? 'text-purple-600 border-b-2 border-purple-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Ulasan ({product.ratingCount})
              </button>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6 mt-4">
              {activeTab === 'detail' && (
                <div className="prose max-w-none">
                  <p className="text-gray-600 whitespace-pre-wrap">{product.description || 'Tidak ada deskripsi'}</p>
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <p className="text-sm text-gray-500">Berat: {product.weightGram / 1000} kg</p>
                  </div>
                </div>
              )}

              {activeTab === 'review' && (
                <div>
                  {reviews.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">Belum ada ulasan untuk produk ini</p>
                  ) : (
                    <div className="space-y-6">
                      {reviews.map((review) => (
                        <div key={review.id} className="border-b border-gray-100 pb-4 last:border-0">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                                <span className="text-purple-600 text-sm font-medium">
                                  {review.userName.charAt(0)}
                                </span>
                              </div>
                              <div>
                                <p className="font-medium text-gray-800">{review.userName}</p>
                                {renderStars(review.rating)}
                              </div>
                            </div>
                            <span className="text-xs text-gray-400">
                              {new Date(review.createdAt).toLocaleDateString('id-ID')}
                            </span>
                          </div>
                          <p className="text-gray-600 mt-2">{review.comment}</p>
                          {review.images && review.images.length > 0 && (
                            <div className="flex gap-2 mt-3">
                              {review.images.map((img, idx) => (
                                <div key={idx} className="relative w-16 h-16 rounded overflow-hidden">
                                  <Image src={img} alt={`Review ${idx + 1}`} fill className="object-cover" />
                                </div>
                              ))}
                            </div>
                          )}
                          {review.sellerReply && (
                            <div className="mt-3 pl-4 border-l-2 border-purple-200 bg-purple-50 p-3 rounded">
                              <p className="text-sm font-medium text-purple-600">Balasan Penjual:</p>
                              <p className="text-sm text-gray-600">{review.sellerReply}</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </>
  );
}