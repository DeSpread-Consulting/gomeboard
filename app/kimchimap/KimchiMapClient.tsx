/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useMemo, useState, useEffect } from "react";
import { Treemap, ResponsiveContainer, Tooltip } from "recharts";

// ----------------------------------------------------------------------
// 타입 정의
// ----------------------------------------------------------------------
interface MindshareItem {
  ticker: string;
  logo: string;
  tge: boolean;
  mention_share: number;
  trend_score: number;
  keyword: string;
  mentions: number;
}

interface TimeSeriesPoint {
  stats_date: string;
  mention_count: string;
}

interface DailyPoint {
  date: string;
  dailyScore: number;
}

// ----------------------------------------------------------------------
// [Utility] 스파크라인 생성
// ----------------------------------------------------------------------
function generateSparklinePath(data: number[], width: number, height: number) {
  if (!data || data.length === 0) return "";
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const paddingY = 5;
  const drawHeight = height - paddingY * 2;
  const points = data.map((val, i) => {
    const x = (i / (data.length - 1)) * width;
    const normalizedVal = (val - min) / range;
    const y = height - paddingY - normalizedVal * drawHeight;
    return `${x},${y}`;
  });
  return `M ${points.join(" L ")}`;
}

// ----------------------------------------------------------------------
// [Design] 커스텀 트리맵 컨텐츠
// ----------------------------------------------------------------------
const CustomTreemapContent = (props: any) => {
  const { x, y, width, height, name, value, totalMentions } = props;
  const itemData = props.itemData || props.payload?.itemData;

  if (!itemData || width < 30 || height < 30) return null;

  const isLarge = width > 140 && height > 100;
  const isMedium = !isLarge && width > 100 && height > 80;
  const isSmall = !isLarge && !isMedium;

  const safeTotal = totalMentions || 1;
  const percentage = ((value / safeTotal) * 100).toFixed(1);

  const isGrowing = itemData.trend_score >= 0;
  const tintColor = isGrowing
    ? "rgba(16, 185, 129, 0.1)"
    : "rgba(244, 63, 94, 0.1)";
  const borderColor = isGrowing
    ? "rgba(16, 185, 129, 0.4)"
    : "rgba(244, 63, 94, 0.4)";
  const sparklineColor = isGrowing ? "#10B981" : "#F43F5E";

  const dailyScores =
    itemData.dailySeries?.map((s: DailyPoint) => s.dailyScore) || [];
  const gap = 4;
  const drawWidth = width - gap;
  const drawHeight = height - gap;
  const sparklinePath = isLarge
    ? generateSparklinePath(dailyScores, drawWidth - 32, drawHeight * 0.25)
    : "";

  return (
    <foreignObject
      x={x + gap / 2}
      y={y + gap / 2}
      width={drawWidth}
      height={drawHeight}
      style={{ overflow: "visible" }}
    >
      <div
        className="w-full h-full rounded-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-xl group relative overflow-hidden flex flex-col justify-between p-3"
        style={{
          background: `linear-gradient(135deg, rgba(255,255,255,0.4) 0%, ${tintColor} 100%)`,
          backdropFilter: "blur(12px)",
          border: `1px solid ${borderColor}`,
          boxShadow: "0 8px 32px 0 rgba(31, 38, 135, 0.05)",
        }}
      >
        <div
          className={`relative z-10 w-full h-full flex ${
            isSmall
              ? "flex-col items-center justify-center gap-1"
              : "flex-col justify-between"
          }`}
        >
          <div
            className={`flex ${
              isSmall ? "flex-col items-center" : "items-start gap-2"
            }`}
          >
            {itemData.logo && (
              <img
                src={itemData.logo}
                alt={name}
                className={`${
                  isSmall ? "w-6 h-6" : "w-8 h-8"
                } rounded-full object-cover bg-white shadow-sm ring-1 ring-white/50`}
              />
            )}

            {!isSmall && (
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-gray-800 truncate leading-tight">
                  {name}
                </p>
                <div className="mt-1">
                  <span
                    className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-md backdrop-blur-md shadow-sm ${
                      isGrowing
                        ? "bg-emerald-50/50 text-emerald-800"
                        : "bg-rose-50/50 text-rose-800"
                    }`}
                  >
                    {percentage}%
                  </span>
                </div>
              </div>
            )}
            {isSmall && (
              <span
                className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-full backdrop-blur-md shadow-sm ${
                  isGrowing
                    ? "bg-emerald-50/80 text-emerald-800"
                    : "bg-rose-50/80 text-rose-800"
                }`}
              >
                {percentage}%
              </span>
            )}
          </div>

          {isLarge && (
            <div className="absolute bottom-4 left-4 right-4 h-1/4 opacity-60 pointer-events-none">
              <svg width="100%" height="100%" overflow="visible">
                <path
                  d={sparklinePath}
                  fill="none"
                  stroke={sparklineColor}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          )}

          {!isSmall && (
            <div className="relative z-10 text-right mt-auto">
              <p className="text-[10px] uppercase text-gray-500 font-semibold mix-blend-multiply">
                Mentions
              </p>
              <p className="text-sm font-black text-gray-800 tabular-nums">
                {Math.round(value).toLocaleString()}
              </p>
            </div>
          )}
        </div>
      </div>
    </foreignObject>
  );
};

