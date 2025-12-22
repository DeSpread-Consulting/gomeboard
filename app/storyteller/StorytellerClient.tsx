/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useMemo, useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Treemap, ResponsiveContainer, Tooltip } from "recharts";

// ----------------------------------------------------------------------
// 타입 정의 (기존과 동일)
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
// [Utility] 스파크라인 및 커스텀 렌더러
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

const CustomTreemapContent = (props: any) => {
  const { x, y, width, height, name, value, totalScore } = props;
  const itemData = props.itemData || props.payload?.itemData;

  // 1. 아주 작은 영역은 렌더링 생략 (최소 50px)
  if (!itemData || width < 50 || height < 50) return null;

  // ----------------------------------------------------------------------
  // [Render Logic] 크기에 따른 정보 노출 단계 (Threshold 상향 조정)
  // ----------------------------------------------------------------------
  // [수정] 모바일 가독성을 위해 기준을 더 엄격하게 변경

  // 1. Large: 모든 정보 표시 (Sparkline + Total Score)
  // 기존: > 140x120 -> 변경: > 200x160 (확실히 클 때만 그래프 표시)
  const isLarge = width > 140 && height > 140;

  // 2. Medium: Total Score 표시 (Sparkline 제외)
  // 기존: > 90x80 -> 변경: > 120x100 (이름과 점수가 겹치지 않을 최소 공간 확보)
  const isMedium = !isLarge && width > 100 && height > 100;

  // 3. Small: 아이콘 + %만 표시 (나머지 모든 경우)
  const isSmall = !isLarge && !isMedium;

  const percentage = ((value / totalScore) * 100).toFixed(1);
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

  const gap = 8;
  const drawX = x + gap / 2;
  const drawY = y + gap / 2;
  const drawWidth = width - gap;
  const drawHeight = height - gap;

  // 그래프는 Large 상태일 때만 계산 및 렌더링
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
        className="w-full h-full rounded-2xl transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl group relative overflow-hidden flex flex-col justify-between p-3"
        style={{
          background: `linear-gradient(135deg, rgba(255,255,255,0.3) 0%, ${tintColor} 100%)`,
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          border: `1px solid ${borderColor}`,
          boxShadow: "0 8px 32px 0 rgba(31, 38, 135, 0.05)",
        }}
      >
        <div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b from-white/30 to-transparent pointer-events-none" />

        {/* 컨텐츠 영역 */}
        <div
          className={`relative z-10 w-full h-full flex ${
            isSmall
              ? "flex-col items-center justify-center gap-1" // Small: 중앙 정렬
              : "flex-col justify-between" // Medium/Large: 상하 배치
          }`}
        >
          {/* 상단 (아이콘 + 이름 + %) */}
          <div
            className={`flex ${
              isSmall ? "flex-col items-center" : "items-start gap-2"
            }`}
          >
            {/* 1. 프로필 이미지 */}
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
                  className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white/50 ${
                    isGrowing ? "bg-emerald-400" : "bg-rose-400"
                  }`}
                />
              </div>
            )}

            {/* 2. 텍스트 정보 (Small이 아닐 때만 표시) */}
            {!isSmall && (
              <div className="min-w-0 flex-1 pt-0.5">
                <p
                  className="text-[13px] font-bold text-gray-800 leading-tight truncate drop-shadow-sm"
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

            {/* 3. Small 모드 전용 퍼센트 */}
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

          {/* 4. 그래프 (Large 전용) */}
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

          {/* 5. Total Score (Medium 이상 표시) */}
          {!isSmall && (
            <div className="relative z-10 text-right mt-auto">
              <p className="text-[10px] uppercase tracking-wider text-gray-600 font-semibold mb-0.5 mix-blend-multiply">
                Total Score
              </p>
              <p className="text-sm font-black text-gray-800 tabular-nums tracking-tight">
                {Math.round(value).toLocaleString()}
              </p>
            </div>
          )}
        </div>
      </div>
    </foreignObject>
  );
};

// ... (이하 CustomTooltip 및 StorytellerClient 컴포넌트는 기존과 동일하게 유지)

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const item = data.itemData as ChannelData;
    if (!item) return null;
    return (
      <div className="bg-white/90 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-white/50 p-4 rounded-2xl text-sm z-50 min-w-[200px]">
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
            <p className="text-gray-500 text-xs">@{item.channelId}</p>
          </div>
        </div>
        <div className="space-y-2 bg-white/50 rounded-xl p-3 border border-white/60">
          <div className="flex justify-between items-center gap-4">
            <span className="text-gray-500 text-xs font-medium">
              Total Score
            </span>
            <span className="font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg text-xs">
              {Math.round(item.score).toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between items-center gap-4">
            <span className="text-gray-500 text-xs font-medium">
              Latest Daily
            </span>
            <span className="font-bold text-gray-800">
              {item.dailySeries && item.dailySeries.length > 0
                ? Math.round(
                    item.dailySeries[item.dailySeries.length - 1].dailyScore
                  ).toLocaleString()
                : "-"}
            </span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

export default function StorytellerClient({
  apiDataMap: initialApiDataMap,
  notionTasks,
  availableGroupIds,
  projectNames,
}: {
  apiDataMap: Record<string, any>;
  notionTasks: NotionTask[];
  availableGroupIds: string[];
  projectNames: Record<string, string>;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryGroupId = searchParams.get("groupId");

  const todayStr = useMemo(() => new Date().toLocaleDateString("en-CA"), []);

  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [selectedGroupId, setSelectedGroupId] = useState<string>(
    queryGroupId && availableGroupIds.includes(queryGroupId)
      ? queryGroupId
      : availableGroupIds[0] || "63"
  );

  const [currentDataMap, setCurrentDataMap] = useState(initialApiDataMap);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

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
      if (task && activeStatuses.includes(task.status)) {
        active.push(id);
      } else {
        finished.push(id);
      }
    });

    return { activeIds: active, finishedIds: finished };
  }, [availableGroupIds, notionTasks]);

  useEffect(() => {
    if (queryGroupId && availableGroupIds.includes(queryGroupId)) {
      if (selectedGroupId !== queryGroupId) {
        setSelectedGroupId(queryGroupId);
      }
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
          alert(`No data found for ${selectedDate}`);
          setSelectedDate(todayStr);
        }
      } catch (e) {
        console.error("Failed to fetch history:", e);
        alert("Failed to load historical data.");
      } finally {
        setIsLoadingHistory(false);
      }
    }

    fetchHistory();
  }, [selectedDate, selectedGroupId, todayStr, initialApiDataMap]);

  const currentApiData = currentDataMap[selectedGroupId];

  const { treeMapData, totalScore } = useMemo(() => {
    if (!currentApiData?.channels) return { treeMapData: [], totalScore: 0 };

    const channels: ChannelData[] = currentApiData.channels;
    const total = channels.reduce((sum, ch) => sum + ch.score, 0);

    const data = channels.map((ch) => {
      const rawSeries = ch.series || [];
      const dailySeries: DailyPoint[] = [];
      for (let i = 1; i < rawSeries.length; i++) {
        const prev = rawSeries[i - 1];
        const curr = rawSeries[i];
        const dailyScore = curr.score - prev.score;
        dailySeries.push({
          date: curr.date,
          dailyScore: dailyScore < 0 ? 0 : dailyScore,
        });
      }
      return {
        name: ch.channelTitle,
        value: ch.score,
        itemData: { ...ch, dailySeries },
      };
    });

    data.sort((a, b) => b.value - a.value);
    return { treeMapData: data, totalScore: total };
  }, [currentApiData]);

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
    <div className="min-h-screen bg-[#F5F5F7] text-[#1D1D1F] font-sans selection:bg-indigo-100 selection:text-indigo-900">
      <main className="max-w-[1600px] mx-auto px-6 py-12">
        <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight mb-2 text-transparent bg-clip-text bg-gradient-to-r from-gray-900 to-gray-600">
              Storyteller
            </h1>
            <p className="text-gray-500 text-lg font-medium">
              Influence Intelligence & Content Scheduling
            </p>
          </div>

          <div className="flex flex-col md:flex-row items-end md:items-center gap-6">
            <div className="flex flex-col items-end">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                {selectedDate !== todayStr && (
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                )}
                Time Machine
              </label>
              <div className="relative group">
                <input
                  type="date"
                  value={selectedDate}
                  max={todayStr}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className={`
                      appearance-none bg-white border rounded-xl px-4 py-2 text-sm font-bold shadow-sm outline-none transition-all duration-200
                      ${
                        selectedDate !== todayStr
                          ? "border-indigo-300 ring-2 ring-indigo-100 text-indigo-700"
                          : "border-gray-200 text-gray-700 hover:border-gray-300 focus:ring-2 focus:ring-gray-100"
                      }
                    `}
                />
                {selectedDate !== todayStr && (
                  <button
                    onClick={() => setSelectedDate(todayStr)}
                    className="absolute -bottom-6 right-0 text-[10px] text-indigo-500 hover:underline font-medium"
                  >
                    Reset to Today
                  </button>
                )}
              </div>
            </div>

            <div className="flex flex-col items-end gap-3 bg-white/50 p-2 rounded-xl border border-gray-200/60 backdrop-blur-sm min-w-[300px]">
              {activeIds.length > 0 && (
                <div className="w-full">
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 px-1">
                    Running
                  </div>
                  <div className="flex flex-wrap gap-2 justify-end">
                    {activeIds.map((id) => (
                      <button
                        key={id}
                        onClick={() => handleTabClick(id)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all duration-200 ${
                          selectedGroupId === id
                            ? "bg-white text-indigo-600 shadow-sm ring-1 ring-gray-100 scale-[1.02]"
                            : "text-gray-500 hover:text-gray-900 hover:bg-gray-100/50"
                        }`}
                      >
                        {projectNames[id] || `Project #${id}`}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {finishedIds.length > 0 && activeIds.length > 0 && (
                <div className="w-full h-px bg-gray-200/50 my-0.5" />
              )}

              {finishedIds.length > 0 && (
                <div className="w-full">
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 px-1 text-right">
                    Finished
                  </div>
                  <div className="flex flex-wrap gap-2 justify-end">
                    {finishedIds.map((id) => (
                      <button
                        key={id}
                        onClick={() => handleTabClick(id)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all duration-200 ${
                          selectedGroupId === id
                            ? "bg-gray-100 text-gray-600 shadow-inner ring-1 ring-gray-200/50"
                            : "text-gray-400 hover:text-gray-600 hover:bg-gray-100/30"
                        }`}
                      >
                        {projectNames[id] || `Project #${id}`}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 1. Liquid Glass TreeMap (Responsive Height) */}
        <div
          className="rounded-[40px] p-2 shadow-inner border border-white/50 mb-12 relative overflow-hidden bg-white/30 
                     h-[1000px] md:h-[700px]"
        >
          {isLoadingHistory && (
            <div className="absolute inset-0 z-50 bg-white/60 backdrop-blur-md flex flex-col items-center justify-center rounded-[32px] transition-all">
              <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4" />
              <div className="text-lg font-bold text-gray-600 animate-pulse">
                Traveling to {selectedDate}...
              </div>
            </div>
          )}

          <div className="absolute inset-0 z-0 flex items-center justify-center pointer-events-none opacity-[0.15] grayscale">
            <img
              src="/logo.png"
              alt="COMPANY WATERMARK"
              className="w-[500px] h-auto object-contain mix-blend-multiply"
            />
          </div>
          <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent pointer-events-none rounded-[32px]" />

          <div className="w-full h-full relative z-10">
            {treeMapData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <Treemap
                  data={treeMapData}
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
              <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-2">
                <p className="font-medium text-lg">No Data Available</p>
                <p className="text-sm">
                  {projectNames[selectedGroupId]} ({selectedDate})
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-[32px] p-8 shadow-xl shadow-gray-200/50 border border-white min-h-[500px]">
          <h2 className="text-2xl font-bold text-gray-900 mb-8 flex items-center gap-3">
            🗓️ All Content Schedules
            <span className="text-sm font-normal text-gray-400 bg-gray-50 px-2 py-1 rounded ml-2">
              Live Status
            </span>
          </h2>

          <div className="relative border border-gray-100 bg-gray-50/50 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto custom-scrollbar">
              <div className="min-w-[1000px] p-6 pt-12 relative min-h-[400px]">
                <div className="absolute inset-0 pointer-events-none">
                  {dateHeaders.map((h, i) => (
                    <div
                      key={i}
                      className="absolute top-0 bottom-0 border-l border-gray-200/60 border-dashed text-[10px] text-gray-400 pl-2 pt-2"
                      style={{ left: `${h.left}%` }}
                    >
                      {h.label}
                    </div>
                  ))}
                </div>

                <div className="space-y-4 relative z-10 mt-2">
                  {notionTasks.length > 0 ? (
                    notionTasks.map((task) => {
                      const left = getDatePosition(task.dateStart);
                      const width = Math.max(
                        getDurationWidth(task.dateStart, task.dateEnd),
                        5
                      );

                      return (
                        <div key={task.id} className="relative h-10 group">
                          <div
                            className={`absolute h-9 rounded-xl shadow-sm border px-3 flex items-center gap-3 text-xs font-semibold transition-all hover:scale-[1.02] hover:shadow-md cursor-pointer
                            ${
                              task.status === "Done" || task.status === "완료"
                                ? "bg-gray-100 text-gray-400 border-gray-200"
                                : task.status === "In Progress" ||
                                  task.status === "진행중"
                                ? "bg-blue-50 text-blue-700 border-blue-100"
                                : "bg-white text-gray-700 border-gray-200"
                            }`}
                            style={{
                              left: `${left}%`,
                              width: `${width}%`,
                              minWidth: "180px",
                            }}
                          >
                            <span
                              className={`w-2 h-2 rounded-full shrink-0 shadow-sm ${
                                task.category === "Video"
                                  ? "bg-red-500"
                                  : task.category === "Article"
                                  ? "bg-orange-500"
                                  : "bg-gray-400"
                              }`}
                            />
                            <span className="truncate flex-1 font-bold">
                              {task.title}
                            </span>
                            {task.managerImg && (
                              <img
                                src={task.managerImg}
                                alt=""
                                className="w-6 h-6 rounded-full border-2 border-white shadow-sm"
                              />
                            )}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-24 text-gray-400">
                      No active content schedules found.
                    </div>
                  )}
                </div>

                <div
                  className="absolute top-0 bottom-0 border-l-2 border-red-500/80 z-20 pointer-events-none"
                  style={{
                    left: `${getDatePosition(new Date().toISOString())}%`,
                  }}
                >
                  <div className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full absolute -top-1.5 -left-6 shadow-md">
                    Today
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
