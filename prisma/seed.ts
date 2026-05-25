import { PrismaClient } from '@prisma/client';
import { UserRole } from '@daka/shared-types';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  const hashedPassword = await bcrypt.hash('password123', 10);

  // ==================== USERS ====================
  console.log('📝 Seeding users...');

  // Admin
  await prisma.user.upsert({
    where: { email: 'admin@dakastore.com' },
    update: {},
    create: {
      email: 'admin@dakastore.com',
      password_hash: hashedPassword,
      full_name: 'Admin Daka',
      phone: '081234567890',
      role: UserRole.admin,
      is_verified: true,
    },
  });

  // Sellers
  const sellers = [
    { email: 'seller1@dakastore.com', name: 'Toko Elektronik Jogja' },
    { email: 'seller2@dakastore.com', name: 'Fashion Store Yogyakarta' },
    { email: 'seller3@dakastore.com', name: 'Herona Official Store' },
  ];

  for (const seller of sellers) {
    await prisma.user.upsert({
      where: { email: seller.email },
      update: {},
      create: {
        email: seller.email,
        password_hash: hashedPassword,
        full_name: seller.name,
        role: UserRole.seller,
        is_verified: true,
      },
    });
  }

  // Buyers
  const buyers = [
    { email: 'buyer1@example.com', name: 'Budi Santoso' },
    { email: 'buyer2@example.com', name: 'Siti Aminah' },
    { email: 'buyer3@example.com', name: 'Agus Wijaya' },
  ];

  for (const buyer of buyers) {
    await prisma.user.upsert({
      where: { email: buyer.email },
      update: {},
      create: {
        email: buyer.email,
        password_hash: hashedPassword,
        full_name: buyer.name,
        role: UserRole.buyer,
        is_verified: true,
      },
    });
  }

  // ==================== PRODUCTS ====================
  console.log('📝 Seeding products...');

  // Get seller IDs
  const sellerUsers = await prisma.user.findMany({
    where: { role: UserRole.seller },
    select: { id: true, email: true },
  });

  const sellerMap: Record<string, string> = {};
  for (const s of sellerUsers) {
    if (s.email === 'seller1@dakastore.com') sellerMap['seller1'] = s.id;
    if (s.email === 'seller2@dakastore.com') sellerMap['seller2'] = s.id;
    if (s.email === 'seller3@dakastore.com') sellerMap['seller3'] = s.id;
  }

  const products = [
    {
      name: 'iPhone 15 Pro',
      slug: 'iphone-15-pro',
      price: 15000000,
      stock: 10,
      weight_gram: 200,
      sellerId: sellerMap['seller1'],
    },
    {
      name: 'MacBook Pro M3',
      slug: 'macbook-pro-m3',
      price: 25000000,
      stock: 5,
      weight_gram: 1500,
      sellerId: sellerMap['seller1'],
    },
    {
      name: 'Kemeja Pria Lengan Panjang',
      slug: 'kemeja-pria',
      price: 150000,
      stock: 50,
      weight_gram: 200,
      sellerId: sellerMap['seller2'],
    },
    {
      name: 'Dress Wanita',
      slug: 'dress-wanita',
      price: 200000,
      stock: 30,
      weight_gram: 250,
      sellerId: sellerMap['seller2'],
    },
    {
      name: 'Keripik Tempe',
      slug: 'keripik-tempe',
      price: 15000,
      stock: 1000,
      weight_gram: 100,
      sellerId: sellerMap['seller3'],
    },
  ];

  for (const product of products) {
    if (product.sellerId) {
      await prisma.product.upsert({
        where: { slug: product.slug },
        update: {},
        create: {
          name: product.name,
          slug: product.slug,
          description: `Deskripsi untuk ${product.name}`,
          price: product.price,
          stock: product.stock,
          weight_gram: product.weight_gram,
          seller_id: product.sellerId,
          is_active: true,
          images: [],
        },
      });
    }
  }

  // ==================== WALLETS ====================
  console.log('📝 Seeding wallets...');

  const allUsers = await prisma.user.findMany({ select: { id: true } });
  for (const user of allUsers) {
    await prisma.wallet.upsert({
      where: { user_id: user.id },
      update: {},
      create: {
        user_id: user.id,
        balance: 100000,
      },
    });
  }

  console.log('✅ Seeding completed!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });