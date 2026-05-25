import { useState, useEffect } from 'react';
import { 
  Search, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Eye,
  MessageSquare,
  FileText
} from 'lucide-react';
import Sidebar from '../components/layout/Sidebar';
import Header from '../components/layout/Header';

interface Dispute {
  id: string;
  orderId: string;
  buyerId: string;
  buyerName: string;
  sellerId: string;
  sellerName: string;
  reason: string;
  description: string;
  evidenceUrls: string[];
  proposedAmount: number;
  status: 'OPEN' | 'UNDER_REVIEW' | 'RESOLVED_BUYER_WIN' | 'RESOLVED_SELLER_WIN' | 'CLOSED';
  createdAt: string;
  adminNotes?: string;
}

export default function DisputesPage() {
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedDispute, setSelectedDispute] = useState<Dispute | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [resolutionVerdict, setResolutionVerdict] = useState<'BUYER_WIN' | 'SELLER_WIN'>('BUYER_WIN');

  useEffect(() => {
    fetchDisputes();
  }, [statusFilter]);

  const fetchDisputes = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const url = `${import.meta.env.VITE_API_URL}/api/v1/admin/disputes${statusFilter !== 'all' ? `?status=${statusFilter}` : ''}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setDisputes(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching disputes:', error);
    } finally {
      setLoading(false);
    }
  };

  const resolveDispute = async () => {
    if (!selectedDispute) return;

    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/v1/admin/disputes/${selectedDispute.id}/resolve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          verdict: resolutionVerdict,
          notes: resolutionNotes,
        }),
      });

      if (res.ok) {
        fetchDisputes();
        setShowModal(false);
        setSelectedDispute(null);
        setResolutionNotes('');
      }
    } catch (error) {
      console.error('Error resolving dispute:', error);
    }
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'OPEN':
        return { label: 'Terbuka', color: 'bg-yellow-100 text-yellow-800', icon: AlertTriangle };
      case 'UNDER_REVIEW':
        return { label: 'Ditinjau', color: 'bg-blue-100 text-blue-800', icon: MessageSquare };
      case 'RESOLVED_BUYER_WIN':
        return { label: 'Pembeli Menang', color: 'bg-green-100 text-green-800', icon: CheckCircle };
      case 'RESOLVED_SELLER_WIN':
        return { label: 'Penjual Menang', color: 'bg-green-100 text-green-800', icon: CheckCircle };
      case 'CLOSED':
        return { label: 'Tutup', color: 'bg-gray-100 text-gray-800', icon: XCircle };
      default:
        return { label: status, color: 'bg-gray-100 text-gray-800', icon: AlertTriangle };
    }
  };

  const getReasonText = (reason: string) => {
    const reasons: Record<string, string> = {
      ITEM_NOT_RECEIVED: 'Barang Tidak Diterima',
      ITEM_NOT_AS_DESCRIBED: 'Barang Tidak Sesuai Deskripsi',
      DAMAGED_ITEM: 'Barang Rusak',
      COUNTERFEIT: 'Barang Palsu',
      OTHER: 'Lainnya',
    };
    return reasons[reason] || reason;
  };

  const filteredDisputes = disputes.filter(dispute =>
    dispute.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    dispute.buyerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    dispute.sellerName.toLowerCase().includes(searchQuery.toLowerCase())
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
        <Header title="Manajemen Dispute" />

        <main className="p-6">
          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-yellow-50 rounded-xl p-4 border-l-4 border-yellow-500">
              <p className="text-sm text-yellow-700">Terbuka</p>
              <p className="text-2xl font-bold text-yellow-800">
                {disputes.filter(d => d.status === 'OPEN').length}
              </p>
            </div>
            <div className="bg-blue-50 rounded-xl p-4 border-l-4 border-blue-500">
              <p className="text-sm text-blue-700">Ditinjau</p>
              <p className="text-2xl font-bold text-blue-800">
                {disputes.filter(d => d.status === 'UNDER_REVIEW').length}
              </p>
            </div>
            <div className="bg-green-50 rounded-xl p-4 border-l-4 border-green-500">
              <p className="text-sm text-green-700">Selesai</p>
              <p className="text-2xl font-bold text-green-800">
                {disputes.filter(d => d.status === 'RESOLVED_BUYER_WIN' || d.status === 'RESOLVED_SELLER_WIN').length}
              </p>
            </div>
            <div className="bg-gray-50 rounded-xl p-4 border-l-4 border-gray-500">
              <p className="text-sm text-gray-700">Total</p>
              <p className="text-2xl font-bold text-gray-800">{disputes.length}</p>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari dispute..."
                className="pl-10 pr-4 py-2 w-80 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500"
            >
              <option value="all">Semua Status</option>
              <option value="OPEN">Terbuka</option>
              <option value="UNDER_REVIEW">Ditinjau</option>
              <option value="RESOLVED_BUYER_WIN">Pembeli Menang</option>
              <option value="RESOLVED_SELLER_WIN">Penjual Menang</option>
              <option value="CLOSED">Tutup</option>
            </select>
          </div>

          {/* Disputes Table */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID Dispute</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pembeli vs Penjual</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Alasan</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Jumlah</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tanggal</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredDisputes.map((dispute) => {
                    const status = getStatusBadge(dispute.status);
                    const StatusIcon = status.icon;
                    return (
                      <tr key={dispute.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <span className="font-mono text-sm">{dispute.id.slice(-8)}</span>
                        </td>
                        <td className="px-6 py-4">
                          <p className="font-medium text-gray-800">{dispute.buyerName}</p>
                          <p className="text-sm text-gray-500">vs</p>
                          <p className="font-medium text-gray-800">{dispute.sellerName}</p>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {getReasonText(dispute.reason)}
                        </td>
                        <td className="px-6 py-4 text-sm font-medium text-purple-600">
                          Rp{formatPrice(dispute.proposedAmount)}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {formatDate(dispute.createdAt)}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs ${status.color}`}>
                            <StatusIcon className="w-3 h-3" />
                            {status.label}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => {
                              setSelectedDispute(dispute);
                              setShowModal(true);
                            }}
                            className="flex items-center gap-1 text-purple-600 hover:text-purple-700 text-sm"
                          >
                            <Eye className="w-4 h-4" />
                            Detail
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {filteredDisputes.length === 0 && (
              <div className="text-center py-12">
                <AlertTriangle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">Tidak ada dispute</p>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Dispute Detail Modal */}
      {showModal && selectedDispute && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-auto">
            <div className="p-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-800">Detail Dispute</h2>
              <p className="text-sm text-gray-500">ID: {selectedDispute.id}</p>
            </div>

            <div className="p-4 space-y-4">
              {/* Parties */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-blue-50 p-3 rounded-lg">
                  <p className="text-sm text-blue-700">Pembeli</p>
                  <p className="font-medium">{selectedDispute.buyerName}</p>
                </div>
                <div className="bg-purple-50 p-3 rounded-lg">
                  <p className="text-sm text-purple-700">Penjual</p>
                  <p className="font-medium">{selectedDispute.sellerName}</p>
                </div>
              </div>

              {/* Dispute Details */}
              <div>
                <p className="text-sm text-gray-500">Alasan Dispute</p>
                <p className="font-medium">{getReasonText(selectedDispute.reason)}</p>
              </div>

              <div>
                <p className="text-sm text-gray-500">Deskripsi</p>
                <p className="text-gray-700">{selectedDispute.description}</p>
              </div>

              <div>
                <p className="text-sm text-gray-500 mb-2">Bukti</p>
                <div className="flex gap-2">
                  {selectedDispute.evidenceUrls.map((url, idx) => (
                    <a
                      key={idx}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-purple-600 hover:text-purple-700 text-sm"
                    >
                      <FileText className="w-4 h-4" />
                      Bukti {idx + 1}
                    </a>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-sm text-gray-500">Jumlah yang Disengketakan</p>
                <p className="text-xl font-bold text-purple-600">Rp{formatPrice(selectedDispute.proposedAmount)}</p>
              </div>

              {/* Resolution Form for OPEN/UNDER_REVIEW */}
              {(selectedDispute.status === 'OPEN' || selectedDispute.status === 'UNDER_REVIEW') && (
                <div className="border-t border-gray-100 pt-4">
                  <h3 className="font-semibold text-gray-800 mb-3">Resolusi Dispute</h3>
                  
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Verdict</label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          value="BUYER_WIN"
                          checked={resolutionVerdict === 'BUYER_WIN'}
                          onChange={() => setResolutionVerdict('BUYER_WIN')}
                          className="text-purple-600"
                        />
                        <span>Pembeli Menang (Refund)</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          value="SELLER_WIN"
                          checked={resolutionVerdict === 'SELLER_WIN'}
                          onChange={() => setResolutionVerdict('SELLER_WIN')}
                          className="text-purple-600"
                        />
                        <span>Penjual Menang</span>
                      </label>
                    </div>
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Catatan Admin</label>
                    <textarea
                      rows={3}
                      value={resolutionNotes}
                      onChange={(e) => setResolutionNotes(e.target.value)}
                      placeholder="Berikan alasan keputusan..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowModal(false)}
                      className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                    >
                      Batal
                    </button>
                    <button
                      onClick={resolveDispute}
                      className="flex-1 bg-purple-600 text-white py-2 rounded-lg hover:bg-purple-700 transition"
                    >
                      Selesaikan Dispute
                    </button>
                  </div>
                </div>
              )}

              {/* Resolution Result */}
              {selectedDispute.status !== 'OPEN' && selectedDispute.status !== 'UNDER_REVIEW' && (
                <div className="border-t border-gray-100 pt-4">
                  <h3 className="font-semibold text-gray-800 mb-3">Hasil Resolusi</h3>
                  <div className={`p-3 rounded-lg ${
                    selectedDispute.status === 'RESOLVED_BUYER_WIN' ? 'bg-green-50' : 'bg-red-50'
                  }`}>
                    <p className={`font-medium ${
                      selectedDispute.status === 'RESOLVED_BUYER_WIN' ? 'text-green-700' : 'text-red-700'
                    }`}>
                      {selectedDispute.status === 'RESOLVED_BUYER_WIN' ? 'Pembeli Menang' : 'Penjual Menang'}
                    </p>
                    {selectedDispute.adminNotes && (
                      <p className="text-sm text-gray-600 mt-2">{selectedDispute.adminNotes}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}