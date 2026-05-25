import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/router';
import { 
  ShoppingCart, 
  Heart, 
  User, 
  Menu, 
  X, 
  Search,
  LogOut,
  Package,
  Settings,
  Store
} from 'lucide-react';

interface User {
  id: string;
  email: string;
  fullName: string;
  role: string;
  avatar?: string;
}

export default function Navbar() {
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [cartCount, setCartCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    checkAuth();
    fetchCartCount();
  }, []);

  const checkAuth = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      if (token) {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/users/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setUser(data.data);
        }
      }
    } catch (error) {
      console.error('Error checking auth:', error);
    }
  };

  const fetchCartCount = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const sessionId = localStorage.getItem('sessionId');
      
      let url = `${process.env.NEXT_PUBLIC_API_URL}/api/v1/cart`;
      if (!token && sessionId) {
        url += `?sessionId=${sessionId}`;
      }
      
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      
      if (res.ok) {
        const data = await res.json();
        setCartCount(data.data?.totalItems || 0);
      }
    } catch (error) {
      console.error('Error fetching cart:', error);
    }
  };

  const handleLogout = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (error) {
      console.error('Error logging out:', error);
    } finally {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      setUser(null);
      router.push('/');
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/products?search=${encodeURIComponent(searchQuery)}`);
    }
  };

  const switchRole = async () => {
    const newRole = user?.role === 'buyer' ? 'seller' : 'buyer';
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/users/switch-role`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ role: newRole }),
      });
      
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem('accessToken', data.data.accessToken);
        if (newRole === 'seller') {
          window.location.href = 'http://localhost:3002';
        } else {
          window.location.reload();
        }
      }
    } catch (error) {
      console.error('Error switching role:', error);
    }
  };

  return (
    <nav className="bg-white shadow-md sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-r from-purple-600 to-purple-800 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">D</span>
            </div>
            <span className="font-bold text-xl text-gray-800">
              Daka<span className="text-purple-600">Store</span>
            </span>
          </Link>

          {/* Search Bar - Desktop */}
          <form onSubmit={handleSearch} className="hidden md:flex flex-1 max-w-md mx-8">
            <div className="relative w-full">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari produk..."
                className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
              />
              <button type="submit" className="absolute right-3 top-2.5">
                <Search className="w-5 h-5 text-gray-400" />
              </button>
            </div>
          </form>

          {/* Navigation Icons */}
          <div className="flex items-center gap-4">
            <Link href="/wishlist" className="text-gray-600 hover:text-purple-600 transition">
              <Heart className="w-6 h-6" />
            </Link>
            
            <Link href="/cart" className="text-gray-600 hover:text-purple-600 transition relative">
              <ShoppingCart className="w-6 h-6" />
              {cartCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-purple-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {cartCount > 9 ? '9+' : cartCount}
                </span>
              )}
            </Link>

            {/* User Menu */}
            {user ? (
              <div className="relative">
                <button
                  onClick={() => setIsProfileOpen(!isProfileOpen)}
                  className="flex items-center gap-2 text-gray-600 hover:text-purple-600 transition"
                >
                  {user.avatar ? (
                    <Image src={user.avatar} alt={user.fullName} width={32} height={32} className="rounded-full" />
                  ) : (
                    <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                      <User className="w-5 h-5 text-purple-600" />
                    </div>
                  )}
                  <span className="hidden md:inline text-sm">{user.fullName.split(' ')[0]}</span>
                </button>

                {isProfileOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-100 z-50">
                    <div className="p-3 border-b border-gray-100">
                      <p className="font-medium text-gray-800">{user.fullName}</p>
                      <p className="text-sm text-gray-500">{user.email}</p>
                      <span className="inline-block mt-1 text-xs px-2 py-0.5 bg-purple-100 text-purple-600 rounded">
                        {user.role === 'seller' ? 'Penjual' : 'Pembeli'}
                      </span>
                    </div>
                    
                    <div className="py-1">
                      <Link
                        href="/profile"
                        className="flex items-center gap-3 px-4 py-2 text-gray-700 hover:bg-gray-50 transition"
                        onClick={() => setIsProfileOpen(false)}
                      >
                        <User className="w-4 h-4" />
                        <span>Profil Saya</span>
                      </Link>
                      
                      <Link
                        href="/orders"
                        className="flex items-center gap-3 px-4 py-2 text-gray-700 hover:bg-gray-50 transition"
                        onClick={() => setIsProfileOpen(false)}
                      >
                        <Package className="w-4 h-4" />
                        <span>Pesanan Saya</span>
                      </Link>
                      
                      <Link
                        href="/profile/addresses"
                        className="flex items-center gap-3 px-4 py-2 text-gray-700 hover:bg-gray-50 transition"
                        onClick={() => setIsProfileOpen(false)}
                      >
                        <Settings className="w-4 h-4" />
                        <span>Alamat Saya</span>
                      </Link>
                      
                      <button
                        onClick={switchRole}
                        className="w-full flex items-center gap-3 px-4 py-2 text-gray-700 hover:bg-gray-50 transition"
                      >
                        <Store className="w-4 h-4" />
                        <span>{user.role === 'buyer' ? 'Jadi Penjual' : 'Jadi Pembeli'}</span>
                      </button>
                      
                      <hr className="my-1" />
                      
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-4 py-2 text-red-600 hover:bg-red-50 transition"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>Keluar</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <Link
                href="/auth/login"
                className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition"
              >
                Masuk
              </Link>
            )}

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="md:hidden text-gray-600"
            >
              {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Search */}
        <div className="md:hidden pb-3">
          <form onSubmit={handleSearch} className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari produk..."
              className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500"
            />
            <button type="submit" className="absolute right-3 top-2.5">
              <Search className="w-5 h-5 text-gray-400" />
            </button>
          </form>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden py-4 border-t border-gray-100">
            <Link
              href="/wishlist"
              className="block py-2 text-gray-600 hover:text-purple-600"
              onClick={() => setIsMenuOpen(false)}
            >
              Wishlist
            </Link>
            <Link
              href="/orders"
              className="block py-2 text-gray-600 hover:text-purple-600"
              onClick={() => setIsMenuOpen(false)}
            >
              Pesanan Saya
            </Link>
            <Link
              href="/profile"
              className="block py-2 text-gray-600 hover:text-purple-600"
              onClick={() => setIsMenuOpen(false)}
            >
              Profil Saya
            </Link>
          </div>
        )}
      </div>
    </nav>
  );
}