"use server";

import { queryKolDb, getCmcPartitionTable } from "@/utils/supabase/kol-db";

// ─── Types ───────────────────────────────────────────────

export interface ProjectItem {
  id: number;
  ticker: string;
  logo: string | null;
  tge: boolean; // true = Post-TGE, false = Pre-TGE
}

export interface TelegramScoreData {
  score: number;
  totalMentions30d: number;
  mentionTrend: number; // recent 7d vs prev 7d % change
  uniqueChannels: number;
  dailyMentions: { date: string; mentions: number }[];
  hourlyHeatmap: { dayOfWeek: number; hour: number; mentions: number }[];
  topChannels: {
    channelId: number;
    channelName: string;
    tier: string | null;
    mentionCount: number;
    participantsCount: number | null;
    medianViews: number | null;
  }[];
}

export interface TelegramSampleMessage {
  content: string;
  messageTimestamp: string;
  viewsCount: number;
  forwardsCount: number;
  channelName: string;
}

export interface SEOScoreData {
  score: number;
  monthlyTrend: {
    yearMonth: string;
    totalVolume: number;
    blogCount: number;
    cafeCount: number;
    newsCount: number;
    webCount: number;
  }[];
}

export interface YoutubeScoreData {
  score: number;
  videoCount: number;
  totalViews: number;
  totalLikes: number;
  videos: {
    videoId: string;
    title: string;
    channelTitle: string;
    viewCount: number;
    likeCount: number;
    publishedAt: string;
  }[];
}

export interface NewsData {
  totalArticles: number;
  uniqueProviders: number;
  keywordBreakdown: { keyword: string; category: string; articleCount: number }[];
  recentArticles: {
    title: string;
    provider: string;
    publishedAt: string;
    url: string;
    searchKeyword: string;
    category: string;
  }[];
  dailyTrend: { date: string; count: number; category: string }[];
}

export interface ExchangeScoreData {
  score: number;
  exchanges: {
    exchangeName: string;
    volume24h: number;
    totalSellDepth: number;
    totalBuyDepth: number;
    totalLiquidity: number;
  }[];
  whaleProxy: number | null; // buy_depth / sell_depth ratio
}

// ─── Helpers ─────────────────────────────────────────────

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

const NEWS_CATEGORY_MAP: Record<string, string> = {
  // coin (individual coins)
  "\uBE44\uD2B8\uCF54\uC778": "coin",
  "\uC774\uB354\uB9AC\uC6C0": "coin",
  "\uC194\uB77C\uB098": "coin",
  "\uB9AC\uD50C": "coin",
  // industry (tech/industry)
  "\uBE14\uB85D\uCCB4\uC778": "industry",
  "NFT": "industry",
  "\uB514\uD30C\uC774": "industry",
  "\uC6F93": "industry",
  "\uBA54\uD0C0\uBC84\uC2A4": "industry",
  // market (market/regulation)
  "\uAC00\uC0C1\uC790\uC0B0": "market",
  "\uCF54\uC778": "market",
  "\uC554\uD638\uD654\uD3D0": "market",
};

function getNewsCategory(keyword: string): string {
  return NEWS_CATEGORY_MAP[keyword] || "market";
}

