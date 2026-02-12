# Korean Crypto Market Insights Page - 최종 설계 스펙

> Gemini + Claude 협업으로 도출된 데이터 기반 페이지 설계
> Route: `/korea-insights`

---

## 핵심 컨셉: "K-Narrative Intelligence"
한국 크립토 시장만의 정보 비대칭을 측정하는 대시보드
- **Alpha (KOL/텔레그램)** → **Awareness (네이버/유튜브)** → **Action (거래소 거래량)** 의 흐름을 추적

---

## 페이지 구조 (4개 섹션 + 상단 펄스 위젯)

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
├─────────────┴──────────────┴────────────┴───────────────┤
│                                                         │
│  storyteller.storyteller_message_grades (품질 등급)       │
│  storyteller.storyteller_leaderboard_scores (리더보드)    │
│  kol.nodes (채널 티어) + kol.edges (관계)                │
│                                                         │
└─────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│              Server Actions (actions.ts)                 │
├─────────────────────────────────────────────────────────┤
│ fetchShillIndex()       → Section 1 Bubble Chart        │
│ fetchAlphaLeak()        → Section 2 Timeline            │
│ fetchMediaDivergence()  → Section 3 Dual-Axis Chart     │
│ fetchNarrativeQuality() → Section 4 Stacked Bar + Table │
│ fetchPulseWidgets()     → Top Pulse Widgets             │
└─────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│              Korea Insights Page                        │
├─────────────────────────────────────────────────────────┤
│ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐                   │
│ │Pulse1│ │Pulse2│ │Pulse3│ │Pulse4│  ← 상단 위젯      │
│ └──────┘ └──────┘ └──────┘ └──────┘                   │
│ ┌────────────────────┐┌────────────────┐               │
│ │ Shill-to-Volume    ││ Narrative      │               │
│ │ Bubble Chart       ││ Quality Board  │               │
│ │ (60%)              ││ (40%)          │               │
│ └────────────────────┘└────────────────┘               │
│ ┌────────────────────┐┌────────────────┐               │
│ │ Alpha Leak         ││ Media vs       │               │
│ │ Timeline           ││ Social Chart   │               │
│ │ (50%)              ││ (50%)          │               │
│ └────────────────────┘└────────────────┘               │
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

## 구현 우선순위

| 순위 | 섹션 | 이유 |
|------|------|------|
| 1 | Pulse Widgets + Shill-to-Volume | 가장 직관적이고 임팩트 큼, 기존 데이터로 즉시 구현 가능 |
| 2 | Narrative Quality Board | storyteller 데이터가 풍부하고 JOIN이 단순 |
| 3 | Media vs Social Divergence | 구글 뉴스 + 텔레그램 비교는 유니크한 인사이트 |
| 4 | Alpha Leak Timeline | 가장 복잡하지만 DeSpread만의 차별화 포인트 |
