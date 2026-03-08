// src/modules/websocket/websocket.gateway.ts
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AppLogger } from '../../common/logger/logger.service';

// Real-time event nomlari
export const WS_EVENTS = {
  // Server → Client
  TRANSACTION_CREATED:  'transaction:created',
  TRANSACTION_UPDATED:  'transaction:updated',
  TRANSACTION_DELETED:  'transaction:deleted',
  BUDGET_ALERT:         'budget:alert',
  BUDGET_EXCEEDED:      'budget:exceeded',
  NOTIFICATION_NEW:     'notification:new',
  ANALYTICS_UPDATED:    'analytics:updated',

  // Client → Server
  JOIN_ROOM:    'join:room',
  LEAVE_ROOM:   'leave:room',
  PING:         'ping',
} as const;

@WebSocketGateway({
  cors: {
    origin: process.env.ALLOWED_ORIGINS?.split(',') ?? ['http://localhost:3001'],
    credentials: true,
  },
  namespace: '/ws',
})
export class HisobchiGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  // userId → Set<socketId> mapping
  private userSockets = new Map<string, Set<string>>();

  constructor(
    private jwt: JwtService,
    private config: ConfigService,
    private logger: AppLogger,
  ) {}

  // ── Ulanish ───────────────────────────────────────────────────────────
  async handleConnection(client: Socket) {
    try {
      const token = this.extractToken(client);
      if (!token) {
        client.disconnect();
        return;
      }

      const payload = this.jwt.verify(token, {
        secret: this.config.get('JWT_ACCESS_SECRET'),
      });

      // Socket ga userId biriktirish
      client.data.userId = payload.sub;

      // Foydalanuvchini o'z xonasiga qo'shish
      await client.join(`user:${payload.sub}`);

      // userId → socketId mapping
      if (!this.userSockets.has(payload.sub)) {
        this.userSockets.set(payload.sub, new Set());
      }
      this.userSockets.get(payload.sub)!.add(client.id);

      this.logger.log(
        `WS ulandi: ${payload.sub} | Socket: ${client.id} | Jami: ${this.server.sockets.sockets.size}`,
        'WebSocketGateway',
      );
    } catch {
      client.disconnect();
    }
  }

  // ── Uzilish ───────────────────────────────────────────────────────────
  handleDisconnect(client: Socket) {
    const userId = client.data.userId;
    if (userId) {
      const sockets = this.userSockets.get(userId);
      sockets?.delete(client.id);
      if (sockets?.size === 0) {
        this.userSockets.delete(userId);
      }
    }
    this.logger.log(`WS uzildi: ${client.id}`, 'WebSocketGateway');
  }

  // ── Ping-Pong (connection test) ───────────────────────────────────────
  @SubscribeMessage(WS_EVENTS.PING)
  handlePing(@ConnectedSocket() client: Socket) {
    return { event: 'pong', data: { timestamp: Date.now() } };
  }

  // ── Admin: barcha ulanishlar statistika ──────────────────────────────
  @SubscribeMessage('admin:stats')
  handleAdminStats(@ConnectedSocket() client: Socket) {
    if (client.data.role !== 'ADMIN') return;
    return {
      event: 'admin:stats',
      data: {
        totalConnections: this.server.sockets.sockets.size,
        uniqueUsers: this.userSockets.size,
      },
    };
  }

  // ── Emit metodlari (boshqa servislardan chaqiriladi) ──────────────────

  // Foydalanuvchiga yangi tranzaksiya haqida xabar
  emitTransactionCreated(userId: string, transaction: any) {
    this.server.to(`user:${userId}`).emit(WS_EVENTS.TRANSACTION_CREATED, transaction);
  }

  emitTransactionUpdated(userId: string, transaction: any) {
    this.server.to(`user:${userId}`).emit(WS_EVENTS.TRANSACTION_UPDATED, transaction);
  }

  emitTransactionDeleted(userId: string, transactionId: string) {
    this.server.to(`user:${userId}`).emit(WS_EVENTS.TRANSACTION_DELETED, { id: transactionId });
  }

  // Budget ogohlantirish
  emitBudgetAlert(userId: string, data: {
    categoryName: string;
    percentage: number;
    isExceeded: boolean;
  }) {
    const event = data.isExceeded ? WS_EVENTS.BUDGET_EXCEEDED : WS_EVENTS.BUDGET_ALERT;
    this.server.to(`user:${userId}`).emit(event, data);
  }

  // Yangi bildirishnoma
  emitNotification(userId: string, notification: any) {
    this.server.to(`user:${userId}`).emit(WS_EVENTS.NOTIFICATION_NEW, notification);
  }

  // Analytics yangilandi (tranzaksiya qo'shilganda)
  emitAnalyticsUpdated(userId: string) {
    this.server.to(`user:${userId}`).emit(WS_EVENTS.ANALYTICS_UPDATED, {
      timestamp: new Date().toISOString(),
    });
  }

  // Foydalanuvchi onlayn ekanligini tekshirish
  isUserOnline(userId: string): boolean {
    return this.userSockets.has(userId);
  }

  // Onlayn foydalanuvchilar soni
  getOnlineCount(): number {
    return this.userSockets.size;
  }

  // ── Private helpers ───────────────────────────────────────────────────
  private extractToken(client: Socket): string | null {
    const auth = client.handshake.auth?.token as string;
    const header = client.handshake.headers?.authorization as string;

    if (auth) return auth;
    if (header?.startsWith('Bearer ')) return header.slice(7);
    return null;
  }
}
