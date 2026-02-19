# Korean Crypto Market Pages - 설계 스펙

> Gemini + Claude 협업으로 도출된 데이터 기반 페이지 설계
> 두 개의 별도 페이지:
> - `/korea-insights` — 시장 전체 인사이트/분석 (K-Narrative Intelligence)
> - `/korea-data` — 프로젝트별 원시 데이터 스코어카드

## 페이지 분류 체계
| | `/korea-insights` | `/korea-data` |
|---|---|---|
| 성격 | 시장 전체 인사이트/분석 | 프로젝트별 원시 데이터 조회 |
| 단위 | 시장 전체 | 개별 프로젝트 (ticker 선택) |
| 목적 | Go-to-Market 전략 수립 | 프로젝트 한국 현황 스코어카드 |

---

# Part 1: Korea Insights (`/korea-insights`)

---

## 핵심 컨셉: "K-Narrative Intelligence"
한국 크립토 시장만의 정보 비대칭을 측정하는 대시보드
- **Alpha (KOL/텔레그램)** → **Awareness (네이버/유튜브)** → **Action (거래소 거래량)** 의 흐름을 추적

---

## 페이지 구조 (7개 섹션 + 상단 펄스 위젯)

### 상단: Pulse Widgets (한눈에 보는 핵심 지표 4개)
| Widget | 데이터 소스 | 설명 |
|--------|------------|------|
| BTC 일간 멘션 수 | `telegram.daily_keyword_stats` (ticker='BTC') | 전일 대비 증감률 |
| 전체 텔레그램 트렌딩 스코어 | `telegram.views_growth_tracking` | 최근 6시간 평균 trending_score |
| 네이버 월간 검색량 트렌드 | `search_analytics.monthly_naver_search_stats` (keyword='비트코인') | 전월 대비 증감 |
| 한국 거래소 총 거래량 | `crypto_market.cmc_exchange_market_pairs` (Korean exchanges) | 전일 총 volume_usd |

---

### Section 1: Shill-to-Volume 버블 차트 (가장 높은 우선순위)
**"텔레그램 과대광고 vs 실제 거래량"**

#### 시각화: ECharts Bubble Chart
- X축: 한국 거래소 24h 거래량 (USD)
- Y축: 텔레그램 24h 총 멘션 수
- 버블 크기: Storyteller 품질 스코어 (A/B 등급 비율)
- 버블 색상: 가격 변동률 (초록=상승, 빨강=하락)

#### SQL 로직
```sql
-- 1) 텔레그램 멘션 (어제)
WITH telegram_hype AS (
  SELECT ticker, SUM(mention_count) as total_mentions
  FROM telegram.daily_keyword_stats
  WHERE stats_date = CURRENT_DATE - INTERVAL '1 day'
  GROUP BY ticker
),
-- 2) 한국 거래소 거래량 (최신 파티션)
korean_volume AS (
  SELECT
    c.symbol as ticker,
    SUM(emp.volume_usd) as total_vol_usd,
    AVG(emp.price) as avg_price_usd
  FROM crypto_market.cmc_exchange_market_pairs emp
  JOIN crypto_market.currencies c ON emp.currency_id = c.id
  JOIN crypto_market.exchanges e ON emp.exchange_id = e.id
  WHERE e.name IN ('upbit', 'bithumb', 'coinone', 'korbit', 'gopax')
    AND emp.last_updated > NOW() - INTERVAL '1 day'
    AND emp.market_pair LIKE '%/KRW'
  GROUP BY c.symbol
),
-- 3) Storyteller 품질 스코어 (최근 7일)
quality AS (
  SELECT
    tkg.name as project_name,
    COUNT(*) as total_graded,
    SUM(CASE WHEN smg.grade IN ('A', 'B') THEN 1 ELSE 0 END)::float / COUNT(*) as quality_ratio
  FROM storyteller.storyteller_message_grades smg
  JOIN telegram.tracking_keyword_groups tkg ON smg.tracking_keyword_group_id = tkg.id
  WHERE smg.created_at > NOW() - INTERVAL '7 days'
  GROUP BY tkg.name
  HAVING COUNT(*) >= 5
)
SELECT
  th.ticker,
  th.total_mentions,
  kv.total_vol_usd,
  kv.avg_price_usd,
  q.quality_ratio,
  CASE
    WHEN kv.total_vol_usd > 0
    THEN (th.total_mentions / kv.total_vol_usd) * 1000000
    ELSE NULL
  END as shill_index
FROM telegram_hype th
LEFT JOIN korean_volume kv ON th.ticker = kv.ticker
LEFT JOIN quality q ON LOWER(q.project_name) = LOWER(th.ticker)
WHERE th.total_mentions >= 10
ORDER BY shill_index DESC NULLS LAST;
```