const SECTOR_MAP: Record<string, string> = {
  // L1
  BTC: "L1", ETH: "L1", SOL: "L1", AVAX: "L1", SUI: "L1", APT: "L1",
  SEI: "L1", NEAR: "L1", DOT: "L1", ATOM: "L1", ADA: "L1", TON: "L1",
  TRX: "L1", HBAR: "L1", ALGO: "L1", XLM: "L1", ICP: "L1", FTM: "L1",
  KLAY: "L1", XRP: "L1", EGLD: "L1", INJ: "L1", TIA: "L1", MINA: "L1",
  // L2
  OP: "L2", ARB: "L2", MATIC: "L2", STRK: "L2", ZK: "L2", MNT: "L2",
  IMX: "L2", METIS: "L2", BOBA: "L2", BLAST: "L2", MODE: "L2", SCROLL: "L2",
  // DeFi
  UNI: "DeFi", AAVE: "DeFi", CRV: "DeFi", MKR: "DeFi", COMP: "DeFi",
  SNX: "DeFi", SUSHI: "DeFi", DYDX: "DeFi", LDO: "DeFi", RPL: "DeFi",
  PENDLE: "DeFi", GMX: "DeFi", JUP: "DeFi", RAY: "DeFi", CAKE: "DeFi",
  "1INCH": "DeFi", YFI: "DeFi", BAL: "DeFi",
  // Gaming
  AXS: "Gaming", SAND: "Gaming", MANA: "Gaming", GALA: "Gaming",
  ENJ: "Gaming", IMC: "Gaming", PIXEL: "Gaming", BEAM: "Gaming",
  RON: "Gaming", PRIME: "Gaming", XAI: "Gaming",
  // AI
  FET: "AI", RNDR: "AI", AGIX: "AI", OCEAN: "AI", TAO: "AI",
  WLD: "AI", AKT: "AI", AR: "AI", ARKM: "AI", OLAS: "AI",
  // Meme
  DOGE: "Meme", SHIB: "Meme", PEPE: "Meme", BONK: "Meme", WIF: "Meme",
  FLOKI: "Meme", MEME: "Meme", MYRO: "Meme",
  // Infra
  LINK: "Infra", GRT: "Infra", FIL: "Infra", THETA: "Infra",
  PYTH: "Infra", API3: "Infra", BAND: "Infra", STORJ: "Infra",
  // RWA
  ONDO: "RWA", MRF: "RWA", POLYX: "RWA",
};

function getSector(ticker: string): string {
  return SECTOR_MAP[ticker.toUpperCase()] || "Other";
}

// ─── Project List ────────────────────────────────────────

export async function fetchProjectList(): Promise<{
  data: ProjectItem[];
  error: string | null;
}> {
  try {
    const rows = await queryKolDb<{
      id: number;
      ticker: string;
      logo: string | null;
      tge: boolean | null;
    }>(`
      SELECT id, ticker, logo, COALESCE(tge, false) as tge
      FROM telegram.projects
      WHERE ticker IS NOT NULL AND ticker != ''
      ORDER BY ticker ASC
    `);
    return {
      data: rows.map((r) => ({
        id: r.id,
        ticker: r.ticker,
        logo: r.logo,
        tge: !!r.tge,
      })),
      error: null,
    };
  } catch (e) {
    console.error("fetchProjectList error:", e);
    return { data: [], error: String(e) };
  }
}

// ─── Telegram Score ──────────────────────────────────────