// 툴팁
const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const item = payload[0].payload.itemData as MindshareItem;
    return (
      <div className="bg-white shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-gray-200 p-4 rounded-lg text-sm z-50 min-w-[200px]">
        <div className="flex items-center gap-3 mb-3">
          <img
            src={item.logo}
            className="w-10 h-10 rounded-full bg-gray-50 p-1 shadow-sm"
          />
          <div>
            <p className="font-bold text-base text-gray-900">{item.ticker}</p>
            <p className="text-xs text-gray-400">Keyword: {item.keyword}</p>
          </div>
        </div>
        <div className="space-y-2 bg-gray-50/50 p-3 rounded-xl border border-gray-100">
          <div className="flex justify-between items-center">
            <span className="text-gray-500 text-xs">Total Mentions</span>
            <span className="font-bold text-gray-900">
              {item.mentions.toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-500 text-xs">Share</span>
            <span className="font-bold text-[#0037F0]">
              {(item.mention_share * 100).toFixed(2)}%
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-500 text-xs">Trend Score</span>
            <span
              className={`font-bold ${
                item.trend_score >= 0 ? "text-emerald-500" : "text-rose-500"
              }`}
            >
              {item.trend_score.toFixed(2)}
            </span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

// ----------------------------------------------------------------------
// 메인 컴포넌트
// ----------------------------------------------------------------------
export default function KimchiMapClient() {
  const [data, setData] = useState<{
    items: MindshareItem[];
    timeseries: any;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  // 상태 관리
  const [intervalDays, setIntervalDays] = useState(30);
  const [preTge, setPreTge] = useState(false);
  const [viewLimit, setViewLimit] = useState<number>(20);

  // 데이터 Fetch
  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const query = new URLSearchParams({
          intervalDays: intervalDays.toString(),
          offset: "0",
          limit: "50",
          pretge: preTge.toString(),
        });

        // [수정] 외부 URL -> 내부 API 라우트로 변경
        // 기존: https://mashboard-api.despreadlabs.io/telegram/mindshare/community?...
        // 변경: /api/mindshare?...
        const res = await fetch(`/api/mindshare?${query}`);

        if (res.ok) {
          const json = await res.json();
          setData(json);
        }
      } catch (e) {
        console.error("Failed to fetch mindshare data", e);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [intervalDays, preTge]);
  // 데이터 가공
  const { treeMapData, totalMentions, rankingData } = useMemo(() => {
    if (!data?.items)
      return { treeMapData: [], totalMentions: 0, rankingData: [] };

    const total = data.items.reduce((sum, item) => sum + item.mentions, 0);

    const allData = data.items.map((item) => {
      const rawSeries = data.timeseries?.[item.ticker]?.daily || [];
      const dailySeries: DailyPoint[] = rawSeries.map((p: TimeSeriesPoint) => ({
        date: p.stats_date,
        dailyScore: Number(p.mention_count) || 0,
      }));
      dailySeries.sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      return {
        name: item.ticker,
        value: item.mentions,
        itemData: { ...item, dailySeries },
      };
    });

    allData.sort((a, b) => b.value - a.value);

    return {
      treeMapData: allData.slice(0, viewLimit),
      rankingData: allData,
      totalMentions: total,
    };
  }, [data, viewLimit]);

  return (
    <div className="flex-1 w-full bg-[#F3F4F6] text-[#1D1D1F] font-sans min-h-screen">
      {/* [수정] max-w-7xl로 변경하여 다른 페이지와 여백 통일 */}
      <main className="max-w-7xl mx-auto px-4 md:px-6 py-10">
        {/* Header - [수정] mb-8 -> mb-12로 간격 확장 */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div>
            <h1 className="text-4xl font-black text-gray-900 tracking-tight mb-1">
              Kimchi Map
            </h1>
            <p className="text-gray-500 text-sm font-medium">
              Telegram Community Mindshare & Trends
            </p>
          </div>

          <div className="flex items-end gap-3 flex-wrap justify-end">
            {/* View Limit Toggle */}
            <div className="flex flex-col items-end gap-1">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                View
              </span>
              <div className="flex bg-white rounded-xl p-1 border border-gray-200 shadow-glass items-center h-9">
                <button
                  onClick={() => setViewLimit(20)}
                  className={`px-3 h-full flex items-center rounded-md text-xs font-bold transition-all ${
                    viewLimit === 20
                      ? "bg-gray-800 text-white"
                      : "text-gray-500 hover:text-gray-900"
                  }`}
                >
                  Top 20
                </button>
                <button
                  onClick={() => setViewLimit(50)}
                  className={`px-3 h-full flex items-center rounded-md text-xs font-bold transition-all ${
                    viewLimit === 50
                      ? "bg-gray-800 text-white"
                      : "text-gray-500 hover:text-gray-900"
                  }`}
                >
                  All 50
                </button>
              </div>
            </div>

            {/* Pre-TGE Toggle */}
            <div className="flex flex-col items-end gap-1">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                Filter
              </span>
              <div
                className="flex items-center gap-2 bg-white px-3 h-9 rounded-xl border border-gray-200 shadow-glass cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => setPreTge(!preTge)}
              >
                <span className="text-[10px] font-bold text-gray-500 uppercase select-none">
                  Pre-TGE
                </span>
                <div
                  className={`w-8 h-4 rounded-full relative transition-colors duration-200 ease-in-out ${
                    preTge ? "bg-[#0037F0]" : "bg-gray-200"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 bg-white w-3 h-3 rounded-full shadow-sm transition-transform duration-200 ${
                      preTge ? "translate-x-4" : "translate-x-0"
                    }`}
                  />
                </div>
              </div>
            </div>

            {/* [수정] Period Label 추가 및 1일/14일 옵션 추가 */}
            <div className="flex flex-col items-end gap-1">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                Period
              </span>
              <div className="flex bg-white rounded-xl p-1 border border-gray-200 shadow-glass h-9 items-center">
                {[1, 7, 14, 30, 90].map((d) => (
                  <button
                    key={d}
                    onClick={() => setIntervalDays(d)}
                    className={`px-3 h-full flex items-center rounded-md text-xs font-bold transition-all ${
                      intervalDays === d
                        ? "bg-[#1D1D1F] text-white"
                        : "text-gray-500 hover:bg-gray-100"
                    }`}
                  >
                    {d === 1 ? "24h" : `${d}d`}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 1. TreeMap Container */}
        <div className="relative h-[700px] w-full bg-white rounded-xl border border-white shadow-sm overflow-hidden p-4 mb-12">
          {loading && (
            <div className="absolute inset-0 z-10 bg-gray-50  flex items-center justify-center">
              <div className="text-[#0037F0] font-bold animate-pulse">
                Updating Mindshare...
              </div>
            </div>
          )}

          {treeMapData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <Treemap
                data={treeMapData}
                dataKey="value"
                aspectRatio={1.6}
                stroke="none"
                fill="transparent"
                isAnimationActive={false}
                content={<CustomTreemapContent totalMentions={totalMentions} />}
              >
                <Tooltip content={<CustomTooltip />} cursor={false} />
              </Treemap>
            </ResponsiveContainer>
          ) : (
            !loading && (
              <div className="flex h-full items-center justify-center text-gray-400">
                데이터가 없습니다.
              </div>
            )
          )}
        </div>

        {/* 2. Leaderboard Section */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 md:p-8 shadow-glass">
          <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
            🏆 Leaderboard
            <span className="text-xs font-normal text-gray-400 bg-gray-50 px-2 py-0.5 rounded border border-gray-100">
              Sorted by Mentions
            </span>
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse table-auto">
              <thead>
                <tr className="border-b border-gray-100 text-gray-400 uppercase tracking-wider text-[10px]">
                  <th className="py-3 pl-2 w-10 text-center">#</th>
                  <th className="py-3">Project</th>
                  <th className="py-3 text-right w-20">Share</th>
                  <th className="py-3 text-right w-24">Trend Score</th>
                  <th className="py-3 text-right pr-4 w-24">Mentions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rankingData.map((item: any, idx: number) => {
                  const ch = item.itemData as MindshareItem;
                  const share =
                    totalMentions > 0
                      ? ((ch.mentions / totalMentions) * 100).toFixed(2)
                      : "0.00";

                  return (
                    <tr
                      key={ch.ticker}
                      className="hover:bg-gray-50 transition-colors group"
                    >
                      <td className="py-3 pl-2 text-center font-bold text-gray-400 group-hover:text-[#0037F0]">
                        {idx + 1}
                      </td>
                      <td className="py-3">
                        <div className="flex items-center gap-3">
                          <img
                            src={ch.logo}
                            className="w-8 h-8 rounded-full border border-gray-100 object-cover bg-white"
                            alt=""
                          />
                          <div>
                            <p className="font-bold text-gray-900 text-sm">
                              {ch.ticker}
                            </p>
                            <p className="text-[10px] text-gray-400">
                              {ch.keyword}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 text-right font-medium text-gray-600">
                        {share}%
                      </td>
                      <td className="py-3 text-right">
                        <span
                          className={`font-bold ${
                            ch.trend_score >= 0
                              ? "text-emerald-500"
                              : "text-rose-500"
                          }`}
                        >
                          {ch.trend_score.toFixed(2)}
                        </span>
                      </td>
                      <td className="py-3 text-right pr-4">
                        <span className="font-bold text-gray-900 group-hover:text-[#0037F0]">
                          {ch.mentions.toLocaleString()}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