#### 인사이트
- **Shill Index 높음** (멘션 많은데 거래량 적음) = 과대광고 / 주의 필요
- **Shill Index 낮음** (거래량 많은데 멘션 적음) = 조용한 기관 매집 가능성
- **Quality Ratio 높음 + 거래량 높음** = 건강한 내러티브

---

### Section 2: Alpha Leak 타임라인 (정보 전파 속도)
**"A+ 채널에서 C/D 그룹까지 정보 전파에 얼마나 걸리나"**

#### 시각화: Recharts Timeline/Heatmap
- 행: 티커별
- 열: 시간대 (6시간 단위)
- 셀 색상: 멘션 채널의 평균 티어 (A+=진한 파랑, D=연한 회색)

#### SQL 로직 (hourly_channel_keyword_stats + channels JOIN)
```sql
-- hourly_channel_keyword_stats에는 channel_id가 있으므로 채널 티어 조인 가능
WITH tiered_mentions AS (
  SELECT
    hcks.keyword,
    hcks.hour_bucket,
    c.manual_tier,
    kn.calculated_tier,
    COALESCE(c.manual_tier, kn.calculated_tier) as tier,
    SUM(hcks.mention_count) as mentions
  FROM telegram.hourly_channel_keyword_stats hcks
  JOIN telegram.channels c ON hcks.channel_id = c.channel_id
  LEFT JOIN kol.nodes kn ON hcks.channel_id = kn.channel_id
  WHERE hcks.hour_bucket > NOW() - INTERVAL '48 hours'
  GROUP BY hcks.keyword, hcks.hour_bucket, c.manual_tier, kn.calculated_tier
),
first_mentions AS (
  SELECT
    keyword,
    tier,
    MIN(hour_bucket) as first_seen
  FROM tiered_mentions
  WHERE mentions > 0 AND tier IS NOT NULL
  GROUP BY keyword, tier
)
SELECT
  fm_alpha.keyword,
  fm_alpha.first_seen as alpha_first_seen,
  fm_retail.first_seen as retail_first_seen,
  EXTRACT(EPOCH FROM (fm_retail.first_seen - fm_alpha.first_seen)) / 3600 as lag_hours
FROM first_mentions fm_alpha
JOIN first_mentions fm_retail ON fm_alpha.keyword = fm_retail.keyword
WHERE fm_alpha.tier IN ('A+', 'A')
  AND fm_retail.tier IN ('C', 'D')
  AND fm_retail.first_seen > fm_alpha.first_seen
ORDER BY lag_hours ASC;
```

#### 인사이트
- **Lag 짧음 (< 6시간)**: 빠르게 퍼지는 핫 내러티브
- **Lag 긺 (> 24시간)**: A급 채널만 아는 초기 알파
- **A급에서만 언급되고 퍼지지 않는 것**: 잠재적 내부자 정보

---

### Section 3: 미디어 vs 소셜 다이버전스
**"구글 뉴스 vs 텔레그램 활동의 괴리"**

#### 시각화: Recharts Dual-Axis Line Chart
- 좌측 Y축: 일간 구글 뉴스 기사 수 (google_news_results)
- 우측 Y축: 텔레그램 일간 멘션 수 (daily_keyword_stats)
- X축: 날짜 (최근 30일)
- 배경에 네이버 월간 검색량 바 차트 오버레이

#### SQL 로직
```sql
-- 구글 뉴스 일간 집계
WITH google_daily AS (
  SELECT
    k.keyword,
    DATE(gnr.collection_timestamp) as news_date,
    COUNT(*) as news_count
  FROM search_analytics.google_news_results gnr
  JOIN search_analytics.keywords k ON gnr.keyword_id = k.id
  WHERE gnr.collection_timestamp > NOW() - INTERVAL '30 days'
  GROUP BY k.keyword, DATE(gnr.collection_timestamp)
),
-- 텔레그램 일간 멘션
telegram_daily AS (
  SELECT
    ticker,
    keyword,
    stats_date,
    mention_count
  FROM telegram.daily_keyword_stats
  WHERE stats_date > CURRENT_DATE - INTERVAL '30 days'
),
-- 네이버 월간 (배경 참고용)
naver_monthly AS (
  SELECT
    k.keyword,
    nss.year_month,
    nss.total_volume,
    nss.blog_count,
    nss.news_count as naver_news_count
  FROM search_analytics.monthly_naver_search_stats nss
  JOIN search_analytics.keywords k ON nss.keyword_id = k.id
  WHERE nss.year_month > NOW() - INTERVAL '6 months'
)
SELECT * FROM google_daily
-- 프론트엔드에서 3개 데이터를 별도 fetch 후 차트에 오버레이
```

