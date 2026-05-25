import { LoggerService } from '@nestjs/common';

export class AppLogger implements LoggerService {
  private getTimestamp(): string {
    return new Date().toISOString();
  }

  private formatMessage(level: string, message: any, context?: string): string {
    const ctx = context ? `[${context}] ` : '';
    return `[${this.getTimestamp()}] ${level} ${ctx}${JSON.stringify(message)}`;
  }

  log(message: any, context?: string) {
    console.log(this.formatMessage('INFO', message, context));
  }

  error(message: any, trace?: string, context?: string) {
    console.error(this.formatMessage('ERROR', message, context));
    if (trace) {
      console.error(trace);
    }
  }

  warn(message: any, context?: string) {
    console.warn(this.formatMessage('WARN', message, context));
  }

  debug(message: any, context?: string) {
    console.debug(this.formatMessage('DEBUG', message, context));
  }

  verbose(message: any, context?: string) {
    console.log(this.formatMessage('VERBOSE', message, context));
  }
}

export const logger = new AppLogger();