export async function fetchTelegramScore(
  ticker: string,
  projectId: number
): Promise<{ data: TelegramScoreData | null; error: string | null }> {
  try {
    // 1. Daily mentions (30 days) — from daily_channel_keyword_stats (project_id based, reliable)
    const dailyRows = await queryKolDb<{
      stats_date: string;
      mentions: number;
    }>(`
      SELECT stats_date::text, SUM(mention_count)::bigint as mentions
      FROM telegram.daily_channel_keyword_stats
      WHERE project_id = $1 AND stats_date > CURRENT_DATE - 30
      GROUP BY stats_date ORDER BY stats_date
    `, [projectId]);

    const totalMentions30d = dailyRows.reduce((s, r) => s + Number(r.mentions), 0);
    if (totalMentions30d === 0) {
      return { data: null, error: null };
    }

    // Compute trend: recent 7d vs previous 7d
    const now = new Date();
    const recent7dStart = new Date(now);
    recent7dStart.setDate(recent7dStart.getDate() - 7);
    const prev7dStart = new Date(now);
    prev7dStart.setDate(prev7dStart.getDate() - 14);

    let recent7d = 0, prev7d = 0;
    for (const r of dailyRows) {
      const d = new Date(r.stats_date);
      if (d >= recent7dStart) recent7d += Number(r.mentions);
      else if (d >= prev7dStart) prev7d += Number(r.mentions);
    }
    const mentionTrend = prev7d > 0 ? Math.round(((recent7d - prev7d) / prev7d) * 100) : 0;

    // 2. Hourly heatmap (7 days) — from hourly_channel_keyword_stats (project_id based)
    const heatmapRows = await queryKolDb<{
      dow: number;
      hr: number;
      mentions: number;
    }>(`
      SELECT EXTRACT(DOW FROM hour_bucket)::int as dow,
             EXTRACT(HOUR FROM hour_bucket)::int as hr,
             SUM(mention_count)::bigint as mentions
      FROM telegram.hourly_channel_keyword_stats
      WHERE project_id = $1 AND hour_bucket > NOW() - INTERVAL '7 days'
      GROUP BY dow, hr ORDER BY dow, hr
    `, [projectId]);

    // 3. Top channels (30 days) — from daily_channel_keyword_stats
    // Note: channel_id is bigint — do NOT cast to ::int (overflow). Use ::text then parse.
    const topChannelRows = await queryKolDb<{
      channel_id: string;
      channel_name: string;
      tier: string | null;
      mention_count: number;
      participants_count: string | null;
      median_views: number | null;
    }>(`
      SELECT
        dck.channel_id::text as channel_id,
        COALESCE(ch.title, 'Unknown') as channel_name,
        COALESCE(UPPER(TRIM(REPLACE(UPPER(n.calculated_tier), 'TIER ', ''))), null) as tier,
        SUM(dck.mention_count)::bigint as mention_count,
        cm.participants_count::text as participants_count,
        cm.median_views::float as median_views
      FROM telegram.daily_channel_keyword_stats dck
      LEFT JOIN telegram.channels ch ON dck.channel_id = ch.channel_id
      LEFT JOIN kol.nodes n ON dck.channel_id = n.channel_id
      LEFT JOIN LATERAL (
        SELECT participants_count, median_views
        FROM telegram.channel_metrics
        WHERE channel_id = dck.channel_id
        ORDER BY stats_date DESC NULLS LAST LIMIT 1
      ) cm ON true
      WHERE dck.project_id = $1 AND dck.stats_date > CURRENT_DATE - 30
      GROUP BY dck.channel_id, ch.title, n.calculated_tier, cm.participants_count, cm.median_views
      ORDER BY mention_count DESC
      LIMIT 20
    `, [projectId]);

    // 4. Unique channels count
    const uniqueRows = await queryKolDb<{ cnt: number }>(`
      SELECT COUNT(DISTINCT channel_id)::bigint as cnt
      FROM telegram.daily_channel_keyword_stats
      WHERE project_id = $1 AND stats_date > CURRENT_DATE - 30
    `, [projectId]);
    const uniqueChannels = Number(uniqueRows[0]?.cnt || 0);

    // Score formula
    const volScore = clamp(Math.round((Math.log(totalMentions30d + 1) / Math.log(10000)) * 100), 0, 100);
    const trendScore = clamp(Math.round(50 + mentionTrend), 0, 100);
    const reachScore = clamp(Math.round((uniqueChannels / 50) * 100), 0, 100);
    const score = clamp(Math.round(volScore * 0.4 + trendScore * 0.3 + reachScore * 0.3), 0, 100);

    return {
      data: {
        score,
        totalMentions30d,
        mentionTrend,
        uniqueChannels,
        dailyMentions: dailyRows.map((r) => ({
          date: r.stats_date,
          mentions: Number(r.mentions),
        })),
        hourlyHeatmap: heatmapRows.map((r) => ({
          dayOfWeek: Number(r.dow),
          hour: Number(r.hr),
          mentions: Number(r.mentions),
        })),
        topChannels: topChannelRows.map((r) => ({
          channelId: Number(r.channel_id),
          channelName: r.channel_name,
          tier: r.tier,
          mentionCount: Number(r.mention_count),
          participantsCount: r.participants_count ? Number(r.participants_count) : null,
          medianViews: r.median_views ? Number(r.median_views) : null,
        })),
      },
      error: null,
    };
  } catch (e) {
    console.error("fetchTelegramScore error:", e);
    return { data: null, error: String(e) };
  }
}

// ─── Telegram Sample Messages (High Impact Mentions) ─────