#### 인사이트
- **소셜 선행**: 텔레그램 멘션이 먼저 급등 → 뉴스가 따라오면 = 가격 상승 전조
- **뉴스 선행**: 뉴스가 먼저인데 소셜이 조용하면 = 기관/정책 뉴스 (규제 등)
- **둘 다 급등**: 강력한 시장 모멘텀

---

### Section 4: 내러티브 품질 리더보드
**"지금 가장 뜨거운 프로젝트의 콘텐츠 품질"**

#### 시각화: Stacked Bar Chart + Table
- 상위 15개 트렌딩 프로젝트
- 각 프로젝트별 A/B/C/D 등급 분포 (Stacked Bar)
- 옆에 테이블: mention_count, avg_views, quality_ratio, trending_score

#### SQL 로직
```sql
-- 트렌딩 프로젝트 (최근 7일 멘션 기준)
WITH trending AS (
  SELECT
    p.id as project_id,
    p.ticker,
    p.logo,
    SUM(dks.mention_count) as total_mentions_7d
  FROM telegram.daily_keyword_stats dks
  JOIN telegram.project_keywords pk ON dks.keyword = pk.keyword
  JOIN telegram.projects p ON pk.project_id = p.id
  WHERE dks.stats_date > CURRENT_DATE - INTERVAL '7 days'
  GROUP BY p.id, p.ticker, p.logo
  ORDER BY total_mentions_7d DESC
  LIMIT 15
),
-- 등급 분포
grades AS (
  SELECT
    tkg.id as group_id,
    tkg.name,
    smg.grade,
    COUNT(*) as grade_count
  FROM storyteller.storyteller_message_grades smg
  JOIN telegram.tracking_keyword_groups tkg ON smg.tracking_keyword_group_id = tkg.id
  WHERE smg.created_at > NOW() - INTERVAL '7 days'
  GROUP BY tkg.id, tkg.name, smg.grade
),
-- 리더보드 스코어
scores AS (
  SELECT
    group_id,
    AVG(score) as avg_score,
    AVG(avg_channel_views) as avg_views,
    SUM(mention_count) as total_mentions
  FROM storyteller.storyteller_leaderboard_scores
  WHERE stats_date > CURRENT_DATE - INTERVAL '7 days'
    AND lookback_days = 7
  GROUP BY group_id
)
SELECT
  t.ticker,
  t.logo,
  t.total_mentions_7d,
  g.grade,
  g.grade_count,
  s.avg_score,
  s.avg_views
FROM trending t
LEFT JOIN grades g ON LOWER(g.name) = LOWER(t.ticker)
LEFT JOIN scores s ON g.group_id = s.group_id
ORDER BY t.total_mentions_7d DESC, g.grade ASC;
```

---

### Section 5: Hidden Origin — 포워딩 발원지 분석 (2026-02-12 추가)
**"구독자 수가 아니라, 누구의 글이 가장 많이 퍼 날라지는가?"**

#### 시각화: Recharts Vertical BarChart
- Y축: 채널명 (상위 15개)
- X축: 포워딩 횟수
- 바 색상: 채널 티어별 (A+=빨강, A=주황, B=노랑, C=파랑, D=회색)
- 툴팁: 채널명, @username, 티어, 포워딩 횟수, 생성 조회수

#### SQL 로직
```sql
-- 자동 포워딩 제외가 핵심!
-- telegram.channel_discussion_mapping으로 채널→연결 채팅방 자동포워딩 필터
WITH forwarding_sources AS (
  SELECT
    m.fwd_peer_id,
    COUNT(*) as forward_count,
    SUM(m.views_count) as total_views_generated
  FROM (
    SELECT fwd_peer_id, views_count, chat_id  -- ⚠️ chat_id (NOT channel_id)
    FROM telegram."messages_y2026m02"
    WHERE fwd_peer_id IS NOT NULL
      AND fwd_peer_type = 'channel'
      AND message_timestamp > NOW() - INTERVAL '30 days'
    UNION ALL
    SELECT fwd_peer_id, views_count, chat_id
    FROM telegram."messages_y2026m01"
    WHERE fwd_peer_id IS NOT NULL
      AND fwd_peer_type = 'channel'
      AND message_timestamp > NOW() - INTERVAL '30 days'
  ) m
  WHERE NOT EXISTS (
    SELECT 1 FROM telegram.channel_discussion_mapping cdm
    WHERE cdm.channel_id = m.fwd_peer_id    -- 방송 채널 = 포워딩 원본
      AND cdm.groupchat_id = m.chat_id       -- 연결 채팅방 = 메시지 수신처
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
JOIN telegram.channels tc ON fs.fwd_peer_id = tc.channel_id  -- INNER JOIN으로 Unknown 제거
LEFT JOIN kol.nodes kn ON fs.fwd_peer_id = kn.channel_id
ORDER BY fs.forward_count DESC
```

