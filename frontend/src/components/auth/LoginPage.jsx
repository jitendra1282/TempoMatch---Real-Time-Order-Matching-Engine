import { useState, useEffect } from 'react'
import '../../auth.css'
import { loginUser, registerUser } from '../../services/api'

// ── Ticker data ───────────────────────────────────────────────────────────────
const TICKER_ITEMS = [
  { pair: 'BTC/USDT', price: '81,027.43', change: '+0.34%', up: true },
  { pair: 'ETH/USDT', price: '3,142.18',  change: '+1.12%', up: true },
  { pair: 'SOL/USDT', price: '178.55',    change: '-0.48%', up: false },
  { pair: 'BNB/USDT', price: '592.30',    change: '+0.71%', up: true },
  { pair: 'XRP/USDT', price: '0.5821',    change: '-0.19%', up: false },
  { pair: 'DOGE/USDT', price: '0.1284',   change: '+2.31%', up: true },
  { pair: 'ADA/USDT', price: '0.4523',    change: '+0.88%', up: true },
  { pair: 'MATIC/USDT', price: '0.8891',  change: '-1.02%', up: false },
]

// ── SVG Icons ─────────────────────────────────────────────────────────────────
const UserIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
  </svg>
)
const LockIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
)
const EyeIcon = ({ open }) => open ? (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
) : (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
    <line x1="1" y1="1" x2="23" y2="23"/>
  </svg>
)
const AlertIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
    <circle cx="12" cy="12" r="10"/>
    <line x1="12" y1="8" x2="12" y2="12"/>
    <line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>
)
const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
    <polyline points="20 6 9 17 4 12"/>
  </svg>
)

