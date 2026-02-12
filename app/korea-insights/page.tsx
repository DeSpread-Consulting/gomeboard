import KoreaInsightsClient from "./components/KoreaInsightsClient";
import {
  fetchPulseWidgets,
  fetchShillIndex,
  fetchNarrativeQuality,
  fetchMediaDivergence,
  fetchAlphaLeak,
} from "./actions";

export const revalidate = 300; // 5 min ISR

export default async function KoreaInsightsPage() {
  const [pulseRes, shillRes, narrativeRes, mediaRes, alphaRes] =
    await Promise.all([
      fetchPulseWidgets(),
      fetchShillIndex(),
      fetchNarrativeQuality(),
      fetchMediaDivergence(),
      fetchAlphaLeak(),
    ]);

  return (
    <KoreaInsightsClient
      initialPulse={pulseRes.data}
      initialShill={shillRes.data}
      initialNarrative={narrativeRes.data}
      initialMedia={mediaRes.data}
      initialAlpha={alphaRes.data}
    />
  );
}
