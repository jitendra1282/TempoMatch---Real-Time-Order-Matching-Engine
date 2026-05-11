import { useState } from 'react'
import useStore from '../../store/useStore'

const USERS = [
  { id: 'user-alice', name: 'Alice' },
  { id: 'user-bob', name: 'Bob' },
]

export default function Navbar() {
  const { currentUser, setCurrentUser } = useStore()
  const [dropdownOpen, setDropdownOpen] = useState(false)

  return (
    <nav className="flex items-center justify-between px-4 h-12 bg-bg-secondary border-b border-border shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-accent flex items-center justify-center">
            <span className="text-bg-primary font-bold text-xs">T</span>
          </div>
          <span className="text-text-primary font-semibold text-base tracking-tight">
            TempoMatch
          </span>
        </div>

        {/* Market Pair */}
        <div className="flex items-center gap-1 ml-4 px-3 py-1 rounded hover:bg-bg-tertiary cursor-pointer transition-colors">
          <span className="text-text-primary font-semibold">BTC/USDT</span>
          <svg className="w-3 h-3 text-text-secondary" fill="currentColor" viewBox="0 0 12 12">
            <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" />
          </svg>
        </div>
      </div>

      {/* User Selector */}
      <div className="relative">
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="flex items-center gap-2 px-3 py-1.5 rounded bg-bg-tertiary hover:bg-bg-hover text-text-primary text-sm transition-colors cursor-pointer"
        >
          <div className="w-5 h-5 rounded-full bg-accent flex items-center justify-center">
            <span className="text-[10px] font-bold text-bg-primary">
              {currentUser.name[0]}
            </span>
          </div>
          {currentUser.name}
          <svg className="w-3 h-3 text-text-secondary" fill="currentColor" viewBox="0 0 12 12">
            <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" />
          </svg>
        </button>

        {dropdownOpen && (
          <div className="absolute right-0 top-full mt-1 bg-bg-secondary border border-border rounded shadow-lg z-50 min-w-[140px]">
            {USERS.map(user => (
              <button
                key={user.id}
                onClick={() => {
                  setCurrentUser(user)
                  setDropdownOpen(false)
                }}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-bg-tertiary transition-colors cursor-pointer ${
                  currentUser.id === user.id ? 'text-accent' : 'text-text-primary'
                }`}
              >
                {user.name}
              </button>
            ))}
          </div>
        )}
      </div>
    </nav>
  )
}
