"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import type { SEOItem } from "../actions";

const COLORS = [
  "#3b82f6",
  "#f97316",
  "#22c55e",
  "#a855f7",
  "#ef4444",
  "#eab308",
  "#06b6d4",
  "#ec4899",
  "#64748b",
  "#84cc16",
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-3 text-sm">
      <p className="font-bold text-gray-900 mb-1">{d.domain}</p>
      <p className="text-gray-600">
        {d.platform === "Google"
          ? `평균 점유율: ${d.metric}%`
          : `기사 수: ${Number(d.metric).toLocaleString()}건`}
      </p>
    </div>
  );
}

function DonutLabel({
  viewBox,
  title,
  subtitle,
}: {
  viewBox?: { cx: number; cy: number };
  title: string;
  subtitle: string;
}) {
  if (!viewBox) return null;
  const { cx, cy } = viewBox;
  return (
    <text x={cx} y={cy} textAnchor="middle">
      <tspan x={cx} dy="-6" fontSize="14" fontWeight="700" fill="#111827">
        {title}
      </tspan>
      <tspan x={cx} dy="20" fontSize="10" fill="#6b7280">
        {subtitle}
      </tspan>
    </text>
  );
}

// Convert typed array to plain objects for Recharts v3 compatibility
function toChartData(items: SEOItem[]): Record<string, unknown>[] {
  return items.map((d) => ({
    domain: d.domain,
    metric: d.metric,
    platform: d.platform,
  }));
}

export default function SEOBattlefield({ data }: { data: SEOItem[] }) {
  const googleItems = data.filter((d) => d.platform === "Google");
  const naverItems = data.filter((d) => d.platform === "Naver");
  const googleChartData = toChartData(googleItems);
  const naverChartData = toChartData(naverItems);

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
      <div className="mb-4">
        <h3 className="text-lg font-bold text-gray-900">SEO Battlefield</h3>
        <p className="text-xs text-gray-500 mt-0.5">
          한국 크립토 미디어 점유율 — PR 기사가 실제 노출되는 곳 · 최근 30일 · {new Date().toLocaleDateString("ko-KR")} 기준
        </p>
      </div>

      {data.length === 0 ? (
        <div className="h-[300px] flex items-center justify-center text-gray-400 text-sm">
          데이터가 없습니다
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Google Domain Share */}
          <div>
            <h4 className="text-sm font-semibold text-gray-700 text-center mb-2">
              Google 검색 도메인 점유율
            </h4>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={googleChartData}
                    dataKey="metric"
                    nameKey="domain"
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    strokeWidth={0}
                  >
                    {googleChartData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Pie
                    data={[{ value: 1 }]}
                    dataKey="value"
                    cx="50%"
                    cy="50%"
                    innerRadius={0}
                    outerRadius={0}
                  >
                    <DonutLabel
                      title="Google"
                      subtitle={`${googleItems.length}개 도메인`}
                    />
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            {/* Google Legend */}
            <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 mt-1">
              {googleItems.slice(0, 5).map((d, i) => (
                <div
                  key={d.domain}
                  className="flex items-center gap-1 text-xs"
                >
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: COLORS[i] }}
                  />
                  <span className="text-gray-600 truncate max-w-[100px]">
                    {d.domain}
                  </span>
                  <span className="text-gray-400">{d.metric}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* Naver News Provider Share */}
          <div>
            <h4 className="text-sm font-semibold text-gray-700 text-center mb-2">
              Naver 뉴스 제공자 점유율
            </h4>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={naverChartData}
                    dataKey="metric"
                    nameKey="domain"
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    strokeWidth={0}
                  >
                    {naverChartData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Pie
                    data={[{ value: 1 }]}
                    dataKey="value"
                    cx="50%"
                    cy="50%"
                    innerRadius={0}
                    outerRadius={0}
                  >
                    <DonutLabel
                      title="Naver"
                      subtitle={`${naverItems.length}개 매체`}
                    />
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            {/* Naver Legend */}
            <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 mt-1">
              {naverItems.slice(0, 5).map((d, i) => (
                <div
                  key={d.domain}
                  className="flex items-center gap-1 text-xs"
                >
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: COLORS[i] }}
                  />
                  <span className="text-gray-600 truncate max-w-[100px]">
                    {d.domain}
                  </span>
                  <span className="text-gray-400">
                    {d.metric.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Insight */}
      {googleItems.length > 0 && naverItems.length > 0 && (
        <div className="mt-4 p-3 rounded-xl bg-gray-50 border border-gray-100">
          <p className="text-xs text-gray-600">
            <span className="font-bold text-gray-900">액션: </span>
            글로벌 미디어 한국어판에 예산 집중 대신, Google 점유율{" "}
            <span className="font-semibold text-blue-600">
              {googleItems[0].domain}({googleItems[0].metric}%)
            </span>
            {naverItems[0] && (
              <>
                {" "}
                + Naver 1위{" "}
                <span className="font-semibold text-orange-600">
                  {naverItems[0].domain}(
                  {naverItems[0].metric.toLocaleString()}건)
                </span>
              </>
            )}
            에 PR 예산을 배분하세요.
          </p>
        </div>
      )}
    </div>
  );
}
