import { useEffect, useState } from 'react'
import Navbar from './components/layout/Navbar'
import MarketStats from './components/layout/MarketStats'
import TradingLayout from './components/layout/TradingLayout'
import useOrderBook from './hooks/useOrderBook'
import useTrades from './hooks/useTrades'
import useSocket from './hooks/useSocket'
import useStore from './store/useStore'
import { listUsers, createUser } from './services/api'

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
  const currentUser = useStore((s) => s.currentUser)

  const [users, setUsers] = useState([])
  const [newUsername, setNewUsername] = useState('')
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    setSocketConnected(connected)
  }, [connected, setSocketConnected])

  // Load available users from backend on mount
  useEffect(() => {
    listUsers()
      .then((res) => {
        setUsers(res.data.users)
      })
      .catch(() => {
        // Backend offline — use a default local user
        if (!currentUser) {
          setCurrentUser({ id: 'offline', username: 'Demo User', fiatBalance: 10000, assetBalance: 0.5 })
        }
      })
      .finally(() => setLoadingUsers(false))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleCreateUser = async (e) => {
    e.preventDefault()
    if (!newUsername.trim()) return
    setCreating(true)
    try {
      const res = await createUser(newUsername.trim())
      const user = res.data.user
      setUsers((prev) => [...prev, user])
      setCurrentUser(user)
      setNewUsername('')
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to create user')
    } finally {
      setCreating(false)
    }
  }

  if (loadingUsers) {
    return (
      <div className="flex items-center justify-center h-screen bg-bg-primary text-text-primary text-lg">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          <span className="text-text-secondary text-sm">Connecting to TempoMatch...</span>
        </div>
      </div>
    )
  }

  if (!currentUser) {
    return (
      <div className="flex items-center justify-center h-screen bg-bg-primary">
        <div className="bg-bg-secondary border border-border rounded-xl p-8 w-[340px] flex flex-col gap-5">
          <h1 className="text-text-primary font-bold text-xl text-center">Welcome to TempoMatch</h1>
          <p className="text-text-secondary text-sm text-center">Select a user or create a new one to start trading.</p>

          {users.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-text-muted text-xs uppercase tracking-wider">Existing Users</p>
              {users.map((u) => (
                <button
                  key={u.id}
                  onClick={() => setCurrentUser(u)}
                  className="flex items-center justify-between px-4 py-2.5 bg-bg-tertiary hover:bg-border rounded-lg text-text-primary text-sm transition-colors cursor-pointer"
                >
                  <span>{u.username}</span>
                  <span className="text-text-muted text-xs">${parseFloat(u.fiatBalance).toFixed(2)}</span>
                </button>
              ))}
            </div>
          )}

          <div className="border-t border-border pt-4">
            <p className="text-text-muted text-xs uppercase tracking-wider mb-2">Create New User</p>
            <form onSubmit={handleCreateUser} className="flex gap-2">
              <input
                type="text"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder="Username"
                className="flex-1 bg-bg-tertiary border border-border rounded-lg px-3 py-2 text-text-primary text-sm outline-none focus:border-accent transition-colors"
              />
              <button
                type="submit"
                disabled={creating}
                className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-semibold hover:brightness-110 transition-all disabled:opacity-50 cursor-pointer"
              >
                {creating ? '...' : 'Create'}
              </button>
            </form>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <LiveDataProvider />
      <div className="flex flex-col h-screen bg-bg-primary">
        <Navbar />
        <MarketStats />
        <TradingLayout />
      </div>
    </>
  )
}
