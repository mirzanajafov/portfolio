import { Module } from '@nestjs/common';
import { ApplicationsModule } from '../applications/applications.module.js';
import { CoreModule } from '../core.module.js';

@Module({
  imports: [CoreModule, ApplicationsModule],
})
export class CliModule {}
