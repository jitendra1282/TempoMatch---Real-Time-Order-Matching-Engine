import { useState, useEffect, useRef } from 'react'
import '../auth.css'
import { registerUser, loginUser, googleAuthUser } from '../services/api'

// ── Ticker data ──────────────────────────────────────────────────────────────
const TICKER_ITEMS = [
  { pair: 'BTC/USDT', price: '81,027.43', change: '+0.34%', up: true },
  { pair: 'ETH/USDT', price: '3,142.18', change: '+1.12%', up: true },
  { pair: 'SOL/USDT', price: '178.55', change: '-0.48%', up: false },
  { pair: 'BNB/USDT', price: '592.30', change: '+0.71%', up: true },
  { pair: 'XRP/USDT', price: '0.5821', change: '-0.19%', up: false },
  { pair: 'DOGE/USDT', price: '0.1284', change: '+2.31%', up: true },
  { pair: 'ADA/USDT', price: '0.4523', change: '+0.88%', up: true },
  { pair: 'MATIC/USDT', price: '0.8891', change: '-1.02%', up: false },
]

// ── SVG Icons ────────────────────────────────────────────────────────────────
const MailIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
  </svg>
)
const LockIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
)
const UserIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
  </svg>
)
const PhoneIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.15 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.06 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.09 8.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
  </svg>
)
const EyeIcon = ({ open }) => open ? (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
  </svg>
) : (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
    <line x1="1" y1="1" x2="23" y2="23"/>
  </svg>
)
const AlertIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0, marginTop:1}}>
    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>
)
const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
)