#### 인사이트
- **자동 포워딩 vs 진짜 포워딩**: 텔레그램은 채널 포스트를 연결 채팅방으로 자동 복사. `channel_discussion_mapping`으로 이 노이즈 제거
- **Unknown 채널**: `fwd_peer_id`가 `channels` 테이블에 없으면 미등록 채널. INNER JOIN으로 제외
- **킬러 인사이트**: 구독자 5만 B급 채널보다, 500회 인용된 A+ 채널과 AMA를 잡는 게 비용 효율적

---

### Section 6: Retail Intent Spectrum — 검색 의도 분석 (2026-02-12 추가)
**"한국 개미는 투기를 원하나, 기술을 원하나, 온보딩을 원하나?"**

#### 시각화: Recharts Vertical BarChart + 키워드 전환 버튼
- Y축: 연관 키워드 (상위 20개)
- X축: 검색량
- 바 색상: 의도 카테고리별 (Investment=파랑, Onboarding=초록, Technology=보라, General=회색)
- 키워드 전환 버튼: 비트코인/이더리움/솔라나/리플 (MediaSocialDivergence와 동일 패턴)

#### SQL 로직
```sql
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
WHERE k.keyword = $1  -- 파라미터: 비트코인/이더리움/솔라나/리플
  AND nrk.year_month = (SELECT MAX(year_month) FROM search_analytics.monthly_naver_related_keywords)
ORDER BY nrk.search_volume DESC
LIMIT 20
```

#### 인사이트
- **Investment 지배적**: '시세/가격' 검색 → 대중 타겟 마케팅 효과적
- **Onboarding 지배적**: '가입/지갑' 검색 → 온보딩 가이드 콘텐츠 집중
- **Technology 지배적**: 'ETF/스테이킹' 검색 → 전문가 타겟 전략 전환

---

### Section 7: SEO Battlefield — 미디어 점유율 (2026-02-12 추가)
**"PR 기사를 냈을 때 실제로 노출되는 곳은 어디인가?"**

#### 시각화: Recharts PieChart (도넛) x2 나란히
- 좌측: Google 검색 도메인 점유율 (AVG percentage, 30일)
- 우측: Naver 뉴스 제공자 점유율 (기사 수, 30일)
- 각 도넛 중앙에 라벨 ("Google" / "Naver")

#### SQL 로직
```sql
-- Google 도메인 점유율
SELECT
  gdd.domain,
  ROUND(AVG(gdd.percentage)::numeric, 1) as avg_share,
  SUM(gdd.count) as total_appearances
FROM search_analytics.google_domain_distribution gdd
WHERE gdd.collection_timestamp > NOW() - INTERVAL '30 days'
GROUP BY gdd.domain
ORDER BY total_appearances DESC
LIMIT 10;

-- Naver 뉴스 제공자 점유율
SELECT
  provider,
  COUNT(*) as article_count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 1) as share_pct
FROM news_scraper.naver_news_articles
WHERE published_at > NOW() - INTERVAL '30 days'
GROUP BY provider
ORDER BY article_count DESC
LIMIT 10;
```

#### 인사이트
- **킬러 인사이트**: bloomingbit.io가 coindesk보다 한국 검색 점유율이 높을 수 있음
- **액션**: 글로벌 미디어 한국어판 $20K 대신, 실제 점유율 상위 매체에 예산 배분

#### 기술 주의사항 (Recharts v3)
- PieChart `data` prop에 TypeScript interface(`SEOItem`) 직접 사용 시 index signature 오류
- 해결: `toChartData()` 헬퍼로 `Record<string, unknown>[]`로 변환 후 전달

---

## 데이터 플로우 다이어그램

