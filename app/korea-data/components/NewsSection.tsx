"use client";

import { useState, useEffect, useRef } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { NewsData } from "../actions";
import { fetchNewsData } from "../actions";

const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes

interface Props {
  initialData: NewsData | null;
}

// English keys for filtering — avoids Unicode comparison issues
const CATEGORIES = [
  { key: "all", label: "\uC804\uCCB4", color: "bg-gray-700" },
  { key: "coin", label: "\uCF54\uC778", color: "bg-blue-500" },
  { key: "industry", label: "\uC0B0\uC5C5/\uAE30\uC220", color: "bg-green-500" },
  { key: "market", label: "\uC2DC\uC7A5/\uADDC\uC81C", color: "bg-amber-500" },
] as const;

const CATEGORY_BADGE_COLORS: Record<string, string> = {
  coin: "bg-blue-100 text-blue-700",
  industry: "bg-green-100 text-green-700",
  market: "bg-amber-100 text-amber-700",
};

const CATEGORY_LABELS: Record<string, string> = {
  coin: "\uCF54\uC778",
  industry: "\uC0B0\uC5C5/\uAE30\uC220",
  market: "\uC2DC\uC7A5/\uADDC\uC81C",
};

function timeAgo(d: string): string {
  const now = new Date();
  const date = new Date(d);
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (diffHours < 1) return "\uBC29\uAE08";
  if (diffHours < 24) return `${diffHours}\uC2DC\uAC04 \uC804`;
  if (diffDays < 7) return `${diffDays}\uC77C \uC804`;
  const dt = new Date(d);
  return `${dt.getMonth() + 1}/${dt.getDate()}`;
}

