// Central Express error handler

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  const status = err.status || 500
  const message = err.message || 'Internal Server Error'
  console.error(`[Error] ${status} — ${message}`, err.stack)
  res.status(status).json({ error: message })
}