export async function fetchTelegramSamples(
  projectId: number,
  ticker: string
): Promise<{ data: TelegramSampleMessage[]; error: string | null }> {
  try {
    const messages = await queryKolDb<{
      content: string;
      message_timestamp: string;
      views_count: number;
      forwards_count: number;
      channel_name: string;
    }>(`
      WITH top_channels AS (
        SELECT channel_id
        FROM telegram.daily_channel_keyword_stats
        WHERE project_id = $1 AND stats_date > CURRENT_DATE - 30
        GROUP BY channel_id
        ORDER BY SUM(mention_count) DESC
        LIMIT 5
      )
      SELECT m.content, m.message_timestamp::text,
             COALESCE(m.views_count, 0)::int as views_count,
             COALESCE(m.forwards_count, 0)::int as forwards_count,
             COALESCE(ch.title, 'Unknown') as channel_name
      FROM telegram.messages m
      JOIN telegram.channels ch ON m.chat_id = ch.channel_id
      WHERE m.chat_id IN (SELECT channel_id FROM top_channels)
        AND m.message_timestamp > NOW() - INTERVAL '7 days'
        AND LENGTH(m.content) >= 50
        AND m.content ILIKE '%' || $2 || '%'
      ORDER BY (COALESCE(m.views_count, 0) + COALESCE(m.forwards_count, 0) * 10) DESC
      LIMIT 2
    `, [projectId, ticker]);

    return {
      data: messages.map((m) => ({
        content: m.content,
        messageTimestamp: m.message_timestamp,
        viewsCount: Number(m.views_count) || 0,
        forwardsCount: Number(m.forwards_count) || 0,
        channelName: m.channel_name,
      })),
      error: null,
    };
  } catch (e) {
    console.error("fetchTelegramSamples error:", e);
    return { data: [], error: String(e) };
  }
}

// ─── SEO Score ───────────────────────────────────────────

export async function fetchSEOScore(
  projectId: number
): Promise<{ data: SEOScoreData | null; error: string | null }> {
  try {
    // Use project_keywords as bridge (714 rows, covers all projects with keywords)
    const rows = await queryKolDb<{
      year_month: string;
      total_volume: number;
      blog_count: number;
      cafe_count: number;
      news_count: number;
      web_count: number;
    }>(`
      SELECT s.year_month,
             SUM(s.total_volume)::bigint as total_volume,
             SUM(s.blog_count)::bigint as blog_count,
             SUM(s.cafe_count)::bigint as cafe_count,
             SUM(s.news_count)::bigint as news_count,
             SUM(s.web_count)::bigint as web_count
      FROM search_analytics.monthly_naver_search_stats s
      JOIN search_analytics.keywords k ON s.keyword_id = k.id
      JOIN telegram.project_keywords pk ON LOWER(k.keyword) = LOWER(pk.keyword)
      WHERE pk.project_id = $1
      GROUP BY s.year_month
      ORDER BY s.year_month DESC
      LIMIT 12
    `, [projectId]);

    if (rows.length === 0) {
      return { data: null, error: null };
    }

    // Score: log-based normalization of latest total_volume
    const latestVol = Number(rows[0].total_volume);
    const refMax = 15;
    const score = clamp(
      Math.round((Math.log(latestVol + 1) / refMax) * 100),
      0,
      100
    );

    return {
      data: {
        score,
        monthlyTrend: rows.reverse().map((r) => ({
          yearMonth: r.year_month,
          totalVolume: Number(r.total_volume),
          blogCount: Number(r.blog_count),
          cafeCount: Number(r.cafe_count),
          newsCount: Number(r.news_count),
          webCount: Number(r.web_count),
        })),
      },
      error: null,
    };
  } catch (e) {
    console.error("fetchSEOScore error:", e);
    return { data: null, error: String(e) };
  }
}

// ─── YouTube Score ───────────────────────────────────────

