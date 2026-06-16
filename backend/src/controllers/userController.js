// User controller — balance query + user creation

import { prisma } from '../services/orderService.js'

/**
 * GET /api/v1/users/:id/balance
 */
export async function getBalance(req, res, next) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: { id: true, username: true, fiatBalance: true, assetBalance: true },
    })
    if (!user) return res.status(404).json({ error: 'User not found' })
    res.json({ user })
  } catch (err) {
    next(err)
  }
}

/**
 * POST /api/v1/users
 * Body: { username }
 * Creates a new user with default balances (10 000 USDT, 0 BTC).
 */
export async function createUser(req, res, next) {
  try {
    const { username, id } = req.body
    if (!username) return res.status(400).json({ error: 'username is required' })

    // Allow caller to supply a specific UUID (useful for concurrency tests)
    const data = id ? { id, username } : { username }
    const user = await prisma.user.create({ data })
    res.status(201).json({ user })
  } catch (err) {
    if (err.code === 'P2002') {
      // Unique constraint — username already taken
      return res.status(409).json({ error: 'Username already exists' })
    }
    next(err)
  }
}

/**
 * GET /api/v1/users
 * Returns all users (handy for the frontend user-select dropdown).
 */
export async function listUsers(req, res, next) {
  try {
    const users = await prisma.user.findMany({
      where: { username: { not: 'TempoBot' } },
      select: { id: true, username: true, fiatBalance: true, assetBalance: true },
      orderBy: { createdAt: 'asc' },
    })
    res.json({ users })
  } catch (err) {
    next(err)
  }
}
