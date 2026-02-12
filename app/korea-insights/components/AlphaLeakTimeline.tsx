"use client";

import type { AlphaLeakItem } from "../actions";

function getLagColor(hours: number): string {
  if (hours < 3) return "bg-red-500";
  if (hours < 6) return "bg-orange-500";
  if (hours < 12) return "bg-amber-500";
  if (hours < 24) return "bg-blue-500";
  return "bg-gray-400";
}

function getLagLabel(hours: number): string {
  if (hours < 3) return "초고속 전파";
  if (hours < 6) return "빠른 전파";
  if (hours < 12) return "보통";
  if (hours < 24) return "느린 전파";
  return "매우 느림";
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Seoul",
  });
}

export default function AlphaLeakTimeline({
  data,
}: {
  data: AlphaLeakItem[];
}) {
  if (!data.length) {
    return (
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Alpha Leak 타임라인</h3>
        <div className="h-60 flex items-center justify-center text-gray-400 text-sm">
          48시간 내 A/A+ → C/D 채널 전파가 감지되지 않았습니다
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
      <div className="mb-4">
        <h3 className="text-lg font-bold text-gray-900">Alpha Leak 타임라인</h3>
        <p className="text-xs text-gray-500 mt-0.5">
          A/A+ → C/D 채널 정보 전파 시간 · 최근 48시간 · {new Date().toLocaleDateString("ko-KR")} 기준
        </p>
      </div>

      {/* Visual Timeline */}
      <div className="space-y-3">
        {data.map((item) => {
          const maxLag = Math.max(...data.map((d) => d.lagHours), 1);
          const widthPct = Math.min((item.lagHours / maxLag) * 100, 100);

          return (
            <div key={item.keyword} className="group relative flex items-center gap-3">
              <span className="text-sm font-bold text-gray-900 w-20 truncate shrink-0" title={item.keyword}>
                {item.ticker || item.keyword}
              </span>
              <div className="relative flex-1">
                <div className="h-7 bg-gray-50 rounded-lg relative overflow-hidden cursor-default">
                  {/* Alpha bar */}
                  <div
                    className="absolute left-0 top-0 h-full bg-blue-100 rounded-lg"
                    style={{ width: "100%" }}
                  >
                    <div
                      className={`h-full ${getLagColor(item.lagHours)} rounded-lg opacity-80`}
                      style={{ width: `${widthPct}%`, minWidth: "8px" }}
                    />
                  </div>
                  {/* Labels inside */}
                  <div className="absolute inset-0 flex items-center justify-between px-2 text-[10px]">
                    <span className="text-blue-800 font-semibold z-10">
                      A+ ({item.alphaMentions})
                    </span>
                    <span className="text-gray-600 font-medium z-10">
                      → {item.lagHours}h → C/D ({item.retailMentions})
                    </span>
                  </div>
                </div>
                {/* Floating tooltip on hover - outside overflow-hidden */}
                <div className="absolute left-0 top-full mt-0.5 z-20 hidden group-hover:flex items-center gap-3 text-[10px] text-gray-500 bg-white/95 backdrop-blur rounded-md px-2 py-0.5 shadow-sm border border-gray-100 whitespace-nowrap pointer-events-none">
                  <span>Alpha: {formatTime(item.alphaFirstSeen)}</span>
                  <span>Retail: {formatTime(item.retailFirstSeen)}</span>
                </div>
              </div>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full text-white shrink-0 ${getLagColor(
                  item.lagHours
                )}`}
              >
                {getLagLabel(item.lagHours)}
              </span>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-5 pt-4 border-t border-gray-100 flex items-center gap-4 text-[10px] text-gray-500">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-red-500" /> &lt;3h 초고속
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-orange-500" /> 3-6h 빠름
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-amber-500" /> 6-12h 보통
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-blue-500" /> 12-24h 느림
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-gray-400" /> &gt;24h 매우느림
        </span>
      </div>
    </div>
  );
}
