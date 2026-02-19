"use client";

import { useState } from "react";
import type {
  TelegramScoreData,
  SEOScoreData,
  YoutubeScoreData,
  ExchangeScoreData,
} from "../actions";

interface Props {
  telegramData: TelegramScoreData | null;
  seoData: SEOScoreData | null;
  youtubeData: YoutubeScoreData | null;
  exchangeData: ExchangeScoreData | null;
  kScore: number | null;
  isPostTge: boolean;
  ticker: string;
  projectId: number;
}

function JsonBlock({ label, data }: { label: string; data: unknown }) {
  const [open, setOpen] = useState(false);
  const jsonStr = JSON.stringify(data, null, 2);
  const lines = jsonStr.split("\n").length;

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
      >
        <span className="text-xs font-bold text-gray-700">{label}</span>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-400">
            {lines} lines
          </span>
          <span className="text-xs text-gray-400">{open ? "\u25BC" : "\u25B6"}</span>
        </div>
      </button>
      {open && (
        <pre className="p-4 text-[11px] leading-relaxed text-gray-700 bg-white overflow-x-auto max-h-[500px] overflow-y-auto">
          {jsonStr}
        </pre>
      )}
    </div>
  );
}

export default function RawDataPanel({
  telegramData,
  seoData,
  youtubeData,
  exchangeData,
  kScore,
  isPostTge,
  ticker,
  projectId,
}: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-6">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-xs font-bold text-gray-400 hover:text-gray-600 transition-colors mb-3"
      >
        <span>{open ? "\u25BC" : "\u25B6"}</span>
        Raw Data (Debug)
      </button>

      {open && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
          {/* Meta info */}
          <div className="flex flex-wrap gap-4 text-xs text-gray-500 mb-2">
            <span>
              <span className="font-bold text-gray-700">Ticker:</span> {ticker}
            </span>
            <span>
              <span className="font-bold text-gray-700">Project ID:</span>{" "}
              {projectId}
            </span>
            <span>
              <span className="font-bold text-gray-700">K-Score:</span>{" "}
              {kScore ?? "loading..."}
            </span>
            <span>
              <span className="font-bold text-gray-700">Post-TGE:</span>{" "}
              {String(isPostTge)}
            </span>
          </div>

          {/* Score summary */}
          <div className="grid grid-cols-4 gap-2 text-xs">
            {[
              { label: "Telegram", score: telegramData?.score, hasData: !!telegramData },
              { label: "SEO", score: seoData?.score, hasData: !!seoData },
              { label: "YouTube", score: youtubeData?.score, hasData: !!youtubeData },
              { label: "Exchange", score: exchangeData?.score, hasData: !!exchangeData },
            ].map((s) => (
              <div
                key={s.label}
                className={`rounded-lg px-3 py-2 text-center ${
                  s.hasData ? "bg-green-50 text-green-700" : "bg-red-50 text-red-500"
                }`}
              >
                <div className="font-bold">{s.label}</div>
                <div>{s.hasData ? s.score : "null"}</div>
              </div>
            ))}
          </div>

          {/* Raw JSON for each data source */}
          <div className="space-y-2">
            {telegramData && (
              <JsonBlock
                label={`Telegram \u2014 ${telegramData.dailyMentions.length} daily rows, ${telegramData.topChannels.length} channels, ${telegramData.hourlyHeatmap.length} heatmap cells`}
                data={telegramData}
              />
            )}
            {!telegramData && (
              <div className="text-xs text-red-400 bg-red-50 rounded-lg px-4 py-2">
                Telegram: null (no data returned)
              </div>
            )}

            {seoData && (
              <JsonBlock
                label={`SEO \u2014 ${seoData.monthlyTrend.length} monthly rows`}
                data={seoData}
              />
            )}
            {!seoData && (
              <div className="text-xs text-red-400 bg-red-50 rounded-lg px-4 py-2">
                SEO: null (no data returned)
              </div>
            )}

            {youtubeData && (
              <JsonBlock
                label={`YouTube \u2014 ${youtubeData.videoCount} videos, ${youtubeData.totalViews} views`}
                data={youtubeData}
              />
            )}
            {!youtubeData && (
              <div className="text-xs text-red-400 bg-red-50 rounded-lg px-4 py-2">
                YouTube: null (no data returned)
              </div>
            )}

            {exchangeData && (
              <JsonBlock
                label={`Exchange \u2014 ${exchangeData.exchanges.length} exchanges`}
                data={exchangeData}
              />
            )}
            {!exchangeData && (
              <div className="text-xs text-gray-400 bg-gray-50 rounded-lg px-4 py-2">
                Exchange: null {isPostTge ? "(no data)" : "(Pre-TGE, skipped)"}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
