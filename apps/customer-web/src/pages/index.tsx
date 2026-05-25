import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import Image from 'next/image';
import { ChevronRight, Star, Clock, TrendingUp, Zap } from 'lucide-react';
import Navbar from '../components/layout/Navbar';
import Footer from '../components/layout/Footer';

interface Product {
  id: string;
  name: string;
  slug: string;
  price: number;
  image: string;
  ratingAvg: number;
  soldCount: number;
}

interface Category {
  id: string;
  name: string;
  slug: string;
  image?: string;
}

interface FlashSaleItem {
  id: string;
  productId: string;
  productName: string;
  flashPrice: number;
  originalPrice: number;
  flashStock: number;
  soldCount: number;
  image: string;
  endTime: string;
}

export default function HomePage() {
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [flashSales, setFlashSales] = useState<FlashSaleItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHomeData();
  }, []);

  const fetchHomeData = async () => {
    try {
      // Fetch products
      const productsRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/products?isFeatured=true&limit=8`);
      const productsData = await productsRes.json();
      setFeaturedProducts(productsData.data || []);

      // Fetch categories
      const categoriesRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/products/categories`);
      const categoriesData = await categoriesRes.json();
      setCategories(categoriesData.data?.slice(0, 6) || []);

      // Fetch flash sales
      const flashRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/flash-sale/active`);
      const flashData = await flashRes.json();
      setFlashSales(flashData.data?.items?.slice(0, 4) || []);
    } catch (error) {
      console.error('Error fetching home data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('id-ID').format(price);
  };

  const calculateDiscount = (original: number, flash: number) => {
    return Math.round(((original - flash) / original) * 100);
  };

  return (
    <>
      <Head>
        <title>Daka Store Yogyakarta - Marketplace Terpercaya di Jogja</title>
        <meta name="description" content="Toko online terlengkap di Yogyakarta" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#8B5CF6" />
      </Head>

      <Navbar />

      <main className="min-h-screen bg-gray-50">
        {/* Hero Banner */}
        <section className="relative bg-gradient-to-r from-purple-600 to-purple-800 text-white">
          <div className="container mx-auto px-4 py-16 md:py-24">
            <div className="max-w-2xl">
              <h1 className="text-4xl md:text-5xl font-bold mb-4">
                Belanja Mudah di Daka Store
              </h1>
              <p className="text-lg md:text-xl mb-6 text-purple-100">
                Temukan berbagai produk terbaik dari seller terpercaya di Yogyakarta
              </p>
              <Link
                href="/products"
                className="inline-flex items-center gap-2 bg-white text-purple-600 px-6 py-3 rounded-lg font-semibold hover:bg-gray-100 transition"
              >
                Belanja Sekarang <ChevronRight className="w-5 h-5" />
              </Link>
            </div>
          </div>
        </section>

        {/* Flash Sale Section */}
        {flashSales.length > 0 && (
          <section className="container mx-auto px-4 py-12">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Zap className="w-6 h-6 text-orange-500" />
                <h2 className="text-2xl font-bold text-gray-800">Flash Sale</h2>
              </div>
              <Link href="/flash-sale" className="text-purple-600 hover:text-purple-700 flex items-center gap-1">
                Lihat Semua <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {flashSales.map((item) => (
                <Link
                  key={item.id}
                  href={`/products/${item.productId}`}
                  className="bg-white rounded-lg shadow-sm hover:shadow-md transition overflow-hidden"
                >
                  <div className="relative aspect-square">
                    <Image
                      src={item.image || '/placeholder.png'}
                      alt={item.productName}
                      fill
                      className="object-cover"
                    />
                    <div className="absolute top-2 left-2 bg-red-500 text-white text-xs px-2 py-1 rounded">
                      -{calculateDiscount(item.originalPrice, item.flashPrice)}%
                    </div>
                  </div>
                  <div className="p-3">
                    <h3 className="font-medium text-gray-800 line-clamp-1">{item.productName}</h3>
                    <div className="mt-1">
                      <span className="text-lg font-bold text-red-600">
                        Rp{formatPrice(item.flashPrice)}
                      </span>
                      <span className="text-sm text-gray-400 line-through ml-2">
                        Rp{formatPrice(item.originalPrice)}
                      </span>
                    </div>
                    <div className="mt-2 text-xs text-gray-500">
                      Terjual {item.soldCount}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Categories Section */}
        <section className="container mx-auto px-4 py-12 bg-white">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Kategori Populer</h2>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
            {categories.map((category) => (
              <Link
                key={category.id}
                href={`/products?category=${category.slug}`}
                className="text-center group"
              >
                <div className="aspect-square bg-gray-100 rounded-full flex items-center justify-center mb-2 group-hover:bg-purple-100 transition">
                  {category.image ? (
                    <Image src={category.image} alt={category.name} width={60} height={60} className="rounded-full" />
                  ) : (
                    <div className="w-16 h-16 bg-purple-200 rounded-full flex items-center justify-center">
                      <span className="text-2xl">📦</span>
                    </div>
                  )}
                </div>
                <span className="text-sm text-gray-600 group-hover:text-purple-600">
                  {category.name}
                </span>
              </Link>
            ))}
          </div>
        </section>

        {/* Featured Products Section */}
        <section className="container mx-auto px-4 py-12">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-purple-600" />
              <h2 className="text-2xl font-bold text-gray-800">Produk Rekomendasi</h2>
            </div>
            <Link href="/products" className="text-purple-600 hover:text-purple-700 flex items-center gap-1">
              Lihat Semua <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
          
          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="bg-white rounded-lg shadow-sm p-4 animate-pulse">
                  <div className="aspect-square bg-gray-200 rounded mb-3"></div>
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-5 bg-gray-200 rounded w-1/2"></div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {featuredProducts.map((product) => (
                <Link
                  key={product.id}
                  href={`/products/${product.slug}`}
                  className="bg-white rounded-lg shadow-sm hover:shadow-md transition overflow-hidden"
                >
                  <div className="relative aspect-square">
                    <Image
                      src={product.image || '/placeholder.png'}
                      alt={product.name}
                      fill
                      className="object-cover"
                    />
                  </div>
                  <div className="p-3">
                    <h3 className="font-medium text-gray-800 line-clamp-2 min-h-[48px]">
                      {product.name}
                    </h3>
                    <div className="mt-2">
                      <span className="text-lg font-bold text-purple-600">
                        Rp{formatPrice(product.price)}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-sm text-gray-500">
                      <div className="flex items-center gap-0.5">
                        <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                        <span>{product.ratingAvg || 0}</span>
                      </div>
                      <span>•</span>
                      <span>Terjual {product.soldCount || 0}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </main>

      <Footer />
    </>
  );
}