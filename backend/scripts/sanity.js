import { PrismaClient } from '@prisma/client'
import { placeOrder, getUserOrderHistory, getUserTradeHistory } from '../src/services/orderService.js'

const prisma = new PrismaClient()

async function run() {
  console.log('--- Sanity Check ---')
  
  // 1. Create two test users
  const user1 = await prisma.user.create({ data: { username: `Alice_${Date.now()}` } })
  const user2 = await prisma.user.create({ data: { username: `Bob_${Date.now()}` } })
  console.log(`Created users: ${user1.username} and ${user2.username}`)

  // 2. Place a SELL order from Alice
  console.log(`\nPlacing SELL order for Alice (0.1 BTC @ $50,000)...`)
  const sellResult = await placeOrder({
    userId: user1.id,
    side: 'SELL',
    type: 'LIMIT',
    price: 50000,
    qty: 0.1
  })
  console.log('Sell order placed:', sellResult.order.id)

  // 3. Place a matching BUY order from Bob
  console.log(`\nPlacing BUY order for Bob (0.1 BTC @ $50,000)...`)
  const buyResult = await placeOrder({
    userId: user2.id,
    side: 'BUY',
    type: 'LIMIT',
    price: 50000,
    qty: 0.1
  })
  console.log('Buy order placed:', buyResult.order.id)
  console.log('Trades executed:', buyResult.trades.length)

  // 4. Test History APIs
  console.log(`\n--- History APIs ---`)
  const aliceOrderHistory = await getUserOrderHistory(user1.id)
  const aliceTradeHistory = await getUserTradeHistory(user1.id)
  
  console.log(`Alice Order History count: ${aliceOrderHistory.length} (Status: ${aliceOrderHistory[0].status})`)
  console.log(`Alice Trade History count: ${aliceTradeHistory.length}`)

  const bobOrderHistory = await getUserOrderHistory(user2.id)
  const bobTradeHistory = await getUserTradeHistory(user2.id)

  console.log(`Bob Order History count: ${bobOrderHistory.length} (Status: ${bobOrderHistory[0].status})`)
  console.log(`Bob Trade History count: ${bobTradeHistory.length}`)

  console.log('\n✅ Sanity check passed!')
  process.exit(0)
}

run().catch(e => {
  console.error('Sanity check failed:', e)
  process.exit(1)
})
