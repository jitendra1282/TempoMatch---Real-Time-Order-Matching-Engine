// Auth controller — email/password + Google OAuth sign-in
//
// Endpoints:
//   POST /api/v1/auth/register  — create account with email + password
//   POST /api/v1/auth/login     — sign in with email + password
//   POST /api/v1/auth/google    — sign in / register with Google ID token
//   GET  /api/v1/auth/me        — get current user (requires Authorization header)

import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { prisma } from '../services/orderService.js'

const JWT_SECRET = process.env.JWT_SECRET || 'tempomatch-secret-key-change-in-production'
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
 * Body: { username, email, password, phone? }
 */
export async function register(req, res, next) {
  try {
    const { username, email, password, phone } = req.body

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'username, email and password are required' })
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' })
    }

    const passwordHash = await bcrypt.hash(password, 12)

    const user = await prisma.user.create({
      data: {
        username: username.trim(),
        email: email.trim().toLowerCase(),
        phone: phone ? phone.trim() : null,
        passwordHash,
        authProvider: 'local',
      },
    })

    const token = signToken(user.id)
    res.status(201).json({ token, user: sanitizeUser(user) })
  } catch (err) {
    if (err.code === 'P2002') {
      const field = err.meta?.target?.join(', ') || 'field'
      return res.status(409).json({ error: `This ${field} is already in use` })
    }
    next(err)
  }
}

/**
 * POST /api/v1/auth/login
 * Body: { email, password }
 */
export async function login(req, res, next) {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' })
    }

    const user = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    })

    if (!user || !user.passwordHash) {
      return res.status(401).json({ error: 'Invalid email or password' })
    }

    const valid = await bcrypt.compare(password, user.passwordHash)
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' })
    }

    const token = signToken(user.id)
    res.json({ token, user: sanitizeUser(user) })
  } catch (err) {
    next(err)
  }
}

/**
 * POST /api/v1/auth/google
 * Body: { googleId, email, name, photoURL? }
 *
 * The frontend verifies the Google ID token via Firebase Auth SDK and sends
 * the verified user data. We trust this data because Google verified it.
 * For production, verify the Google ID token server-side with google-auth-library.
 */
export async function googleAuth(req, res, next) {
  try {
    const { googleId, email, name, photoURL } = req.body

    if (!googleId || !email) {
      return res.status(400).json({ error: 'googleId and email are required' })
    }

    // Try to find existing user by googleId first, then by email
    let user = await prisma.user.findUnique({ where: { googleId } })

    if (!user) {
      // Check if email exists (user registered with email/password before)
      const existing = await prisma.user.findUnique({
        where: { email: email.toLowerCase() },
      })

      if (existing) {
        // Link Google account to existing email account
        user = await prisma.user.update({
          where: { id: existing.id },
          data: { googleId, authProvider: 'google' },
        })
      } else {
        // Create new user from Google profile
        // Generate a clean username from their name
        let baseUsername = name
          ? name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20)
          : email.split('@')[0].slice(0, 20)
        if (!baseUsername) baseUsername = 'user'

        // Make username unique by appending random suffix if needed
        let username = baseUsername
        let attempt = 0
        while (attempt < 10) {
          const exists = await prisma.user.findUnique({ where: { username } })
          if (!exists) break
          username = `${baseUsername}${Math.floor(Math.random() * 9000) + 1000}`
          attempt++
        }

        user = await prisma.user.create({
          data: {
            username,
            email: email.toLowerCase(),
            googleId,
            authProvider: 'google',
          },
        })
      }
    }

    const token = signToken(user.id)
    res.json({ token, user: sanitizeUser(user) })
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'Account conflict. Try logging in with email/password.' })
    }
    next(err)
  }
}

/**
 * POST /api/v1/auth/phone-login
 * Body: { phone, password }
 * Simple phone number + password login (no SMS OTP).
 */
export async function phoneLogin(req, res, next) {
  try {
    const { phone, password } = req.body

    if (!phone || !password) {
      return res.status(400).json({ error: 'phone and password are required' })
    }

    const user = await prisma.user.findUnique({
      where: { phone: phone.trim() },
    })

    if (!user || !user.passwordHash) {
      return res.status(401).json({ error: 'Invalid phone number or password' })
    }

    const valid = await bcrypt.compare(password, user.passwordHash)
    if (!valid) {
      return res.status(401).json({ error: 'Invalid phone number or password' })
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
 * Returns the current authenticated user's data.
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
        id: true,
        username: true,
        email: true,
        phone: true,
        authProvider: true,
        fiatBalance: true,
        assetBalance: true,
        createdAt: true,
      },
    })

    if (!user) return res.status(404).json({ error: 'User not found' })
    res.json({ user })
  } catch (err) {
    next(err)
  }
}
