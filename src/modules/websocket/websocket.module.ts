// src/modules/websocket/websocket.module.ts
import { Module } from '@nestjs/common';
import { HisobchiGateway } from './websocket.gateway';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  providers: [HisobchiGateway],
  exports: [HisobchiGateway],
})
export class WebSocketModule {}
