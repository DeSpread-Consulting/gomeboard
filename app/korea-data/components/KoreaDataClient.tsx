"use client";

import { useState, useCallback, useEffect } from "react";
import ProjectSelector from "./ProjectSelector";
import ScoreCard from "./ScoreCard";
import DetailTabs from "./DetailTabs";
import RawDataPanel from "./RawDataPanel";
import NewsSection from "./NewsSection";
import type {
  ProjectItem,
  TelegramScoreData,
  SEOScoreData,
  YoutubeScoreData,
  ExchangeScoreData,
  NewsData,
} from "../actions";
import {
  fetchTelegramScore,
  fetchSEOScore,
  fetchYoutubeScore,
  fetchExchangeScore,
} from "../actions";

// ─── K-Score weights (news excluded, proportionally redistributed) ───
const K_SCORE_WEIGHTS = {
  preTge: { telegram: 0.59, seo: 0.23, youtube: 0.18, exchange: 0 },
  postTge: { telegram: 0.29, seo: 0.12, youtube: 0.12, exchange: 0.47 },
} as const;

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toString();
}

function computeKScore(
  isPostTge: boolean,
  telegram: TelegramScoreData | null,
  seo: SEOScoreData | null,
  youtube: YoutubeScoreData | null,
  exchange: ExchangeScoreData | null
): number {
  const w = isPostTge ? K_SCORE_WEIGHTS.postTge : K_SCORE_WEIGHTS.preTge;
  const scores: { score: number; weight: number }[] = [];

  if (telegram) scores.push({ score: telegram.score, weight: w.telegram });
  if (seo) scores.push({ score: seo.score, weight: w.seo });
  if (youtube) scores.push({ score: youtube.score, weight: w.youtube });
  if (exchange) scores.push({ score: exchange.score, weight: w.exchange });

  if (scores.length === 0) return 0;
  const totalWeight = scores.reduce((s, x) => s + x.weight, 0);
  return Math.round(
    scores.reduce((s, x) => s + x.score * (x.weight / totalWeight), 0)
  );
}

interface Props {
  initialProjects: ProjectItem[];
  initialNewsData: NewsData | null;
}

