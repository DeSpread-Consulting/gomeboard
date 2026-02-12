"use client";

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
import type { HiddenOriginItem } from "../actions";

const TIER_COLORS: Record<string, string> = {
  "A+": "#dc2626",
  A: "#f97316",
  "B+": "#84cc16",
  B: "#eab308",
  C: "#3b82f6",
  D: "#94a3b8",
};

function getTierColor(tier: string | null): string {
  return TIER_COLORS[tier || ""] || "#6b7280";
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    payload: HiddenOriginItem & { label: string };
    value: number;
  }>;
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-4 text-sm">
      <p className="font-bold text-gray-900 mb-1">{d.channelTitle}</p>
      {d.username && (
        <p className="text-gray-500 text-xs mb-2">@{d.username}</p>
      )}
      <div className="space-y-1">
        <div className="flex justify-between gap-4">
          <span className="text-gray-500">티어</span>
          <span
            className="font-bold"
            style={{ color: getTierColor(d.tier) }}
          >
            {d.tier || "N/A"}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-gray-500">포워딩 횟수</span>
          <span className="font-semibold">
            {d.forwardCount.toLocaleString()}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-gray-500">생성 조회수</span>
          <span className="font-semibold">
            {d.totalViewsGenerated.toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function HiddenOriginChart({
  data,
}: {
  data: HiddenOriginItem[];
}) {
  const chartData = data.map((d) => ({
    ...d,
    label:
      d.channelTitle.length > 16
        ? d.channelTitle.slice(0, 14) + "…"
        : d.channelTitle,
  }));

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 h-full">
      <div className="mb-4">
        <h3 className="text-lg font-bold text-gray-900">Hidden Origin</h3>
        <p className="text-xs text-gray-500 mt-0.5">
          포워딩 발원지 — 누구의 글이 가장 많이 퍼지는가? · 최근 30일 · {new Date().toLocaleDateString("ko-KR")} 기준
        </p>
      </div>

      <div className="h-[400px]">
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
                  v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v)
                }
              />
              <YAxis
                type="category"
                dataKey="label"
                width={120}
                tick={{ fontSize: 11, fill: "#374151" }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="forwardCount" radius={[0, 6, 6, 0]} barSize={18}>
                {chartData.map((d, i) => (
                  <Cell key={i} fill={getTierColor(d.tier)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-gray-500">
        {Object.entries(TIER_COLORS).map(([tier, color]) => (
          <div key={tier} className="flex items-center gap-1">
            <span
              className="w-2.5 h-2.5 rounded-sm"
              style={{ backgroundColor: color }}
            />
            <span>{tier}</span>
          </div>
        ))}
      </div>

      {/* Insight */}
      {chartData.length > 0 && (
        <div className="mt-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
          <p className="text-xs text-gray-600">
            <span className="font-bold text-gray-900">액션: </span>
            구독자 수 많은 B급 채널보다,{" "}
            <span className="font-semibold text-red-600">
              {chartData[0].forwardCount.toLocaleString()}회 인용된{" "}
              {chartData[0].tier || "?"} 채널 &quot;{chartData[0].channelTitle}&quot;
            </span>
            과 AMA를 잡는 게 비용 효율적입니다.
          </p>
        </div>
      )}
    </div>
  );
}
