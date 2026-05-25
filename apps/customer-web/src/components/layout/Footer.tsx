import Link from 'next/link';
import { Facebook, Instagram, Twitter, Youtube, Mail, Phone, MapPin } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-300">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-gradient-to-r from-purple-600 to-purple-800 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">D</span>
              </div>
              <span className="font-bold text-xl text-white">
                Daka<span className="text-purple-500">Store</span>
              </span>
            </div>
            <p className="text-sm text-gray-400 mb-4">
              Marketplace terpercaya di Yogyakarta. Belanja mudah, aman, dan nyaman.
            </p>
            <div className="flex gap-3">
              <a href="#" className="text-gray-400 hover:text-purple-500 transition">
                <Facebook className="w-5 h-5" />
              </a>
              <a href="#" className="text-gray-400 hover:text-purple-500 transition">
                <Instagram className="w-5 h-5" />
              </a>
              <a href="#" className="text-gray-400 hover:text-purple-500 transition">
                <Twitter className="w-5 h-5" />
              </a>
              <a href="#" className="text-gray-400 hover:text-purple-500 transition">
                <Youtube className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* Informasi */}
          <div>
            <h3 className="text-white font-semibold mb-4">Informasi</h3>
            <ul className="space-y-2 text-sm">
              <li><Link href="/about" className="hover:text-purple-500 transition">Tentang Kami</Link></li>
              <li><Link href="/contact" className="hover:text-purple-500 transition">Hubungi Kami</Link></li>
              <li><Link href="/faq" className="hover:text-purple-500 transition">FAQ</Link></li>
              <li><Link href="/privacy" className="hover:text-purple-500 transition">Kebijakan Privasi</Link></li>
              <li><Link href="/terms" className="hover:text-purple-500 transition">Syarat & Ketentuan</Link></li>
            </ul>
          </div>

          {/* Belanja */}
          <div>
            <h3 className="text-white font-semibold mb-4">Belanja</h3>
            <ul className="space-y-2 text-sm">
              <li><Link href="/products" className="hover:text-purple-500 transition">Semua Produk</Link></li>
              <li><Link href="/flash-sale" className="hover:text-purple-500 transition">Flash Sale</Link></li>
              <li><Link href="/vouchers" className="hover:text-purple-500 transition">Voucher</Link></li>
              <li><Link href="/how-to-shop" className="hover:text-purple-500 transition">Cara Belanja</Link></li>
              <li><Link href="/payment-methods" className="hover:text-purple-500 transition">Metode Pembayaran</Link></li>
            </ul>
          </div>

          {/* Kontak */}
          <div>
            <h3 className="text-white font-semibold mb-4">Kontak</h3>
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2">
                <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>Jl. Malioboro No 123, Yogyakarta</span>
              </li>
              <li className="flex items-center gap-2">
                <Phone className="w-4 h-4" />
                <span>(0274) 1234567</span>
              </li>
              <li className="flex items-center gap-2">
                <Mail className="w-4 h-4" />
                <span>cs@dakastore.com</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 mt-8 pt-8 text-center text-sm text-gray-400">
          <p>&copy; {new Date().getFullYear()} Daka Store Yogyakarta. All rights reserved.</p>
          <p className="mt-1">Dibuat dengan 💜 untuk Yogyakarta</p>
        </div>
      </div>
    </footer>
  );
}