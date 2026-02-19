"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { ExchangeScoreData } from "../actions";

interface Props {
  data: ExchangeScoreData | null;
}

function formatUsd(n: number): string {
  if (n >= 1_000_000_000) return "$" + (n / 1_000_000_000).toFixed(2) + "B";
  if (n >= 1_000_000) return "$" + (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000) return "$" + (n / 1_000).toFixed(1) + "K";
  return "$" + n.toFixed(0);
}

export default function ExchangeDetail({ data }: Props) {
  if (!data) {
    return (
      <div className="text-center py-12 text-gray-400">
        <p className="text-sm">
          No Exchange data available. This section is only active for Post-TGE
          projects with Korean exchange listings.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex items-center gap-3">
        <div>
          <div className="text-[10px] text-gray-500 uppercase font-bold mb-0.5">
            Exchange Score
          </div>
          <div className="text-2xl font-black text-gray-900">{data.score}</div>
        </div>
        <div className="flex gap-2">
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <div className="text-sm font-black text-gray-900">
              {data.exchanges.length}
            </div>
            <div className="text-[9px] text-gray-500 font-bold">
              KR Exchanges
            </div>
          </div>
          {data.whaleProxy !== null && (
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <div
                className={`text-sm font-black ${
                  data.whaleProxy > 1 ? "text-green-600" : "text-red-500"
                }`}
              >
                {data.whaleProxy.toFixed(2)}
              </div>
              <div className="text-[9px] text-gray-500 font-bold">
                Buy/Sell Ratio
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Volume Chart */}
      {data.exchanges.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-gray-900 mb-1">
            24h Volume by Exchange (KRW pairs)
          </h3>
          <p className="text-[10px] text-gray-500 mb-2">
            Trading volume across Korean exchanges in the last 24 hours (KRW market pairs only)
          </p>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data.exchanges.map((d) => ({ ...d }))}
                layout="vertical"
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis
                  type="number"
                  tick={{ fontSize: 10, fill: "#94a3b8" }}
                  tickFormatter={(v: number) => formatUsd(v)}
                />
                <YAxis
                  type="category"
                  dataKey="exchangeName"
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                  width={90}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 8,
                    border: "1px solid #e5e7eb",
                    fontSize: 10,
                  }}
                  formatter={(value: number | undefined) => [formatUsd(value ?? 0), "Volume"]}
                />
                <Bar
                  dataKey="volume24h"
                  fill="#0037F0"
                  radius={[0, 4, 4, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Depth Table */}
      {data.exchanges.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-gray-900 mb-1">
            Order Book Depth ({"\u00B1"}2%)
          </h3>
          <p className="text-[10px] text-gray-500 mb-2">
            Buy and sell depth within 2% of mid-price by exchange (KRW pairs, summed)
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                  <th className="py-2 px-1 font-medium">Exchange</th>
                  <th className="py-2 px-1 font-medium text-right">Volume 24h</th>
                  <th className="py-2 px-1 font-medium text-right">
                    Buy Depth (+2%)
                  </th>
                  <th className="py-2 px-1 font-medium text-right">
                    Sell Depth (-2%)
                  </th>
                  <th className="py-2 px-1 font-medium text-right">Book Depth</th>
                </tr>
              </thead>
              <tbody>
                {data.exchanges.map((ex, i) => (
                  <tr
                    key={i}
                    className="border-b border-gray-50 hover:bg-gray-50"
                  >
                    <td className="py-2 font-medium text-gray-900">
                      {ex.exchangeName}
                    </td>
                    <td className="py-2 text-right text-gray-700">
                      {formatUsd(ex.volume24h)}
                    </td>
                    <td className="py-2 text-right text-green-600">
                      {formatUsd(ex.totalBuyDepth)}
                    </td>
                    <td className="py-2 text-right text-red-500">
                      {formatUsd(ex.totalSellDepth)}
                    </td>
                    <td className="py-2 text-right text-gray-700">
                      {formatUsd(ex.totalLiquidity)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Insight Box */}
          <div className="mt-4 p-3 rounded-xl bg-gray-50 border border-gray-100">
            <p className="text-xs text-gray-600">
              <span className="font-bold text-gray-900">Insight: </span>
              {(() => {
                const totalVol = data.exchanges.reduce((s, e) => s + e.volume24h, 0);
                const totalDepth = data.exchanges.reduce((s, e) => s + e.totalLiquidity, 0);
                const whaleStr = data.whaleProxy !== null
                  ? data.whaleProxy > 1.2
                    ? "Strong buy pressure detected"
                    : data.whaleProxy < 0.8
                    ? "Sell pressure dominates"
                    : "Balanced buy/sell activity"
                  : "Whale proxy data unavailable";

                return `${whaleStr} across ${data.exchanges.length} Korean exchanges. Total 24h volume: ${formatUsd(totalVol)}, combined book depth: ${formatUsd(totalDepth)}.`;
              })()}
            </p>
          </div>
        </div>
      )}

      {/* Kimchi Premium (Coming Soon) */}
      <div className="rounded-lg border border-dashed border-gray-200 p-4 text-center">
        <div className="text-lg mb-1">{"\uD83C\uDF36\uFE0F"}</div>
        <h3 className="text-xs font-bold text-gray-500 mb-1">
          Kimchi Premium
        </h3>
        <p className="text-xs text-gray-400">
          Coming Soon {"\u2014"} Exchange rate data integration required for accurate premium calculation.
        </p>
      </div>
    </div>
  );
}
