import OrderBook from '../orderbook/OrderBook'
import CandlestickChart from '../chart/CandlestickChart'
import OrderEntryForm from '../trading/OrderEntryForm'
import BalanceDisplay from '../trading/BalanceDisplay'
import RecentTrades from '../history/RecentTrades'
import OpenOrders from '../history/OpenOrders'

export default function TradingLayout() {
  return (
    <div className="flex-1 grid grid-cols-[280px_1fr_320px] grid-rows-[1fr_220px] gap-px bg-border overflow-hidden min-h-0">
      {/* Left: Order Book */}
      <div className="bg-bg-primary overflow-hidden">
        <OrderBook />
      </div>

      {/* Center: Candlestick Chart */}
      <div className="bg-bg-primary overflow-hidden">
        <CandlestickChart />
      </div>

      {/* Right: Order Entry + Balance */}
      <div className="bg-bg-primary overflow-hidden flex flex-col">
        <OrderEntryForm />
        <BalanceDisplay />
      </div>

      {/* Bottom-left: Recent Trades */}
      <div className="bg-bg-primary overflow-hidden">
        <RecentTrades />
      </div>

      {/* Bottom-center + bottom-right: Open Orders */}
      <div className="bg-bg-primary overflow-hidden col-span-2">
        <OpenOrders />
      </div>
    </div>
  )
}
