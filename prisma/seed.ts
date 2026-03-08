// prisma/seed.ts
// Default kategoriyalar va admin user

import { PrismaClient, TransactionType } from '@prisma/client';

const prisma = new PrismaClient();

const defaultCategories = [
  // XARAJATLAR
  { name: 'Food', nameUz: 'Oziq-ovqat', nameRu: 'Еда', emoji: '🍔', color: '#FF6B6B', type: TransactionType.EXPENSE, sortOrder: 1 },
  { name: 'Transport', nameUz: 'Transport', nameRu: 'Транспорт', emoji: '🚗', color: '#4ECDC4', type: TransactionType.EXPENSE, sortOrder: 2 },
  { name: 'Home', nameUz: 'Uy', nameRu: 'Дом', emoji: '🏠', color: '#45B7D1', type: TransactionType.EXPENSE, sortOrder: 3 },
  { name: 'Health', nameUz: 'Salomatlik', nameRu: 'Здоровье', emoji: '💊', color: '#96CEB4', type: TransactionType.EXPENSE, sortOrder: 4 },
  { name: 'Education', nameUz: "Ta'lim", nameRu: 'Образование', emoji: '📚', color: '#FFEAA7', type: TransactionType.EXPENSE, sortOrder: 5 },
  { name: 'Entertainment', nameUz: "O'yin-kulgi", nameRu: 'Развлечения', emoji: '🎮', color: '#DDA0DD', type: TransactionType.EXPENSE, sortOrder: 6 },
  { name: 'Clothing', nameUz: 'Kiyim-kechak', nameRu: 'Одежда', emoji: '👕', color: '#F0E68C', type: TransactionType.EXPENSE, sortOrder: 7 },
  { name: 'Beauty', nameUz: 'Go\'zallik', nameRu: 'Красота', emoji: '💄', color: '#FFB6C1', type: TransactionType.EXPENSE, sortOrder: 8 },
  { name: 'Cafe', nameUz: 'Kafe & Restoran', nameRu: 'Кафе', emoji: '☕', color: '#D2691E', type: TransactionType.EXPENSE, sortOrder: 9 },
  { name: 'Shopping', nameUz: 'Xarid', nameRu: 'Покупки', emoji: '🛍️', color: '#FF8C00', type: TransactionType.EXPENSE, sortOrder: 10 },
  { name: 'Utilities', nameUz: 'Kommunal', nameRu: 'Коммунальные', emoji: '💡', color: '#20B2AA', type: TransactionType.EXPENSE, sortOrder: 11 },
  { name: 'Internet', nameUz: 'Internet & Telefon', nameRu: 'Интернет', emoji: '📱', color: '#6495ED', type: TransactionType.EXPENSE, sortOrder: 12 },
  { name: 'Other Expense', nameUz: 'Boshqa', nameRu: 'Другое', emoji: '📦', color: '#A9A9A9', type: TransactionType.EXPENSE, sortOrder: 99 },

  // DAROMADLAR
  { name: 'Salary', nameUz: 'Maosh', nameRu: 'Зарплата', emoji: '💼', color: '#3FB950', type: TransactionType.INCOME, sortOrder: 1 },
  { name: 'Freelance', nameUz: 'Freelance', nameRu: 'Фриланс', emoji: '💻', color: '#58A6FF', type: TransactionType.INCOME, sortOrder: 2 },
  { name: 'Business', nameUz: 'Biznes', nameRu: 'Бизнес', emoji: '🏢', color: '#BC8CFF', type: TransactionType.INCOME, sortOrder: 3 },
  { name: 'Gift', nameUz: "Sovg'a", nameRu: 'Подарок', emoji: '🎁', color: '#F0883E', type: TransactionType.INCOME, sortOrder: 4 },
  { name: 'Investment', nameUz: 'Investitsiya', nameRu: 'Инвестиции', emoji: '📈', color: '#E3B341', type: TransactionType.INCOME, sortOrder: 5 },
  { name: 'Other Income', nameUz: 'Boshqa daromad', nameRu: 'Другой доход', emoji: '💰', color: '#A9A9A9', type: TransactionType.INCOME, sortOrder: 99 },
];

async function main() {
  console.log('🌱 Seeding started...');

  // Default kategoriyalarni yaratish
  for (const cat of defaultCategories) {
    await prisma.category.upsert({
      where: {
        // Unique constraint yo'q, shuning uchun name + type bo'yicha tekshiramiz
        id: `default-${cat.name.toLowerCase().replace(/\s/g, '-')}`,
      },
      update: cat,
      create: {
        id: `default-${cat.name.toLowerCase().replace(/\s/g, '-')}`,
        ...cat,
        isDefault: true,
        userId: null,
      },
    });
  }

  console.log(`✅ ${defaultCategories.length} ta kategoriya yaratildi`);
  console.log('🎉 Seeding completed!');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
