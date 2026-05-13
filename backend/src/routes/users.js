// User routes — GET /api/v1/users/:id/balance + POST /api/v1/users

import { Router } from 'express'
import { getBalance, createUser, listUsers } from '../controllers/userController.js'

const router = Router()

router.get('/', listUsers)
router.post('/', createUser)
router.get('/:id/balance', getBalance)

export default router
