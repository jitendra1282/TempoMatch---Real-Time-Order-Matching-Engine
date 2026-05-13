import axios from 'axios'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const API = 'http://localhost:3001/api/v1'

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function placeOrder(userId, side, type, price, qty) {
  const payload = { userId, side, type, qty }
  if (type === 'LIMIT') payload.price = price
  
  try {
    const res = await axios.post(`${API}/orders`, payload)
    return res.data
  } catch (err) {
    console.error(`Error placing ${side} order:`, err.response?.data || err.message)
    throw err
  }
}

async function runTest() {
  console.log('--- Starting TempoMatch E2E Tests ---')

  // 1. Get Alice and Bob
  const alice = await prisma.user.findFirst({ where: { username: 'Alice' } })
  const bob = await prisma.user.findFirst({ where: { username: 'Bob' } })

  if (!alice || !bob) {
    console.error('Alice or Bob not found in DB. Run `npx prisma db seed` first.')
    process.exit(1)
  }

  console.log(`Test Users: Alice (${alice.id}), Bob (${bob.id})`)

  // 2. Alice places resting BUY order
  console.log('\n[Test 1] Alice places resting BUY limit order (0.1 BTC @ 80000 USDT)')
  await placeOrder(alice.id, 'BUY', 'LIMIT', 80000, 0.1)
  
  await delay(1000)

  // 3. Self-trade prevention: Alice tries to SELL to herself
  console.log('\n[Test 2] Alice tries to SELL 0.05 BTC @ 80000 (Should skip self-trade)')
  const resAliceSell = await placeOrder(alice.id, 'SELL', 'LIMIT', 80000, 0.05)
  if (resAliceSell.trades && resAliceSell.trades.length > 0) {
    console.error('❌ FAIL: Self-trade occurred!')
  } else {
    console.log('✅ PASS: Self-trade prevented. Order rests in book.')
  }

  await delay(1000)

  // 4. Bob places matching SELL order
  console.log('\n[Test 3] Bob places SELL limit order (0.05 BTC @ 80000)')
  const resBobSell = await placeOrder(bob.id, 'SELL', 'LIMIT', 80000, 0.05)
  
  if (resBobSell.trades && resBobSell.trades.length === 1) {
    console.log('✅ PASS: Trade executed between Alice and Bob.')
    console.log(`Trade Details: ${resBobSell.trades[0].qty} BTC @ ${resBobSell.trades[0].price}`)
  } else {
    console.error('❌ FAIL: Trade did not execute correctly.')
  }

  await delay(1000)

  // 5. Verify Balances
  console.log('\n[Test 4] Verifying Balances after trade...')
  const aliceAfter = await prisma.user.findUnique({ where: { id: alice.id } })
  const bobAfter = await prisma.user.findUnique({ where: { id: bob.id } })

  console.log(`Alice Fiat: ${aliceAfter.fiatBalance}, Asset: ${aliceAfter.assetBalance}`)
  console.log(`Bob Fiat: ${bobAfter.fiatBalance}, Asset: ${bobAfter.assetBalance}`)

  console.log('\n--- Tests Complete ---')
  process.exit(0)
}

runTest()
