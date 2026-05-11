import useStore from '../../store/useStore'

export default function BalanceDisplay() {
  const { balances } = useStore()

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
