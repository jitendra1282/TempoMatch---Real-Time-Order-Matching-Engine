// Auth controller — username + password authentication
//
// Endpoints:
//   POST /api/v1/auth/register  — create account with username + password
//   POST /api/v1/auth/login     — sign in with username + password
//   GET  /api/v1/auth/me        — get current user (requires Authorization header)

import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { prisma } from '../services/orderService.js'

const JWT_SECRET     = process.env.JWT_SECRET || 'tempomatch-secret-key-change-in-production'
const JWT_EXPIRES_IN = '7d'

function signToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN })
}

function sanitizeUser(user) {
  // Never expose passwordHash to the client
  const { passwordHash, googleId, ...safe } = user
  return safe
}

/**
 * POST /api/v1/auth/register
 * Body: { username, password }
 */
export async function register(req, res, next) {
  try {
    const { username, password } = req.body

    if (!username || !password) {
      return res.status(400).json({ error: 'username and password are required' })
    }
    if (username.trim().length < 3) {
      return res.status(400).json({ error: 'Username must be at least 3 characters' })
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' })
    }

    const passwordHash = await bcrypt.hash(password, 12)

    const user = await prisma.user.create({
      data: {
        username:     username.trim(),
        passwordHash,
        authProvider: 'local',
      },
    })

    const token = signToken(user.id)
    res.status(201).json({ token, user: sanitizeUser(user) })
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'That username is already taken. Please choose another.' })
    }
    next(err)
  }
}

/**
 * POST /api/v1/auth/login
 * Body: { username, password }
 */
export async function login(req, res, next) {
  try {
    const { username, password } = req.body

    if (!username || !password) {
      return res.status(400).json({ error: 'username and password are required' })
    }

    const user = await prisma.user.findUnique({
      where: { username: username.trim() },
    })

    if (!user || !user.passwordHash) {
      return res.status(401).json({ error: 'Invalid username or password' })
    }

    const valid = await bcrypt.compare(password, user.passwordHash)
    if (!valid) {
      return res.status(401).json({ error: 'Invalid username or password' })
    }

    const token = signToken(user.id)
    res.json({ token, user: sanitizeUser(user) })
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/v1/auth/me
 * Requires: Authorization: Bearer <token>
 */
export async function getMe(req, res, next) {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' })
    }

    const token = authHeader.split(' ')[1]
    let payload
    try {
      payload = jwt.verify(token, JWT_SECRET)
    } catch {
      return res.status(401).json({ error: 'Invalid or expired token' })
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id:           true,
        username:     true,
        email:        true,
        phone:        true,
        authProvider: true,
        fiatBalance:  true,
        assetBalance: true,
        createdAt:    true,
      },
    })

    if (!user) return res.status(404).json({ error: 'User not found' })
    res.json({ user })
  } catch (err) {
    next(err)
  }
}
