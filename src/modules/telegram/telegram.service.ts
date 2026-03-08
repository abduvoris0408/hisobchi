// src/modules/telegram/telegram.service.ts
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { TransactionsService } from '../transactions/transactions.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { Telegraf, Context, Markup } from 'telegraf';
import { TransactionType, TransactionSource } from '@prisma/client';

@Injectable()
export class TelegramService implements OnModuleInit {
  private readonly logger = new Logger(TelegramService.name);
  private bot: Telegraf;

  // Foydalanuvchi holatlari (oddiy in-memory, kichik loyiha uchun yetarli)
  private userStates = new Map<number, { action: string; step?: string; data?: any }>();

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
    private transactionsService: TransactionsService,
    private analyticsService: AnalyticsService,
  ) {}

  async onModuleInit() {
    const token = this.config.get<string>('TELEGRAM_BOT_TOKEN');
    if (!token) {
      this.logger.warn('TELEGRAM_BOT_TOKEN sozlanmagan — bot ishlamaydi');
      return;
    }

    this.bot = new Telegraf(token);
    this.registerHandlers();

    const webhookUrl = this.config.get<string>('TELEGRAM_WEBHOOK_URL');
    if (webhookUrl && this.config.get('NODE_ENV') === 'production') {
      await this.bot.telegram.setWebhook(webhookUrl);
      this.logger.log(`✅ Telegram webhook: ${webhookUrl}`);
    } else {
      // Development: long polling
      this.bot.launch().catch((e) => this.logger.error('Bot launch xatosi:', e));
      this.logger.log('✅ Telegram bot long polling rejimida ishga tushdi');
    }
  }

  private registerHandlers() {
    // ── /start ───────────────────────────────────────────────────────
    this.bot.start(async (ctx) => {
      const telegramId = String(ctx.from.id);
      const user = await this.prisma.user.findUnique({ where: { telegramId } });

      if (!user) {
        await ctx.reply(
          `👋 Salom! Men Hisobchi botiman.\n\n` +
          `Meni ilovangizga ulash uchun:\n` +
          `1. Hisobchi ilovasini oching\n` +
          `2. Profil → Telegram ulash\n` +
          `3. Ko'rsatilgan kodni menga yuboring`,
        );
        return;
      }

      await ctx.reply(
        `👋 Salom, ${user.name ?? 'foydalanuvchi'}! Xush kelibsiz.\n\n` +
        `Men orqali tezkor xarajatlaringizni qo'sha olasiz.`,
        this.mainKeyboard(),
      );
    });

    // ── /balance ─────────────────────────────────────────────────────
    this.bot.command('balance', async (ctx) => {
      const user = await this.getUserByTelegramId(ctx);
      if (!user) return;

      const now = new Date();
      const summary = await this.analyticsService.getMonthlySummary(
        user.id, now.getMonth() + 1, now.getFullYear()
      );

      const d = summary.data;
      await ctx.reply(
        `📊 *${now.toLocaleString('uz', { month: 'long' })} oylik hisobot*\n\n` +
        `💰 Daromad: ${this.formatAmount(d.totalIncome)}\n` +
        `💸 Xarajat: ${this.formatAmount(d.totalExpense)}\n` +
        `${d.balance >= 0 ? '✅' : '⚠️'} Balans: ${this.formatAmount(d.balance)}\n` +
        `📈 Jamg'arma: ${d.savingsRate}%`,
        { parse_mode: 'Markdown', ...this.mainKeyboard() },
      );
    });

    // ── Xarajat qo'shish ─────────────────────────────────────────────
    this.bot.hears('➕ Xarajat', async (ctx) => {
      const user = await this.getUserByTelegramId(ctx);
      if (!user) return;

      this.userStates.set(ctx.from.id, { action: 'add_expense', step: 'amount' });

      await ctx.reply(
        '💸 Xarajat summasini kiriting:\n(Masalan: 50000)',
        Markup.forceReply(),
      );
    });

    // ── Daromad qo'shish ─────────────────────────────────────────────
    this.bot.hears('💰 Daromad', async (ctx) => {
      const user = await this.getUserByTelegramId(ctx);
      if (!user) return;

      this.userStates.set(ctx.from.id, { action: 'add_income', step: 'amount' });
      await ctx.reply('💰 Daromad summasini kiriting:', Markup.forceReply());
    });

    // ── So'nggi xarajatlar ───────────────────────────────────────────
    this.bot.hears("📋 So'nggi", async (ctx) => {
      const user = await this.getUserByTelegramId(ctx);
      if (!user) return;

      const recent = await this.transactionsService.getRecentForTelegram(user.id, 5);

      if (recent.length === 0) {
        await ctx.reply("📭 Hozircha hech qanday tranzaksiya yo'q");
        return;
      }

      const text = recent
        .map((t) => {
          const sign = t.type === 'EXPENSE' ? '➖' : '➕';
          const date = new Date(t.date).toLocaleDateString('uz');
          return `${sign} ${t.category.emoji} ${this.formatAmount(Number(t.amount))} — ${t.category.nameUz} (${date})`;
        })
        .join('\n');

      await ctx.reply(`📋 *So'nggi 5 ta tranzaksiya:*\n\n${text}`, { parse_mode: 'Markdown', ...this.mainKeyboard() });
    });

    // ── Matn xabarlar (holat mashinasi) ─────────────────────────────
    this.bot.on('text', async (ctx) => {
      const state = this.userStates.get(ctx.from.id);
      if (!state) return;

      const user = await this.getUserByTelegramId(ctx);
      if (!user) return;

      if ((state.action === 'add_expense' || state.action === 'add_income') && state.step === 'amount') {
        const amount = parseFloat(ctx.message.text.replace(/\s/g, ''));

        if (isNaN(amount) || amount <= 0) {
          await ctx.reply("❌ Noto'g'ri summa. Raqam kiriting (masalan: 50000)");
          return;
        }

        // Kategoriya tanlash
        const type = state.action === 'add_expense' ? TransactionType.EXPENSE : TransactionType.INCOME;
        const categories = await this.prisma.category.findMany({
          where: { type, OR: [{ isDefault: true }, { userId: user.id }] },
          take: 8,
          orderBy: { sortOrder: 'asc' },
        });

        this.userStates.set(ctx.from.id, {
          ...state,
          step: 'category',
          data: { amount, type },
        });

        const buttons = categories.map((c) =>
          Markup.button.callback(`${c.emoji} ${c.nameUz}`, `cat_${c.id}`),
        );

        await ctx.reply(
          '🏷️ Kategoriyani tanlang:',
          Markup.inlineKeyboard(buttons, { columns: 2 }),
        );
      }
    });

    // ── Kategoriya tanlash (callback) ────────────────────────────────
    this.bot.action(/^cat_(.+)$/, async (ctx) => {
      const state = this.userStates.get(ctx.from.id);
      if (!state || state.step !== 'category') return;

      const user = await this.getUserByTelegramId(ctx);
      if (!user) return;

      const categoryId = ctx.match[1];
      const { amount, type } = state.data;

      try {
        await this.transactionsService.create(
          user.id,
          { categoryId, amount, type },
          TransactionSource.TELEGRAM,
        );

        const category = await this.prisma.category.findUnique({ where: { id: categoryId } });
        const sign = type === TransactionType.EXPENSE ? '➖' : '➕';

        await ctx.editMessageText(
          `✅ *Saqlandi!*\n\n${sign} ${this.formatAmount(amount)} — ${category?.emoji} ${category?.nameUz}`,
          { parse_mode: 'Markdown' },
        );
        await ctx.reply('Yana nima qilasiz?', this.mainKeyboard());
      } catch {
        await ctx.reply('❌ Xatolik yuz berdi. Qaytadan urinib ko\'ring');
      }

      this.userStates.delete(ctx.from.id);
    });
  }

  // ── Webhook handler (production) ─────────────────────────────────────
  async handleWebhook(body: any): Promise<void> {
    await this.bot.handleUpdate(body);
  }

  // ── Foydalanuvchini ulash (ilova orqali) ─────────────────────────────
  async connectUser(userId: string, telegramId: string): Promise<void> {
    const telegramUser = await this.bot.telegram.getChat(telegramId);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        telegramId,
        telegramUsername: (telegramUser as any).username ?? null,
        telegramConnectedAt: new Date(),
      },
    });

    await this.bot.telegram.sendMessage(
      telegramId,
      `✅ Hisobchi ilovangiz muvaffaqiyatli ulandi!\n\nEndi /start yuboring.`,
    );
  }

  // ── Helpers ──────────────────────────────────────────────────────────
  private async getUserByTelegramId(ctx: Context) {
    const telegramId = String(ctx.from?.id);
    const user = await this.prisma.user.findUnique({ where: { telegramId } });

    if (!user) {
      await ctx.reply(
        "❌ Hisobingiz topilmadi. Avval Hisobchi ilovasida Telegram ni ulang.",
      );
      return null;
    }

    return user;
  }

  private formatAmount(amount: number): string {
    return `${amount.toLocaleString('uz')} so'm`;
  }

  private mainKeyboard() {
    return Markup.keyboard([
      ['➕ Xarajat', '💰 Daromad'],
      ["📋 So'nggi", '📊 Balans'],
    ]).resize();
  }
}
