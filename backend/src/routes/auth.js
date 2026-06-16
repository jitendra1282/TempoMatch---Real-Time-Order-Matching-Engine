// Auth routes — POST /api/v1/auth/*

import { Router } from 'express'
import { register, login, googleAuth, phoneLogin, getMe } from '../controllers/authController.js'

const router = Router()

router.post('/register', register)
router.post('/login', login)
router.post('/google', googleAuth)
router.post('/phone-login', phoneLogin)
router.get('/me', getMe)

export default router
