import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { Request, Response, NextFunction } from 'express';
import { firstValueFrom } from 'rxjs';
import * as axios from 'axios';

@Injectable()
export class GatewayService {
  private readonly logger = new Logger(GatewayService.name);
  private readonly backendUrl: string;

  constructor(
    private httpService: HttpService,
    private configService: ConfigService
  ) {
    this.backendUrl = this.configService.get('BACKEND_URL', 'http://localhost:3000');
  }

  async proxyRequest(req: Request, res: Response, next: NextFunction) {
    try {
      const targetUrl = `${this.backendUrl}${req.originalUrl}`;

      // Prepare headers (forward relevant ones)
      const headers: Record<string, string> = {
        'Content-Type': (req.headers['content-type'] as string) || 'application/json',
      };

      // Forward authorization header
      if (req.headers['authorization']) {
        headers['Authorization'] = req.headers['authorization'] as string;
      }

      // Forward device ID
      if (req.headers['x-device-id']) {
        headers['X-Device-ID'] = req.headers['x-device-id'] as string;
      }

      // Forward request ID
      if (req.headers['x-request-id']) {
        headers['X-Request-ID'] = req.headers['x-request-id'] as string;
      }

      // Forward user agent
      if (req.headers['user-agent']) {
        headers['User-Agent'] = req.headers['user-agent'] as string;
      }

      // Forward IP
      if (req.ip) {
        headers['X-Forwarded-For'] = req.ip;
      }

      this.logger.debug(`Proxying ${req.method} ${req.originalUrl} -> ${targetUrl}`);

      const response = await firstValueFrom(
        this.httpService.request({
          method: req.method as any,
          url: targetUrl,
          data: req.body,
          headers,
          params: req.query,
        })
      );

      // Forward response status and body
      res.status(response.status).json(response.data);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status || 500;
        const data = error.response?.data || {
          success: false,
          message: error.message,
          error: { code: 'GATEWAY_001', details: null },
        };

        this.logger.error(`Proxy error: ${error.message} - ${req.method} ${req.originalUrl}`);
        res.status(status).json(data);
      } else {
        this.logger.error(`Unexpected error: ${error.message}`);
        res.status(500).json({
          success: false,
          message: 'Gateway error',
          error: { code: 'GATEWAY_001', details: error.message },
        });
      }
    }
  }
}
