import useStore from '../../store/useStore'

export default function Navbar() {
  const { currentUser, setCurrentUser, socketConnected } = useStore()

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
          <div 
            className={`w-2 h-2 rounded-full ml-1 ${socketConnected ? 'bg-bid shadow-[0_0_8px_rgba(14,203,129,0.5)]' : 'bg-ask shadow-[0_0_8px_rgba(246,70,93,0.5)]'}`}
            title={socketConnected ? 'Connected to Engine' : 'Disconnected'}
          />
        </div>

        {/* Market Pair */}
        <div className="flex items-center gap-1 ml-4 px-3 py-1 rounded hover:bg-bg-tertiary cursor-pointer transition-colors">
          <span className="text-text-primary font-semibold">BTC/USDT</span>
          <svg className="w-3 h-3 text-text-secondary" fill="currentColor" viewBox="0 0 12 12">
            <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" />
          </svg>
        </div>
      </div>

      {/* User Display */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-bg-tertiary text-text-primary text-sm">
          <div className="w-5 h-5 rounded-full bg-accent flex items-center justify-center">
            <span className="text-[10px] font-bold text-bg-primary">
              {currentUser?.username?.[0]?.toUpperCase() || '?'}
            </span>
          </div>
          {currentUser?.username}
        </div>
        
        <button 
          onClick={() => setCurrentUser(null)}
          className="text-text-secondary text-xs hover:text-text-primary cursor-pointer"
        >
          Logout
        </button>
      </div>
    </nav>
  )
}
