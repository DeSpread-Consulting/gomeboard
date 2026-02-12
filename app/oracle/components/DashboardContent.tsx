"use client";

import { useState, useEffect } from "react";
import PremiumChart from "./PremiumChart";
import StockIndexChart from "./StockIndexChart";
import StockMajorChart from "./StockMajorChart";
import { fetchDashboardData, type ChartData, type StockData } from "../actions";

interface Props {
  initialCrypto: ChartData[];
  initialIndices: StockData[];
  initialMajors: StockData[];
}

export default function DashboardContent({ initialCrypto, initialIndices, initialMajors }: Props) {
  // Tabs: 'crypto' | 'stock'
  const [activeTab, setActiveTab] = useState<'crypto' | 'stock'>('crypto');
  
  // Date Selection: YYYY-MM-DD (Defaults to Today in KST)
  // Need to be careful with client timezone. 
  // Let's initialize with the current local date formatted as YYYY-MM-DD.
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const now = new Date();
    // Adjust to KST to be consistent with default server logic if needed, 
    // but usually user's local time is what they expect.
    // Let's stick to local for the input value.
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });

  const [cryptoData, setCryptoData] = useState<ChartData[]>(initialCrypto);
  const [indicesData, setIndicesData] = useState<StockData[]>(initialIndices);
  const [majorsData, setMajorsData] = useState<StockData[]>(initialMajors);
  
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [isUpdating, setIsUpdating] = useState(false);

  // Fetch Data Function
  const fetchData = async (dateStr: string) => {
    setIsUpdating(true);
    const { data, error } = await fetchDashboardData(dateStr);
    
    if (!error && data) {
      if (data.crypto) setCryptoData(data.crypto);
      if (data.indices) setIndicesData(data.indices);
      if (data.majors) setMajorsData(data.majors);
      setLastUpdated(new Date());
    }
    setIsUpdating(false);
  };

  // Effect: Fetch when Date Changes
  // Also we might want initial mount to respect the initial props, so skip first run?
  // Actually, initial props are loaded based on "default" server logic (Today).
  // If client default date matches server default, we don't need to fetch immediately.
  // But to be safe and ensure sync, let's just use initial data and only fetch on change?
  // Or fetch immediately if date is set.
  // Let's relying on user interaction or polling.

  // Polling Effect
  useEffect(() => {
    // Determine if selected date is "Today".
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    
    const isToday = selectedDate === todayStr;

    // Initial fetch if date changed from default? 
    // Note: The parent passed initialData which is "Today". 
    // If selectedDate is strictly "Today", we start with that.
    
    // Watch for date changes to trigger fetch
    if (selectedDate !== todayStr) {
        fetchData(selectedDate);
    } 
    // If it IS today, we want to poll. 
    // And if we just switched back to Today, we should probably fetch once to be sure, then poll.
    else {
        // We might already have initial data if it's the very first render.
        // But if user switched dates back and forth, we need to re-fetch today's data.
        // Let's just fetch once when "selectedDate" changes to Today (handled by dep array),
        // PLUS setup interval.
        // For simplicity: Always fetch when date changes.
        fetchData(selectedDate);
    }
    
    let interval: NodeJS.Timeout | null = null;

    if (isToday) {
        interval = setInterval(() => {
            fetchData(selectedDate);
        }, 60000);
    }

    return () => {
        if (interval) clearInterval(interval);
    };
  }, [selectedDate]);

  const latest = cryptoData.length > 0 ? cryptoData[cryptoData.length - 1] : null;

  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <h1 className="text-3xl font-bold text-gray-900">통합 금융 대시보드</h1>
          
          <div className="flex items-center gap-4">
            {/* Date Picker */}
            <input 
                type="date" 
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-white border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5"
            />

            <div className="flex items-center gap-3">
                {isUpdating && (
                    <span className="flex items-center text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-full animate-pulse">
                        업데이트 중...
                    </span>
                )}
                <div className="text-sm text-gray-500 flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${selectedDate === new Date().toISOString().split('T')[0] ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></span>
                {lastUpdated.toLocaleTimeString()}
                </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex space-x-1 rounded-xl bg-gray-200/50 p-1 mb-6 w-fit">
            <button
                onClick={() => setActiveTab('crypto')}
                className={`w-32 rounded-lg py-2.5 text-sm font-medium leading-5 transition-all
                    ${activeTab === 'crypto'
                    ? 'bg-white text-blue-700 shadow'
                    : 'text-gray-600 hover:bg-white/[0.12] hover:text-blue-600'
                    }`}
            >
                가상자산
            </button>
            <button
                onClick={() => setActiveTab('stock')}
                className={`w-32 rounded-lg py-2.5 text-sm font-medium leading-5 transition-all
                    ${activeTab === 'stock'
                    ? 'bg-white text-indigo-700 shadow'
                    : 'text-gray-600 hover:bg-white/[0.12] hover:text-indigo-600'
                    }`}
            >
                국내 증시
            </button>
        </div>
        
        <div className="flex flex-col gap-8">
          
          {/* Section 1: Crypto */}
          {activeTab === 'crypto' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <h2 className="text-lg font-bold text-gray-800 mb-4 px-1 border-l-4 border-blue-600 pl-2">
                가상자산 (Crypto)
                </h2>
                <div className="grid gap-6">
                <PremiumChart data={cryptoData} />
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                    <div className="text-sm text-gray-500 mb-1">현재 프리미엄 (김프)</div>
                    <div className={`text-2xl font-bold ${
                        (latest?.premium || 0) > 0 ? 'text-red-500' : 'text-blue-500'
                    }`}>
                        {latest ? latest.premium.toFixed(2) : "-"}%
                    </div>
                    </div>
                    <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                    <div className="text-sm text-gray-500 mb-1">업비트 BTC</div>
                    <div className="text-2xl font-bold text-gray-900">
                        ${latest ? latest.upbitPrice.toLocaleString(undefined, { maximumFractionDigits: 0 }) : "-"}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">KRW 환산</div>
                    </div>
                    <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                    <div className="text-sm text-gray-500 mb-1">바이낸스 BTC</div>
                    <div className="text-2xl font-bold text-gray-900">
                        ${latest ? latest.binancePrice.toLocaleString(undefined, { maximumFractionDigits: 0 }) : "-"}
                    </div>
                    </div>
                </div>
                </div>
            </div>
          )}

          {/* Section 2: Stock Market */}
          {activeTab === 'stock' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <h2 className="text-lg font-bold text-gray-800 mb-4 px-1 border-l-4 border-indigo-600 pl-2">
                국내 증시 (Korean Stock Market)
                    <span className="ml-2 text-xs text-gray-400 font-normal">09:00 ~ 15:30</span>
                </h2>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Indices */}
                <StockIndexChart data={indicesData} />
                
                {/* Major Stocks */}
                <StockMajorChart data={majorsData} />
                </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

