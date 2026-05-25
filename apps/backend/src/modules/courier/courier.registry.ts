import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { CourierAdapter, RateParams, Rate } from './interfaces/courier.adapter.interface';
import { JntAdapter } from './adapters/jnt.adapter';
import { DakaSamedayAdapter } from './adapters/daka-sameday.adapter';
import { DakaInstantAdapter } from './adapters/daka-instant.adapter';
import { HeronaAdapter } from './adapters/herona.adapter';
import { GojekAdapter } from './adapters/gojek.adapter';
import { GrabAdapter } from './adapters/grab.adapter';
import { PosAdapter } from './adapters/pos.adapter';

@Injectable()
export class CourierRegistry implements OnModuleInit {
  private readonly logger = new Logger(CourierRegistry.name);
  private readonly adapters = new Map<string, CourierAdapter>();

  constructor(
    private readonly jntAdapter: JntAdapter,
    private readonly dakaSamedayAdapter: DakaSamedayAdapter,
    private readonly dakaInstantAdapter: DakaInstantAdapter,
    private readonly heronaAdapter: HeronaAdapter,
    private readonly gojekAdapter: GojekAdapter,
    private readonly grabAdapter: GrabAdapter,
    private readonly posAdapter: PosAdapter
  ) {}

  onModuleInit() {
    this.logger.log('Initializing Courier Registry...');

    this.registerAdapter(this.jntAdapter.getName(), this.jntAdapter);
    this.registerAdapter(this.dakaSamedayAdapter.getName(), this.dakaSamedayAdapter);
    this.registerAdapter(this.dakaInstantAdapter.getName(), this.dakaInstantAdapter);
    this.registerAdapter(this.heronaAdapter.getName(), this.heronaAdapter);
    this.registerAdapter(this.gojekAdapter.getName(), this.gojekAdapter);
    this.registerAdapter(this.grabAdapter.getName(), this.grabAdapter);
    this.registerAdapter(this.posAdapter.getName(), this.posAdapter);

    this.logger.log(
      `Courier Registry initialized with ${this.adapters.size} couriers: ${this.getAvailableCouriers().join(', ')}`
    );
  }

  registerAdapter(name: string, adapter: CourierAdapter) {
    this.adapters.set(name.toUpperCase(), adapter);
  }

  getAdapter(name: string): CourierAdapter {
    const adapter = this.adapters.get(name.toUpperCase());
    if (!adapter) {
      throw new Error(`Courier adapter '${name}' not found`);
    }
    return adapter;
  }

  getAvailableCouriers(): string[] {
    return Array.from(this.adapters.keys());
  }

  async getRatesFromAll(params: RateParams): Promise<Rate[]> {
    const results = await Promise.allSettled(
      Array.from(this.adapters.values()).map((adapter) => adapter.getRates(params))
    );

    const rates = results
      .filter((result): result is PromiseFulfilledResult<Rate[]> => result.status === 'fulfilled')
      .flatMap((result) => result.value);

    if (rates.length === 0) {
      throw new Error('All couriers failed');
    }

    return rates.sort((a, b) => a.price - b.price);
  }

  supportsWebhook(name: string): boolean {
    const adapter = this.adapters.get(name.toUpperCase());
    return adapter?.supportsWebhook?.() ?? false;
  }

  supportsPolling(name: string): boolean {
    const adapter = this.adapters.get(name.toUpperCase());
    return adapter?.supportsPolling?.() ?? false;
  }
}
