"use client";

import { useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import type { RetailIntentItem } from "../actions";
import { fetchRetailIntent } from "../actions";

const KEYWORD_OPTIONS = [
  { label: "비트코인", value: "비트코인" },
  { label: "이더리움", value: "이더리움" },
  { label: "솔라나", value: "솔라나" },
  { label: "리플", value: "리플" },
];

const INTENT_COLORS: Record<string, string> = {
  Investment: "#3b82f6",
  Onboarding: "#22c55e",
  Technology: "#a855f7",
  General: "#94a3b8",
};

const INTENT_LABELS: Record<string, string> = {
  Investment: "투자/시세",
  Onboarding: "온보딩",
  Technology: "기술/심화",
  General: "일반",
};

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    payload: RetailIntentItem & { label: string };
    value: number;
  }>;
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-4 text-sm">
      <p className="font-bold text-gray-900 mb-1">{d.relatedKeyword}</p>
      <div className="space-y-1">
        <div className="flex justify-between gap-4">
          <span className="text-gray-500">검색량</span>
          <span className="font-semibold">
            {d.searchVolume.toLocaleString()}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-gray-500">의도</span>
          <span
            className="font-bold"
            style={{ color: INTENT_COLORS[d.intentCategory] }}
          >
            {INTENT_LABELS[d.intentCategory]}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function RetailIntentSpectrum({
  initialData,
}: {
  initialData: RetailIntentItem[];
}) {
  const [data, setData] = useState(initialData);
  const [selectedKeyword, setSelectedKeyword] = useState("비트코인");
  const [loading, setLoading] = useState(false);

  const handleKeywordChange = async (keyword: string) => {
    setSelectedKeyword(keyword);
    setLoading(true);
    const result = await fetchRetailIntent(keyword);
    if (result.data) setData(result.data);
    setLoading(false);
  };

  const chartData = data.map((d) => ({
    ...d,
    label:
      d.relatedKeyword.length > 14
        ? d.relatedKeyword.slice(0, 12) + "…"
        : d.relatedKeyword,
  }));

  // Summary by intent category
  const intentSummary = data.reduce(
    (acc, d) => {
      acc[d.intentCategory] = (acc[d.intentCategory] || 0) + d.searchVolume;
      return acc;
    },
    {} as Record<string, number>
  );
  const topIntent = Object.entries(intentSummary).sort(
    (a, b) => b[1] - a[1]
  )[0];

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 h-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold text-gray-900">
            Retail Intent Spectrum
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            네이버 검색 의도 분석 · 최신 월간 데이터 · {new Date().toLocaleDateString("ko-KR")} 기준
          </p>
        </div>
        <div className="flex items-center gap-1">
          {KEYWORD_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => handleKeywordChange(opt.value)}
              disabled={loading}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                selectedKeyword === opt.value
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className={`h-[400px] ${loading ? "opacity-50" : ""}`}>
        {chartData.length === 0 ? (
          <div className="h-full flex items-center justify-center text-gray-400 text-sm">
            데이터가 없습니다
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 5, right: 30, bottom: 5, left: 10 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#f1f5f9"
                horizontal={false}
              />
              <XAxis
                type="number"
                tick={{ fontSize: 10, fill: "#94a3b8" }}
                tickFormatter={(v: number) =>
                  v >= 10000
                    ? `${(v / 10000).toFixed(0)}만`
                    : v >= 1000
                      ? `${(v / 1000).toFixed(0)}K`
                      : String(v)
                }
              />
              <YAxis
                type="category"
                dataKey="label"
                width={110}
                tick={{ fontSize: 11, fill: "#374151" }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="searchVolume" radius={[0, 6, 6, 0]} barSize={18}>
                {chartData.map((d, i) => (
                  <Cell key={i} fill={INTENT_COLORS[d.intentCategory]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-gray-500">
        {Object.entries(INTENT_COLORS).map(([intent, color]) => (
          <div key={intent} className="flex items-center gap-1">
            <span
              className="w-2.5 h-2.5 rounded-sm"
              style={{ backgroundColor: color }}
            />
            <span>{INTENT_LABELS[intent]}</span>
          </div>
        ))}
      </div>

      {/* Insight */}
      {topIntent && (
        <div className="mt-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
          <p className="text-xs text-gray-600">
            <span className="font-bold text-gray-900">액션: </span>
            {topIntent[0] === "Investment" &&
              "키워드 유입이 '시세/가격' 위주 → 대중 타겟 마케팅이 효과적"}
            {topIntent[0] === "Onboarding" &&
              "키워드 유입이 '가입/지갑' 위주 → 온보딩 가이드 콘텐츠 집중"}
            {topIntent[0] === "Technology" &&
              "키워드 유입이 'ETF/스테이킹' 위주 → 전문가 타겟 전략으로 전환"}
            {topIntent[0] === "General" &&
              "키워드 유입이 일반 검색 위주 → 브랜드 인지도 구축 우선"}
          </p>
        </div>
      )}
    </div>
  );
}
