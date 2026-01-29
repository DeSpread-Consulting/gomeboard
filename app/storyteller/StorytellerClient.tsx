/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useMemo, useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Treemap, ResponsiveContainer, Tooltip } from "recharts";

// ----------------------------------------------------------------------
// 타입 정의
// ----------------------------------------------------------------------
interface SeriesPoint {
  date: string;
  score: number;
  mentionCount: number;
}
interface DailyPoint {
  date: string;
  dailyScore: number;
}
interface ChannelData {
  channelId: string;
  channelTitle: string;
  channelUsername?: string;
  score: number;
  mentionCount: number;
  profileImageUrl?: string;
  series: SeriesPoint[];
  dailySeries?: DailyPoint[];
}
interface NotionTask {
  id: string;
  title: string;
  groupId: string | null;
  dateStart: string | null;
  dateEnd: string | null;
  status: string;
  category: string;
  manager: string;
  managerImg: string | null;
}

// ----------------------------------------------------------------------
// [Utility] 스파크라인 패스 생성기
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
// [Design] 트라맵 컨텐츠
// ----------------------------------------------------------------------
const CustomTreemapContent = (props: any) => {
  const { x, y, width, height, name, value, totalScore } = props;
  const itemData = props.itemData || props.payload?.itemData;
  if (!itemData || width < 50 || height < 50) return null;

  const isLarge = width > 160 && height > 120;
  const isMedium = !isLarge && width > 120 && height > 100;
  const isSmall = !isLarge && !isMedium;

  // [Fix] 숫자 변환 안전장치
  const safeTotal = Number(totalScore) || 1;
  const safeValue = Number(value) || 0;
  const percentage = ((safeValue / safeTotal) * 100).toFixed(1);

  const dailySeries = itemData.dailySeries || [];
  const dailyScores = dailySeries.map((s: DailyPoint) => s.dailyScore);

  const isGrowing =
    (dailyScores[dailyScores.length - 1] || 0) >= (dailyScores[0] || 0);

  const tintColor = isGrowing
    ? "rgba(16, 185, 129, 0.1)"
    : "rgba(244, 63, 94, 0.1)";
  const borderColor = isGrowing
    ? "rgba(16, 185, 129, 0.4)"
    : "rgba(244, 63, 94, 0.4)";
  const sparklineColor = isGrowing ? "#10B981" : "#F43F5E";

  const gap = 4;
  const drawX = x + gap / 2;
  const drawY = y + gap / 2;
  const drawWidth = width - gap;
  const drawHeight = height - gap;

  const sparklinePath = isLarge
    ? generateSparklinePath(dailyScores, drawWidth - 32, drawHeight * 0.25)
    : "";

  return (
    <foreignObject
      x={drawX}
      y={drawY}
      width={drawWidth}
      height={drawHeight}
      style={{ overflow: "visible" }}
    >
      <div
        className="w-full h-full rounded-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-xl group relative overflow-hidden flex flex-col justify-between p-3"
        style={{
          background: `linear-gradient(135deg, rgba(255,255,255,0.4) 0%, ${tintColor} 100%)`,
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          border: `1px solid ${borderColor}`,
          boxShadow: "0 8px 32px 0 rgba(31, 38, 135, 0.05)",
        }}
      >
        <div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b from-white/30 to-transparent pointer-events-none" />

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
            {itemData.profileImageUrl && (
              <div className="relative shrink-0">
                <img
                  src={itemData.profileImageUrl}
                  alt=""
                  className={`${
                    isSmall ? "w-8 h-8" : "w-10 h-10"
                  } rounded-full object-cover shadow-sm ring-2 ring-white/60 transition-all`}
                />
                <div
                  className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-gray-200 ${
                    isGrowing ? "bg-emerald-400" : "bg-rose-400"
                  }`}
                />
              </div>
            )}

            {!isSmall && (
              <div className="min-w-0 flex-1 pt-0.5">
                <p
                  className="text-[13px] font-bold text-gray-800 leading-tight truncate drop-shadow-sm group-hover:text-[#0037F0] transition-colors"
                  title={name}
                >
                  {name}
                </p>
                <div className="flex items-center gap-1.5 mt-1">
                  <span
                    className={`text-[11px] font-extrabold px-1.5 py-0.5 rounded-md backdrop-blur-md shadow-sm ${
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
                className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-full backdrop-blur-md shadow-sm mt-1 ${
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
            <div className="absolute bottom-4 left-4 right-4 h-1/4 pointer-events-none opacity-60 group-hover:opacity-100 transition-opacity">
              <svg width="100%" height="100%" overflow="visible">
                <path
                  d={sparklinePath}
                  fill="none"
                  stroke={sparklineColor}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  filter="drop-shadow(0px 2px 2px rgba(0,0,0,0.1))"
                />
              </svg>
            </div>
          )}

          {!isSmall && (
            <div className="relative z-10 text-right mt-auto">
              <p className="text-[10px] uppercase tracking-wider text-gray-600 font-semibold mb-0.5 mix-blend-multiply">
                Total Score
              </p>
              <p className="text-sm font-black text-gray-800 tabular-nums tracking-tight group-hover:scale-105 transition-transform origin-right">
                {Math.round(safeValue).toLocaleString()}
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
    const item = payload[0].payload.itemData;
    if (!item) return null;
    return (
      <div className="bg-white shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-gray-200 p-4 rounded-lg text-sm z-50 min-w-[200px]">
        <div className="flex items-center gap-3 mb-4">
          {item.profileImageUrl && (
            <img
              src={item.profileImageUrl}
              alt=""
              className="w-10 h-10 rounded-full shadow-md ring-2 ring-white"
            />
          )}
          <div>
            <p className="font-bold text-gray-900 text-base">
              {item.channelTitle}
            </p>
            <p className="text-gray-500 text-xs">
              @{item.channelUsername || item.channelId}
            </p>
          </div>
        </div>
        <div className="space-y-2 bg-white rounded-xl p-3 border border-gray-200">
          <div className="flex justify-between items-center gap-4">
            <span className="text-gray-500 text-xs font-medium">
              Total Score
            </span>
            <span className="font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg text-xs">
              {Math.round(Number(item.score) || 0).toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between items-center gap-4">
            <span className="text-gray-500 text-xs font-medium">Mentions</span>
            <span className="font-bold text-gray-800">{item.mentionCount}</span>
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
export default function StorytellerClient({
  apiDataMap: initialApiDataMap,
  notionTasks,
  availableGroupIds,
  projectNames,
  initialNow,
  initialTodayStr,
}: {
  apiDataMap: Record<string, any>;
  notionTasks: NotionTask[];
  availableGroupIds: string[];
  projectNames: Record<string, string>;
  initialNow: number;
  initialTodayStr: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryGroupId = searchParams.get("groupId");
  const todayStr = useMemo(() => initialTodayStr, [initialTodayStr]);
  const initialDateObj = useMemo(() => new Date(initialNow), [initialNow]);

  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [selectedGroupId, setSelectedGroupId] = useState<string>(
    queryGroupId && availableGroupIds.includes(queryGroupId)
      ? queryGroupId
      : availableGroupIds[0] || "63"
  );
  const [lookback, setLookback] = useState<number>(30);
  const [currentDataMap, setCurrentDataMap] = useState(initialApiDataMap);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Grouping
  const { activeIds, finishedIds } = useMemo(() => {
    const activeStatuses = [
      "진행중",
      "In Progress",
      "진행 중",
      "Ongoing",
      "Running",
      "Active",
    ];
    const active: string[] = [];
    const finished: string[] = [];
    availableGroupIds.forEach((id) => {
      const task = notionTasks.find((t) => t.groupId === id);
      if (task && activeStatuses.includes(task.status)) active.push(id);
      else finished.push(id);
    });
    return { activeIds: active, finishedIds: finished };
  }, [availableGroupIds, notionTasks]);

  useEffect(() => {
    if (queryGroupId && availableGroupIds.includes(queryGroupId)) {
      if (selectedGroupId !== queryGroupId) setSelectedGroupId(queryGroupId);
    }
  }, [queryGroupId, availableGroupIds, selectedGroupId]);

  const handleTabClick = (id: string) => {
    setSelectedGroupId(id);
    router.push(`?groupId=${id}`, { scroll: false });
  };

  useEffect(() => {
    async function fetchHistory() {
      if (selectedDate === todayStr) {
        setCurrentDataMap(initialApiDataMap);
        return;
      }
      setIsLoadingHistory(true);
      try {
        const res = await fetch(
          `/api/history?groupId=${selectedGroupId}&date=${selectedDate}`
        );
        if (res.ok) {
          const historyData = await res.json();
          setCurrentDataMap((prev) => ({
            ...prev,
            [selectedGroupId]: historyData,
          }));
        } else {
          setSelectedDate(todayStr);
        }
      } catch (e) {
        console.error(e);
        setSelectedDate(todayStr);
      } finally {
        setIsLoadingHistory(false);
      }
    }
    fetchHistory();
  }, [selectedDate, selectedGroupId, todayStr, initialApiDataMap]);

  const currentGroupAllData = currentDataMap[selectedGroupId];
  const currentApiData = useMemo(() => {
    if (!currentGroupAllData) return null;
    if (currentGroupAllData["30"] || currentGroupAllData["7"])
      return currentGroupAllData[lookback.toString()];
    if (lookback === 30) return currentGroupAllData;
    return null;
  }, [currentGroupAllData, lookback]);

  const { treeMapData, totalScore } = useMemo(() => {
    if (!currentApiData?.channels) return { treeMapData: [], totalScore: 0 };
    const channels: ChannelData[] = currentApiData.channels;

    const total = channels.reduce(
      (sum, ch) => sum + (Number(ch.score) || 0),
      0
    );

    const data = channels.map((ch) => {
      const rawSeries = ch.series || [];
      const dailySeries: DailyPoint[] = [];
      for (let i = 1; i < rawSeries.length; i++) {
        const prev = rawSeries[i - 1];
        const curr = rawSeries[i];
        const dailyScore =
          (Number(curr.score) || 0) - (Number(prev.score) || 0);
        dailySeries.push({
          date: curr.date,
          dailyScore: dailyScore < 0 ? 0 : dailyScore,
        });
      }
      return {
        name: ch.channelTitle,
        value: Number(ch.score) || 0,
        itemData: { ...ch, dailySeries },
      };
    });
    data.sort((a, b) => b.value - a.value);
    return { treeMapData: data, totalScore: total };
  }, [currentApiData]);

  const treemapVisualData = useMemo(
    () => treeMapData.slice(0, 20),
    [treeMapData]
  );
  const rankingData = treeMapData;

  const { startDate, totalDays, dateHeaders } = useMemo(() => {
    const baseDate = new Date();
    if (notionTasks.length === 0) {
      const start = new Date(baseDate);
      start.setDate(start.getDate() - 3);
      return { startDate: start, totalDays: 30, dateHeaders: [] };
    }
    const dates = notionTasks
      .map((t) => [new Date(t.dateStart || ""), new Date(t.dateEnd || "")])
      .flat()
      .filter((d) => !isNaN(d.getTime()))
      .map((d) => d.getTime());
    const min = dates.length ? Math.min(...dates) : baseDate.getTime();
    const max = dates.length
      ? Math.max(...dates)
      : baseDate.getTime() + 86400000 * 30;
    const start = new Date(min);
    start.setDate(start.getDate() - 3);
    const end = new Date(max);
    end.setDate(end.getDate() + 7);
    const diffDays = Math.ceil(
      (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
    );
    const headers = [];
    for (let i = 0; i <= diffDays; i += 7) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      headers.push({
        label: `${d.getMonth() + 1}/${d.getDate()}`,
        left: (i / diffDays) * 100,
      });
    }
    return {
      startDate: start,
      totalDays: diffDays || 30,
      dateHeaders: headers,
    };
  }, [notionTasks]);

  const getDatePosition = (dateStr: string | null) => {
    if (!dateStr) return 0;
    const diff = new Date(dateStr).getTime() - startDate.getTime();
    return Math.max(0, (diff / (1000 * 60 * 60 * 24) / totalDays) * 100);
  };
  const getDurationWidth = (startStr: string | null, endStr: string | null) => {
    if (!startStr) return 0;
    const start = new Date(startStr);
    const end = endStr ? new Date(endStr) : start;
    const days = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24) + 1;
    return (days / totalDays) * 100;
  };

  return (
    <div className="flex-1 w-full bg-[#F3F4F6] text-[#1D1D1F] font-sans">
      <main className="max-w-7xl mx-auto px-4 md:px-6 py-10">
        {/* 헤더 섹션 */}
        <div className="flex flex-col gap-8 mb-12">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <h1 className="text-4xl font-black text-gray-900 tracking-tight mb-1">
                Storyteller
              </h1>
              <p className="text-gray-500 text-sm font-medium">
                Influence Intelligence & Content Scheduling
              </p>
            </div>

            <div className="flex items-end gap-3">
              {/* Period Selector */}
              <div className="flex flex-col items-end gap-1">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  Period
                </span>
                <div className="flex bg-white rounded-xl p-1 border border-gray-200 shadow-glass h-9 items-center">
                  {[7, 14, 30, 90].map((days) => (
                    <button
                      key={days}
                      onClick={() => setLookback(days)}
                      className={`px-3 h-full flex items-center rounded-md text-xs font-bold transition-all ${
                        lookback === days
                          ? "bg-[#1D1D1F] text-white"
                          : "text-gray-500 hover:bg-gray-100"
                      }`}
                    >
                      {days}d
                    </button>
                  ))}
                </div>
              </div>

              {/* Time Machine Selector */}
              <div className="flex flex-col items-end gap-1">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  Time Machine
                </span>
                <input
                  type="date"
                  value={selectedDate}
                  max={todayStr}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="bg-white border border-gray-200 rounded-xl px-3 text-xs font-bold text-gray-700 outline-none focus:ring-2 focus:ring-[#0037F0]/30 shadow-glass h-9"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-5">
            {activeIds.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 ml-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#0037F0] animate-pulse"></div>
                  <h3 className="text-[10px] font-bold text-[#0037F0] uppercase tracking-wider">
                    Active Projects
                  </h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {activeIds.map((id) => (
                    <button
                      key={id}
                      onClick={() => handleTabClick(id)}
                      className={`px-4 py-2 rounded-lg text-xs font-bold transition-all border shadow-sm ${
                        selectedGroupId === id
                          ? "bg-[#0037F0] text-white border-[#0037F0] shadow-md scale-105"
                          : "bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:text-blue-600"
                      }`}
                    >
                      {projectNames[id] || id}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {finishedIds.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">
                  Finished Projects
                </h3>
                <div className="flex flex-wrap gap-2">
                  {finishedIds.map((id) => (
                    <button
                      key={id}
                      onClick={() => handleTabClick(id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                        selectedGroupId === id
                          ? "bg-gray-600 text-white border-gray-600"
                          : "bg-white text-gray-400 border-gray-200 hover:bg-gray-50"
                      }`}
                    >
                      {projectNames[id] || id}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 1. TreeMap */}
        <div className="relative h-[650px] w-full mb-10 rounded-xl overflow-hidden shadow-inner border border-gray-200 bg-gray-50">
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.1] z-0">
            <img
              src="/logo.png"
              alt=""
              className="w-[500px] h-auto object-contain mix-blend-multiply grayscale"
            />
          </div>

          {isLoadingHistory && (
            <div className="absolute inset-0 z-50 bg-gray-100 backdrop-blur-md flex items-center justify-center">
              <div className="text-[#0037F0] font-bold animate-pulse">
                Loading...
              </div>
            </div>
          )}

          <div className="w-full h-full relative z-10 p-4">
            {treemapVisualData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <Treemap
                  data={treemapVisualData}
                  dataKey="value"
                  aspectRatio={1}
                  stroke="none"
                  fill="transparent"
                  isAnimationActive={false}
                  content={<CustomTreemapContent totalScore={totalScore} />}
                >
                  <Tooltip content={<CustomTooltip />} cursor={false} />
                </Treemap>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2">
                <div className="text-2xl">🌪️</div>
                <div>데이터가 없습니다.</div>
              </div>
            )}
          </div>
        </div>

        {/* 2. Leaderboard & Schedule */}
        <div className="flex flex-col gap-10">
          {/* Leaderboard */}
          <div className="bg-white rounded-lg border border-gray-200 p-4 md:p-8 shadow-glass">
            <h2 className="text-lg md:text-xl font-bold text-gray-900 mb-4 md:mb-6 flex items-center gap-2">
              🏆 Leaderboard{" "}
              <span className="text-xs font-normal text-gray-400 bg-gray-50 px-2 py-0.5 rounded">
                Top 50
              </span>
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse table-auto">
                <thead>
                  <tr className="border-b border-gray-100 text-gray-400 uppercase tracking-wider text-[10px]">
                    <th className="py-2 pl-1 w-8 text-center md:pl-2 md:w-10">
                      #
                    </th>
                    <th className="py-2">Channel</th>
                    <th className="py-2 text-right w-12 md:w-16">Share</th>
                    <th className="py-2 text-right pr-2 md:pr-4">Score</th>
                    <th className="py-2 text-center w-8 md:w-12">Link</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {rankingData.slice(0, 50).map((item, idx) => {
                    const ch = item.itemData as ChannelData;
                    const telegramLink = ch.channelUsername
                      ? `https://t.me/${ch.channelUsername}`
                      : `https://t.me/${ch.channelId}`;

                    const safeScore = Number(ch.score) || 0;
                    const safeTotal = Number(totalScore) || 1;
                    const share =
                      safeTotal > 0
                        ? ((safeScore / safeTotal) * 100).toFixed(2)
                        : "0.00";

                    return (
                      <tr
                        key={ch.channelId}
                        className="hover:bg-gray-50 transition-colors group"
                      >
                        <td className="py-2 pl-1 text-center font-bold text-gray-400 group-hover:text-[#0037F0] text-xs md:pl-2">
                          {idx + 1}
                        </td>
                        <td className="py-2">
                          <div className="flex items-center gap-2 md:gap-3">
                            {ch.profileImageUrl ? (
                              <img
                                src={ch.profileImageUrl}
                                className="w-6 h-6 md:w-8 md:h-8 rounded-full border border-gray-100 object-cover"
                              />
                            ) : (
                              <div className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 font-bold text-[10px]">
                                ?
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              {/* [모바일] max-w-100px로 줄여서 ...처리 */}
                              <p className="font-bold text-gray-900 truncate max-w-[100px] sm:max-w-[150px] md:max-w-[200px] text-[11px] md:text-xs">
                                {ch.channelTitle}
                              </p>
                              <p className="text-[9px] md:text-[10px] text-gray-400 truncate max-w-[100px] sm:max-w-[150px] md:max-w-[200px]">
                                @{ch.channelUsername || ch.channelId}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="py-2 text-right text-xs font-medium text-gray-500 tabular-nums w-12 md:w-16">
                          {share}%
                        </td>
                        <td className="py-2 text-right pr-2 md:pr-4">
                          <span className="text-gray-900 font-bold font-mono text-xs group-hover:text-[#0037F0]">
                            {Math.round(safeScore).toLocaleString()}
                          </span>
                        </td>
                        <td className="py-2 text-center w-8 md:w-12">
                          <a
                            href={telegramLink}
                            target="_blank"
                            rel="noreferrer"
                            className="text-gray-300 hover:text-[#0088cc] inline-flex justify-center items-center w-full"
                          >
                            <svg
                              className="w-4 h-4"
                              fill="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 11.944 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                            </svg>
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Schedule */}
          <div className="bg-white rounded-lg border border-gray-200 p-8 shadow-glass flex flex-col">
            <h2 className="text-xl font-bold text-gray-900 mb-8 flex items-center gap-2">
              🗓 Content Schedule{" "}
              <span className="text-xs font-normal text-gray-400 bg-gray-50 px-2 py-0.5 rounded">
                Live Status
              </span>
            </h2>
            <div className="flex-1 border border-gray-100 rounded-xl bg-gray-50/30 relative overflow-hidden min-h-[400px]">
              <div className="absolute inset-0 overflow-x-auto custom-scrollbar">
                <div className="min-w-[1000px] h-full relative p-6 pt-10">
                  <div className="absolute top-0 left-0 right-0 h-full pointer-events-none">
                    {dateHeaders.map((h, i) => (
                      <div
                        key={i}
                        className="absolute top-0 bottom-0 border-l border-dashed border-gray-200"
                        style={{ left: `${h.left}%` }}
                      >
                        <span className="absolute top-3 left-1 text-[10px] text-gray-400 font-medium">
                          {h.label}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="relative z-10 pt-4 space-y-4">
                    {notionTasks.length > 0 ? (
                      notionTasks.map((task) => {
                        const left = getDatePosition(task.dateStart);
                        const width = Math.max(
                          getDurationWidth(task.dateStart, task.dateEnd),
                          5
                        );
                        const isDone =
                          task.status === "Done" || task.status === "완료";
                        const isInProgress =
                          task.status === "In Progress" ||
                          task.status === "진행중";

                        return (
                          <div key={task.id} className="h-10 relative group">
                            <div
                              className={`absolute h-full rounded-xl border px-4 flex items-center gap-3 transition-all hover:scale-[1.01] hover:shadow-md cursor-pointer
                                       ${
                                         isDone
                                           ? "bg-gray-100 border-gray-200 text-gray-400"
                                           : isInProgress
                                           ? "bg-blue-50 border-blue-200 text-[#0037F0]"
                                           : "bg-white border-gray-200 text-gray-700"
                                       }
                                     `}
                              style={{
                                left: `${left}%`,
                                width: `${width}%`,
                                minWidth: "180px",
                              }}
                            >
                              <span
                                className={`w-2 h-2 rounded-full ${
                                  task.category === "Video"
                                    ? "bg-red-400"
                                    : task.category === "Article"
                                    ? "bg-orange-400"
                                    : "bg-gray-300"
                                }`}
                              />
                              <span className="text-xs font-bold truncate flex-1">
                                {task.title}
                              </span>
                              {task.managerImg && (
                                <img
                                  src={task.managerImg}
                                  className="w-6 h-6 rounded-full border-2 border-white shadow-sm"
                                />
                              )}
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="text-center py-20 text-gray-400 text-sm">
                        스케줄이 없습니다.
                      </div>
                    )}
                  </div>
                  <div
                    className="absolute top-0 bottom-0 border-l-2 border-red-500 z-20 pointer-events-none opacity-50"
                    style={{
                      left: `${getDatePosition(initialDateObj.toISOString())}%`,
                    }}
                  >
                    <div className="bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full absolute -top-1.5 -left-5 shadow-sm">
                      Today
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
