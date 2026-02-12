"use client";

import { useState } from "react";
import PulseWidgets from "./PulseWidgets";
import ShillToVolumeBubble from "./ShillToVolumeBubble";
import NarrativeQualityBoard from "./NarrativeQualityBoard";
import MediaSocialDivergence from "./MediaSocialDivergence";
import AlphaLeakTimeline from "./AlphaLeakTimeline";
import HiddenOriginChart from "./HiddenOriginChart";
import RetailIntentSpectrum from "./RetailIntentSpectrum";
import SEOBattlefield from "./SEOBattlefield";
import type {
  PulseData,
  ShillItem,
  NarrativeItem,
  MediaDivergencePoint,
  AlphaLeakItem,
  HiddenOriginItem,
  RetailIntentItem,
  SEOItem,
} from "../actions";
import {
  fetchPulseWidgets,
  fetchShillIndex,
  fetchNarrativeQuality,
  fetchMediaDivergence,
  fetchAlphaLeak,
  fetchHiddenOrigin,
  fetchRetailIntent,
  fetchSEOBattlefield,
} from "../actions";

interface Props {
  initialPulse: PulseData | null;
  initialShill: ShillItem[];
  initialNarrative: NarrativeItem[];
  initialMedia: MediaDivergencePoint[];
  initialAlpha: AlphaLeakItem[];
  initialOrigin: HiddenOriginItem[];
  initialIntent: RetailIntentItem[];
  initialSeo: SEOItem[];
}

export default function KoreaInsightsClient({
  initialPulse,
  initialShill,
  initialNarrative,
  initialMedia,
  initialAlpha,
  initialOrigin,
  initialIntent,
  initialSeo,
}: Props) {
  const [pulse, setPulse] = useState(initialPulse);
  const [shill, setShill] = useState(initialShill);
  const [narrative, setNarrative] = useState(initialNarrative);
  const [media, setMedia] = useState(initialMedia);
  const [alpha, setAlpha] = useState(initialAlpha);
  const [origin, setOrigin] = useState(initialOrigin);
  const [intent, setIntent] = useState(initialIntent);
  const [seo, setSeo] = useState(initialSeo);
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    const [p, s, n, m, a, o, i, se] = await Promise.all([
      fetchPulseWidgets(),
      fetchShillIndex(),
      fetchNarrativeQuality(),
      fetchMediaDivergence(),
      fetchAlphaLeak(),
      fetchHiddenOrigin(),
      fetchRetailIntent(),
      fetchSEOBattlefield(),
    ]);
    if (p.data) setPulse(p.data);
    if (s.data) setShill(s.data);
    if (n.data) setNarrative(n.data);
    if (m.data) setMedia(m.data);
    if (a.data) setAlpha(a.data);
    if (o.data) setOrigin(o.data);
    if (i.data) setIntent(i.data);
    if (se.data) setSeo(se.data);
    setRefreshing(false);
  };

  return (
    <div className="max-w-[1600px] mx-auto px-6 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Korea Market Insights
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            한국 크립토 시장 내러티브 인텔리전스
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            refreshing
              ? "bg-gray-100 text-gray-400 cursor-not-allowed"
              : "bg-[#0037F0] text-white hover:bg-blue-700 shadow-brand-glow"
          }`}
        >
          {refreshing ? "새로고침 중..." : "새로고침"}
        </button>
      </div>

      {/* Row 1: Pulse Widgets */}
      <PulseWidgets data={pulse} />

      {/* Row 2: Shill (60%) + Narrative (40%) */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-6">
        <div className="lg:col-span-3">
          <ShillToVolumeBubble data={shill} />
        </div>
        <div className="lg:col-span-2">
          <NarrativeQualityBoard data={narrative} />
        </div>
      </div>

      {/* Row 3: Media (50%) + Alpha (50%) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <MediaSocialDivergence initialData={media} />
        <AlphaLeakTimeline data={alpha} />
      </div>

      {/* Row 4: Hidden Origin (50%) + Retail Intent (50%) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <HiddenOriginChart data={origin} />
        <RetailIntentSpectrum initialData={intent} />
      </div>

      {/* Row 5: SEO Battlefield (100%) */}
      <SEOBattlefield data={seo} />
    </div>
  );
}
