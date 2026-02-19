"use client";

import type { YoutubeScoreData } from "../actions";

interface Props {
  data: YoutubeScoreData | null;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toString();
}

function formatDate(d: string): string {
  const date = new Date(d);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

export default function YoutubeDetail({ data }: Props) {
  if (!data) {
    return (
      <div className="text-center py-12 text-gray-400">
        <p className="text-sm">No YouTube data available for this project.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex items-center gap-3">
        <div>
          <div className="text-[10px] text-gray-500 uppercase font-bold mb-0.5">
            YouTube Score
          </div>
          <div className="text-2xl font-black text-gray-900">{data.score}</div>
        </div>
        <div className="flex gap-2">
          {[
            { label: "Videos (30d)", value: data.videoCount },
            { label: "Total Views", value: data.totalViews },
            { label: "Total Likes", value: data.totalLikes },
          ].map((m) => (
            <div
              key={m.label}
              className="bg-gray-50 rounded-lg p-3 text-center"
            >
              <div className="text-sm font-black text-gray-900">
                {formatNumber(m.value)}
              </div>
              <div className="text-[9px] text-gray-500 font-bold">
                {m.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Video List */}
      {data.videos.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-gray-900 mb-1">
            Recent Videos
          </h3>
          <p className="text-[10px] text-gray-500 mb-2">
            YouTube videos from the last 30 days mentioning this project
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                  <th className="py-2 px-1 font-medium">Title</th>
                  <th className="py-2 px-1 font-medium">Channel</th>
                  <th className="py-2 px-1 font-medium text-right">Views</th>
                  <th className="py-2 px-1 font-medium text-right">Likes</th>
                  <th className="py-2 px-1 font-medium text-right">Date</th>
                </tr>
              </thead>
              <tbody>
                {data.videos.map((v, i) => (
                  <tr
                    key={i}
                    className="border-b border-gray-50 hover:bg-gray-50"
                  >
                    <td className="py-2 font-medium text-gray-900 max-w-[300px]">
                      <a
                        href={`https://youtube.com/watch?v=${v.videoId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-[#0037F0] transition-colors truncate block"
                        title={v.title}
                      >
                        {v.title}
                      </a>
                    </td>
                    <td className="py-2 text-gray-500 max-w-[150px] truncate">
                      {v.channelTitle}
                    </td>
                    <td className="py-2 text-right text-gray-700">
                      {formatNumber(v.viewCount)}
                    </td>
                    <td className="py-2 text-right text-gray-700">
                      {formatNumber(v.likeCount)}
                    </td>
                    <td className="py-2 text-right text-gray-500">
                      {formatDate(v.publishedAt)}
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
                const avgViews = data.videoCount > 0
                  ? Math.round(data.totalViews / data.videoCount)
                  : 0;
                const avgLikes = data.videoCount > 0
                  ? Math.round(data.totalLikes / data.videoCount)
                  : 0;
                const engagementRate = data.totalViews > 0
                  ? ((data.totalLikes / data.totalViews) * 100).toFixed(1)
                  : "0";

                if (data.videoCount >= 10)
                  return `High coverage with ${data.videoCount} videos. Avg ${formatNumber(avgViews)} views and ${formatNumber(avgLikes)} likes per video (${engagementRate}% engagement).`;
                if (data.videoCount >= 3)
                  return `Moderate YouTube presence \u2014 ${data.videoCount} videos averaging ${formatNumber(avgViews)} views each.`;
                return `Limited YouTube coverage with ${data.videoCount} video(s) in the last 30 days.`;
              })()}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