```
┌─────────────────────────────────────────────────────────┐
│                    KOL DB (PostgreSQL)                   │
├─────────────┬──────────────┬────────────┬───────────────┤
│crypto_market│   telegram   │search_anal │   youtube     │
│             │              │            │               │
│exchanges    │channels      │keywords    │channels       │
│currencies   │daily_keyword │monthly_    │videos         │
│cmc_exchange │  _stats      │ naver_     │video_metrics  │
│ _market_    │hourly_channel│ search_    │               │
│  pairs      │ _keyword_    │ stats      │               │
│ (partitioned│  stats       │google_news │               │
│  monthly)   │views_growth  │ _results   │               │
│             │ _tracking    │            │               │
│             │projects      │            │               │
│             │project_      │            │               │
│             │ keywords     │            │               │
│             │channel_      │            │               │
│             │ discussion_  │            │               │
│             │ mapping      │            │               │
├─────────────┴──────────────┴────────────┴───────────────┤
│                                                         │
│  storyteller.storyteller_message_grades (품질 등급)       │
│  storyteller.storyteller_leaderboard_scores (리더보드)    │
│  kol.nodes (채널 티어) + kol.edges (관계)                │
│  news_scraper.naver_news_articles (뉴스 기사)            │
│                                                         │
└─────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│              Server Actions (actions.ts) — 8개           │
├─────────────────────────────────────────────────────────┤
│ fetchPulseWidgets()       → Top Pulse Widgets           │
│ fetchShillIndex()         → Section 1 Bubble Chart      │
│ fetchNarrativeQuality()   → Section 2 Quality Board     │
│ fetchMediaDivergence()    → Section 3 Dual-Axis Chart   │
│ fetchAlphaLeak()          → Section 4 Timeline          │
│ fetchHiddenOrigin()       → Section 5 Fwd Origin Bar    │
│ fetchRetailIntent(kw)     → Section 6 Intent Bar        │
│ fetchSEOBattlefield()     → Section 7 Donut x2         │
└─────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│              Korea Insights Page                        │
├─────────────────────────────────────────────────────────┤
│ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐                   │
│ │Pulse1│ │Pulse2│ │Pulse3│ │Pulse4│  ← Row 1          │
│ └──────┘ └──────┘ └──────┘ └──────┘                   │
│ ┌────────────────────┐┌────────────────┐               │
│ │ Shill-to-Volume    ││ Narrative      │  ← Row 2      │
│ │ (60%)              ││ Quality (40%)  │               │
│ └────────────────────┘└────────────────┘               │
│ ┌────────────────────┐┌────────────────┐               │
│ │ Media vs Social    ││ Alpha Leak     │  ← Row 3      │
│ │ (50%)              ││ Timeline (50%) │               │
│ └────────────────────┘└────────────────┘               │
│ ┌────────────────────┐┌────────────────┐               │
│ │ Hidden Origin      ││ Retail Intent  │  ← Row 4 NEW  │
│ │ (50%)              ││ Spectrum (50%) │               │
│ └────────────────────┘└────────────────┘               │
│ ┌──────────────────────────────────────┐               │
│ │ SEO Battlefield (100%)              │  ← Row 5 NEW  │
│ │ Google Donut │ Naver Donut          │               │
│ └──────────────────────────────────────┘               │
└─────────────────────────────────────────────────────────┘
```

---

## 기술 구현 포인트

### CMC 파티션 테이블 헬퍼
```typescript
// utils/supabase/partition.ts
export function getCmcPartitionTable(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `cmc_exchange_market_pairs_y${year}m${month}`;
}
```

### DB 연결 (pg 직접 사용)
KOL DB는 Supabase REST API가 아닌 PostgreSQL 직접 연결이 필요 (cross-schema 쿼리)
```typescript
// utils/supabase/kol-db.ts
import { Client } from 'pg';

export async function getKolDbClient() {
  const client = new Client({
    host: process.env.KOL_DB_HOST,
    port: parseInt(process.env.KOL_DB_PORT || '5432'),
    database: process.env.KOL_DB_NAME,
    user: process.env.KOL_DB_USER,
    password: process.env.KOL_DB_PASSWORD,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  return client;
}
```

### 캐싱 전략
- CMC 데이터: ISR 60초 (기존 crypto-dashboard와 동일)
- 텔레그램 일간 통계: ISR 300초 (5분)
- 네이버 월간: ISR 3600초 (1시간)

---

## 구현 이력

| 순위 | 섹션 | 이유 | 상태 |
|------|------|------|------|
| 1 | Pulse Widgets + Shill-to-Volume | 가장 직관적이고 임팩트 큼, 기존 데이터로 즉시 구현 가능 | ✅ 완료 |
| 2 | Narrative Quality Board | storyteller 데이터가 풍부하고 JOIN이 단순 | ✅ 완료 |
| 3 | Media vs Social Divergence | 구글 뉴스 + 텔레그램 비교는 유니크한 인사이트 | ✅ 완료 |
| 4 | Alpha Leak Timeline | 가장 복잡하지만 DeSpread만의 차별화 포인트 | ✅ 완료 |
| 5 | Hidden Origin (포워딩 발원지) | Go-to-Market 전략: 루트 채널 식별 | ✅ 완료 (2026-02-12) |
| 6 | Retail Intent Spectrum (검색 의도) | 리테일 심리 분석으로 타겟 전략 수립 | ✅ 완료 (2026-02-12) |
| 7 | SEO Battlefield (미디어 점유율) | PR 예산 최적화를 위한 미디어 점유율 | ✅ 완료 (2026-02-12) |

