import { useEffect, useState } from 'react'
import Navbar from './components/layout/Navbar'
import MarketStats from './components/layout/MarketStats'
import TradingLayout from './components/layout/TradingLayout'
import LoginPage from './components/auth/LoginPage'
import useOrderBook from './hooks/useOrderBook'
import useTrades from './hooks/useTrades'
import useSocket from './hooks/useSocket'
import useStore from './store/useStore'
import { getMe } from './services/api'
import ErrorBoundary from './components/ErrorBoundary'

// Mounts WebSocket subscriber hooks at root level
function LiveDataProvider() {
  useOrderBook()
  useTrades()
  return null
}

export default function App() {
  const { connected } = useSocket()
  const setSocketConnected = useStore((s) => s.setSocketConnected)
  const setCurrentUser = useStore((s) => s.setCurrentUser)
  const setBalances = useStore((s) => s.setBalances)
  const currentUser = useStore((s) => s.currentUser)

  const [bootstrapping, setBootstrapping] = useState(true)

  useEffect(() => {
    setSocketConnected(connected)
  }, [connected, setSocketConnected])

  // On mount — check if there's a stored JWT and try to restore session
  useEffect(() => {
    async function restoreSession() {
      const token = localStorage.getItem('tm_token')
      if (!token) {
        setBootstrapping(false)
        return
      }
      try {
        const res = await getMe()
        const user = res.data.user
        setCurrentUser(user)
        setBalances({
          fiat: parseFloat(user.fiatBalance),
          asset: parseFloat(user.assetBalance),
        })
      } catch {
        // Token expired or invalid — clear it
        localStorage.removeItem('tm_token')
      } finally {
        setBootstrapping(false)
      }
    }
    restoreSession()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Handle successful authentication from LoginPage
  function handleAuthenticated(user, token) {
    setCurrentUser(user)
    setBalances({
      fiat: parseFloat(user.fiatBalance),
      asset: parseFloat(user.assetBalance),
    })
  }

  // Show spinner while restoring session from token
  if (bootstrapping) {
    return (
      <div className="flex items-center justify-center h-screen bg-bg-primary text-text-primary text-lg">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          <span className="text-text-secondary text-sm">Connecting to TempoMatch...</span>
        </div>
      </div>
    )
  }

  // Show login page if not authenticated
  if (!currentUser) {
    return (
      <ErrorBoundary>
        <LoginPage onAuthenticated={handleAuthenticated} />
      </ErrorBoundary>
    )
  }

  // Main trading app
  return (
    <ErrorBoundary>
      <LiveDataProvider />
      <div className="flex flex-col h-screen bg-bg-primary">
        <Navbar />
        <MarketStats />
        <ErrorBoundary>
          <TradingLayout />
        </ErrorBoundary>
      </div>
    </ErrorBoundary>
  )
}
