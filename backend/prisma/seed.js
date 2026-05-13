import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Clearing existing data...')
  await prisma.trade.deleteMany()
  await prisma.order.deleteMany()
  await prisma.user.deleteMany()

  console.log('Seeding standard test users...')
  
  const users = [
    { username: 'Alice', fiatBalance: 10000.00, assetBalance: 1.00 },
    { username: 'Bob', fiatBalance: 10000.00, assetBalance: 1.00 },
    { username: 'Charlie', fiatBalance: 10000.00, assetBalance: 1.00 },
  ]

  for (const u of users) {
    const created = await prisma.user.create({ data: u })
    console.log(`Created user: ${created.username} (ID: ${created.id})`)
  }

  console.log('Database seeded successfully.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
