import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Upsert settings
  const settings = await prisma.settings.upsert({
    where: { id: 1 },
    update: {},
    create: {
      shopName: '67 Café',
      address: '123 Coffee Lane',
      phone: '+1 234 567 8900',
      footerMessage: 'Thank you for visiting 67 Café!',
      printerType: 'USB',
      printerAddress: '',
    },
  });
  console.log('Settings seeded:', settings.shopName);

  // Not seeding any dummy items to comply with the empty-slate requirement
  console.log('Skipping dummy item generation.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
