"use client";

import { useState, useEffect } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { TelegramScoreData, TelegramSampleMessage } from "../actions";
import { fetchTelegramSamples } from "../actions";

interface Props {
  data: TelegramScoreData | null;
  projectId: number;
  ticker: string;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toString();
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function TelegramDetail({ data, projectId, ticker }: Props) {
  const [samples, setSamples] = useState<TelegramSampleMessage[]>([]);
  const [samplesLoading, setSamplesLoading] = useState(false);

  useEffect(() => {
    if (!data) return;
    setSamplesLoading(true);
    fetchTelegramSamples(projectId, ticker).then((res) => {
      setSamples(res.data);
      setSamplesLoading(false);
    });
  }, [data, projectId, ticker]);

  if (!data) {
    return (
      <div className="text-center py-12 text-gray-400">
        <p className="text-sm">No Telegram data available for this project.</p>
      </div>
    );
  }

  // Build heatmap grid: 7 rows (days) x 24 cols (hours)
  const heatmapGrid: number[][] = Array.from({ length: 7 }, () =>
    Array(24).fill(0)
  );
  let maxMentions = 0;
  for (const h of data.hourlyHeatmap) {
    heatmapGrid[h.dayOfWeek][h.hour] = h.mentions;
    if (h.mentions > maxMentions) maxMentions = h.mentions;
  }

  return (
    <div className="space-y-4">
      {/* Summary Metrics */}
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <div className="text-[10px] text-gray-500 uppercase font-bold mb-0.5">
            Telegram Score
          </div>
          <div className="text-2xl font-black text-gray-900">{data.score}</div>
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            { label: "Mentions (30d)", value: formatNumber(data.totalMentions30d) },
            {
              label: "Trend (7d)",
              value: `${data.mentionTrend > 0 ? "+" : ""}${data.mentionTrend}%`,
              color:
                data.mentionTrend > 0
                  ? "text-green-600"
                  : data.mentionTrend < 0
                  ? "text-red-500"
                  : "text-gray-900",
            },
            { label: "Channels", value: data.uniqueChannels.toString() },
          ].map((m) => (
            <div
              key={m.label}
              className="bg-gray-50 rounded-lg p-3 text-center"
            >
              <div
                className={`text-sm font-black ${m.color || "text-gray-900"}`}
              >
                {m.value}
              </div>
              <div className="text-[9px] text-gray-500 font-bold">
                {m.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* High Impact Mentions — fixed height prevents layout shift during async load */}
      <div className="min-h-[120px]">
        <h3 className="text-sm font-bold text-gray-900 mb-1">
          High Impact Mentions
        </h3>
        <p className="text-[10px] text-gray-500 mb-2">
          Most impactful messages from top channels in the last 7 days
        </p>
        {samplesLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {[1, 2].map((i) => (
              <div key={i} className="bg-gray-50 rounded-lg p-3 animate-pulse h-[90px]">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
                <div className="h-4 bg-gray-200 rounded w-full mb-2" />
                <div className="h-4 bg-gray-200 rounded w-1/2 mb-3" />
                <div className="flex gap-2">
                  <div className="h-5 bg-gray-200 rounded-full w-20" />
                  <div className="h-5 bg-gray-200 rounded-full w-16" />
                </div>
              </div>
            ))}
          </div>
        ) : samples.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {samples.map((msg, i) => (
              <div
                key={i}
                className="bg-gray-50 rounded-lg p-3 border border-gray-100 h-[90px] overflow-hidden"
              >
                <p className="text-xs text-gray-700 leading-relaxed line-clamp-3">
                  {msg.content.length > 200
                    ? msg.content.slice(0, 200) + "..."
                    : msg.content}
                </p>
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  <span className="px-2 py-0.5 rounded-full bg-[#0037F0]/10 text-[#0037F0] text-[10px] font-bold">
                    {msg.channelName}
                  </span>
                  {msg.viewsCount > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-[10px] font-bold">
                      {formatNumber(msg.viewsCount)} views
                    </span>
                  )}
                  {msg.forwardsCount > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-[10px] font-bold">
                      {formatNumber(msg.forwardsCount)} forwards
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <p className="text-[10px] text-gray-400">
              No recent high-impact mentions found.
            </p>
          </div>
        )}
      </div>

      {/* Daily Mentions Chart */}
      {data.dailyMentions.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-gray-900 mb-1">
            Daily Mentions
          </h3>
          <p className="text-[10px] text-gray-500 mb-2">
            Last 30 days mention trend across all tracked channels
          </p>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.dailyMentions}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: "#94a3b8" }}
                  tickFormatter={(v: string) => v.slice(5)}
                />
                <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} tickFormatter={formatNumber} />
                <Tooltip
                  contentStyle={{
                    borderRadius: 8,
                    border: "1px solid #e5e7eb",
                    fontSize: 10,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="mentions"
                  stroke="#0037F0"
                  strokeWidth={1.5}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Hourly Heatmap (7 days x 24 hours) */}
      {data.hourlyHeatmap.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-gray-900 mb-1">
            Hourly Activity Heatmap
          </h3>
          <p className="text-[10px] text-gray-500 mb-2">
            7-day mention distribution by day and hour (UTC)
          </p>
          <div className="overflow-x-auto">
            <div className="min-w-[600px]">
              {/* Hour labels */}
              <div className="flex ml-10">
                {Array.from({ length: 24 }, (_, i) => (
                  <div
                    key={i}
                    className="flex-1 text-center text-[9px] text-gray-400"
                  >
                    {i % 3 === 0 ? `${i}h` : ""}
                  </div>
                ))}
              </div>
              {/* Grid rows */}
              {heatmapGrid.map((hours, dayIdx) => (
                <div key={dayIdx} className="flex items-center gap-1 mb-0.5">
                  <div className="w-9 text-[10px] text-gray-500 font-medium text-right pr-1">
                    {DAY_LABELS[dayIdx]}
                  </div>
                  <div className="flex flex-1 gap-px">
                    {hours.map((count, hourIdx) => {
                      const intensity =
                        maxMentions > 0 ? count / maxMentions : 0;
                      return (
                        <div
                          key={hourIdx}
                          className="flex-1 aspect-square rounded-sm"
                          style={{
                            backgroundColor: `rgba(0, 55, 240, ${
                              intensity * 0.85 + (count > 0 ? 0.1 : 0.02)
                            })`,
                          }}
                          title={`${DAY_LABELS[dayIdx]} ${hourIdx}:00 \u2014 ${count} mentions`}
                        />
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Top Channels Table */}
      {data.topChannels.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-gray-900 mb-1">
            Top Channels
          </h3>
          <p className="text-[10px] text-gray-500 mb-2">
            Most active channels mentioning this project in the last 30 days
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                  <th className="py-2 px-1 font-medium w-8">#</th>
                  <th className="py-2 px-1 font-medium">Channel</th>
                  <th className="py-2 px-1 font-medium">Tier</th>
                  <th className="py-2 px-1 font-medium text-right">Mentions</th>
                  <th className="py-2 px-1 font-medium text-right">Subscribers</th>
                  <th className="py-2 px-1 font-medium text-right">Median Views</th>
                </tr>
              </thead>
              <tbody>
                {data.topChannels.map((ch, i) => (
                  <tr
                    key={ch.channelId}
                    className="border-b border-gray-50 hover:bg-gray-50"
                  >
                    <td className="py-2 text-gray-400 text-xs">{i + 1}</td>
                    <td className="py-2 font-medium text-gray-900 max-w-[200px] truncate">
                      {ch.channelName}
                    </td>
                    <td className="py-2">
                      {ch.tier ? (
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                            ch.tier === "A+" || ch.tier === "A"
                              ? "bg-green-100 text-green-700"
                              : ch.tier === "B+" || ch.tier === "B"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {ch.tier}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </td>
                    <td className="py-2 text-right font-bold text-gray-900">
                      {formatNumber(ch.mentionCount)}
                    </td>
                    <td className="py-2 text-right text-gray-700">
                      {ch.participantsCount
                        ? formatNumber(ch.participantsCount)
                        : "-"}
                    </td>
                    <td className="py-2 text-right text-gray-700">
                      {ch.medianViews
                        ? formatNumber(Math.round(ch.medianViews))
                        : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Insight Box */}
          <div className="mt-4 p-3 rounded-xl bg-gray-50 border border-gray-100">
            <p className="text-xs text-gray-600">
              <span className="font-bold text-gray-900">Insight: </span>
              {(() => {
                const topTier = data.topChannels.filter(
                  (ch) => ch.tier === "A+" || ch.tier === "A"
                ).length;
                const trendUp = data.mentionTrend > 0;
                const trendStrong = Math.abs(data.mentionTrend) > 20;

                if (trendUp && topTier >= 2)
                  return `Mentions rising ${data.mentionTrend}% with ${topTier} top-tier channels active \u2014 strong organic momentum.`;
                if (trendUp)
                  return `Mentions trending up ${data.mentionTrend}% over 7 days across ${data.uniqueChannels} channels.`;
                if (trendStrong && !trendUp)
                  return `Mentions declining ${data.mentionTrend}% \u2014 monitor for continued drop in community engagement.`;
                return `Mentions stable across ${data.uniqueChannels} channels with ${data.topChannels.length} active contributors.`;
              })()}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