export async function fetchYoutubeScore(
  projectId: number
): Promise<{ data: YoutubeScoreData | null; error: string | null }> {
  try {
    // Aggregate stats
    const aggRows = await queryKolDb<{
      video_count: number;
      total_views: number;
      total_likes: number;
    }>(`
      SELECT COUNT(DISTINCT v.id)::bigint as video_count,
             COALESCE(SUM(vm.view_count), 0)::bigint as total_views,
             COALESCE(SUM(vm.like_count), 0)::bigint as total_likes
      FROM youtube.videos v
      JOIN youtube.video_keywords vk ON v.id = vk.video_id
      JOIN youtube.keywords yk ON vk.keyword_id = yk.id
      JOIN telegram.project_keywords pk ON yk.keyword = pk.keyword
      LEFT JOIN LATERAL (
        SELECT view_count, like_count FROM youtube.video_metrics
        WHERE video_id = v.id ORDER BY collected_at DESC LIMIT 1
      ) vm ON true
      WHERE pk.project_id = $1 AND v.published_at > NOW() - INTERVAL '30 days'
    `, [projectId]);

    const agg = aggRows[0] || { video_count: 0, total_views: 0, total_likes: 0 };

    if (Number(agg.video_count) === 0) {
      return { data: null, error: null };
    }

    // Video list (with video_id for YouTube link)
    const videoRows = await queryKolDb<{
      video_id: string;
      title: string;
      channel_title: string;
      view_count: number;
      like_count: number;
      published_at: string;
    }>(`
      SELECT v.id as video_id, v.title, v.channel_title,
             COALESCE(vm.view_count, 0)::bigint as view_count,
             COALESCE(vm.like_count, 0)::bigint as like_count,
             v.published_at::text
      FROM youtube.videos v
      JOIN youtube.video_keywords vk ON v.id = vk.video_id
      JOIN youtube.keywords yk ON vk.keyword_id = yk.id
      JOIN telegram.project_keywords pk ON yk.keyword = pk.keyword
      LEFT JOIN LATERAL (
        SELECT view_count, like_count FROM youtube.video_metrics
        WHERE video_id = v.id ORDER BY collected_at DESC LIMIT 1
      ) vm ON true
      WHERE pk.project_id = $1 AND v.published_at > NOW() - INTERVAL '30 days'
      ORDER BY vm.view_count DESC NULLS LAST
      LIMIT 20
    `, [projectId]);

    // Score: (view_score * 0.7 + count_score * 0.3)
    const viewScore = clamp(Math.round((Math.log(Number(agg.total_views) + 1) / Math.log(1000000)) * 100), 0, 100);
    const countScore = clamp(Math.round((Number(agg.video_count) / 50) * 100), 0, 100);
    const score = clamp(Math.round(viewScore * 0.7 + countScore * 0.3), 0, 100);

    return {
      data: {
        score,
        videoCount: Number(agg.video_count),
        totalViews: Number(agg.total_views),
        totalLikes: Number(agg.total_likes),
        videos: videoRows.map((r) => ({
          videoId: r.video_id,
          title: r.title,
          channelTitle: r.channel_title,
          viewCount: Number(r.view_count),
          likeCount: Number(r.like_count),
          publishedAt: r.published_at,
        })),
      },
      error: null,
    };
  } catch (e) {
    console.error("fetchYoutubeScore error:", e);
    return { data: null, error: String(e) };
  }
}

// ─── News Data (Project-Independent) ─────────────────────
// naver_news_articles는 범용 키워드(비트코인, 이더리움, 블록체인 등 ~11개)로만 수집됨
// 프로젝트별 매칭 불가 → 전체 뉴스를 카테고리별로 보여주는 방식

export async function fetchNewsData(): Promise<{
  data: NewsData | null;
  error: string | null;
}> {
  try {
    // 1. Aggregate: 전체 기사 통계 (30일)
    const aggRows = await queryKolDb<{
      total_articles: number;
      unique_providers: number;
    }>(`
      SELECT COUNT(*)::bigint as total_articles, COUNT(DISTINCT provider)::bigint as unique_providers
      FROM news_scraper.naver_news_articles
      WHERE published_at > NOW() - INTERVAL '30 days'
    `);

    const agg = aggRows[0] || { total_articles: 0, unique_providers: 0 };
    const totalArticles = Number(agg.total_articles);

    if (totalArticles === 0) {
      return { data: null, error: null };
    }

    // 2. 키워드별 기사 수 (카테고리 매핑 포함)
    const keywordRows = await queryKolDb<{
      search_keyword: string;
      article_count: number;
    }>(`
      SELECT search_keyword, COUNT(*)::bigint as article_count
      FROM news_scraper.naver_news_articles
      WHERE published_at > NOW() - INTERVAL '30 days'
        AND search_keyword IS NOT NULL
      GROUP BY search_keyword
      ORDER BY article_count DESC
    `);

    const keywordBreakdown = keywordRows.map((r) => ({
      keyword: r.search_keyword,
      category: getNewsCategory(r.search_keyword),
      articleCount: Number(r.article_count),
    }));

    // 3. 최근 기사 리스트 (30일, 최신 100개 — 카테고리 필터링 시 충분한 분포)
    const articleRows = await queryKolDb<{
      title: string;
      provider: string;
      published_at: string;
      url: string;
      search_keyword: string;
    }>(`
      SELECT title, provider, published_at::text, url, search_keyword
      FROM news_scraper.naver_news_articles
      WHERE published_at > NOW() - INTERVAL '30 days'
      ORDER BY published_at DESC
      LIMIT 100
    `);

    // 4. 일별 트렌드 (30일, 키워드별 → 클라이언트에서 카테고리 집계)
    const dailyRows = await queryKolDb<{
      d: string;
      search_keyword: string;
      cnt: number;
    }>(`
      SELECT DATE(published_at)::text as d, search_keyword, COUNT(*)::bigint as cnt
      FROM news_scraper.naver_news_articles
      WHERE published_at > NOW() - INTERVAL '30 days'
        AND search_keyword IS NOT NULL
      GROUP BY DATE(published_at), search_keyword
      ORDER BY d
    `);

    return {
      data: {
        totalArticles,
        uniqueProviders: Number(agg.unique_providers),
        keywordBreakdown,
        recentArticles: articleRows.map((r) => ({
          title: r.title,
          provider: r.provider,
          publishedAt: r.published_at,
          url: r.url,
          searchKeyword: r.search_keyword,
          category: getNewsCategory(r.search_keyword),
        })),
        dailyTrend: dailyRows.map((r) => ({
          date: r.d,
          count: Number(r.cnt),
          category: getNewsCategory(r.search_keyword),
        })),
      },
      error: null,
    };
  } catch (e) {
    console.error("fetchNewsData error:", e);
    return { data: null, error: String(e) };
  }
}

