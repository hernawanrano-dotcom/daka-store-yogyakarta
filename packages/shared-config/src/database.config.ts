import { registerAs } from '@nestjs/config';

export const databaseConfig = registerAs('database', () => ({
  url: process.env.DATABASE_URL,
  poolMin: parseInt(process.env.DATABASE_POOL_MIN || '2', 10),
  poolMax: parseInt(process.env.DATABASE_POOL_MAX || '10', 10),
  timeout: parseInt(process.env.DATABASE_TIMEOUT || '30000', 10),
}));

export type DatabaseConfig = {
  url: string;
  poolMin: number;
  poolMax: number;
  timeout: number;
};