// ── Live Ticker Bar ───────────────────────────────────────────────────────────
function TickerBar() {
  const doubled = [...TICKER_ITEMS, ...TICKER_ITEMS]
  return (
    <div className="auth-ticker">
      <div className="auth-ticker-track">
        {doubled.map((item, i) => (
          <div key={i} className="auth-ticker-item">
            <span className="pair">{item.pair}</span>
            <span className="price" style={{ color: '#f0f2f5' }}>{item.price}</span>
            <span className={item.up ? 'up' : 'down'}>{item.change}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Login Form ────────────────────────────────────────────────────────────────
function LoginForm({ onSuccess, onSwitchToRegister }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw]     = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!username.trim() || !password) return
    setError('')
    setLoading(true)
    try {
      const res = await loginUser({ username: username.trim(), password })
      const { token, user } = res.data
      localStorage.setItem('tm_token', token)
      onSuccess(user, token)
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid username or password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <h1 className="auth-title">Welcome back</h1>
      <p className="auth-subtitle">Sign in to your TempoMatch account</p>

      {error && (
        <div className="auth-message error" role="alert">
          <AlertIcon /> {error}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <div className="auth-field">
          <label className="auth-label" htmlFor="login-username">Username</label>
          <div className="auth-input-wrap">
            <span className="auth-input-icon"><UserIcon /></span>
            <input
              id="login-username"
              type="text"
              className="auth-input"
              placeholder="your_username"
              value={username}
              onChange={e => setUsername(e.target.value)}
              required
              autoComplete="username"
              autoFocus
            />
          </div>
        </div>

        <div className="auth-field">
          <label className="auth-label" htmlFor="login-password">Password</label>
          <div className="auth-input-wrap">
            <span className="auth-input-icon"><LockIcon /></span>
            <input
              id="login-password"
              type={showPw ? 'text' : 'password'}
              className="auth-input"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
            <button
              type="button"
              className="auth-input-suffix"
              onClick={() => setShowPw(p => !p)}
              aria-label={showPw ? 'Hide password' : 'Show password'}
            >
              <EyeIcon open={showPw} />
            </button>
          </div>
        </div>

        <button
          type="submit"
          id="login-submit-btn"
          className="auth-btn"
          disabled={loading || !username.trim() || !password}
        >
          {loading ? <span className="auth-spinner" /> : 'Sign In'}
        </button>
      </form>

      <p className="auth-footer">
        Don&apos;t have an account?{' '}
        <button type="button" className="auth-link" onClick={onSwitchToRegister}>
          Create account
        </button>
      </p>
    </>
  )
}

// ── Register Form ─────────────────────────────────────────────────────────────
function RegisterForm({ onSuccess, onSwitchToLogin }) {
  const [username, setUsername]   = useState('')
  const [password, setPassword]   = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [showPw, setShowPw]       = useState(false)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')

  // Password strength indicator
  const pwStrength = password.length === 0 ? null
    : password.length < 6 ? 'weak'
    : password.length < 10 ? 'fair'
    : 'strong'

  const strengthColor = { weak: '#ff4d64', fair: '#f0b90b', strong: '#13d284' }
  const strengthLabel = { weak: 'Too short', fair: 'Fair', strong: 'Strong' }

  async function handleSubmit(e) {
    e.preventDefault()
    if (password !== confirmPw) {
      setError('Passwords do not match.')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    setError('')
    setLoading(true)
    try {
      const res = await registerUser({ username: username.trim(), password })
      const { token, user } = res.data
      localStorage.setItem('tm_token', token)
      onSuccess(user, token)
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <h1 className="auth-title">Create account</h1>
      <p className="auth-subtitle">Start trading on TempoMatch today — free</p>

      {error && (
        <div className="auth-message error" role="alert">
          <AlertIcon /> {error}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <div className="auth-field">
          <label className="auth-label" htmlFor="reg-username">Username</label>
          <div className="auth-input-wrap">
            <span className="auth-input-icon"><UserIcon /></span>
            <input
              id="reg-username"
              type="text"
              className="auth-input"
              placeholder="satoshi_btc"
              value={username}
              onChange={e => setUsername(e.target.value)}
              required
              autoComplete="username"
              minLength={3}
              maxLength={30}
              autoFocus
            />
          </div>
        </div>

        <div className="auth-field">
          <label className="auth-label" htmlFor="reg-password">Password</label>
          <div className="auth-input-wrap">
            <span className="auth-input-icon"><LockIcon /></span>
            <input
              id="reg-password"
              type={showPw ? 'text' : 'password'}
              className="auth-input"
              placeholder="Min. 6 characters"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="new-password"
              minLength={6}
            />
            <button
              type="button"
              className="auth-input-suffix"
              onClick={() => setShowPw(p => !p)}
              aria-label={showPw ? 'Hide password' : 'Show password'}
            >
              <EyeIcon open={showPw} />
            </button>
          </div>
          {/* Password strength bar */}
          {pwStrength && (
            <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ flex: 1, height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  borderRadius: 2,
                  background: strengthColor[pwStrength],
                  width: pwStrength === 'weak' ? '33%' : pwStrength === 'fair' ? '66%' : '100%',
                  transition: 'width 0.3s, background 0.3s',
                }} />
              </div>
              <span style={{ fontSize: 11, color: strengthColor[pwStrength], minWidth: 50 }}>
                {strengthLabel[pwStrength]}
              </span>
            </div>
          )}
        </div>

        <div className="auth-field">
          <label className="auth-label" htmlFor="reg-confirm">Confirm password</label>
          <div className="auth-input-wrap">
            <span className="auth-input-icon"><LockIcon /></span>
            <input
              id="reg-confirm"
              type={showPw ? 'text' : 'password'}
              className="auth-input"
              placeholder="Repeat password"
              value={confirmPw}
              onChange={e => setConfirmPw(e.target.value)}
              required
              autoComplete="new-password"
            />
            {confirmPw && password === confirmPw && (
              <span className="auth-input-suffix" style={{ color: '#13d284' }}>
                <CheckIcon />
              </span>
            )}
          </div>
        </div>

        <button
          type="submit"
          id="register-submit-btn"
          className="auth-btn"
          disabled={loading || !username.trim() || !password || !confirmPw}
        >
          {loading ? <span className="auth-spinner" /> : 'Create Account'}
        </button>
      </form>

      <p className="auth-footer">
        Already have an account?{' '}
        <button type="button" className="auth-link" onClick={onSwitchToLogin}>
          Sign in
        </button>
      </p>
    </>
  )
}

// ── Main LoginPage ────────────────────────────────────────────────────────────
export default function LoginPage({ onAuthenticated }) {
  const [view, setView] = useState('login')

  return (
    <div className="auth-root">
      <TickerBar />

      <div className="auth-card" style={{ marginTop: 32 }}>
        {/* Logo */}
        <div className="auth-logo">
          <div className="auth-logo-icon">T</div>
          <div className="auth-logo-text">
            <span className="auth-logo-name">TempoMatch</span>
            <span className="auth-logo-tagline">Real-Time Order Matching Engine</span>
          </div>
        </div>

        {view === 'login' ? (
          <LoginForm
            onSuccess={onAuthenticated}
            onSwitchToRegister={() => setView('register')}
          />
        ) : (
          <RegisterForm
            onSuccess={onAuthenticated}
            onSwitchToLogin={() => setView('login')}
          />
        )}

        {/* Footer strip */}
        <div style={{
          marginTop: 24,
          paddingTop: 14,
          borderTop: '1px solid rgba(255,255,255,0.06)',
          display: 'flex',
          justifyContent: 'center',
          gap: 20,
        }}>
          {['BTC/USDT', 'ETH/USDT', 'SOL/USDT'].map(pair => (
            <span key={pair} style={{ fontSize: 11, color: '#646a73' }}>{pair}</span>
          ))}
        </div>
        <p style={{ textAlign: 'center', fontSize: 10, color: '#464c56', marginTop: 6 }}>
          © 2025 TempoMatch · For demonstration purposes only
        </p>
      </div>
    </div>
  )
}
