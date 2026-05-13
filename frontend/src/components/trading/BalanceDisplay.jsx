import { useEffect } from 'react'
import useStore from '../../store/useStore'
import { getBalance } from '../../services/api'

export default function BalanceDisplay() {
  const currentUser = useStore((s) => s.currentUser)
  const balances = useStore((s) => s.balances)
  const setBalances = useStore((s) => s.setBalances)

  // Fetch real balance from backend whenever user changes
  useEffect(() => {
    if (!currentUser?.id || currentUser.id === 'offline') return

    getBalance(currentUser.id)
      .then((res) => {
        const { fiatBalance, assetBalance } = res.data.user
        setBalances({
          fiat: parseFloat(fiatBalance),
          asset: parseFloat(assetBalance),
        })
      })
      .catch(() => {
        // Backend offline — keep existing balances
      })
  }, [currentUser?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="px-3 py-2 border-t border-border mt-auto shrink-0">
      <div className="flex items-center justify-between text-xs">
        <span className="text-text-muted">Avbl</span>
        <div className="flex gap-4">
          <span className="text-text-primary tabular-nums">
            {balances.fiat.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            <span className="text-text-muted ml-1">USDT</span>
          </span>
          <span className="text-text-primary tabular-nums">
            {balances.asset.toFixed(5)}
            <span className="text-text-muted ml-1">BTC</span>
          </span>
        </div>
      </div>
    </div>
  )
}
