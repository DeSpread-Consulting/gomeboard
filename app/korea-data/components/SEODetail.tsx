"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { SEOScoreData } from "../actions";

interface Props {
  data: SEOScoreData | null;
  ticker?: string;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toString();
}

export default function SEODetail({ data, ticker }: Props) {
  if (!data) {
    return (
      <div className="text-center py-12 text-gray-400">
        <p className="text-sm">No SEO data available for this project.</p>
      </div>
    );
  }

  const latest = data.monthlyTrend[data.monthlyTrend.length - 1];

  return (
    <div className="space-y-4">
      {/* Score + Latest */}
      <div className="flex items-center gap-3">
        <div>
          <div className="text-[10px] text-gray-500 uppercase font-bold mb-0.5">
            SEO Score
          </div>
          <div className="text-2xl font-black text-gray-900">{data.score}</div>
        </div>
        {latest && (
          <div className="flex gap-2">
            {[
              { label: "Total Volume", value: latest.totalVolume },
              { label: "Blog", value: latest.blogCount },
              { label: "Cafe", value: latest.cafeCount },
              { label: "News", value: latest.newsCount },
            ].map((m) => (
              <div
                key={m.label}
                className="bg-gray-50 rounded-lg p-3 text-center"
              >
                <div className="text-sm font-black text-gray-900">
                  {formatNumber(m.value)}
                </div>
                <div className="text-[9px] text-gray-500 font-bold">
                  {m.label}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Naver Search Link */}
      {ticker && (
        <div className="flex items-center gap-2">
          <a
            href={`https://search.naver.com/search.naver?query=${encodeURIComponent(ticker)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 rounded-lg text-xs font-bold hover:bg-green-100 transition-colors"
          >
            <span>{"\uD83D\uDD0D"}</span>
            Search on Naver
          </a>
          <span className="text-[10px] text-gray-400">
            See live Naver search results for this project
          </span>
        </div>
      )}

      {/* Monthly Naver Search Volume Trend */}
      <div>
        <h3 className="text-sm font-bold text-gray-900 mb-1">
          Monthly Naver Search Volume
        </h3>
        <p className="text-[10px] text-gray-500 mb-2">
          Total search volume trend on Naver by month
        </p>
        <div className="h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.monthlyTrend.map((d) => ({ ...d }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey="yearMonth"
                tick={{ fontSize: 10, fill: "#94a3b8" }}
                tickFormatter={(v) => String(v).slice(2)}
              />
              <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} tickFormatter={formatNumber} />
              <Tooltip
                contentStyle={{
                  borderRadius: 8,
                  border: "1px solid #e5e7eb",
                  fontSize: 10,
                }}
                formatter={(value: number | undefined) => [formatNumber(value ?? 0), ""]}
              />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Bar
                dataKey="totalVolume"
                name="Total Volume"
                fill="#0037F0"
                radius={[3, 3, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Content Type Breakdown */}
      <div>
        <h3 className="text-sm font-bold text-gray-900 mb-1">
          Content Type Breakdown
        </h3>
        <p className="text-[10px] text-gray-500 mb-2">
          Blog, Cafe, News, and Web content distribution over time
        </p>
        <div className="h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.monthlyTrend.map((d) => ({ ...d }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey="yearMonth"
                tick={{ fontSize: 10, fill: "#94a3b8" }}
                tickFormatter={(v) => String(v).slice(2)}
              />
              <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} />
              <Tooltip
                contentStyle={{
                  borderRadius: 8,
                  border: "1px solid #e5e7eb",
                  fontSize: 10,
                }}
              />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Bar dataKey="blogCount" name="Blog" fill="#3b82f6" stackId="a" />
              <Bar dataKey="cafeCount" name="Cafe" fill="#8b5cf6" stackId="a" />
              <Bar dataKey="newsCount" name="News" fill="#f59e0b" stackId="a" />
              <Bar dataKey="webCount" name="Web" fill="#6b7280" stackId="a" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Insight Box */}
        {data.monthlyTrend.length >= 2 && (
          <div className="mt-4 p-3 rounded-xl bg-gray-50 border border-gray-100">
            <p className="text-xs text-gray-600">
              <span className="font-bold text-gray-900">Insight: </span>
              {(() => {
                const curr = data.monthlyTrend[data.monthlyTrend.length - 1];
                const prev = data.monthlyTrend[data.monthlyTrend.length - 2];
                const change = prev.totalVolume > 0
                  ? ((curr.totalVolume - prev.totalVolume) / prev.totalVolume) * 100
                  : 0;
                const blogShare = curr.totalVolume > 0
                  ? Math.round((curr.blogCount / curr.totalVolume) * 100)
                  : 0;

                if (change > 20)
                  return `Search volume surged ${change.toFixed(0)}% MoM \u2014 growing interest. Blog content accounts for ${blogShare}% of total.`;
                if (change > 0)
                  return `Search volume up ${change.toFixed(0)}% MoM. Blog content leads at ${blogShare}% share.`;
                if (change < -20)
                  return `Search volume dropped ${change.toFixed(0)}% MoM \u2014 declining interest trend.`;
                return `Search volume stable MoM. Blog content represents ${blogShare}% of total Naver mentions.`;
              })()}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
