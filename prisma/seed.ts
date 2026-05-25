import { PrismaClient, UserRole } from '@prisma/client';
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
      password: hashedPassword,
      name: 'Admin Daka',
      phone: '081234567890',
      role: UserRole.admin,
      isVerified: true,
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
        password: hashedPassword,
        name: seller.name,
        role: UserRole.seller,
        isVerified: true,
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
        password: hashedPassword,
        name: buyer.name,
        role: UserRole.buyer,
        isVerified: true,
      },
    });
  }

  // ==================== CATEGORIES ====================
  console.log('📝 Seeding categories...');

  const categories = [
    { name: 'Elektronik', slug: 'elektronik' },
    { name: 'Fashion', slug: 'fashion' },
    { name: 'Makanan', slug: 'makanan' },
  ];

  for (const cat of categories) {
    await prisma.category.upsert({
      where: { slug: cat.slug },
      update: {},
      create: {
        name: cat.name,
        slug: cat.slug,
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

  // Get category IDs
  const elektronik = await prisma.category.findUnique({ where: { slug: 'elektronik' } });
  const fashion = await prisma.category.findUnique({ where: { slug: 'fashion' } });
  const makanan = await prisma.category.findUnique({ where: { slug: 'makanan' } });

  const products = [
    {
      name: 'iPhone 15 Pro',
      slug: 'iphone-15-pro',
      price: 15000000,
      stock: 10,
      weight: 200,
      categoryId: elektronik?.id,
      sellerId: sellerMap['seller1'],
    },
    {
      name: 'MacBook Pro M3',
      slug: 'macbook-pro-m3',
      price: 25000000,
      stock: 5,
      weight: 1500,
      categoryId: elektronik?.id,
      sellerId: sellerMap['seller1'],
    },
    {
      name: 'Kemeja Pria Lengan Panjang',
      slug: 'kemeja-pria',
      price: 150000,
      stock: 50,
      weight: 200,
      categoryId: fashion?.id,
      sellerId: sellerMap['seller2'],
    },
    {
      name: 'Dress Wanita',
      slug: 'dress-wanita',
      price: 200000,
      stock: 30,
      weight: 250,
      categoryId: fashion?.id,
      sellerId: sellerMap['seller2'],
    },
    {
      name: 'Keripik Tempe',
      slug: 'keripik-tempe',
      price: 15000,
      stock: 1000,
      weight: 100,
      categoryId: makanan?.id,
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
          weight: product.weight,
          categoryId: product.categoryId,
          sellerId: product.sellerId,
          isActive: true,
        },
      });
    }
  }

  // ==================== ADDRESSES ====================
  console.log('📝 Seeding addresses...');

  const buyerUsers = await prisma.user.findMany({
    where: { role: UserRole.buyer },
    select: { id: true },
  });

  const addresses = [
    {
      label: 'Rumah',
      recipient: 'Budi Santoso',
      phone: '081234567890',
      address: 'Jl. Malioboro No 1',
      city: 'Yogyakarta',
      province: 'DI Yogyakarta',
      postal: '55221',
      isPrimary: true,
    },
    {
      label: 'Kantor',
      recipient: 'Budi Santoso',
      phone: '081234567891',
      address: 'Jl. Sudirman No 2',
      city: 'Yogyakarta',
      province: 'DI Yogyakarta',
      postal: '55221',
      isPrimary: false,
    },
  ];

  for (const buyer of buyerUsers) {
    for (let i = 0; i < addresses.length; i++) {
      const addr = addresses[i];
      await prisma.address.create({
        data: {
          userId: buyer.id,
          label: addr.label,
          recipient: addr.recipient,
          phone: addr.phone,
          address: addr.address,
          city: addr.city,
          province: addr.province,
          postal: addr.postal,
          isPrimary: addr.isPrimary,
        },
      });
    }
  }

  // ==================== WALLETS ====================
  console.log('📝 Seeding wallets...');

  const allUsers = await prisma.user.findMany({ select: { id: true } });
  for (const user of allUsers) {
    await prisma.wallet.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
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