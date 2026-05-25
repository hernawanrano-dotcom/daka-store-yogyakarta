/**
 * Utility untuk handle uang (wajib integer Rupiah)
 * JANGAN PERNAH PAKAI FLOAT!
 */

/**
 * Format integer Rupiah ke string dengan pemisah ribuan
 * Contoh: 1500000 -> "1.500.000"
 */
export function formatRupiah(amount: number): string {
  if (typeof amount !== 'number' || isNaN(amount)) {
    return '0';
  }
  return amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/**
 * Parse string Rupiah ke integer
 * Contoh: "1.500.000" -> 1500000
 */
export function parseRupiah(rupiahString: string): number {
  const clean = rupiahString.replace(/\./g, '');
  const num = parseInt(clean, 10);
  return isNaN(num) ? 0 : num;
}

/**
 * Validasi apakah amount valid (integer positif, tidak lebih dari max)
 */
export function isValidAmount(amount: number, max: number = 100000000): boolean {
  return Number.isInteger(amount) && amount > 0 && amount <= max;
}

/**
 * Hitung fee berdasarkan percentage
 * @param amount - Jumlah dalam integer Rupiah
 * @param percentage - Persentase fee (contoh: 3 untuk 3%)
 * @returns Fee dalam integer Rupiah (pembulatan ke bawah)
 */
export function calculateFee(amount: number, percentage: number): number {
  return Math.floor(amount * percentage / 100);
}

/**
 * Hitung net amount setelah dipotong fee
 */
export function calculateNetAmount(amount: number, feePercentage: number): number {
  const fee = calculateFee(amount, feePercentage);
  return amount - fee;
}

/**
 * Validasi saldo cukup
 */
export function hasSufficientBalance(balance: number, requiredAmount: number): boolean {
  return balance >= requiredAmount;
}

/**
 * Konversi dari float ke integer Rupiah (jika terpaksa dapat float)
 * JANGAN PAKAI KALAU BISA! Lebih baik simpan integer dari awal.
 */
export function floatToRupiah(value: number): number {
  return Math.round(value);
}