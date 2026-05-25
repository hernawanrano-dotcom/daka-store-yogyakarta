import { Controller, All, Req, Res, Next } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { GatewayService } from './gateway.service';

@Controller()
export class GatewayController {
  constructor(private readonly gatewayService: GatewayService) {}

  @All('*')
  async handleRequest(@Req() req: Request, @Res() res: Response, @Next() next: NextFunction) {
    return this.gatewayService.proxyRequest(req, res, next);
  }
}