## 기술 이슈 & 해결

| 이슈 | 원인 | 해결 |
|------|------|------|
| Hidden Origin 포워딩 횟수 과다 | 텔레그램 자동포워딩 (채널→연결 채팅방) 포함 | `channel_discussion_mapping` NOT EXISTS 필터 |
| Hidden Origin #1 Unknown | `fwd_peer_id`가 `channels` 테이블에 미등록 | LEFT JOIN → INNER JOIN 변경 |
| `messages` 테이블 `channel_id` 오류 | 실제 컬럼명은 `chat_id` | 실제 DB information_schema 검증 후 수정 |
| Recharts v3 PieChart 타입 오류 | typed interface에 index signature 없음 | `Record<string, unknown>[]`로 변환 |
| `naver_news_articles` 범용 키워드만 | 11개 범용 키워드(비트코인, 가상자산 등)로만 수집, 개별 프로젝트 매칭 불가 | Korea Data에서 범용 키워드 전체 기사 표시로 전환 |
| `project_keywords.is_active` 미존재 | 스키마 문서에 기재되나 실제 DB에 없음 (에러 42703) | 해당 필터 사용 금지, DB_SCHEMA.md에 경고 추가 |
| PostgreSQL bigint→int 오버플로 | `channel_id::int` 등에서 에러 22003 | 모든 `::int` → `::bigint`, channel_id는 `::text` |

---

# Part 2: Korea Data (`/korea-data`)

> 2026-02-13 생성. Gemini 3-pro-preview와 3라운드 토론으로 설계.
> 2026-02-13 리팩토링 완료: 데이터 파이프라인 전면 재작성

## 컨셉: "프로젝트별 한국 시장 스코어카드"
해외 프로젝트팀이 한국 시장에서 개별 프로젝트의 원시 데이터를 조회할 수 있는 페이지.

## 아키텍처
- **프로젝트 선택기**: `telegram.projects` (372개) 에서 선택
- **Pre-TGE / Post-TGE 자동 전환**: `projects.tge` 필드 기반 (boolean: true=Post-TGE, false/null=Pre-TGE)
- **5개 스코어 카드** (각 0-100점) + 상세 데이터 탭 + 디버그 Raw Data 패널
- **데스크톱 5열 그리드**: `grid-cols-2 sm:grid-cols-3 lg:grid-cols-5`
- **각 스코어카드에 subtitle**: 예) "1.2K mentions", "3 exchanges"

## 5개 스코어 정의 (리팩토링 후)

### ① Telegram Score (커뮤니티 활동량)
- **데이터**: `telegram.daily_channel_keyword_stats` (project_id 기반) + `hourly_channel_keyword_stats` + `channels` + `kol.nodes` + `channel_metrics`
- **함수 시그니처**: `fetchTelegramScore(ticker: string, projectId: number)`
- **4개 쿼리**:
  1. 일별 멘션 (30일): `daily_channel_keyword_stats WHERE project_id = $1`
  2. 시간별 히트맵 (7일): `hourly_channel_keyword_stats` → `EXTRACT(DOW, HOUR)` 집계
  3. 톱 채널 (30일): `daily_channel_keyword_stats` JOIN `channels` + `kol.nodes` + `channel_metrics`
  4. 유니크 채널 수: `COUNT(DISTINCT channel_id)`
- **스코어 공식**:
  - Volume (40%): `log(totalMentions+1) / log(10000) * 100`
  - Trend (30%): `50 + mentionTrend%` (최근 7일 vs 이전 7일, clamp 0-100)
  - Reach (30%): `uniqueChannels / 50 * 100`
- **상세 탭** (TelegramDetail.tsx):
  - 요약 지표: Score + Mentions 30d + Trend % + Channels
  - 일별 멘션 LineChart (height 250)
  - 시간별 히트맵: 7행(요일) x 24열(시간) CSS 그리드, `rgba(0,55,240, intensity)` 색상
  - 톱 채널 테이블: # / Channel / Tier / Mentions / Subscribers / Median Views

### ② SEO Score (검색 가시성)
- **데이터**: `search_analytics.monthly_naver_search_stats` (via `project_keywords` 브릿지)
- **함수 시그니처**: `fetchSEOScore(projectId: number)`
- **조인 경로**: `telegram.project_keywords(project_id)` → `LOWER(keyword)` → `search_analytics.keywords(keyword)` → `monthly_naver_search_stats`
- **공식**: log-based normalization of total_volume
- **상세 탭** (SEODetail.tsx): 월별 네이버 검색량 추이, 콘텐츠 타입(Blog/Cafe/News/Web) 분해
- ⚠️ tickFormatter: `String(v).slice(2)` 사용 (Recharts v3 non-string 값 대응)