// ─── Exchange Score (Post-TGE Only) ─────────────────────

export async function fetchExchangeScore(
  ticker: string
): Promise<{ data: ExchangeScoreData | null; error: string | null }> {
  try {
    const partition = getCmcPartitionTable();
    const rows = await queryKolDb<{
      exchange_name: string;
      volume_24h: number;
      total_sell_depth: number;
      total_buy_depth: number;
      total_liquidity: number;
    }>(`
      SELECT e.name as exchange_name,
             SUM(emp.volume_usd)::float as volume_24h,
             SUM(emp.depth_usd_negative_two)::float as total_sell_depth,
             SUM(emp.depth_usd_positive_two)::float as total_buy_depth,
             SUM(COALESCE(emp.depth_usd_positive_two, 0) + COALESCE(emp.depth_usd_negative_two, 0))::float as total_liquidity
      FROM crypto_market."${partition}" emp
      JOIN crypto_market.currencies c ON emp.currency_id = c.id
      JOIN crypto_market.exchanges e ON emp.exchange_id = e.id
      WHERE UPPER(c.symbol) = UPPER($1)
        AND e.slug IN ('upbit', 'bithumb', 'coinone', 'korbit', 'gopax')
        AND emp.market_pair LIKE '%/KRW'
        AND emp.last_updated > NOW() - INTERVAL '1 day'
      GROUP BY e.name ORDER BY volume_24h DESC
    `, [ticker]);

    if (rows.length === 0) {
      return { data: null, error: null };
    }

    const totalVolume = rows.reduce((s, r) => s + Number(r.volume_24h), 0);
    const totalBuyDepth = rows.reduce((s, r) => s + Number(r.total_buy_depth || 0), 0);
    const totalSellDepth = rows.reduce((s, r) => s + Number(r.total_sell_depth || 0), 0);

    // volume_score * 0.6 + depth_score * 0.4
    const volScore = clamp(Math.round((Math.log(totalVolume + 1) / Math.log(100000000)) * 100), 0, 100);
    const depthScore = clamp(Math.round((Math.log(totalBuyDepth + totalSellDepth + 1) / Math.log(10000000)) * 100), 0, 100);
    const score = clamp(Math.round(volScore * 0.6 + depthScore * 0.4), 0, 100);

    const whaleProxy = totalSellDepth > 0 ? totalBuyDepth / totalSellDepth : null;

    return {
      data: {
        score,
        exchanges: rows.map((r) => ({
          exchangeName: r.exchange_name,
          volume24h: Number(r.volume_24h),
          totalSellDepth: Number(r.total_sell_depth),
          totalBuyDepth: Number(r.total_buy_depth),
          totalLiquidity: Number(r.total_liquidity),
        })),
        whaleProxy: whaleProxy ? Math.round(whaleProxy * 100) / 100 : null,
      },
      error: null,
    };
  } catch (e) {
    console.error("fetchExchangeScore error:", e);
    return { data: null, error: String(e) };
  }
}
