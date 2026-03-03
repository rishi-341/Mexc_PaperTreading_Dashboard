// app/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { TrendingUp, Wallet, BarChart3, Activity, DollarSign } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

const API_BASE = 'http://localhost:3000/api';

// --- Interfaces matching your Backend Responses ---
interface PriceData { symbol: string; price: number; }

interface Order { 
  _id: string; 
  symbol: string; 
  side: 'BUY'|'SELL'; 
  qty: number; 
  type: string; 
  status: string; 
  filledPrice?: number;
  timestamp: string;
}

interface PortfolioItem { 
  symbol: string; 
  amount: number; 
  value: number; 
  pnl: number; 
}

export default function DashboardPage() {
  const [userId] = useState('testuser'); // Hardcoded for now
  const [prices, setPrices] = useState<PriceData[]>([]);
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [balance, setBalance] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<'portfolio'|'orders'>('portfolio');

  // Trade Form State
  const [tradeSymbol, setTradeSymbol] = useState('BTC');
  const [tradeAmount, setTradeAmount] = useState('');
  const [isTrading, setIsTrading] = useState(false);
  
  // 1. Fetch Prices (and format them for the UI)
  const fetchPrices = useCallback(async () => {
    try {
      // Backend returns object: { "BTC": 50000, "ETH": 3000 }
      // const res = await fetch(`${API_BASE}/prices?symbols=BTC,ETH,SOL,DOGE,XRP,BNB`);
      const res = await fetch(`${API_BASE}/prices?symbols=BTC,ETH`);
      const data = await res.json();
      
      // Convert object to array for UI
      const formattedPrices = Object.entries(data).map(([key, val]) => ({
        symbol: key,
        price: Number(val)
      }));
      setPrices(formattedPrices);
      return formattedPrices; // Return for use in other functions
    } catch (error) {
      console.error('Price fetch error:', error);
      return [];
    }
  }, []);

  // 2. Fetch User Data (Balance, Orders, Portfolio Assets)
  const fetchUserData = useCallback(async (currentPrices: PriceData[]) => {
    try {
      const [portRes, ordersRes] = await Promise.all([
        fetch(`${API_BASE}/trades/balance/${userId}`),
        fetch(`${API_BASE}/trades/orders/${userId}`)
      ]);

      const portData = await portRes.json();
      const ordersData = await ordersRes.json();

      // Set Balance
      setBalance(portData.balance || 0);

      // Set Orders (Backend returns { orders: [...] })
      setOrders(ordersData.orders || []);

      // Transform Assets Map to Array and calculate Value
      // Backend assets: { "BTCUSDT": 0.5, "ETHUSDT": 2.0 }
      const assetsList: PortfolioItem[] = Object.entries(portData.assets || {}).map(([key, qty]) => {
        // Strip 'USDT' to match price keys if needed, or rely on consistency
        const symbol = key.replace('USDT', ''); 
        const amount = Number(qty);
        
        // Find current price to calculate value
        const currentPriceObj = currentPrices.find(p => p.symbol === symbol);
        const currentPrice = currentPriceObj ? currentPriceObj.price : 0;
        
        return {
          symbol: key,
          amount: amount,
          value: amount * currentPrice,
          pnl: 0 // Backend doesn't track avg buy price yet, so PnL is 0 for now
        };
      }).filter(item => item.amount > 0); // Only show assets we actually own

      setPortfolio(assetsList);

    } catch (error) {
      console.error('User data fetch error:', error);
    }
  }, [userId]);

  // Initial Load & Polling
  useEffect(() => {
    const init = async () => {
      const currentPrices = await fetchPrices();
      await fetchUserData(currentPrices);
    };
    init();

    const interval = setInterval(async () => {
      const currentPrices = await fetchPrices();
      await fetchUserData(currentPrices);
    }, 1000);

    return () => clearInterval(interval);
  }, [fetchPrices, fetchUserData]);


  // 3. Execute Trade Function
  const handleTrade = async (side: 'BUY' | 'SELL') => {
    if (!tradeAmount || Number(tradeAmount) <= 0) {
      alert("Please enter a valid amount");
      return;
    }
    setIsTrading(true);
    try {
      const res = await fetch(`${API_BASE}/trades/order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          symbol: tradeSymbol,
          side,
          qty: Number(tradeAmount),
          type: 'MARKET'
        })
      });
      
      const result = await res.json();
      
      if (!res.ok) throw new Error(result.error || 'Trade failed');
      
      alert(`Order Filled! ${side} ${tradeAmount} ${tradeSymbol} @ ${result.price}`);
      setTradeAmount(''); // Reset input
      
      // Refresh data immediately
      const p = await fetchPrices();
      fetchUserData(p);
      
    } catch (error: any) {
      alert(`Trade Failed: ${error.message}`);
    } finally {
      setIsTrading(false);
    }
  };

  const totalPortfolioValue = portfolio.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-black text-white">
      {/* Header */}
      <header className="border-b border-slate-800/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 bg-gradient-to-r from-cyan-500/90 to-emerald-500/90 rounded-2xl flex items-center justify-center shadow-2xl backdrop-blur-sm">
                <TrendingUp className="w-8 h-8 text-black font-bold" />
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
                  Paper Trading
                </h1>
                <p className="text-slate-400 text-sm mt-1">Live Market Simulation</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-slate-400">User ID</p>
              <p className="font-mono font-bold text-emerald-400">{userId}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-9xl mx-auto px-6 py-14 space-y-10">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard 
            icon={<Wallet className="w-6 h-6" />}
            title="Cash Balance"
            value={`$${balance.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 4})}`}
            change="Available"
            color="from-cyan-500 to-blue-500"
          />
          <StatCard 
            icon={<DollarSign className="w-6 h-6" />}
            title="Asset Value"
            value={`$${totalPortfolioValue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 4})}`}
            change="Est. Value"
            color="from-emerald-500 to-teal-500"
          />
          <StatCard 
            icon={<TrendingUp className="w-6 h-6" />}
            title="Total Net Worth"
            value={`$${(balance + totalPortfolioValue).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 4})}`}
            change="Combined"
            color="from-green-500 to-emerald-500"
          />
          <StatCard 
            icon={<Activity className="w-6 h-6" />}
            title="Total Orders"
            value={orders.length.toString()}
            change={orders.filter(o => o.status === 'PENDING').length + ' Pending'}
            color="from-purple-500 to-violet-500"
          />
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Live Prices */}
          <Card className="lg:col-span-2 bg-slate-900/30 backdrop-blur-xl border-slate-800/50 shadow-2xl border-opacity-50 col-span-1">
            <CardHeader className="pb-6">
              <CardTitle className="text-2xl font-bold flex items-center space-x-3 text-white">
                <BarChart3 className="w-8 h-8" />
                <span>Live Prices</span>
              </CardTitle>
              <p className="text-slate-400 text-lg">Real-time market data</p>
            </CardHeader>
            <CardContent className="pt-0 space-y-2">
              {prices.length === 0 ? <p className="text-slate-500 p-4">Loading prices...</p> : 
                prices.map((price) => (
                <PriceRow key={price.symbol} price={price} />
              ))}
            </CardContent>
          </Card>

          {/* Portfolio & Orders */}
          <Card className="bg-slate-900/30 backdrop-blur-xl border-slate-800/50 shadow-2xl h-[600px] col-span-1">
            <CardHeader className="pb-4">
              <CardTitle className="text-2xl font-bold flex items-center space-x-3 text-white">
                <Wallet className="w-8 h-8" />
                <span>Portfolio</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 h-[calc(100%-120px)] flex flex-col">
              <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)} className="flex-1 flex flex-col">
                <TabsList className="grid w-full grid-cols-2 bg-slate-800/50 border-slate-700/50 h-14 rounded-none">
                  <TabsTrigger value="portfolio" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-cyan-500 data-[state=active]:to-emerald-500 data-[state=active]:text-black rounded-none border-b-2 data-[state=active]:border-transparent">
                    Assets
                  </TabsTrigger>
                  <TabsTrigger value="orders" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-cyan-500 data-[state=active]:to-emerald-500 data-[state=active]:text-black rounded-none border-b-2 data-[state=active]:border-transparent">
                    History
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="portfolio" className="p-6 flex-1 overflow-y-auto max-h-full mt-0 border-t border-slate-800/50">
                  {portfolio.length === 0 ? <div className="text-slate-500 text-center mt-10">No assets owned</div> : 
                   <PortfolioList data={portfolio} />}
                </TabsContent>
                <TabsContent value="orders" className="p-6 flex-1 mt-0 border-t border-slate-800/50 overflow-hidden">
                  <div className="h-full max-h-full overflow-x-auto overflow-y-auto">
                    {orders.length === 0 ? (
                      <div className="text-slate-500 text-center mt-10 min-h-[200px] flex items-center justify-center">
                        No order history
                      </div>
                    ) : (
                      <OrdersList data={orders} />
                    )}
                  </div>
                </TabsContent>

              </Tabs>
            </CardContent>
          </Card>
        </div>

        {/* Quick Trade */}
        <Card className="bg-slate-900/30 backdrop-blur-xl border-slate-800/50 shadow-2xl">
          <CardHeader>
            <CardTitle className="text-2xl font-bold flex items-center space-x-3 text-white">
              <Activity className="w-8 h-8" />
              <span>Quick Trade</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-0">
            <Select onValueChange={setTradeSymbol} value={tradeSymbol}>
              <SelectTrigger className="bg-slate-800/50 border-slate-700/50 text-white hover:bg-slate-800/70 data-[placeholder]:text-slate-400">
                <SelectValue placeholder="Select pair" />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-800/50 text-white">
                <SelectItem value="BTC">BTC/USDT</SelectItem>
                <SelectItem value="ETH">ETH/USDT</SelectItem>
                <SelectItem value="SOL">SOL/USDT</SelectItem>
                <SelectItem value="DOGE">DOGE/USDT</SelectItem>
                <SelectItem value="XRP">XRP/USDT</SelectItem>
                <SelectItem value="BNB">BNB/USDT</SelectItem>
              </SelectContent>
            </Select>
            <Input 
              type="number" 
              placeholder="Qty (e.g. 0.01)" 
              value={tradeAmount}
              onChange={(e) => setTradeAmount(e.target.value)}
              className="bg-slate-800/50 border-slate-700/50 text-white placeholder-slate-400 hover:bg-slate-800/70 h-14 text-lg"
            />
            <div className="flex space-x-4">
              <Button 
                onClick={() => handleTrade('BUY')} 
                disabled={isTrading}
                className="h-14 flex-1 bg-gradient-to-r from-emerald-600/90 to-emerald-500/90 hover:from-emerald-500 hover:to-emerald-400 text-black font-bold shadow-xl hover:shadow-2xl transition-all backdrop-blur-sm border-0 disabled:opacity-50">
                {isTrading ? 'Processing...' : 'Buy (Long)'}
              </Button>
              <Button 
                onClick={() => handleTrade('SELL')} 
                disabled={isTrading}
                className="h-14 flex-1 bg-gradient-to-r from-red-600/90 to-red-500/90 hover:from-red-500 hover:to-red-400 text-white font-bold shadow-xl hover:shadow-2xl transition-all backdrop-blur-sm border-0 disabled:opacity-50">
                {isTrading ? 'Processing...' : 'Sell (Short)'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

// --- Sub Components ---

function StatCard({ icon, title, value, change, color }: any) {
  return (
    <Card className="group bg-slate-900/30 backdrop-blur-xl border-slate-800/50 hover:border-slate-700/50 hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 h-50 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br opacity-20 group-hover:opacity-30 transition-opacity" style={{ backgroundImage: `linear-gradient(135deg, ${color})` }} />
      <CardContent className="relative p-8 pt-12 h-full flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <div className={`p-4 bg-gradient-to-r ${color} rounded-2xl group-hover:scale-110 transition-all duration-300 shadow-2xl`}>
            {icon}
          </div>
          <Badge className={`font-bold text-xs bg-slate-800/50 text-slate-300 border-slate-700`}>
            {change}
          </Badge>
        </div>
        <div>
          <p className="text-slate-400 text-sm font-medium opacity-90">{title}</p>
          <p className="text-3xl font-bold text-white mt-2">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function PriceRow({ price }: { price: PriceData }) {
  return (
    <div className="group p-6 hover:bg-slate-800/50 transition-all duration-200 border-t border-slate-800/30 first:border-t-0 last:border-t">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xl font-bold font-mono text-white group-hover:text-cyan-400 transition-colors">
            {price.symbol}
          </p>
          <p className="text-2xl font-mono font-bold bg-gradient-to-r from-cyan-400 to-emerald-400 bg-clip-text text-transparent mt-1">
            ${price.price?.toLocaleString(undefined, {minimumFractionDigits: 2}) || '0.00'}
          </p>
        </div>
        <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-mono font-semibold px-4 py-2">
          Live
        </Badge>
      </div>
    </div>
  );
}

function PortfolioList({ data }: { data: PortfolioItem[] }) {
  return (
    <div className="space-y-4">
      {data.map((item, idx) => (
        <div key={idx} className="group p-4 hover:bg-slate-800/30 rounded-xl transition-all border border-slate-800/50">
          <div className="flex items-center justify-between">
            <div>
                <span className="text-lg font-mono font-semibold text-white block">{item.symbol}</span>
                <span className="text-sm text-slate-400">Qty: {item.amount}</span>
            </div>
            <div className="text-right">
              <p className="text-xl font-bold text-white">${item.value.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function OrdersList({ data }: { data: Order[] }) {
  return (
    <div className="space-y-3">
      {data.slice(0, 10).map((order) => (
        <div key={order._id} className="group p-4 hover:bg-slate-800/30 rounded-xl transition-all border border-slate-800/50">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center space-x-3">
              <span className="font-mono font-semibold text-white">{order.symbol}</span>
              <Badge className={`font-medium px-3 py-1 ${
                order.side === 'BUY' 
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' 
                  : 'bg-red-500/20 text-red-400 border-red-500/30'
              }`}>
                {order.side}
              </Badge>
            </div>
            <div className="text-right font-mono space-y-1">
              <p className="text-slate-300">
                {order.status === 'FILLED' && order.filledPrice 
                  ? `$${order.filledPrice}` 
                  : 'MKT'} 
                <span className="text-slate-500 mx-1">×</span> 
                {order.qty}
              </p>
              <Badge className={`px-3 py-1 ${
                order.status === 'FILLED' 
                  ? 'bg-emerald-500/20 text-emerald-400' 
                  : order.status === 'CANCELLED'
                  ? 'bg-red-500/20 text-red-400'
                  : 'bg-yellow-500/20 text-yellow-400'
              }`}>
                {order.status}
              </Badge>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}