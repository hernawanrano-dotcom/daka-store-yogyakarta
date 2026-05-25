import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    // Use user ID if authenticated, otherwise use IP
    if (req.user && req.user.sub) {
      return `user-${req.user.sub}`;
    }
    return req.ip;
  }

  protected getTTL(context: ExecutionContext): number {
    const req = context.switchToHttp().getRequest();
    
    // Higher limit for sellers
    if (req.user && req.user.role === 'seller') {
      return 60;
    }
    
    return 60;
  }

  protected getLimit(context: ExecutionContext): number {
    const req = context.switchToHttp().getRequest();
    
    // Higher limit for sellers (1000 per minute)
    if (req.user && req.user.role === 'seller') {
      return 1000;
    }
    
    // Default for buyers (100 per minute)
    return 100;
  }
}