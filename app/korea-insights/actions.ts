"use server";

import { queryKolDb, getCmcPartitionTable } from "@/utils/supabase/kol-db";

// ─── Types ───────────────────────────────────────────────

export interface PulseData {
  btcMentions: number;
  btcMentionsDelta: number; // % change vs previous day
  avgTrendingScore: number;
  naverSearchVolume: number;
  naverSearchDelta: number; // % change vs previous month
  koreanExchangeVolume: number; // USD
}

export interface ShillItem {
  ticker: string;
  mentions: number;
  volumeUsd: number;
  avgPriceUsd: number;
  shillIndex: number | null;
  logo: string | null;
}

export interface NarrativeItem {
  ticker: string;
  logo: string | null;
  totalMentions: number;
  gradeA: number;
  gradeB: number;
  gradeC: number;
  gradeD: number;
  avgScore: number | null;
  avgViews: number | null;
}

export interface MediaDivergencePoint {
  date: string;
  newsCount: number;
  telegramMentions: number;
}

export interface AlphaLeakItem {
  keyword: string;
  ticker: string | null;
  alphaFirstSeen: string;
  retailFirstSeen: string;
  lagHours: number;
  alphaMentions: number;
  retailMentions: number;
}

export interface HiddenOriginItem {
  channelTitle: string;
  username: string | null;
  tier: string | null;
  forwardCount: number;
  totalViewsGenerated: number;
}

export interface RetailIntentItem {
  relatedKeyword: string;
  searchVolume: number;
  intentCategory: "Investment" | "Onboarding" | "Technology" | "General";
}

export interface SEOItem {
  domain: string;
  metric: number;
  platform: "Google" | "Naver";
}

// ─── Pulse Widgets ───────────────────────────────────────

