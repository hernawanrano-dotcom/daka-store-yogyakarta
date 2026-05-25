import { registerAs } from '@nestjs/config';

export const redisConfig = registerAs('redis', () => ({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || '0', 10),
  ttlSession: parseInt(process.env.REDIS_TTL_SESSION || '86400', 10),
  ttlCache: parseInt(process.env.REDIS_TTL_CACHE || '300', 10),
}));

export type RedisConfig = {
  url: string;
  password?: string;
  db: number;
  ttlSession: number;
  ttlCache: number;
};