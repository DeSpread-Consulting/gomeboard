"use client";

import type { PulseData } from "../actions";

function formatNumber(num: number): string {
  if (num >= 1_000_000_000) return `$${(num / 1_000_000_000).toFixed(1)}B`;
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toLocaleString();
}

function DeltaBadge({ value }: { value: number }) {
  const isPositive = value > 0;
  return (
    <span
      className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
        isPositive
          ? "bg-green-100 text-green-700"
          : "bg-red-100 text-red-700"
      }`}
    >
      {isPositive ? "+" : ""}
      {value.toFixed(1)}%
    </span>
  );
}

export default function PulseWidgets({ data }: { data: PulseData | null }) {
  if (!data) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 animate-pulse h-24" />
        ))}
      </div>
    );
  }

  const widgets = [
    {
      label: "BTC 텔레그램 멘션",
      value: data.btcMentions.toLocaleString(),
      delta: data.btcMentionsDelta,
      sub: "일간",
      color: "bg-blue-500",
    },
    {
      label: "트렌딩 스코어",
      value: data.avgTrendingScore.toFixed(2),
      delta: null,
      sub: "최근 6시간 평균",
      color: "bg-purple-500",
    },
    {
      label: "네이버 검색량",
      value: formatNumber(data.naverSearchVolume),
      delta: data.naverSearchDelta,
      sub: "월간 (비트코인)",
      color: "bg-green-500",
    },
    {
      label: "한국 거래소 거래량",
      value: formatNumber(data.koreanExchangeVolume),
      delta: null,
      sub: "KRW 페어 24h",
      color: "bg-orange-500",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {widgets.map((w) => (
        <div
          key={w.label}
          className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
        >
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-2 h-2 rounded-full ${w.color}`} />
            <span className="text-xs text-gray-500 font-medium">{w.label}</span>
          </div>
          <div className="flex items-end gap-2">
            <span className="text-2xl font-bold text-gray-900">{w.value}</span>
            {w.delta !== null && <DeltaBadge value={w.delta} />}
          </div>
          <p className="text-[10px] text-gray-400 mt-1">{w.sub}</p>
        </div>
      ))}
    </div>
  );
}
