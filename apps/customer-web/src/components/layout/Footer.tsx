import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="bg-gray-800 text-white py-8 mt-8">
      <div className="container mx-auto text-center">
        <p>&copy; 2024 Daka Store Yogyakarta. All rights reserved.</p>
        <div className="flex justify-center gap-4 mt-4">
          <Link href="/terms" className="text-gray-400 hover:text-white">
            Syarat & Ketentuan
          </Link>
          <Link href="/privacy" className="text-gray-400 hover:text-white">
            Kebijakan Privasi
          </Link>
          <Link href="/contact" className="text-gray-400 hover:text-white">
            Kontak
          </Link>
        </div>
      </div>
    </footer>
  );
}