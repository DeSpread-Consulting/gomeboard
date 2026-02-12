"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { StockData } from "../actions";

interface Props {
  data: StockData[];
}

export default function StockIndexChart({ data }: Props) {
  return (
    <div className="w-full h-[400px] bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
      <div className="mb-4">
        <h3 className="text-xl font-bold text-gray-900">국내 증시 지수</h3>
        <p className="text-sm text-gray-500 mt-1">
          KOSPI (좌) vs KOSDAQ (우)
        </p>
      </div>

      <ResponsiveContainer width="100%" height="85%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
          <XAxis 
            dataKey="time" 
            tick={{ fontSize: 11, fill: "#6b7280" }} 
            tickMargin={10}
            minTickGap={60}
            axisLine={false}
            tickLine={false}
          />
          {/* KOSPI Axis */}
          <YAxis
            yAxisId="left"
            tickFormatter={(value) => value.toLocaleString()}
            domain={['auto', 'auto']}
            orientation="left"
            tick={{ fontSize: 11, fill: "#6b7280" }}
            axisLine={false}
            tickLine={false}
            width={50}
          />
          {/* KOSDAQ Axis */}
          <YAxis
            yAxisId="right"
            tickFormatter={(value) => value.toLocaleString()}
            domain={['auto', 'auto']}
            orientation="right"
            tick={{ fontSize: 11, fill: "#6b7280" }}
            axisLine={false}
            tickLine={false}
            width={50}
          />
          <Tooltip
            contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
            formatter={(value: number | undefined, name: string | undefined) => [
                value?.toLocaleString() || "-", 
                name === "value1" ? "KOSPI" : "KOSDAQ"
            ]}
            labelStyle={{ color: "#111827", fontWeight: "bold", marginBottom: "4px" }}
          />
          <Legend formatter={(value) => value === "value1" ? "KOSPI" : "KOSDAQ"} />
          
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="value1"
            name="value1"
            stroke="#1d4ed8" // Blue for KOSPI
            strokeWidth={2}
            dot={false}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="value2"
            name="value2"
            stroke="#16a34a" // Green for KOSDAQ
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
