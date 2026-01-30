"use client";

import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface ChartData {
  time: string;
  upbitPrice: number;
  binancePrice: number;
  premium: number;
}

interface Props {
  data: ChartData[];
}

export default function PremiumChart({ data }: Props) {
  // Format numbers to USD currency string
  const formatUSD = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${value.toFixed(2)}%`;
  };

  return (
    <div className="w-full h-[500px] bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-xl font-bold text-gray-900">
            시장 프리미엄 분석
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            업비트 vs 바이낸스 BTC 가격 괴리율 (USDT)
          </p>
        </div>
        <div className="flex items-center gap-2">
            <span className="flex items-center text-xs text-gray-500 font-medium">
                <span className="w-2 h-2 rounded-full bg-red-500 mr-1"></span>프리미엄
            </span>
            <span className="flex items-center text-xs text-gray-500 font-medium ml-2">
                <span className="w-2 h-2 rounded-full bg-blue-600 mr-1"></span>업비트
            </span>
            <span className="flex items-center text-xs text-gray-500 font-medium ml-2">
                <span className="w-2 h-2 rounded-full bg-orange-400 mr-1"></span>바이낸스
            </span>
        </div>
      </div>
      
      <ResponsiveContainer width="100%" height="85%">
        <ComposedChart
          data={data}
          margin={{
            top: 20,
            right: 0,
            left: 0,
            bottom: 0,
          }}
        >
          <defs>
            <linearGradient id="colorPremium" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#ef4444" stopOpacity={0.05}/>
            </linearGradient>
          </defs>
          
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
          
          <XAxis 
            dataKey="time" 
            tick={{ fontSize: 11, fill: "#6b7280" }} 
            tickMargin={10}
            minTickGap={60}
            axisLine={false}
            tickLine={false}
          />
          
          <YAxis
            yAxisId="left"
            tickFormatter={(value) => 
              new Intl.NumberFormat("en-US", { notation: "compact", currency: "USD", style: "currency", maximumFractionDigits: 1 }).format(value)
            }
            domain={['auto', 'auto']}
            orientation="left"
            tick={{ fontSize: 11, fill: "#6b7280" }}
            axisLine={false}
            tickLine={false}
            width={60}
          />
          
          <YAxis
            yAxisId="right"
            orientation="right"
            tickFormatter={(value) => `${value}%`}
            domain={['auto', 'auto']} // Give some headroom for the area chart
            tick={{ fontSize: 11, fill: "#ef4444", fontWeight: 600 }}
            axisLine={false}
            tickLine={false}
            width={50}
          />
          
          <Tooltip
            cursor={{ stroke: '#9ca3af', strokeWidth: 1, strokeDasharray: '4 4' }}
            wrapperStyle={{ outline: 'none' }}
            content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                return (
                    <div className="bg-white/95 backdrop-blur-sm p-4 rounded-xl shadow-lg border border-gray-100 text-sm">
                    <p className="font-bold text-gray-900 mb-2">{label}</p>
                    {payload.map((entry: any) => (
                        <div key={entry.name} className="flex items-center justify-between gap-4 mb-1 last:mb-0">
                        <span className="text-gray-500 font-medium flex items-center">
                            <span 
                                className="w-2 h-2 rounded-full mr-2" 
                                style={{ backgroundColor: entry.color }}
                            />
                            {entry.name === "Premium" ? "프리미엄" : entry.name === "Upbit BTC" ? "업비트" : "바이낸스"}
                        </span>
                        <span className="font-bold tabular-nums text-gray-900">
                            {entry.name === "Premium" 
                            ? formatPercent(entry.value) 
                            : formatUSD(entry.value)}
                        </span>
                        </div>
                    ))}
                    </div>
                );
                }
                return null;
            }}
          />
          
          {/* Main Focus: Premium Area */}
          <Area
            yAxisId="right"
            type="monotone"
            dataKey="premium"
            name="Premium"
            stroke="#ef4444"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#colorPremium)"
          />

          {/* Context: Prices */}
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="upbitPrice"
            name="Upbit BTC"
            stroke="#2563eb"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
          />
          
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="binancePrice"
            name="Binance"
            stroke="#fb923c"
            strokeWidth={2}
            strokeDasharray="4 4" // Dashed line for reference price
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
          />

        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
