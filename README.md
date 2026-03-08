# 🧾 Hisobchi Backend

> O'zbekiston shaxsiy moliya ilovasi — NestJS + TypeScript + Supabase + Prisma

## 🚀 Tezkor ishga tushirish

### 1. Talablar
- Node.js 18+
- npm yoki yarn
- Supabase hisobi (bepul): https://supabase.com
- Redis hisobi — Upstash (bepul): https://upstash.com
- Eskiz SMS hisobi: https://eskiz.uz

### 2. O'rnatish

```bash
# Klonlash
git clone https://github.com/yourusername/hisobchi-backend.git
cd hisobchi-backend

# Paketlarni o'rnatish
npm install

# .env faylni sozlash
cp .env.example .env
# .env faylni to'ldiring (Supabase, Redis, Eskiz ma'lumotlari)
```

### 3. Database sozlash

```bash
# Prisma client generatsiya
npm run db:generate

# Migratsiya yaratish va ishlatish
npm run db:migrate

# Default kategoriyalarni seed qilish
npm run db:seed
```

### 4. Ishga tushirish

```bash
# Development (hot reload)
npm run start:dev

# Production build
npm run build
npm run start:prod
```

### 5. Swagger dokumentatsiya

Development muhitda: http://localhost:3000/api/docs

---

## 📁 Loyiha tuzilmasi

```
src/
├── modules/
│   ├── auth/           # SMS OTP + JWT
│   ├── users/          # Profil
│   ├── transactions/   # Xarajat/daromad
│   ├── categories/     # Kategoriyalar
│   ├── budgets/        # Byudjet
│   ├── analytics/      # Statistika
│   ├── notifications/  # Push + in-app
│   ├── telegram/       # Telegram bot
│   ├── files/          # Fayl yuklash
│   └── admin/          # Admin panel
├── common/
│   ├── decorators/     # @CurrentUser(), @Roles()
│   ├── filters/        # Exception filter
│   ├── interceptors/   # Response transformer
│   ├── guards/         # Throttle guard
│   └── redis/          # Redis service
├── prisma/             # Prisma service & module
├── app.module.ts
└── main.ts
prisma/
├── schema.prisma       # Database modellari
└── seed.ts             # Default ma'lumotlar
```

---

## 🔗 API Endpointlar

| Modul         | Endpoint             | Metodlar                    |
|---------------|----------------------|-----------------------------|
| Auth          | /api/v1/auth         | POST (send-otp, verify, refresh, logout) |
| Users         | /api/v1/users        | GET, PUT, DELETE (me)       |
| Transactions  | /api/v1/transactions | GET, POST, PATCH, DELETE    |
| Categories    | /api/v1/categories   | GET, POST, PATCH, DELETE    |
| Budgets       | /api/v1/budgets      | GET, POST                   |
| Analytics     | /api/v1/analytics    | GET (summary, by-category, daily, trend) |

---

## 🛠 Texnologiyalar

| Texnologiya | Maqsad |
|-------------|--------|
| NestJS 10   | Backend framework |
| TypeScript 5 | Til |
| Prisma 5    | ORM |
| PostgreSQL (Supabase) | Database |
| Redis (Upstash) | Cache + OTP |
| JWT + Passport | Auth |
| Eskiz SMS   | OTP yuborish |
| Firebase FCM | Push notification |
| Telegraf.js | Telegram bot |
| Swagger     | API dokumentatsiya |
| Railway     | Deploy |

---

## 📞 Qo'llab-quvvatlash

Telegram: @hisobchi_support
# hisobchi
