import Navbar from './components/layout/Navbar'
import MarketStats from './components/layout/MarketStats'
import TradingLayout from './components/layout/TradingLayout'

function App() {
  return (
    <div className="flex flex-col h-screen bg-bg-primary">
      <Navbar />
      <MarketStats />
      <TradingLayout />
    </div>
  )
}

export default App