export default function KoreaDataClient({ initialProjects, initialNewsData }: Props) {
  const [projects] = useState(initialProjects);
  const [selected, setSelected] = useState<ProjectItem | null>(null);
  const [activeTab, setActiveTab] = useState<string>("telegram");

  // Individual score states for progressive loading
  const [telegramData, setTelegramData] = useState<TelegramScoreData | null>(null);
  const [seoData, setSeoData] = useState<SEOScoreData | null>(null);
  const [youtubeData, setYoutubeData] = useState<YoutubeScoreData | null>(null);
  const [exchangeData, setExchangeData] = useState<ExchangeScoreData | null>(null);

  // Individual loading states
  const [telegramLoading, setTelegramLoading] = useState(false);
  const [seoLoading, setSeoLoading] = useState(false);
  const [youtubeLoading, setYoutubeLoading] = useState(false);
  const [exchangeLoading, setExchangeLoading] = useState(false);

  // Derived K-Score
  const [kScore, setKScore] = useState<number | null>(null);
  const allLoaded = selected && !telegramLoading && !seoLoading && !youtubeLoading && !exchangeLoading;

  useEffect(() => {
    if (allLoaded) {
      setKScore(computeKScore(
        !!selected?.tge,
        telegramData,
        seoData,
        youtubeData,
        exchangeData
      ));
    }
  }, [allLoaded, selected, telegramData, seoData, youtubeData, exchangeData]);

  const handleSelectProject = useCallback(async (project: ProjectItem) => {
    setSelected(project);
    setActiveTab("telegram");
    setKScore(null);

    // Reset all data
    setTelegramData(null);
    setSeoData(null);
    setYoutubeData(null);
    setExchangeData(null);

    // Set all loading
    setTelegramLoading(true);
    setSeoLoading(true);
    setYoutubeLoading(true);
    setExchangeLoading(true);

    // Fire all fetches independently
    fetchTelegramScore(project.ticker, project.id).then((res) => {
      setTelegramData(res.data);
      setTelegramLoading(false);
    });

    fetchSEOScore(project.id).then((res) => {
      setSeoData(res.data);
      setSeoLoading(false);
    });

    fetchYoutubeScore(project.id).then((res) => {
      setYoutubeData(res.data);
      setYoutubeLoading(false);
    });

    if (project.tge) {
      fetchExchangeScore(project.ticker).then((res) => {
        setExchangeData(res.data);
        setExchangeLoading(false);
      });
    } else {
      setExchangeData(null);
      setExchangeLoading(false);
    }
  }, []);

  const isPostTge = selected?.tge ?? false;

  const scores = [
    {
      key: "telegram",
      label: "Telegram",
      icon: "\uD83D\uDCAC",
      score: telegramData?.score ?? null,
      subtitle: telegramData
        ? `${formatNumber(telegramData.totalMentions30d)} mentions`
        : undefined,
      available: true,
      loading: telegramLoading,
    },
    {
      key: "seo",
      label: "SEO",
      icon: "\uD83D\uDD0D",
      score: seoData?.score ?? null,
      subtitle: seoData?.monthlyTrend.length
        ? `${formatNumber(seoData.monthlyTrend[seoData.monthlyTrend.length - 1].totalVolume)} vol`
        : undefined,
      available: true,
      loading: seoLoading,
    },
    {
      key: "youtube",
      label: "YouTube",
      icon: "\u25B6",
      score: youtubeData?.score ?? null,
      subtitle: youtubeData
        ? `${youtubeData.videoCount} videos`
        : undefined,
      available: true,
      loading: youtubeLoading,
    },
    {
      key: "exchange",
      label: "Exchange",
      icon: "\uD83D\uDCB1",
      score: exchangeData?.score ?? null,
      subtitle: exchangeData
        ? `${exchangeData.exchanges.length} exchanges`
        : undefined,
      available: isPostTge,
      loading: exchangeLoading,
    },
  ];

  return (
    <div className="w-full max-w-[1400px] mx-auto px-8 py-6 overflow-x-hidden">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-lg font-bold text-gray-900">Korea Data</h1>
        <p className="text-xs text-gray-500 mt-0.5">
          {"\uD55C\uAD6D \uD06C\uB9BD\uD1A0 \uC2DC\uC7A5 \uB274\uC2A4 & \uD504\uB85C\uC81D\uD2B8 \uB370\uC774\uD130"}
        </p>
      </div>

      {/* ═══ Market News — top of page, always visible ═══ */}
      <NewsSection initialData={initialNewsData} />

      {/* ═══ Project Section ═══ */}
      <div className="mt-6">
        {/* Project Selector + K-Score Badge */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4">
          <ProjectSelector
            projects={projects}
            selected={selected}
            onSelect={handleSelectProject}
          />
          {selected && (
            <div className="flex items-center gap-2">
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                  isPostTge
                    ? "bg-blue-100 text-blue-700"
                    : "bg-green-100 text-green-700"
                }`}
              >
                {isPostTge ? "Post-TGE" : "Pre-TGE"}
              </span>
              {kScore !== null ? (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-gray-900">K-Score:</span>
                  <span
                    className={`text-2xl font-black ${
                      kScore >= 70
                        ? "text-green-600"
                        : kScore >= 40
                        ? "text-amber-600"
                        : "text-red-500"
                    }`}
                  >
                    {kScore}
                  </span>
                  <span className="text-xs text-gray-400">/100</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-gray-900">K-Score:</span>
                  <div className="h-6 w-10 bg-gray-200 rounded animate-pulse" />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Score Cards + Detail */}
        {selected ? (
          <div className="w-full overflow-x-hidden">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              {scores.map((s) =>
                s.loading ? (
                  <div
                    key={s.key}
                    className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 animate-pulse"
                  >
                    <div className="flex items-center gap-1.5 mb-2">
                      <div className="w-5 h-5 bg-gray-200 rounded-full" />
                      <div className="h-3 bg-gray-200 rounded w-14" />
                    </div>
                    <div className="h-6 bg-gray-200 rounded w-14 mb-1.5" />
                    <div className="h-2.5 bg-gray-100 rounded w-16 mb-2" />
                    <div className="h-1 bg-gray-100 rounded-full" />
                  </div>
                ) : (
                  <ScoreCard
                    key={s.key}
                    label={s.label}
                    icon={s.icon}
                    score={s.score}
                    subtitle={s.subtitle}
                    available={s.available}
                    active={activeTab === s.key}
                    onClick={() => s.available && setActiveTab(s.key)}
                  />
                )
              )}
            </div>

            {/* Detail Tabs */}
            <DetailTabs
              activeTab={activeTab}
              onTabChange={setActiveTab}
              telegramData={telegramData}
              seoData={seoData}
              youtubeData={youtubeData}
              exchangeData={exchangeData}
              isPostTge={isPostTge}
              telegramLoading={telegramLoading}
              seoLoading={seoLoading}
              youtubeLoading={youtubeLoading}
              exchangeLoading={exchangeLoading}
              projectId={selected.id}
              ticker={selected.ticker}
            />

            {/* Raw Data Debug Panel */}
            <RawDataPanel
              telegramData={telegramData}
              seoData={seoData}
              youtubeData={youtubeData}
              exchangeData={exchangeData}
              kScore={kScore}
              isPostTge={isPostTge}
              ticker={selected.ticker}
              projectId={selected.id}
            />
          </div>
        ) : (
          /* Empty state skeleton */
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="bg-white rounded-xl p-4 shadow-sm border border-gray-100"
                >
                  <div className="flex items-center gap-1.5 mb-2">
                    <div className="w-5 h-5 bg-gray-100 rounded-full" />
                    <div className="h-3 bg-gray-100 rounded w-14" />
                  </div>
                  <div className="h-6 bg-gray-100 rounded w-14 mb-1.5" />
                  <div className="h-2.5 bg-gray-100 rounded w-16 mb-2" />
                  <div className="h-1 bg-gray-100 rounded-full" />
                </div>
              ))}
            </div>

            <div className="bg-white rounded-xl p-10 shadow-sm border border-gray-100 text-center mb-4">
              <div className="text-2xl mb-3">{"\uD83D\uDD0E"}</div>
              <h3 className="text-sm font-bold text-gray-900 mb-1.5">
                {"\uD504\uB85C\uC81D\uD2B8\uB97C \uC120\uD0DD\uD558\uC138\uC694"}
              </h3>
              <p className="text-sm text-gray-500">
                {"\uC0C1\uB2E8 \uAC80\uC0C9\uCC3D\uC5D0\uC11C \uD504\uB85C\uC81D\uD2B8\uB97C \uAC80\uC0C9\uD558\uAC70\uB098 \uC120\uD0DD\uD558\uBA74"}
                <br />
                {"\uD55C\uAD6D \uC2DC\uC7A5 \uB370\uC774\uD130 \uC2A4\uCF54\uC5B4\uCE74\uB4DC\uAC00 \uD45C\uC2DC\uB429\uB2C8\uB2E4."}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
