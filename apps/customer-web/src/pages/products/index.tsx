import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/router';
import { 
  Search, 
  Filter, 
  X, 
  ChevronDown, 
  Star, 
  Grid3X3, 
  List,
  SlidersHorizontal
} from 'lucide-react';
import Navbar from '../../components/layout/Navbar';
import Footer from '../../components/layout/Footer';

interface Product {
  id: string;
  name: string;
  slug: string;
  price: number;
  image: string;
  ratingAvg: number;
  soldCount: number;
  sellerName: string;
}

interface Category {
  id: string;
  name: string;
  slug: string;
}

interface FilterState {
  category: string;
  minPrice: number;
  maxPrice: number;
  sort: string;
}

export default function ProductsPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filters, setFilters] = useState<FilterState>({
    category: '',
    minPrice: 0,
    maxPrice: 0,
    sort: 'newest',
  });
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    // Get query params from URL
    const { category, search, sort, minPrice, maxPrice } = router.query;
    setFilters({
      category: (category as string) || '',
      minPrice: minPrice ? parseInt(minPrice as string) : 0,
      maxPrice: maxPrice ? parseInt(maxPrice as string) : 0,
      sort: (sort as string) || 'newest',
    });
    setSearchQuery((search as string) || '');
    fetchProducts();
    fetchCategories();
  }, [router.query, page]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('limit', '20');
      if (filters.category) params.append('category', filters.category);
      if (filters.minPrice > 0) params.append('minPrice', filters.minPrice.toString());
      if (filters.maxPrice > 0) params.append('maxPrice', filters.maxPrice.toString());
      if (filters.sort) params.append('sort', filters.sort);
      if (searchQuery) params.append('search', searchQuery);

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/products?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setProducts(data.data || []);
        setTotalPages(data.meta?.totalPages || 1);
      }
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/products/categories`);
      if (res.ok) {
        const data = await res.json();
        setCategories(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const updateFilters = (newFilters: Partial<FilterState>) => {
    const updated = { ...filters, ...newFilters };
    setFilters(updated);
    setPage(1);
    
    // Update URL
    const query: any = {};
    if (updated.category) query.category = updated.category;
    if (updated.minPrice > 0) query.minPrice = updated.minPrice;
    if (updated.maxPrice > 0) query.maxPrice = updated.maxPrice;
    if (updated.sort !== 'newest') query.sort = updated.sort;
    if (searchQuery) query.search = searchQuery;
    
    router.push({ pathname: '/products', query }, undefined, { shallow: true });
  };

  const clearFilters = () => {
    setFilters({ category: '', minPrice: 0, maxPrice: 0, sort: 'newest' });
    setSearchQuery('');
    router.push('/products');
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
        <span className="ml-1 text-xs text-gray-500">({rating})</span>
      </div>
    );
  };

  const sortOptions = [
    { value: 'newest', label: 'Terbaru' },
    { value: 'price_asc', label: 'Harga Terendah' },
    { value: 'price_desc', label: 'Harga Tertinggi' },
    { value: 'popular', label: 'Terlaris' },
  ];

  const priceRanges = [
    { label: 'Semua Harga', min: 0, max: 0 },
    { label: 'Rp 0 - Rp 50.000', min: 0, max: 50000 },
    { label: 'Rp 50.000 - Rp 100.000', min: 50000, max: 100000 },
    { label: 'Rp 100.000 - Rp 200.000', min: 100000, max: 200000 },
    { label: 'Rp 200.000 - Rp 500.000', min: 200000, max: 500000 },
    { label: 'Rp 500.000+', min: 500000, max: 0 },
  ];

  return (
    <>
      <Head>
        <title>Produk - Daka Store</title>
      </Head>

      <Navbar />

      <main className="min-h-screen bg-gray-50 py-8">
        <div className="container mx-auto px-4">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-800">Katalog Produk</h1>
            <p className="text-gray-500 mt-1">Temukan produk terbaik untuk kebutuhan Anda</p>
          </div>

          {/* Search Bar */}
          <div className="mb-6">
            <div className="relative max-w-md">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchProducts()}
                placeholder="Cari produk..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500"
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            </div>
          </div>

          {/* Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 hover:border-purple-300 transition"
              >
                <SlidersHorizontal className="w-4 h-4" />
                Filter
                {(filters.category || filters.minPrice > 0 || filters.maxPrice > 0) && (
                  <span className="w-2 h-2 bg-purple-600 rounded-full"></span>
                )}
              </button>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded-lg transition ${
                    viewMode === 'grid' ? 'bg-purple-600 text-white' : 'bg-white text-gray-600'
                  }`}
                >
                  <Grid3X3 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded-lg transition ${
                    viewMode === 'list' ? 'bg-purple-600 text-white' : 'bg-white text-gray-600'
                  }`}
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">Urutkan:</span>
              <select
                value={filters.sort}
                onChange={(e) => updateFilters({ sort: e.target.value })}
                className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-purple-500"
              >
                {sortOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Filter Panel */}
          {showFilters && (
            <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-800">Filter Produk</h3>
                <button onClick={clearFilters} className="text-sm text-purple-600 hover:text-purple-700">
                  Reset Filter
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Categories */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Kategori</label>
                  <select
                    value={filters.category}
                    onChange={(e) => updateFilters({ category: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500"
                  >
                    <option value="">Semua Kategori</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.slug}>{cat.name}</option>
                    ))}
                  </select>
                </div>

                {/* Price Range */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Rentang Harga</label>
                  <select
                    value={priceRanges.findIndex(r => r.min === filters.minPrice && r.max === filters.maxPrice)}
                    onChange={(e) => {
                      const range = priceRanges[parseInt(e.target.value)];
                      updateFilters({ minPrice: range.min, maxPrice: range.max });
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500"
                  >
                    {priceRanges.map((range, idx) => (
                      <option key={idx} value={idx}>{range.label}</option>
                    ))}
                  </select>
                </div>

                {/* Active Filters */}
                {(filters.category || filters.minPrice > 0 || filters.maxPrice > 0) && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Filter Aktif</label>
                    <div className="flex flex-wrap gap-2">
                      {filters.category && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-600 text-xs rounded">
                          Kategori: {categories.find(c => c.slug === filters.category)?.name}
                          <button onClick={() => updateFilters({ category: '' })}>
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      )}
                      {(filters.minPrice > 0 || filters.maxPrice > 0) && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-600 text-xs rounded">
                          Harga: {filters.minPrice > 0 ? `Rp${formatPrice(filters.minPrice)}` : 'Rp0'} - {filters.maxPrice > 0 ? `Rp${formatPrice(filters.maxPrice)}` : '∞'}
                          <button onClick={() => updateFilters({ minPrice: 0, maxPrice: 0 })}>
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Products Grid/List */}
          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
            </div>
          ) : products.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm p-12 text-center">
              <Search className="w-20 h-20 text-gray-300 mx-auto mb-4" />
              <h2 className="text-xl font-medium text-gray-600 mb-2">Produk Tidak Ditemukan</h2>
              <p className="text-gray-400 mb-6">Coba ubah filter atau kata kunci pencarian</p>
              <button
                onClick={clearFilters}
                className="text-purple-600 hover:text-purple-700"
              >
                Reset Filter
              </button>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {products.map((product) => (
                <Link
                  key={product.id}
                  href={`/products/${product.slug}`}
                  className="bg-white rounded-lg shadow-sm hover:shadow-md transition overflow-hidden group"
                >
                  <div className="relative aspect-square bg-gray-100">
                    <Image
                      src={product.image || '/placeholder.png'}
                      alt={product.name}
                      fill
                      className="object-cover group-hover:scale-105 transition duration-300"
                    />
                  </div>
                  <div className="p-3">
                    <h3 className="font-medium text-gray-800 line-clamp-2 min-h-[48px] text-sm">
                      {product.name}
                    </h3>
                    <div className="mt-2">
                      <span className="text-base font-bold text-purple-600">
                        Rp{formatPrice(product.price)}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                      {renderStars(product.ratingAvg)}
                      <span>| Terjual {product.soldCount}</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1 line-clamp-1">{product.sellerName}</p>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {products.map((product) => (
                <Link
                  key={product.id}
                  href={`/products/${product.slug}`}
                  className="bg-white rounded-lg shadow-sm hover:shadow-md transition overflow-hidden flex gap-4 p-4"
                >
                  <div className="relative w-24 h-24 flex-shrink-0 bg-gray-100 rounded-lg overflow-hidden">
                    <Image
                      src={product.image || '/placeholder.png'}
                      alt={product.name}
                      fill
                      className="object-cover"
                    />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-800 hover:text-purple-600 line-clamp-2">
                      {product.name}
                    </h3>
                    <div className="mt-1 flex items-center gap-3 text-sm">
                      <span className="font-bold text-purple-600">Rp{formatPrice(product.price)}</span>
                      <span className="text-gray-400">|</span>
                      {renderStars(product.ratingAvg)}
                      <span className="text-gray-400">|</span>
                      <span className="text-gray-500">Terjual {product.soldCount}</span>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">{product.sellerName}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-8">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50 transition"
              >
                Sebelumnya
              </button>
              <span className="px-4 py-2 text-gray-600">
                Halaman {page} dari {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50 transition"
              >
                Selanjutnya
              </button>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </>
  );
}