### ③ YouTube Score (유튜브 마인드쉐어)
- **데이터**: `youtube.videos` + `video_metrics` + `video_keywords` + `project_keywords`
- **함수 시그니처**: `fetchYoutubeScore(projectId: number)`
- **공식**: (view_score * 0.7 + count_score * 0.3)
- **상세 탭** (YoutubeDetail.tsx): 최근 30일 영상 리스트 (제목, 조회수, 좋아요)
- ⚠️ `view_count::bigint`, `like_count::bigint` 캐스트 필수 (bigint 컬럼)

### ④ News (프로젝트 무관 독립 섹션 — K-Score 미포함)
- **데이터**: `news_scraper.naver_news_articles` (프로젝트 무관, 전체 기사)
- **함수 시그니처**: `fetchNewsData()` (파라미터 없음)
- **핵심**: `naver_news_articles`는 11개 범용 키워드로만 수집 → K-Score에서 제외, 페이지 하단에 항상 표시
- **서버사이드 fetch**: `page.tsx`에서 미리 fetch하여 `KoreaDataClient`에 prop으로 전달
- **카테고리 매핑** (`NEWS_CATEGORY_MAP`):
  - 코인: 비트코인, 이더리움, 솔라나, 리플
  - 산업/기술: 블록체인, NFT, 디파이, 웹3, 메타버스
  - 시장/규제: 가상자산, 코인, 암호화폐
- **독립 섹션** (NewsSection.tsx):
  - 카테고리 필터 pill 버튼 (전체/코인/산업기술/시장규제)
  - 2열 레이아웃: 기사 카드 리스트 (좌) + 일별 기사 수 차트 + 키워드 분포 (우)
  - 기사 카드: 제목 + 키워드 배지 + 언론사 + 시간

### ⑤ Exchange Score (거래소 유동성 — Post-TGE Only)
- **데이터**: `crypto_market.cmc_exchange_market_pairs` (한국 거래소, KRW 페어 필터)
- **함수 시그니처**: `fetchExchangeScore(ticker: string)`
- **변경**: AVG → SUM, KRW 페어 필터 (`market_pair LIKE '%/KRW'`), depth/liquidity도 SUM
- **공식**: volume_score * 0.6 + depth_score * 0.4
- **상세 탭** (ExchangeDetail.tsx): 거래소별 볼륨 차트, 호가 깊이 테이블, Buy/Sell Depth 비율 + Kimchi Premium (Coming Soon)

### RawDataPanel.tsx (디버그)
- 페이지 하단 접이식 "Raw Data (Debug)" 패널
- Meta 정보: ticker, projectId, K-Score, Post-TGE 여부
- 5셀 그리드: 각 데이터 소스 존재 여부 (green=있음, red=null)
- 접이식 JSON 블록: 각 데이터 소스의 전체 JSON (행 수 표시)

## 종합 K-Score 가중치 (뉴스 제외, 비례 재배분)
| 카테고리 | Pre-TGE | Post-TGE |
|---------|---------|----------|
| Telegram | 59% | 29% |
| SEO | 23% | 12% |
| YouTube | 18% | 12% |
| Exchange | 0% | 47% |

News는 K-Score에서 제외 (프로젝트 무관 데이터이므로). 페이지 하단에 항상 표시.
데이터 없는 스코어는 N/A 처리, 나머지 가중치 자동 재분배.
K-Score는 클라이언트에서 계산 (모든 하위 점수 도착 후 가중평균).

## 크로스 스키마 연결 전략 (리팩토링 후)
```
telegram.projects (id, ticker)
  → daily_channel_keyword_stats.project_id (텔레그램 멘션 — 가장 넓은 커버리지)
  → hourly_channel_keyword_stats.project_id (시간별 히트맵)
  → project_keywords.project_id → LOWER(keyword) → search_analytics.keywords (SEO)
  → project_keywords.project_id → LOWER(keyword) → youtube.keywords (유튜브)
  → currencies.symbol = ticker (거래소 데이터 연결)

news_scraper.naver_news_articles
  → 프로젝트 연결 없음 (범용 키워드 기반 전체 기사)
  → search_keyword로 분류 (비트코인, 가상자산, 블록체인 등 11개)
```

