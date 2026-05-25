import {
  formatRupiah,
  parseRupiah,
  isValidAmount,
  calculateFee,
  calculateNetAmount,
  hasSufficientBalance,
  floatToRupiah,
} from '../balance.util';

describe('Balance Utils', () => {
  describe('formatRupiah', () => {
    it('should format integer to Rupiah string', () => {
      expect(formatRupiah(1500000)).toBe('1.500.000');
      expect(formatRupiah(50000)).toBe('50.000');
      expect(formatRupiah(100000000)).toBe('100.000.000');
    });

    it('should return "0" for invalid input', () => {
      expect(formatRupiah(NaN)).toBe('0');
      expect(formatRupiah(null as any)).toBe('0');
    });
  });

  describe('parseRupiah', () => {
    it('should parse Rupiah string to integer', () => {
      expect(parseRupiah('1.500.000')).toBe(1500000);
      expect(parseRupiah('50.000')).toBe(50000);
      expect(parseRupiah('100.000.000')).toBe(100000000);
    });

    it('should return 0 for invalid input', () => {
      expect(parseRupiah('invalid')).toBe(0);
      expect(parseRupiah('')).toBe(0);
    });
  });

  describe('isValidAmount', () => {
    it('should return true for valid amounts', () => {
      expect(isValidAmount(1000)).toBe(true);
      expect(isValidAmount(50000)).toBe(true);
      expect(isValidAmount(100000000)).toBe(true);
    });

    it('should return false for invalid amounts', () => {
      expect(isValidAmount(0)).toBe(false);
      expect(isValidAmount(-1000)).toBe(false);
      expect(isValidAmount(100.5)).toBe(false);
      expect(isValidAmount(200000000)).toBe(false);
    });
  });

  describe('calculateFee', () => {
    it('should calculate fee correctly', () => {
      expect(calculateFee(100000, 3)).toBe(3000);
      expect(calculateFee(150000, 3)).toBe(4500);
      expect(calculateFee(1000000, 10)).toBe(100000);
    });

    it('should floor the result', () => {
      expect(calculateFee(100000, 1)).toBe(1000);
    });
  });

  describe('calculateNetAmount', () => {
    it('should calculate net amount after fee', () => {
      expect(calculateNetAmount(100000, 3)).toBe(97000);
      expect(calculateNetAmount(150000, 3)).toBe(145500);
    });
  });

  describe('hasSufficientBalance', () => {
    it('should return true when balance is sufficient', () => {
      expect(hasSufficientBalance(100000, 50000)).toBe(true);
      expect(hasSufficientBalance(100000, 100000)).toBe(true);
    });

    it('should return false when balance is insufficient', () => {
      expect(hasSufficientBalance(100000, 150000)).toBe(false);
    });
  });

  describe('floatToRupiah', () => {
    it('should convert float to integer Rupiah', () => {
      expect(floatToRupiah(100.5)).toBe(101);
      expect(floatToRupiah(99.49)).toBe(99);
      expect(floatToRupiah(15000.75)).toBe(15001);
    });
  });
});
