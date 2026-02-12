"use client";

import { useState } from "react";
import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { MediaDivergencePoint } from "../actions";
import { fetchMediaDivergence } from "../actions";

const KEYWORD_OPTIONS = [
  { label: "비트코인", value: "비트코인" },
  { label: "이더리움", value: "이더리움" },
  { label: "리플", value: "리플" },
  { label: "솔라나", value: "솔라나" },
];

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-4 text-sm">
      <p className="font-bold text-gray-900 mb-2">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="text-gray-600">{p.name}:</span>
          <span className="font-semibold">{p.value.toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}

export default function MediaSocialDivergence({
  initialData,
}: {
  initialData: MediaDivergencePoint[];
}) {
  const [data, setData] = useState(initialData);
  const [selectedKeyword, setSelectedKeyword] = useState("비트코인");
  const [loading, setLoading] = useState(false);

  const handleKeywordChange = async (keyword: string) => {
    setSelectedKeyword(keyword);
    setLoading(true);
    const result = await fetchMediaDivergence(keyword);
    if (result.data) setData(result.data);
    setLoading(false);
  };

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold text-gray-900">미디어 vs 소셜</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            구글 뉴스 기사 수 vs 텔레그램 멘션 (30일)
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

      <div className={`h-[350px] ${loading ? "opacity-50" : ""}`}>
        {data.length === 0 ? (
          <div className="h-full flex items-center justify-center text-gray-400 text-sm">
            데이터가 없습니다
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 10, right: 10, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: "#94a3b8" }}
                interval="preserveStartEnd"
              />
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 10, fill: "#94a3b8" }}
                label={{
                  value: "뉴스 기사",
                  angle: -90,
                  position: "insideLeft",
                  offset: 10,
                  fontSize: 10,
                  fill: "#94a3b8",
                }}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 10, fill: "#94a3b8" }}
                label={{
                  value: "텔레그램 멘션",
                  angle: 90,
                  position: "insideRight",
                  offset: 10,
                  fontSize: 10,
                  fill: "#94a3b8",
                }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: "11px" }} />
              <Bar
                yAxisId="left"
                dataKey="newsCount"
                fill="#60a5fa"
                fillOpacity={0.6}
                name="구글 뉴스"
                radius={[4, 4, 0, 0]}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="telegramMentions"
                stroke="#f97316"
                strokeWidth={2}
                dot={false}
                name="텔레그램 멘션"
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Insight Box */}
      {data.length > 5 && (
        <div className="mt-4 p-3 rounded-xl bg-gray-50 border border-gray-100">
          <p className="text-xs text-gray-600">
            <span className="font-bold text-gray-900">인사이트: </span>
            {(() => {
              const last7News = data.slice(-7).reduce((s, d) => s + d.newsCount, 0);
              const prev7News = data.slice(-14, -7).reduce((s, d) => s + d.newsCount, 0);
              const last7Tg = data.slice(-7).reduce((s, d) => s + d.telegramMentions, 0);
              const prev7Tg = data.slice(-14, -7).reduce((s, d) => s + d.telegramMentions, 0);

              const newsGrowing = last7News > prev7News * 1.2;
              const tgGrowing = last7Tg > prev7Tg * 1.2;

              if (tgGrowing && !newsGrowing)
                return "소셜이 뉴스보다 선행 중 - 가격 움직임 전조 가능성";
              if (newsGrowing && !tgGrowing)
                return "뉴스가 소셜보다 선행 중 - 규제/정책 뉴스 확인 필요";
              if (newsGrowing && tgGrowing)
                return "뉴스 + 소셜 동시 상승 - 강한 시장 모멘텀";
              return "뉴스와 소셜 모두 안정적 - 특별한 시그널 없음";
            })()}
          </p>
        </div>
      )}
    </div>
  );
}