export async function fetchPulseWidgets(): Promise<{
  data: PulseData | null;
  error: string | null;
}> {
  try {
    const partition = getCmcPartitionTable();

    // BTC mentions today vs yesterday
    const btcMentions = await queryKolDb<{
      stats_date: string;
      total: string;
    }>(`
      SELECT stats_date, SUM(mention_count) as total
      FROM telegram.daily_keyword_stats
      WHERE ticker = 'BTC'
        AND stats_date >= CURRENT_DATE - INTERVAL '2 days'
      GROUP BY stats_date
      ORDER BY stats_date DESC
      LIMIT 2
    `);

    const todayMentions = Number(btcMentions[0]?.total || 0);
    const yesterdayMentions = Number(btcMentions[1]?.total || 1);
    const btcDelta =
      ((todayMentions - yesterdayMentions) / yesterdayMentions) * 100;

    // Average trending score (last 6 hours)
    const trending = await queryKolDb<{ avg_score: string }>(`
      SELECT AVG(trending_score) as avg_score
      FROM telegram.views_growth_tracking
      WHERE hour_bucket > NOW() - INTERVAL '6 hours'
    `);

    // Naver monthly search volume (latest 2 months for delta)
    const naverSearch = await queryKolDb<{
      year_month: string;
      total_volume: string;
    }>(`
      SELECT nss.year_month, nss.total_volume
      FROM search_analytics.monthly_naver_search_stats nss
      JOIN search_analytics.keywords k ON nss.keyword_id = k.id
      WHERE k.keyword = '비트코인'
      ORDER BY nss.year_month DESC
      LIMIT 2
    `);

    const latestNaver = Number(naverSearch[0]?.total_volume || 0);
    const prevNaver = Number(naverSearch[1]?.total_volume || 1);
    const naverDelta = ((latestNaver - prevNaver) / prevNaver) * 100;

    // Korean exchange total volume (latest day)
    const volume = await queryKolDb<{ total_vol: string }>(`
      SELECT SUM(emp.volume_usd) as total_vol
      FROM crypto_market."${partition}" emp
      JOIN crypto_market.exchanges e ON emp.exchange_id = e.id
      WHERE e.name IN ('upbit', 'bithumb', 'coinone', 'korbit', 'gopax')
        AND emp.last_updated > NOW() - INTERVAL '1 day'
        AND emp.market_pair LIKE '%/KRW'
    `);

    return {
      data: {
        btcMentions: todayMentions,
        btcMentionsDelta: Math.round(btcDelta * 10) / 10,
        avgTrendingScore:
          Math.round(Number(trending[0]?.avg_score || 0) * 100) / 100,
        naverSearchVolume: latestNaver,
        naverSearchDelta: Math.round(naverDelta * 10) / 10,
        koreanExchangeVolume: Number(volume[0]?.total_vol || 0),
      },
      error: null,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("fetchPulseWidgets error:", message);
    return { data: null, error: message };
  }
}

// ─── Shill-to-Volume Bubble Chart ────────────────────────

export async function fetchShillIndex(): Promise<{
  data: ShillItem[];
  error: string | null;
}> {
  try {
    const partition = getCmcPartitionTable();

    const rows = await queryKolDb<{
      ticker: string;
      total_mentions: string;
      total_vol_usd: string;
      avg_price_usd: string;
      shill_index: string | null;
      logo: string | null;
    }>(`
      WITH telegram_hype AS (
        SELECT ticker, SUM(mention_count) as total_mentions
        FROM telegram.daily_keyword_stats
        WHERE stats_date >= CURRENT_DATE - INTERVAL '1 day'
        GROUP BY ticker
        HAVING SUM(mention_count) >= 5
      ),
      korean_volume AS (
        SELECT
          c.symbol as ticker,
          SUM(emp.volume_usd) as total_vol_usd,
          AVG(emp.price) as avg_price_usd
        FROM crypto_market."${partition}" emp
        JOIN crypto_market.currencies c ON emp.currency_id = c.id
        JOIN crypto_market.exchanges e ON emp.exchange_id = e.id
        WHERE e.name IN ('upbit', 'bithumb', 'coinone', 'korbit', 'gopax')
          AND emp.last_updated > NOW() - INTERVAL '1 day'
          AND emp.market_pair LIKE '%/KRW'
        GROUP BY c.symbol
      ),
      project_logos AS (
        SELECT DISTINCT ON (p.ticker) p.ticker, p.logo
        FROM telegram.projects p
        WHERE p.logo IS NOT NULL
      )
      SELECT
        th.ticker,
        th.total_mentions,
        COALESCE(kv.total_vol_usd, 0) as total_vol_usd,
        COALESCE(kv.avg_price_usd, 0) as avg_price_usd,
        CASE
          WHEN kv.total_vol_usd > 0
          THEN (th.total_mentions::float / kv.total_vol_usd) * 1000000
          ELSE NULL
        END as shill_index,
        pl.logo
      FROM telegram_hype th
      LEFT JOIN korean_volume kv ON UPPER(th.ticker) = UPPER(kv.ticker)
      LEFT JOIN project_logos pl ON UPPER(th.ticker) = UPPER(pl.ticker)
      ORDER BY th.total_mentions DESC
      LIMIT 50
    `);

    return {
      data: rows.map((r) => ({
        ticker: r.ticker,
        mentions: Number(r.total_mentions),
        volumeUsd: Number(r.total_vol_usd),
        avgPriceUsd: Number(r.avg_price_usd),
        shillIndex: r.shill_index ? Number(r.shill_index) : null,
        logo: r.logo || null,
      })),
      error: null,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("fetchShillIndex error:", message);
    return { data: [], error: message };
  }
}

// ─── Narrative Quality Board ─────────────────────────────

export async function fetchNarrativeQuality(): Promise<{
  data: NarrativeItem[];
  error: string | null;
}> {
  try {
    const rows = await queryKolDb<{
      ticker: string;
      logo: string | null;
      total_mentions: string;
      grade_a: string;
      grade_b: string;
      grade_c: string;
      grade_d: string;
      avg_score: string | null;
      avg_views: string | null;
    }>(`
      WITH trending AS (
        SELECT
          p.id as project_id,
          p.ticker,
          p.logo,
          SUM(dks.mention_count) as total_mentions
        FROM telegram.daily_keyword_stats dks
        JOIN telegram.project_keywords pk ON dks.keyword = pk.keyword
        JOIN telegram.projects p ON pk.project_id = p.id
        WHERE dks.stats_date > CURRENT_DATE - INTERVAL '7 days'
        GROUP BY p.id, p.ticker, p.logo
        ORDER BY total_mentions DESC
        LIMIT 15
      ),
      grades AS (
        SELECT
          tkg.name,
          COALESCE(SUM(CASE WHEN smg.grade = 'A' THEN 1 ELSE 0 END), 0) as grade_a,
          COALESCE(SUM(CASE WHEN smg.grade = 'B' THEN 1 ELSE 0 END), 0) as grade_b,
          COALESCE(SUM(CASE WHEN smg.grade = 'C' THEN 1 ELSE 0 END), 0) as grade_c,
          COALESCE(SUM(CASE WHEN smg.grade = 'D' THEN 1 ELSE 0 END), 0) as grade_d
        FROM storyteller.storyteller_message_grades smg
        JOIN telegram.tracking_keyword_groups tkg
          ON smg.tracking_keyword_group_id = tkg.id
        WHERE smg.created_at > NOW() - INTERVAL '7 days'
        GROUP BY tkg.name
      ),
      scores AS (
        SELECT
          sl.tracking_keyword_group_id as group_id,
          tkg.name,
          AVG(sls.score) as avg_score,
          AVG(sls.avg_channel_views) as avg_views
        FROM storyteller.storyteller_leaderboard_scores sls
        JOIN storyteller.storyteller_leaderboards sl
          ON sls.group_id = sl.id
        JOIN telegram.tracking_keyword_groups tkg
          ON sl.tracking_keyword_group_id = tkg.id
        WHERE sls.stats_date > CURRENT_DATE - INTERVAL '7 days'
          AND sls.lookback_days = 7
        GROUP BY sl.tracking_keyword_group_id, tkg.name
      )
      SELECT
        t.ticker,
        t.logo,
        t.total_mentions,
        COALESCE(g.grade_a, 0) as grade_a,
        COALESCE(g.grade_b, 0) as grade_b,
        COALESCE(g.grade_c, 0) as grade_c,
        COALESCE(g.grade_d, 0) as grade_d,
        s.avg_score,
        s.avg_views
      FROM trending t
      LEFT JOIN grades g ON LOWER(g.name) = LOWER(t.ticker)
      LEFT JOIN scores s ON LOWER(s.name) = LOWER(t.ticker)
      ORDER BY t.total_mentions DESC
    `);

    return {
      data: rows.map((r) => ({
        ticker: r.ticker,
        logo: r.logo,
        totalMentions: Number(r.total_mentions),
        gradeA: Number(r.grade_a),
        gradeB: Number(r.grade_b),
        gradeC: Number(r.grade_c),
        gradeD: Number(r.grade_d),
        avgScore: r.avg_score ? Number(r.avg_score) : null,
        avgViews: r.avg_views ? Number(r.avg_views) : null,
      })),
      error: null,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("fetchNarrativeQuality error:", message);
    return { data: [], error: message };
  }
}

// ─── Media vs Social Divergence ──────────────────────────

// 한국어 검색 키워드 → 텔레그램 ticker 매핑
const KEYWORD_TO_TICKER: Record<string, string> = {
  "비트코인": "BTC",
  "이더리움": "ETH",
  "솔라나": "SOL",
  "리플": "XRP",
};

export async function fetchMediaDivergence(
  keyword: string = "비트코인"
): Promise<{
  data: MediaDivergencePoint[];
  error: string | null;
}> {
  try {
    const ticker = KEYWORD_TO_TICKER[keyword] || "BTC";

    const rows = await queryKolDb<{
      the_date: string;
      news_count: string;
      telegram_mentions: string;
    }>(`
      WITH date_series AS (
        SELECT generate_series(
          CURRENT_DATE - INTERVAL '30 days',
          CURRENT_DATE,
          '1 day'::interval
        )::date as the_date
      ),
      google_daily AS (
        SELECT
          DATE(gnr.collection_timestamp) as news_date,
          COUNT(*) as news_count
        FROM search_analytics.google_news_results gnr
        JOIN search_analytics.keywords k ON gnr.keyword_id = k.id
        WHERE k.keyword = $1
          AND gnr.collection_timestamp > NOW() - INTERVAL '30 days'
        GROUP BY DATE(gnr.collection_timestamp)
      ),
      telegram_daily AS (
        SELECT
          dks.stats_date,
          SUM(dks.mention_count) as mentions
        FROM telegram.daily_keyword_stats dks
        JOIN telegram.project_keywords pk ON dks.keyword = pk.keyword
        JOIN telegram.projects p ON pk.project_id = p.id
        WHERE p.ticker = $2
          AND dks.stats_date > CURRENT_DATE - INTERVAL '30 days'
        GROUP BY dks.stats_date
      )
      SELECT
        ds.the_date,
        COALESCE(gd.news_count, 0) as news_count,
        COALESCE(td.mentions, 0) as telegram_mentions
      FROM date_series ds
      LEFT JOIN google_daily gd ON ds.the_date = gd.news_date
      LEFT JOIN telegram_daily td ON ds.the_date = td.stats_date
      ORDER BY ds.the_date ASC
    `,
      [keyword, ticker]
    );

    return {
      data: rows.map((r) => ({
        date: new Date(r.the_date).toLocaleDateString("ko-KR", {
          month: "short",
          day: "numeric",
        }),
        newsCount: Number(r.news_count),
        telegramMentions: Number(r.telegram_mentions),
      })),
      error: null,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("fetchMediaDivergence error:", message);
    return { data: [], error: message };
  }
}

// ─── Alpha Leak Timeline ─────────────────────────────────

export async function fetchAlphaLeak(): Promise<{
  data: AlphaLeakItem[];
  error: string | null;
}> {
  try {
    const rows = await queryKolDb<{
      keyword: string;
      ticker: string | null;
      alpha_first_seen: string;
      retail_first_seen: string;
      lag_hours: string;
      alpha_mentions: string;
      retail_mentions: string;
    }>(`
      WITH tiered_mentions AS (
        SELECT
          hcks.keyword,
          hcks.hour_bucket,
          COALESCE(ch.manual_tier, kn.calculated_tier) as tier,
          SUM(hcks.mention_count) as mentions
        FROM telegram.hourly_channel_keyword_stats hcks
        JOIN telegram.channels ch ON hcks.channel_id = ch.channel_id
        LEFT JOIN kol.nodes kn ON hcks.channel_id = kn.channel_id
        WHERE hcks.hour_bucket > NOW() - INTERVAL '48 hours'
          AND COALESCE(ch.manual_tier, kn.calculated_tier) IS NOT NULL
        GROUP BY hcks.keyword, hcks.hour_bucket, COALESCE(ch.manual_tier, kn.calculated_tier)
        HAVING SUM(hcks.mention_count) > 0
      ),
      alpha_first AS (
        SELECT keyword, MIN(hour_bucket) as first_seen, SUM(mentions) as total_mentions
        FROM tiered_mentions
        WHERE tier IN ('A+', 'A')
        GROUP BY keyword
      ),
      retail_first AS (
        SELECT keyword, MIN(hour_bucket) as first_seen, SUM(mentions) as total_mentions
        FROM tiered_mentions
        WHERE tier IN ('C', 'D')
        GROUP BY keyword
      )
      SELECT
        af.keyword,
        p.ticker,
        af.first_seen as alpha_first_seen,
        rf.first_seen as retail_first_seen,
        ROUND(EXTRACT(EPOCH FROM (rf.first_seen - af.first_seen)) / 3600, 1) as lag_hours,
        af.total_mentions as alpha_mentions,
        rf.total_mentions as retail_mentions
      FROM alpha_first af
      JOIN retail_first rf ON af.keyword = rf.keyword
      LEFT JOIN telegram.project_keywords pk ON af.keyword = pk.keyword
      LEFT JOIN telegram.projects p ON pk.project_id = p.id
      WHERE rf.first_seen > af.first_seen
      ORDER BY lag_hours ASC
      LIMIT 20
    `);

    return {
      data: rows.map((r) => ({
        keyword: r.keyword,
        ticker: r.ticker || null,
        alphaFirstSeen: r.alpha_first_seen,
        retailFirstSeen: r.retail_first_seen,
        lagHours: Number(r.lag_hours),
        alphaMentions: Number(r.alpha_mentions),
        retailMentions: Number(r.retail_mentions),
      })),
      error: null,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("fetchAlphaLeak error:", message);
    return { data: [], error: message };
  }
}

// ─── Hidden Origin (포워딩 발원지) ──────────────────────

export async function fetchHiddenOrigin(): Promise<{
  data: HiddenOriginItem[];
  error: string | null;
}> {
  try {
    const now = new Date();
    const partitionCurrent = `messages_y${now.getFullYear()}m${String(now.getMonth() + 1).padStart(2, "0")}`;
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const partitionPrev = `messages_y${prev.getFullYear()}m${String(prev.getMonth() + 1).padStart(2, "0")}`;

    const rows = await queryKolDb<{
      channel_title: string;
      username: string | null;
      tier: string | null;
      forward_count: string;
      total_views_generated: string;
    }>(`
      WITH forwarding_sources AS (
        SELECT
          m.fwd_peer_id,
          COUNT(*) as forward_count,
          SUM(m.views_count) as total_views_generated
        FROM (
          SELECT fwd_peer_id, views_count, chat_id
          FROM telegram."${partitionCurrent}"
          WHERE fwd_peer_id IS NOT NULL
            AND fwd_peer_type = 'channel'
            AND message_timestamp > NOW() - INTERVAL '30 days'
          UNION ALL
          SELECT fwd_peer_id, views_count, chat_id
          FROM telegram."${partitionPrev}"
          WHERE fwd_peer_id IS NOT NULL
            AND fwd_peer_type = 'channel'
            AND message_timestamp > NOW() - INTERVAL '30 days'
        ) m
        WHERE NOT EXISTS (
          SELECT 1 FROM telegram.channel_discussion_mapping cdm
          WHERE cdm.channel_id = m.fwd_peer_id
            AND cdm.groupchat_id = m.chat_id
        )
        GROUP BY m.fwd_peer_id
        ORDER BY forward_count DESC
        LIMIT 15
      )
      SELECT
        tc.title as channel_title,
        tc.username,
        COALESCE(tc.manual_tier, kn.calculated_tier) as tier,
        fs.forward_count,
        fs.total_views_generated
      FROM forwarding_sources fs
      JOIN telegram.channels tc ON fs.fwd_peer_id = tc.channel_id
      LEFT JOIN kol.nodes kn ON fs.fwd_peer_id = kn.channel_id
      ORDER BY fs.forward_count DESC
    `);

    return {
      data: rows.map((r) => ({
        channelTitle: r.channel_title || "Unknown",
        username: r.username || null,
        tier: r.tier || null,
        forwardCount: Number(r.forward_count),
        totalViewsGenerated: Number(r.total_views_generated || 0),
      })),
      error: null,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("fetchHiddenOrigin error:", message);
    return { data: [], error: message };
  }
}

// ─── Retail Intent Spectrum (검색 의도 분석) ─────────────

export async function fetchRetailIntent(
  keyword: string = "비트코인"
): Promise<{
  data: RetailIntentItem[];
  error: string | null;
}> {
  try {
    const rows = await queryKolDb<{
      related_keyword: string;
      search_volume: string;
      intent_category: string;
    }>(
      `
      SELECT
        nrk.related_keyword,
        nrk.search_volume,
        CASE
          WHEN nrk.related_keyword ~ '시세|가격|차트|전망|호재|하락|상승' THEN 'Investment'
          WHEN nrk.related_keyword ~ '하는법|가입|지갑|계좌|거래소|출금|입금|매수' THEN 'Onboarding'
          WHEN nrk.related_keyword ~ 'ETF|스테이킹|디파이|반감기|백서' THEN 'Technology'
          ELSE 'General'
        END as intent_category
      FROM search_analytics.monthly_naver_related_keywords nrk
      JOIN search_analytics.keywords k ON nrk.keyword_id = k.id
      WHERE k.keyword = $1
        AND nrk.year_month = (SELECT MAX(year_month) FROM search_analytics.monthly_naver_related_keywords)
      ORDER BY nrk.search_volume DESC
      LIMIT 20
    `,
      [keyword]
    );

    return {
      data: rows.map((r) => ({
        relatedKeyword: r.related_keyword,
        searchVolume: Number(r.search_volume),
        intentCategory: r.intent_category as RetailIntentItem["intentCategory"],
      })),
      error: null,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("fetchRetailIntent error:", message);
    return { data: [], error: message };
  }
}

// ─── SEO Battlefield (미디어 점유율) ─────────────────────

export async function fetchSEOBattlefield(): Promise<{
  data: SEOItem[];
  error: string | null;
}> {
  try {
    const [googleRows, naverRows] = await Promise.all([
      queryKolDb<{
        domain: string;
        avg_share: string;
        total_appearances: string;
      }>(`
        SELECT
          gdd.domain,
          ROUND(AVG(gdd.percentage)::numeric, 1) as avg_share,
          SUM(gdd.count) as total_appearances
        FROM search_analytics.google_domain_distribution gdd
        WHERE gdd.collection_timestamp > NOW() - INTERVAL '30 days'
        GROUP BY gdd.domain
        ORDER BY total_appearances DESC
        LIMIT 10
      `),
      queryKolDb<{
        provider: string;
        article_count: string;
        share_pct: string;
      }>(`
        SELECT
          provider,
          COUNT(*) as article_count,
          ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 1) as share_pct
        FROM news_scraper.naver_news_articles
        WHERE published_at > NOW() - INTERVAL '30 days'
        GROUP BY provider
        ORDER BY article_count DESC
        LIMIT 10
      `),
    ]);

    const googleData: SEOItem[] = googleRows.map((r) => ({
      domain: r.domain,
      metric: Number(r.avg_share),
      platform: "Google" as const,
    }));

    const naverData: SEOItem[] = naverRows.map((r) => ({
      domain: r.provider,
      metric: Number(r.article_count),
      platform: "Naver" as const,
    }));

    return {
      data: [...googleData, ...naverData],
      error: null,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("fetchSEOBattlefield error:", message);
    return { data: [], error: message };
  }
}
