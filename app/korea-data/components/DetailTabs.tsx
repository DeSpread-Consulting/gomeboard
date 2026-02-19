"use client";

import type {
  TelegramScoreData,
  SEOScoreData,
  YoutubeScoreData,
  ExchangeScoreData,
} from "../actions";
import TelegramDetail from "./TelegramDetail";
import SEODetail from "./SEODetail";
import YoutubeDetail from "./YoutubeDetail";
import ExchangeDetail from "./ExchangeDetail";

interface Props {
  activeTab: string;
  onTabChange: (tab: string) => void;
  telegramData: TelegramScoreData | null;
  seoData: SEOScoreData | null;
  youtubeData: YoutubeScoreData | null;
  exchangeData: ExchangeScoreData | null;
  isPostTge: boolean;
  telegramLoading: boolean;
  seoLoading: boolean;
  youtubeLoading: boolean;
  exchangeLoading: boolean;
  projectId: number;
  ticker: string;
}

const tabs = [
  { key: "telegram", label: "Telegram", icon: "\uD83D\uDCAC" },
  { key: "seo", label: "SEO", icon: "\uD83D\uDD0D" },
  { key: "youtube", label: "YouTube", icon: "\u25B6" },
  { key: "exchange", label: "Exchange", icon: "\uD83D\uDCB1" },
];

function TabSkeleton() {
  return (
    <div className="animate-pulse space-y-3 py-4">
      <div className="flex items-center gap-3">
        <div className="h-10 w-14 bg-gray-200 rounded-lg" />
        <div className="flex gap-2">
          <div className="h-12 w-20 bg-gray-100 rounded-lg" />
          <div className="h-12 w-20 bg-gray-100 rounded-lg" />
          <div className="h-12 w-20 bg-gray-100 rounded-lg" />
        </div>
      </div>
      <div className="h-[220px] bg-gray-100 rounded-lg" />
    </div>
  );
}

export default function DetailTabs({
  activeTab,
  onTabChange,
  telegramData,
  seoData,
  youtubeData,
  exchangeData,
  isPostTge,
  telegramLoading,
  seoLoading,
  youtubeLoading,
  exchangeLoading,
  projectId,
  ticker,
}: Props) {
  return (
    <div className="w-full bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Tab bar */}
      <div className="flex border-b border-gray-100">
        {tabs.map((tab) => {
          const disabled = tab.key === "exchange" && !isPostTge;
          return (
            <button
              key={tab.key}
              onClick={() => !disabled && onTabChange(tab.key)}
              disabled={disabled}
              className={`flex items-center gap-1 px-4 py-2.5 text-xs font-medium whitespace-nowrap transition-colors border-b-2 ${
                activeTab === tab.key
                  ? "border-[#0037F0] text-[#0037F0]"
                  : disabled
                  ? "border-transparent text-gray-300 cursor-not-allowed"
                  : "border-transparent text-gray-500 hover:text-gray-900"
              }`}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content — w-full + overflow-x-hidden locks the width */}
      <div className="w-full p-4 lg:p-6 overflow-x-hidden">
        {activeTab === "telegram" && (
          telegramLoading ? <TabSkeleton /> : <TelegramDetail data={telegramData} projectId={projectId} ticker={ticker} />
        )}
        {activeTab === "seo" && (
          seoLoading ? <TabSkeleton /> : <SEODetail data={seoData} ticker={ticker} />
        )}
        {activeTab === "youtube" && (
          youtubeLoading ? <TabSkeleton /> : <YoutubeDetail data={youtubeData} />
        )}
        {activeTab === "exchange" && (
          exchangeLoading ? <TabSkeleton /> : <ExchangeDetail data={exchangeData} />
        )}
      </div>
    </div>
  );
}
