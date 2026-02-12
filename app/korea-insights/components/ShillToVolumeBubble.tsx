"use client";

import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
} from "recharts";
import type { ShillItem } from "../actions";

function formatVol(v: number): string {
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

function getColor(item: ShillItem): string {
  // Shill Index 기반 색상: 높을수록 빨강(과대광고), 낮을수록 초록(건강)
  if (item.shillIndex === null) return "#3b82f6"; // 거래량 없는 건 파랑
  if (item.shillIndex > 100) return "#ef4444";
  if (item.shillIndex > 10) return "#f59e0b";
  return "#22c55e";
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: ShillItem }>;
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-4 text-sm max-w-xs">
      <div className="flex items-center gap-2 mb-2">
        {d.logo && <img src={d.logo} alt="" className="w-5 h-5 rounded-full" />}
        <p className="font-bold text-gray-900 text-base">{d.ticker}</p>
      </div>
      <div className="space-y-1 text-gray-600">
        <p>
          멘션: <span className="font-semibold text-gray-900">{d.mentions.toLocaleString()}</span>
        </p>
        <p>
          거래량: <span className="font-semibold text-gray-900">{formatVol(d.volumeUsd)}</span>
        </p>
        {d.shillIndex !== null && (
          <p>
            Shill Index:{" "}
            <span
              className={`font-bold ${
                d.shillIndex > 100 ? "text-red-600" : d.shillIndex > 10 ? "text-amber-600" : "text-green-600"
              }`}
            >
              {d.shillIndex.toFixed(1)}
            </span>
          </p>
        )}
      </div>
    </div>
  );
}

export default function ShillToVolumeBubble({
  data,
}: {
  data: ShillItem[];
}) {
  if (!data.length) {
    return (
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Shill-to-Volume</h3>
        <div className="h-80 flex items-center justify-center text-gray-400 text-sm">
          데이터가 없습니다
        </div>
      </div>
    );
  }

  const chartData = data.filter((d) => d.volumeUsd > 0);
  const noVolumeData = data.filter((d) => d.volumeUsd === 0);

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold text-gray-900">Shill-to-Volume</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            텔레그램 멘션 vs 한국 거래소 거래량 (버블 크기 = 멘션 수)
          </p>
        </div>
        <div className="flex items-center gap-3 text-[10px]">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-500" /> 건강 (SI&lt;10)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-500" /> 주의 (10-100)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-500" /> 과대광고 (&gt;100)
          </span>
        </div>
      </div>

      <div className="h-[400px]">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 20, right: 30, bottom: 20, left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis
              dataKey="volumeUsd"
              name="거래량"
              tickFormatter={formatVol}
              type="number"
              scale="log"
              domain={["auto", "auto"]}
              tick={{ fontSize: 11, fill: "#94a3b8" }}
              label={{ value: "거래량 (USD)", position: "bottom", offset: 0, fontSize: 11, fill: "#94a3b8" }}
            />
            <YAxis
              dataKey="mentions"
              name="멘션"
              type="number"
              tick={{ fontSize: 11, fill: "#94a3b8" }}
              label={{ value: "텔레그램 멘션", angle: -90, position: "insideLeft", offset: 10, fontSize: 11, fill: "#94a3b8" }}
            />
            <ZAxis dataKey="mentions" range={[50, 500]} />
            <Tooltip content={<CustomTooltip />} />
            <Scatter data={chartData} name="Projects">
              {chartData.map((item, idx) => (
                <Cell key={idx} fill={getColor(item)} fillOpacity={0.75} stroke={getColor(item)} strokeWidth={1} />
              ))}
              <LabelList
                dataKey="ticker"
                position="top"
                offset={8}
                style={{ fontSize: 10, fontWeight: 700, fill: "#374151" }}
              />
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      {noVolumeData.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <p className="text-xs text-gray-500 mb-2">
            KRW 거래량 없음 ({noVolumeData.length}개)
          </p>
          <div className="flex flex-wrap gap-1.5">
            {noVolumeData.slice(0, 25).map((d) => (
              <span
                key={d.ticker}
                className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500"
              >
                {d.ticker} ({d.mentions})
              </span>
            ))}
            {noVolumeData.length > 25 && (
              <span className="text-[10px] px-2 py-0.5 text-gray-400">
                +{noVolumeData.length - 25}개
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
