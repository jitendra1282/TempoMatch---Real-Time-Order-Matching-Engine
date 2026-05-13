// Middleware — validate order placement body via express-validator

import { body, param, query, validationResult } from 'express-validator'

export const validateOrder = [
  body('userId').isUUID().withMessage('userId must be a valid UUID'),
  body('side').isIn(['BUY', 'SELL']).withMessage('side must be BUY or SELL'),
  body('type').isIn(['LIMIT', 'MARKET']).withMessage('type must be LIMIT or MARKET'),
  body('price')
    .if(body('type').equals('LIMIT'))
    .isFloat({ gt: 0 })
    .withMessage('price must be > 0 for LIMIT orders'),
  body('qty').isFloat({ gt: 0 }).withMessage('qty must be > 0'),

  // Run validation and respond with errors if any
  (req, res, next) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() })
    }
    next()
  },
]

export const validateCancelOrder = [
  param('id').isUUID().withMessage('id must be a valid UUID'),
  query('userId').isUUID().withMessage('userId query param must be a valid UUID'),

  (req, res, next) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() })
    }
    next()
  },
]
