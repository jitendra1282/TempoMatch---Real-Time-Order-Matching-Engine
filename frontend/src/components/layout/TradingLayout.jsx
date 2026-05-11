import OrderBook from '../orderbook/OrderBook'
import CandlestickChart from '../chart/CandlestickChart'
import OrderEntryForm from '../trading/OrderEntryForm'
import BalanceDisplay from '../trading/BalanceDisplay'
import RecentTrades from '../history/RecentTrades'
import OpenOrders from '../history/OpenOrders'

export default function TradingLayout() {
  return (
    <div className="flex-1 flex flex-col lg:grid lg:grid-cols-[280px_1fr_320px] lg:grid-rows-[1fr_220px] gap-px bg-border overflow-auto lg:overflow-hidden min-h-0">
      {/* Left: Order Book */}
      <div className="bg-bg-primary overflow-hidden h-[400px] lg:h-auto order-2 lg:order-none">
        <OrderBook />
      </div>

      {/* Center: Candlestick Chart */}
      <div className="bg-bg-primary overflow-hidden h-[400px] lg:h-auto order-1 lg:order-none">
        <CandlestickChart />
      </div>

      {/* Right: Order Entry + Balance */}
      <div className="bg-bg-primary overflow-hidden flex flex-col order-3 lg:order-none">
        <OrderEntryForm />
        <BalanceDisplay />
      </div>

      {/* Bottom-left: Recent Trades */}
      <div className="bg-bg-primary overflow-hidden h-[300px] lg:h-auto order-4 lg:order-none">
        <RecentTrades />
      </div>

      {/* Bottom-center + bottom-right: Open Orders */}
      <div className="bg-bg-primary overflow-hidden h-[300px] lg:h-auto lg:col-span-2 order-5 lg:order-none">
        <OpenOrders />
      </div>
    </div>
  )
}
