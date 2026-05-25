import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { createClient, RedisClientType } from 'redis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly client: RedisClientType;

  constructor() {
    this.client = createClient({
      url:
        process.env.REDIS_URL ||
        `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || '6379'}`,
      password: process.env.REDIS_PASSWORD || undefined,
      database: process.env.REDIS_DB ? parseInt(process.env.REDIS_DB, 10) : 0,
    });

    this.client.on('error', (error) => this.logger.error('Redis Client Error', error));
  }

  async onModuleInit() {
    await this.client.connect();
    this.logger.log('Redis connected');
  }

  async onModuleDestroy() {
    await this.client.disconnect();
    this.logger.log('Redis disconnected');
  }

  get clientInstance() {
    return this.client;
  }

  async get(key: string) {
    return this.client.get(key);
  }

  async set(key: string, value: string | number, ttlSeconds?: number) {
    if (ttlSeconds) {
      return this.client.set(key, String(value), { EX: ttlSeconds });
    }

    return this.client.set(key, String(value));
  }

  async del(key: string) {
    return this.client.del(key);
  }

  async setnx(key: string, value: string, expireSeconds?: number) {
    const success = await this.client.setNX(key, value);

    if (success && expireSeconds) {
      await this.client.expire(key, expireSeconds);
    }

    return success;
  }

  async incrBy(key: string, increment: number) {
    return this.client.incrBy(key, increment);
  }

  async decrBy(key: string, decrement: number) {
    return this.client.decrBy(key, decrement);
  }

  async expire(key: string, seconds: number) {
    return this.client.expire(key, seconds);
  }

  pipeline(): any {
    return this.client.multi();
  }
}