⚠️ **사용하지 않는 경로 (폐기)**:
- ~~`tracking_keyword_groups.name = ticker` → `tracking_keywords` → `search_analytics.keywords`~~ (65개 그룹 병목)
- ~~`storyteller_message_grades`~~ (17.5% 커버리지 — 별도 storyteller 전용)
- ~~`project_keywords` → `naver_news_articles`~~ (11개 범용 키워드만 수집, 개별 프로젝트 매칭 불가)

## SECTOR_MAP (코드 내 상수)
뉴스가 범용 키워드 기반이므로 섹터 분류는 코드 내 `SECTOR_MAP` 상수로 관리:
```typescript
const SECTOR_MAP: Record<string, string> = {
  BTC: "L1", ETH: "L1", SOL: "L1", AVAX: "L1", SUI: "L1", APT: "L1", ...
  OP: "L2", ARB: "L2", MATIC: "L2", ...
  UNI: "DeFi", AAVE: "DeFi", ...
  AXS: "Gaming", SAND: "Gaming", ...
  FET: "AI", RNDR: "AI", ...
  DOGE: "Meme", PEPE: "Meme", ...
  LINK: "Infra", GRT: "Infra", ...
};
```

## 기술 이슈 & 해결

| 이슈 | 원인 | 해결 |
|------|------|------|
| Telegram 대부분 null | `storyteller_message_grades` 65/372 프로젝트만 커버 (17.5%) | `daily_channel_keyword_stats` (project_id 기반, 전체 커버) 사용 |
| `daily_keyword_stats` 매칭 실패 | ticker 기반 매칭 불안정 | `_channel_` 버전 (project_id 기반) 전환 |
| SEO 65개만 커버 | `tracking_keyword_groups` 병목 (65행) | `project_keywords` 브릿지 (714행) 사용 |
| PostgreSQL 에러 22003 | `channel_id::int`에서 bigint→int 오버플로 (int84 루틴) | 모든 `::int` → `::bigint`, channel_id는 `::text` |
| `project_keywords.is_active` 에러 | 스키마 문서에 기재되나 실제 DB에 미존재 (42703) | is_active 필터 제거, DB_SCHEMA.md에 경고 추가 |
| News 대부분 null (ZRO 등) | `naver_news_articles`는 11개 범용 키워드만 수집 | 범용 키워드 기반 전체 기사 표시로 전환 |
| SEODetail `v.slice` 에러 | Recharts v3 tickFormatter에 non-string 전달 | `(v) => String(v).slice(2)` |
| YouTube view_count 오버플로 | `view_count`, `like_count`가 bigint 컬럼 | `::bigint` 캐스트 |
| `nna.link` 컬럼 미존재 | 실제 컬럼명은 `url` | `nna.link` → `nna.url` 수정 |

## 구현 이력

| 날짜 | 내용 | 상태 |
|------|------|------|
| 2026-02-13 | 초기 구현 (Gemini 설계 기반) | ✅ 완료 |
| 2026-02-13 | 리팩토링: Telegram → daily_channel_keyword_stats | ✅ 완료 |
| 2026-02-13 | 리팩토링: SEO → project_keywords 브릿지 | ✅ 완료 |
| 2026-02-13 | 리팩토링: News → 범용 키워드 전체 기사 | ✅ 완료 |
| 2026-02-13 | bigint 오버플로 수정 (전체 파일) | ✅ 완료 |
| 2026-02-13 | RawDataPanel 디버그 패널 추가 | ✅ 완료 |
| 2026-02-13 | UI 리팩토링: 5열 그리드, subtitle, 히트맵, 톱 채널 테이블 | ✅ 완료 |
| 2026-02-13 | Recharts v3 tickFormatter 수정 | ✅ 완료 |
| 2026-02-13 | is_active 필터 제거 (DB 미존재 확인) | ✅ 완료 |
| 2026-02-19 | 점진적 로딩: 개별 ScoreCard 독립 fetch + 클라이언트 K-Score 계산 | ✅ 완료 |
| 2026-02-19 | 뉴스 독립 분리: K-Score 제외, 하단 항상 표시, 카테고리 필터 | ✅ 완료 |
| 2026-02-19 | 거래소 유동성 수정: AVG→SUM + KRW 페어 필터 | ✅ 완료 |
| 2026-02-19 | Telegram High Impact Mentions 추가 | ✅ 완료 |
| 2026-02-19 | YouTube 링크 추가 (video_id) | ✅ 완료 |
| 2026-02-19 | SEO Naver 검색 링크 추가 | ✅ 완료 |
| 2026-02-19 | Kimchi Premium placeholder 추가 | ✅ 완료 |
| 2026-02-19 | 스켈레톤 UI (미선택 + 로딩 중) | ✅ 완료 |
