import { Module, Global } from '@nestjs/common';
import { MeilisearchClient } from './meilisearch.client';

@Global()
@Module({
  providers: [MeilisearchClient],
  exports: [MeilisearchClient],
})
export class MeilisearchModule {}