// ── Ticker Bar ────────────────────────────────────────────────────────────────
function TickerBar() {
  const doubled = [...TICKER_ITEMS, ...TICKER_ITEMS]
  return (
    <div className="auth-ticker">
      <div className="auth-ticker-track">
        {doubled.map((item, i) => (
          <div key={i} className="auth-ticker-item">
            <span className="pair">{item.pair}</span>
            <span className="price" style={{color: '#f0f2f5'}}>{item.price}</span>
            <span className={item.up ? 'up' : 'down'}>{item.change}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Login Form ────────────────────────────────────────────────────────────────
function LoginForm({ onSuccess, onSwitchToRegister }) {
  const [tab, setTab] = useState('email') // 'email' | 'phone' | 'google'
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleEmailLogin(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await loginUser({ email, password })
      const { token, user } = res.data
      localStorage.setItem('tm_token', token)
      onSuccess(user, token)
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Check your credentials.')
    } finally {
      setLoading(false)
    }
  }

  async function handlePhoneLogin(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await loginUser({ phone, password, method: 'phone' })
      const { token, user } = res.data
      localStorage.setItem('tm_token', token)
      onSuccess(user, token)
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Check your phone and password.')
    } finally {
      setLoading(false)
    }
  }

  async function handleGoogleLogin() {
    setError('')
    setGoogleLoading(true)
    try {
      // Use Google Identity Services (GSI) popup
      if (!window.google) {
        setError('Google Sign-In is not available. Make sure VITE_GOOGLE_CLIENT_ID is set.')
        setGoogleLoading(false)
        return
      }

      window.google.accounts.id.initialize({
        client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
        callback: async (response) => {
          try {
            // Decode the JWT credential to get user info
            const payload = JSON.parse(atob(response.credential.split('.')[1]))
            const res = await googleAuthUser({
              googleId: payload.sub,
              email: payload.email,
              name: payload.name,
              photoURL: payload.picture,
            })
            const { token, user } = res.data
            localStorage.setItem('tm_token', token)
            onSuccess(user, token)
          } catch (err) {
            setError(err.response?.data?.error || 'Google sign-in failed.')
          } finally {
            setGoogleLoading(false)
          }
        },
      })
      window.google.accounts.id.prompt()
    } catch {
      setError('Google Sign-In failed. Please try email/password instead.')
      setGoogleLoading(false)
    }
  }

  return (
    <>
      <h1 className="auth-title">Welcome back</h1>
      <p className="auth-subtitle">Sign in to your TempoMatch account</p>

      {/* Tab switcher */}
      <div className="auth-tabs" role="tablist">
        <button
          role="tab"
          aria-selected={tab === 'email'}
          className={`auth-tab ${tab === 'email' ? 'active' : ''}`}
          onClick={() => { setTab('email'); setError('') }}
          type="button"
        >
          <MailIcon /> Email
        </button>
        <button
          role="tab"
          aria-selected={tab === 'phone'}
          className={`auth-tab ${tab === 'phone' ? 'active' : ''}`}
          onClick={() => { setTab('phone'); setError('') }}
          type="button"
        >
          <PhoneIcon /> Phone
        </button>
        <button
          role="tab"
          aria-selected={tab === 'google'}
          className={`auth-tab ${tab === 'google' ? 'active' : ''}`}
          onClick={() => { setTab('google'); setError('') }}
          type="button"
        >
          <GoogleIcon /> Google
        </button>
      </div>

      {/* Error message */}
      {error && (
        <div className="auth-message error" role="alert">
          <AlertIcon /> {error}
        </div>
      )}

      {/* Email tab */}
      {tab === 'email' && (
        <form onSubmit={handleEmailLogin} noValidate>
          <div className="auth-field">
            <label className="auth-label" htmlFor="login-email">Email address</label>
            <div className="auth-input-wrap">
              <span className="auth-input-icon"><MailIcon /></span>
              <input
                id="login-email"
                type="email"
                className="auth-input"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
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

          <button type="submit" id="login-submit-btn" className="auth-btn" disabled={loading}>
            {loading ? <span className="auth-spinner" /> : 'Sign In'}
          </button>
        </form>
      )}

      {/* Phone tab */}
      {tab === 'phone' && (
        <form onSubmit={handlePhoneLogin} noValidate>
          <div className="auth-field">
            <label className="auth-label" htmlFor="login-phone">Phone number</label>
            <div className="auth-phone-wrap">
              <span className="auth-phone-prefix">🇮🇳 +91</span>
              <div className="auth-input-wrap" style={{flex:1}}>
                <span className="auth-input-icon"><PhoneIcon /></span>
                <input
                  id="login-phone"
                  type="tel"
                  className="auth-input"
                  placeholder="98765 43210"
                  value={phone}
                  onChange={e => setPhone(e.target.value.replace(/\D/g, ''))}
                  required
                  autoComplete="tel"
                />
              </div>
            </div>
          </div>

          <div className="auth-field">
            <label className="auth-label" htmlFor="login-phone-password">Password</label>
            <div className="auth-input-wrap">
              <span className="auth-input-icon"><LockIcon /></span>
              <input
                id="login-phone-password"
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

          <button type="submit" id="login-phone-submit-btn" className="auth-btn" disabled={loading}>
            {loading ? <span className="auth-spinner" /> : 'Sign In with Phone'}
          </button>
        </form>
      )}

      {/* Google tab */}
      {tab === 'google' && (
        <div>
          <p style={{color: '#9ea4ae', fontSize: '13px', textAlign: 'center', marginBottom: '20px', lineHeight: '1.6'}}>
            Sign in instantly with your Google account. No password needed.
          </p>
          <button
            type="button"
            id="login-google-btn"
            className="auth-google-btn"
            onClick={handleGoogleLogin}
            disabled={googleLoading}
          >
            {googleLoading ? <span className="auth-spinner" style={{borderTopColor:'#f0f2f5'}} /> : <GoogleIcon />}
            {googleLoading ? 'Opening Google...' : 'Continue with Google'}
          </button>

          {import.meta.env.VITE_GOOGLE_CLIENT_ID === 'YOUR_GOOGLE_CLIENT_ID_HERE' && (
            <p style={{color:'#646a73', fontSize:'11px', textAlign:'center', marginTop:'12px'}}>
              ⚠️ Google Client ID not configured in <code style={{color:'#9ea4ae'}}>.env</code>
            </p>
          )}
        </div>
      )}

      <p className="auth-footer">
        Don't have an account?{' '}
        <button type="button" className="auth-link" onClick={onSwitchToRegister}>
          Create account
        </button>
      </p>
    </>
  )
}

// ── Register Form ─────────────────────────────────────────────────────────────
function RegisterForm({ onSuccess, onSwitchToLogin }) {
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleRegister(e) {
    e.preventDefault()
    setError('')
    if (password !== confirmPw) {
      setError('Passwords do not match.')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    setLoading(true)
    try {
      const res = await registerUser({
        username: username.trim(),
        email: email.trim(),
        password,
        phone: phone ? `+91${phone}` : undefined,
      })
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
      <p className="auth-subtitle">Start trading on TempoMatch today</p>

      {error && (
        <div className="auth-message error" role="alert">
          <AlertIcon /> {error}
        </div>
      )}

      <form onSubmit={handleRegister} noValidate>
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
            />
          </div>
        </div>

        <div className="auth-field">
          <label className="auth-label" htmlFor="reg-email">Email address</label>
          <div className="auth-input-wrap">
            <span className="auth-input-icon"><MailIcon /></span>
            <input
              id="reg-email"
              type="email"
              className="auth-input"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
        </div>

        <div className="auth-field">
          <label className="auth-label" htmlFor="reg-phone">Phone number <span style={{color:'#646a73'}}>(optional)</span></label>
          <div className="auth-phone-wrap">
            <span className="auth-phone-prefix">🇮🇳 +91</span>
            <div className="auth-input-wrap" style={{flex:1}}>
              <span className="auth-input-icon"><PhoneIcon /></span>
              <input
                id="reg-phone"
                type="tel"
                className="auth-input"
                placeholder="98765 43210"
                value={phone}
                onChange={e => setPhone(e.target.value.replace(/\D/g, ''))}
                autoComplete="tel"
              />
            </div>
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
          </div>
        </div>

        <button type="submit" id="register-submit-btn" className="auth-btn" disabled={loading}>
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

// ── Main LoginPage export ─────────────────────────────────────────────────────
export default function LoginPage({ onAuthenticated }) {
  const [view, setView] = useState('login') // 'login' | 'register'

  // Load Google Identity Services script
  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
    if (!clientId || clientId === 'YOUR_GOOGLE_CLIENT_ID_HERE') return
    if (document.getElementById('gsi-script')) return

    const script = document.createElement('script')
    script.id = 'gsi-script'
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    document.head.appendChild(script)
    return () => {}
  }, [])

  function handleSuccess(user, token) {
    onAuthenticated(user, token)
  }

  return (
    <div className="auth-root">
      <TickerBar />

      <div className="auth-card" style={{ marginTop: '32px' }}>
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
            onSuccess={handleSuccess}
            onSwitchToRegister={() => setView('register')}
          />
        ) : (
          <RegisterForm
            onSuccess={handleSuccess}
            onSwitchToLogin={() => setView('login')}
          />
        )}

        {/* Footer */}
        <div style={{
          marginTop: '24px',
          paddingTop: '16px',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          display: 'flex',
          justifyContent: 'center',
          gap: '20px',
        }}>
          {['BTC/USDT', 'ETH/USDT', 'SOL/USDT'].map(pair => (
            <span key={pair} style={{fontSize:'11px', color:'#646a73'}}>{pair}</span>
          ))}
        </div>
        <p style={{textAlign:'center', fontSize:'10px', color:'#464c56', marginTop:'8px'}}>
          © 2025 TempoMatch · For demonstration purposes only
        </p>
      </div>
    </div>
  )
}
