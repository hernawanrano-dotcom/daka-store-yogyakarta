import { registerAs } from '@nestjs/config';

export const jwtConfig = registerAs('jwt', () => ({
  secret: process.env.JWT_SECRET,
  refreshSecret: process.env.JWT_REFRESH_SECRET,
  accessExpiry: parseInt(process.env.JWT_ACCESS_EXPIRY || '900', 10), // 15 menit
  refreshExpiry: parseInt(process.env.JWT_REFRESH_EXPIRY || '604800', 10), // 7 hari
}));

export type JwtConfig = {
  secret: string;
  refreshSecret: string;
  accessExpiry: number;
  refreshExpiry: number;
};