export default function NewsSection({ initialData }: Props) {
  const [data, setData] = useState<NewsData | null>(initialData);
  const [activeCategory, setActiveCategory] = useState("all");
  const [newArticleUrls, setNewArticleUrls] = useState<Set<string>>(new Set());
  const knownUrlsRef = useRef<Set<string>>(
    new Set(initialData?.recentArticles.map((a) => a.url) || [])
  );

  // Auto-refresh
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const result = await fetchNewsData();
        if (!result.data) return;

        const prevKnown = knownUrlsRef.current;
        const freshUrls = new Set<string>();

        for (const a of result.data.recentArticles) {
          if (!prevKnown.has(a.url)) {
            freshUrls.add(a.url);
          }
        }

        setData(result.data);

        if (freshUrls.size > 0) {
          setNewArticleUrls(freshUrls);
          knownUrlsRef.current = new Set(
            result.data.recentArticles.map((a) => a.url)
          );
          setTimeout(() => setNewArticleUrls(new Set()), 800);
        }
      } catch {
        // Silently ignore refresh errors
      }
    }, REFRESH_INTERVAL);

    return () => clearInterval(interval);
  }, []);

  // Direct filtering — no useMemo to avoid stale cache issues
  const articles = data?.recentArticles ?? [];
  const filteredArticles =
    activeCategory === "all"
      ? articles
      : articles.filter((a) => a.category === activeCategory);

  // Count per category from actual article list
  const categoryCounts: Record<string, number> = {};
  for (const a of articles) {
    categoryCounts[a.category] = (categoryCounts[a.category] || 0) + 1;
  }

  // Aggregate daily trend by selected category
  const chartData: { date: string; count: number }[] = [];
  if (data) {
    const trendRows =
      activeCategory === "all"
        ? data.dailyTrend
        : data.dailyTrend.filter((r) => r.category === activeCategory);
    const dateMap = new Map<string, number>();
    for (const r of trendRows) {
      dateMap.set(r.date, (dateMap.get(r.date) || 0) + r.count);
    }
    for (const [date, count] of dateMap) {
      chartData.push({ date, count });
    }
    chartData.sort((a, b) => a.date.localeCompare(b.date));
  }

  if (!data) {
    return (
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 text-center">
        <p className="text-xs text-gray-400">
          {"\uB274\uC2A4 \uB370\uC774\uD130\uB97C \uBD88\uB7EC\uC624\uB294 \uC911..."}
        </p>
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-hidden">
      {/* Section Header */}
      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-base font-bold text-gray-900">Market News</h2>
        <span className="text-[10px] text-gray-400">
          {articles.length} articles
        </span>
        <span className="ml-auto text-[9px] text-gray-300">
          {"\u26A1"} 5min
        </span>
      </div>

      {/* Category Filter Pills */}
      <div className="flex gap-1.5 mb-3">
        {CATEGORIES.map((cat) => {
          const isActive = activeCategory === cat.key;
          const count =
            cat.key === "all" ? articles.length : categoryCounts[cat.key] || 0;
          return (
            <button
              key={cat.key}
              onClick={() => setActiveCategory(cat.key)}
              className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition-colors ${
                isActive
                  ? `${cat.color} text-white`
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {cat.label}
              <span
                className={`ml-1 ${isActive ? "opacity-80" : "text-gray-400"}`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="w-full bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-0">
          {/* Article List (left 3 cols) */}
          <div className="lg:col-span-3 p-4 lg:border-r border-gray-100 overflow-hidden">
            <div className="h-[280px] overflow-y-auto pr-1 space-y-1">
              {filteredArticles.length === 0 ? (
                <div className="h-full flex items-center justify-center">
                  <p className="text-xs text-gray-400">
                    {"\uD574\uB2F9 \uCE74\uD14C\uACE0\uB9AC\uC758 \uAE30\uC0AC\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4."}
                  </p>
                </div>
              ) : (
                filteredArticles.map((a, idx) => {
                  const isNew = newArticleUrls.has(a.url);
                  return (
                    <a
                      key={`${idx}-${a.url}`}
                      href={a.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block bg-gray-50 rounded-lg px-3 py-2 hover:bg-gray-100 transition-colors group"
                      style={
                        isNew
                          ? { animation: "news-slide-in 0.5s ease-out" }
                          : undefined
                      }
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex-1 min-w-0 flex items-center gap-2">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[8px] font-bold shrink-0 ${
                              CATEGORY_BADGE_COLORS[a.category] ||
                              "bg-gray-100 text-gray-600"
                            }`}
                          >
                            {a.searchKeyword}
                          </span>
                          <p className="text-xs text-gray-900 group-hover:text-[#0037F0] truncate">
                            {a.title}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-[10px] text-gray-400">
                            {a.provider}
                          </span>
                          <span className="text-[10px] text-gray-300">
                            {timeAgo(a.publishedAt)}
                          </span>
                        </div>
                      </div>
                    </a>
                  );
                })
              )}
            </div>
          </div>

          {/* Daily Trend Chart (right 2 cols) — filtered by active category */}
          <div className="lg:col-span-2 p-4 overflow-hidden">
            <h3 className="text-xs font-bold text-gray-700 mb-2">
              Daily Article Count
              {activeCategory !== "all" && (
                <span className="ml-1.5 font-normal text-gray-400">
                  ({CATEGORIES.find((c) => c.key === activeCategory)?.label})
                </span>
              )}
            </h3>
            {chartData.length > 0 ? (
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 8, fill: "#94a3b8" }}
                      tickFormatter={(v: string) => v.slice(5)}
                    />
                    <YAxis
                      tick={{ fontSize: 8, fill: "#94a3b8" }}
                      width={25}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: 8,
                        border: "1px solid #e5e7eb",
                        fontSize: 10,
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="count"
                      stroke={
                        activeCategory === "coin"
                          ? "#3b82f6"
                          : activeCategory === "industry"
                          ? "#22c55e"
                          : activeCategory === "market"
                          ? "#f59e0b"
                          : "#0037F0"
                      }
                      strokeWidth={1.5}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-xs text-gray-400">
                No trend data
              </div>
            )}
          </div>
        </div>

        {/* Insight Box */}
        <div className="border-t border-gray-100 px-4 py-2">
          <p className="text-[10px] text-gray-500">
            <span className="font-bold text-gray-700">Insight: </span>
            {(() => {
              const last7 = data.dailyTrend.slice(-7);
              const prev7 = data.dailyTrend.slice(-14, -7);
              const last7Sum = last7.reduce((s, d) => s + d.count, 0);
              const prev7Sum = prev7.reduce((s, d) => s + d.count, 0);
              const topKeyword =
                data.keywordBreakdown[0]?.keyword || "N/A";

              if (prev7Sum > 0 && last7Sum > prev7Sum * 1.3)
                return `\uC774\uBC88 \uC8FC \uAE30\uC0AC\uAC00 ${Math.round(((last7Sum - prev7Sum) / prev7Sum) * 100)}% \uC99D\uAC00. \uC8FC\uC694 \uD0A4\uC6CC\uB4DC: ${topKeyword}.`;
              if (prev7Sum > 0 && last7Sum < prev7Sum * 0.7)
                return `\uC774\uBC88 \uC8FC \uAE30\uC0AC\uAC00 ${Math.round(((prev7Sum - last7Sum) / prev7Sum) * 100)}% \uAC10\uC18C. \uC8FC\uC694 \uD0A4\uC6CC\uB4DC: ${topKeyword}.`;
              return `${data.totalArticles}\uAC1C \uAE30\uC0AC, ${data.uniqueProviders}\uAC1C \uC5B8\uB860\uC0AC. \uC8FC\uC694 \uD0A4\uC6CC\uB4DC: ${topKeyword}.`;
            })()}
          </p>
        </div>
      </div>
    </div>
  );
}
