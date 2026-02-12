# System Overview

> Claude Code context document. 프로젝트 구조, 아키텍처, 주요 변경 이력을 기록하여 세션 리셋 후에도 빠르게 파악할 수 있도록 한다.

---

## 1. 프로젝트 개요

**DeSpread Internal Dashboard** - 텔레그램 KOL(Key Opinion Leader) 캠페인 운영을 위한 내부 관리 도구.
- Next.js 16 (App Router, Turbopack)
- Privy 인증 (Google/Apple 로그인 + 임베디드 EVM/Solana 지갑 자동 생성)
- Supabase (DB + Auth)
- Tailwind CSS

---

## 2. 디렉토리 구조

```
app/
├── layout.tsx              # RootLayout (Providers 래핑)
├── providers.tsx            # PrivyProvider 설정
├── page.tsx                 # 홈 (/)
├── mypage/page.tsx          # 마이페이지 - 계정연동, 지갑, 채널인증, 랭킹
├── settlement/page.tsx      # KOL 정산 대시보드 - 링크등록, 요약, 지급, 채널관리
├── kol/page.tsx             # KOL 리더보드 (public)
├── crypto-dashboard/page.tsx# 크립토 대시보드
├── projects/page.tsx        # 프로젝트 목록
├── reports/page.tsx         # 리포트
├── storyteller/page.tsx     # 스토리텔러
├── kimchimap/page.tsx       # 김치맵
├── api/
│   ├── auth/[...nextauth]/route.ts
│   ├── my-rank/route.ts
│   ├── verify-channel/route.ts
│   ├── mindshare/route.ts
│   ├── history/route.ts
│   └── cron/
│       ├── storyteller/route.ts
│       └── update-channels/route.ts
utils/
├── payment.ts              # USDT 전송 (EVM ERC-20 + Solana SPL Token)
├── balance.ts              # 잔액 조회 (EVM ETH/USDT + Solana SOL/USDT)
└── supabase/
    ├── client.ts           # 브라우저용 Supabase 클라이언트
    ├── server.ts           # 서버용 Supabase 클라이언트
    ├── oracle-client.ts
    └── oracle-server.ts
```

---

## 3. 인증 & 지갑 아키텍처

### Privy 설정 (`app/providers.tsx`)
- `loginMethods`: `["google", "apple"]`
- `embeddedWallets`: EVM + Solana 모두 `createOnLogin: "users-without-wallets"`
- 로그인 시 Privy가 **임베디드 지갑을 자동 생성** (EVM 1개 + Solana 1개)

### 지갑 분류 (중요)
| 구분 | walletClientType | 특징 |
|------|-----------------|------|
| **Privy 임베디드** | `"privy"` 또는 `"privy-v2"` | 자동 생성, unlink하면 **영구 삭제** 후 다음 로그인 시 새 주소로 재생성. **절대 Disconnect 버튼을 보여주면 안 됨** |
| **외부 개인지갑** | `"metamask"`, `"phantom"` 등 | 사용자가 직접 연결. Disconnect 가능 |

### 지갑 주소 가져오는 방법
- **EVM**: `user.linkedAccounts`에서 `chainType==="ethereum" && walletClientType==="privy"` 필터, 또는 `user.wallet.address` fallback
- **Solana**: `user.linkedAccounts`에서 `chainType==="solana" && walletClientType==="privy"` 필터, 또는 `@privy-io/react-auth/solana`의 `useWallets()` 훅에서 fallback

### 훅 import 주의사항 (이름 충돌)
```typescript
// EVM 지갑
import { useWallets } from "@privy-io/react-auth";
// Solana 지갑 (별칭 필수)
import { useWallets as useSolanaWallets } from "@privy-io/react-auth/solana";
```
`settlement/page.tsx`에서는 Solana `useWallets`가 이미 사용 중이므로 EVM을 `useEvmWallets`로 별칭.

---

## 4. 주요 유틸리티

### `utils/payment.ts`
- `encodeERC20Transfer(to, amount)` - EVM USDT 전송 데이터 인코딩
- `buildSolanaTransferTx(from, to, amount)` - Solana SPL Token 전송 트랜잭션 빌드
- `getAvailableNetworks(address)` - 주소 형식으로 사용 가능 네트워크 판별
- 상수: `USDT_ADDRESSES`, `CHAIN_IDS`, `EXPLORER_URLS`, `NETWORK_LABELS`

### `utils/balance.ts`
- `fetchEvmBalance(address, "ethereum"|"arbitrum")` - ETH 네이티브 잔액
- `fetchEvmUsdtBalance(address, "ethereum"|"arbitrum")` - ERC-20 USDT 잔액 (6 decimals)
- `fetchSolBalance(address)` - SOL 네이티브 잔액
- `fetchSolanaUsdtBalance(address)` - Solana SPL USDT 잔액 (ATA 조회)
- RPC: Ethereum(`eth.llamarpc.com`), Arbitrum(`arb1.arbitrum.io/rpc`), Solana(`api.mainnet-beta.solana.com`)
- 모든 함수 try/catch 감싸서 실패 시 `"0"` 반환

---

## 5. 변경 이력

### 2025-02 마이페이지 지갑 분리 + 잔액 조회 + 개인지갑 지급

**문제**: 마이페이지 Wallet 행이 Privy 임베디드 지갑에 `unlinkWallet`(Disconnect)을 노출. 임베디드 지갑을 unlink하면 영구 삭제됨.

**변경 내용**:

1. **`utils/balance.ts` (NEW)** - EVM/Solana 잔액 조회 유틸리티 4개 함수

2. **`app/mypage/page.tsx`**
   - Wallet AccountRow 제거 (임베디드 지갑 Disconnect 방지)
   - **Privy Wallet 카드** 추가: EVM/Solana 주소 표시 + copy + 6칸 잔액 그리드 + Refresh
   - **External Wallet 카드** 추가: 외부 지갑 목록 + Connect/Disconnect
   - `BalanceItem` 컴포넌트 추가 (로딩 스켈레톤 포함)
   - Solana 주소는 `linkedAccounts` → `useSolanaWallets()` 훅 순서로 fallback

3. **`app/settlement/page.tsx`**
   - 지급 모달에 **지갑 선택** UI 추가 (Privy / 개인지갑, EVM일 때만 표시)
   - `handlePayment`에 외부 지갑 분기 추가: `externalEvmWallet.switchChain()` → `getEthereumProvider()` → `eth_sendTransaction`
   - Solana는 항상 Privy 지갑 사용

---

## 6. DB 스키마 (Supabase)

| 테이블 | 주요 컬럼 |
|--------|----------|
| `kol_channels` | id, tier, channel_name, username, subscriber, url, channel_link, price_write, price_forward, wallet_address, memo, is_active, owner_username |
| `kol_settlements` | id, created_at, link_url, post_type(write/forward), amount, wallet_address, channel_id(FK) |
| `monthly_settlements` | year, month, is_closed, closed_at |

---

## 7. KOL DB (외부 PostgreSQL 직접 연결)

> **중요**: 이 DB는 Supabase REST API가 아닌 `pg` 패키지로 PostgreSQL 직접 연결.
> 여러 스키마(crypto_market, telegram, search_analytics 등)를 cross-schema 쿼리해야 하므로 REST API 사용 불가.

### 접속 정보 (.env.local)
```
KOL_DB_HOST=aws-0-ap-northeast-2.pooler.supabase.com
KOL_DB_PORT=5432
KOL_DB_NAME=postgres
KOL_DB_USER=analyst_ro.jtubvpmekasodzakasgv-rr-ap-northeast-2-nvuvh
KOL_DB_PASSWORD=ca64ddwg6JToV6KJLMmm
```
- 유틸리티: `utils/supabase/kol-db.ts` (Pool 기반, `queryKolDb()` 함수)
- read-only 계정 (analyst_ro)

### 스키마 구조

#### crypto_market 스키마 (거래소 시장 데이터 - CoinMarketCap)
| 테이블 | 행 수 | 주요 컬럼 | 비고 |
|--------|-------|----------|------|
| `cmc_exchange_market_pairs` | 35M+ | exchange_id, market_pair("BTC/KRW"), currency_id, price, volume_usd, quote(KRW가격), depth_usd_negative_two/positive_two, effective_liquidity, volume_percent, last_updated | **월별 파티션**: `_y2024m01` ~ `_y2026m03` |
| `currencies` | 4,674 | id, symbol, name, slug | `currency_id`로 JOIN |
| `exchanges` | 16 | id, name, slug | 한국: upbit, bithumb, coinone, korbit, gopax 등. `exchange_id`로 JOIN |

**파티션 테이블명 규칙**: `cmc_exchange_market_pairs_y{YYYY}m{MM}`
헬퍼: `getCmcPartitionTable()` in `utils/supabase/kol-db.ts`

#### telegram 스키마 (한국 크립토 텔레그램 인텔리전스)
| 테이블 | 행 수 | 주요 컬럼 | 비고 |
|--------|-------|----------|------|
| `channels` | 1,433 | channel_id(bigint), username, title, category, is_monitored, memo, is_channel(bool), manual_tier, subscriber_count | KOL 채널 + 그룹챗 |
| `channel_metrics` | 602K | channel_id, participants_count, median_views, median_forwards, stats_date | 일간 채널 통계 |
| `channel_participants` | 1.5M | channel_id, count, created_at | 구독자 수 히스토리 |
| `messages` | 파티션 | **chat_id**(bigint), message_id, content(text), message_timestamp, views_count, forwards_count, fwd_peer_id, fwd_peer_type(enum), fwd_message_id, fwd_date, sender_id(jsonb), entities(jsonb), reactions(jsonb), is_channel_msg(bool), topic_id, fwd(jsonb), quote(jsonb), content_tsv(tsvector) | **월별 파티션**: `messages_y2024m01` ~ `_y2026m12`. ⚠️ `chat_id`임 (`channel_id` 아님!) |
| `channel_discussion_mapping` | 956 | channel_id(bigint=방송채널), groupchat_id(bigint=연결 채팅방), created_at, updated_at | 채널↔토론방 매핑. 자동 포워딩 필터에 사용 |
| `daily_keyword_stats` | 189K | **ticker**(text), **keyword**(text), mention_count, **stats_date**(date) | 전체 채널 집계 (channel_id 없음!) |
| `hourly_keyword_stats` | 2.9M | ticker, keyword, mention_count, **hour_bucket**(timestamptz) | 전체 채널 집계 (channel_id 없음!) |
| `daily_channel_keyword_stats` | 854K | **channel_id**, project_id, keyword, mention_count, stats_date | 채널별 일간 |
| `hourly_channel_keyword_stats` | 1M+ | **channel_id**, project_id, keyword, mention_count, hour_bucket | 채널별 시간대별 |
| `projects` | 372 | id, ticker, tge(bool), logo | 크립토 프로젝트 |
| `project_keywords` | 714 | project_id, keyword | 프로젝트→키워드 매핑 |
| `daily_project_channel_scores_v2` | 10.1M | project_id, stats_date, channel_id, lookback_days(7/30/90), score, mention_count, avg_participants, avg_channel_views, avg_mentions_views | 채널별 프로젝트 영향력 |
| `views_growth_tracking` | 4.2M | channel_id, hour_bucket, hourly_views_added, hourly_forwards_added, growth_rate, trending_score | 시간별 조회수 성장 |
| `channel_views_snapshot` | 4.2M | channel_id, snapshot_time, total_channel_views, avg_views, message_count | 채널 뷰 스냅샷 |
| `tracking_keyword_groups` | 65 | id, name, type, is_active | 키워드 그룹 (storyteller 등) |
| `tracking_keywords` | 176 | id, group_id, keyword, is_active | 개별 추적 키워드 |

**주의**: `daily_keyword_stats` / `hourly_keyword_stats`는 전체 집계이므로 channel_id가 없음. 채널별 분석이 필요하면 `daily_channel_keyword_stats` / `hourly_channel_keyword_stats` 사용.

#### search_analytics 스키마 (네이버 & 구글 검색 데이터)
| 테이블 | 행 수 | 주요 컬럼 | 비고 |
|--------|-------|----------|------|
| `keywords` | 806 | id, keyword | 추적 검색 키워드 (한국어 프로젝트명) |
| `monthly_naver_search_stats` | 4,572 | keyword_id, pc_volume, mobile_volume, **total_volume**, competition_index, blog_count, cafe_count, news_count, year_month | **월간 단위만** (일간/시간 없음) |
| `monthly_naver_related_keywords` | 24,677 | keyword_id, related_keyword, search_volume, year_month | 연관 키워드 + 검색량 |
| `google_news_results` | 263K | keyword_id, rank, title, url, snippet, publisher, published_date, collection_timestamp | 구글 뉴스 기사 |
| `google_news_stats` | 9,594 | keyword_id, total_results, collection_timestamp | 뉴스 결과 수 |
| `google_search_results` | 135K | keyword_id, rank, title, url, snippet, domain, collection_timestamp | 구글 검색 결과 |
| `google_search_stats` | 9,363 | keyword_id, total_results, collection_timestamp | 검색 결과 수 |
| `google_related_keywords` | 75K | keyword_id, related_keyword, relation_type, collection_timestamp | 구글 연관 키워드 |
| `google_domain_distribution` | 275K | keyword_id, domain, count, percentage, search_type, collection_timestamp | 도메인별 검색 점유율 |
| `naver_top_posts` | 2.9M | keyword_id, post_type(blog/cafe), title, link, ranking_type, created_at | 네이버 상위 포스트 |

#### youtube 스키마 (한국 크립토 유튜브)
| 테이블 | 행 수 | 주요 컬럼 | 비고 |
|--------|-------|----------|------|
| `channels` | 3,555 | id(varchar), title, country, published_at | 한국 크립토 유튜브 채널 |
| `channel_metrics` | 226K | channel_id, view_count, subscriber_count, video_count, collected_at | 구독자/조회수 추이 |
| `videos` | 22K | id, channel_id, title, description, tags(ARRAY), duration | 비디오 메타데이터 |
| `video_metrics` | 421K | video_id, view_count, like_count, comment_count, collected_at, hours_since_publish | 조회수/좋아요 추이 |
| `video_keywords` | 38K | video_id, keyword_id, matched_in(title/tags) | 키워드-비디오 매핑 |
| `keywords` | 37 | id, keyword, category, is_active | 추적 유튜브 키워드 |
| `comments` | 544K | id, video_id, text_original, author_display_name, like_count, published_at | 유튜브 댓글 |

#### news_scraper 스키마
| 테이블 | 행 수 | 주요 컬럼 |
|--------|-------|----------|
| `naver_news_articles` | 288K | title, content(전문), url, provider, search_keyword, published_at |

#### kol 스키마 (KOL 네트워크)
| 테이블 | 행 수 | 주요 컬럼 |
|--------|-------|----------|
| `nodes` | 490 | channel_id, platform, title, username, manual_tier, **calculated_tier**(A+/A/B+/B/C/D), total_cited, cited_by_ap_count, noble_score, subscriber_count |
| `edges` | 1,388 | source_id, target_id, weight, is_golden_link |

#### storyteller 스키마
| 테이블 | 행 수 | 주요 컬럼 | 비고 |
|--------|-------|----------|------|
| `storyteller_leaderboard_scores` | 708K | group_id, stats_date, channel_id, lookback_days(7/30/90), score, mention_count, avg_channel_views, avg_mentions_views, raw_score, quality_score, traffic_score, tier | 리더보드 스코어 |
| `storyteller_leaderboards` | 34 | id, **tracking_keyword_group_id**, name, is_public, logo | 리더보드 설정 (tracking_keyword_groups와 연결) |
| `storyteller_message_grades` | 75K | tracking_keyword_group_id, topic, message_id, message_text, **grade**(A/B/C/D enum), reason, is_main, length_chars, evidence_types, hype_count | AI 메시지 품질 평가 |

#### public 스키마
| 테이블 | 행 수 | 비고 |
|--------|-------|------|
| `daily_news_insights` | 610 | AI 뉴스 요약 (session_id, message jsonb) |
| `announce_messages` | 110 | 텔레그램 공지 메시지 |
| `naver_news` | 0 | 비어있음 (사용 안 함) |

### 핵심 JOIN 경로
```
crypto_market.cmc_exchange_market_pairs
  → currencies (currency_id = currencies.id) → symbol로 ticker 매칭
  → exchanges (exchange_id = exchanges.id) → name으로 거래소 필터

telegram.daily_keyword_stats.ticker
  ↔ telegram.projects.ticker (via project_keywords.keyword)

storyteller.storyteller_message_grades.tracking_keyword_group_id
  → telegram.tracking_keyword_groups.id → .name으로 프로젝트명

storyteller.storyteller_leaderboard_scores.group_id
  → storyteller.storyteller_leaderboards.id
  → .tracking_keyword_group_id → telegram.tracking_keyword_groups.id

telegram.hourly_channel_keyword_stats.channel_id
  → telegram.channels.channel_id (manual_tier 확인)
  → kol.nodes.channel_id (calculated_tier 확인)
```

---

## 8. Korea Insights 페이지 (`/korea-insights`)

> 2026-02-12 생성. Gemini CLI와 Claude 협업으로 설계.

### 컨셉: "K-Narrative Intelligence"
한국 크립토 시장만의 정보 비대칭 측정: **Alpha (KOL/텔레그램) → Awareness (네이버/유튜브) → Action (거래소 거래량)**

### Gemini 피드백 요약 (2라운드 진행)

**라운드 1: 구조 제안**
Gemini(gemini-3-flash-preview)에게 전체 DB 스키마를 제공하고 페이지 설계를 요청.
제안된 5개 섹션:
1. **K-Narrative Velocity** - 텔레그램 멘션 vs 가격 변동 (버블차트)
2. **Retail Onboarding Funnel** - 네이버 검색량 → 거래 전환 추적
3. **Alpha Leak Network** - KOL 정보 전파 속도 (A+→C/D 채널)
4. **Exchange Dominance** - 한국 거래소 점유율/유동성
5. **Cross-Data Correlations** - YouTube FOMO 지표, KOL→뉴스 지연 시간

핵심 인사이트: "Shill-to-Volume Ratio" 개념 - 멘션 대비 거래량이 높으면 과대광고 경고

**라운드 2: SQL 구체화**
실제 데이터 상태(월간 네이버, 35M+ CMC 파티션 등)를 피드백.
- K-Sentiment Score = storyteller grade A+B 비율로 프록시
- Shill Index = (mentions / volume_usd) * 1,000,000
- 네이버 월간 한계 → 구글 뉴스(일간)로 보완, 네이버는 배경 참고
- Alpha Leak = hourly_channel_keyword_stats + channels.manual_tier JOIN으로 시간차 분석

**라운드 3: 스키마 보정** (Gemini 429 에러로 Claude가 직접 수행)
- Gemini가 잘못 추정한 컬럼명 전부 수정 (stats_date, hour_bucket, channel_id 유무 등)
- 정확한 JOIN 경로 정리
- CMC 파티션 헬퍼 함수 설계

### 파일 구조
```
app/korea-insights/
├── page.tsx                          # 서버 페이지 (ISR 300초)
├── actions.ts                        # 서버 액션 8개
│   ├── fetchPulseWidgets()           # 상단 펄스 위젯 4개
│   ├── fetchShillIndex()             # Shill-to-Volume 버블차트
│   ├── fetchNarrativeQuality()       # 내러티브 품질 리더보드
│   ├── fetchMediaDivergence(keyword) # 미디어 vs 소셜 (키워드 변경 가능)
│   ├── fetchAlphaLeak()              # Alpha Leak 타임라인
│   ├── fetchHiddenOrigin()           # 포워딩 발원지 (자동포워딩 제외)
│   ├── fetchRetailIntent(keyword)    # 네이버 검색 의도 분석 (키워드 변경 가능)
│   └── fetchSEOBattlefield()         # Google/Naver 미디어 점유율
└── components/
    ├── KoreaInsightsClient.tsx       # 메인 클라이언트 래퍼 (새로고침 기능)
    ├── PulseWidgets.tsx              # BTC멘션, 트렌딩스코어, 네이버검색, 거래량
    ├── ShillToVolumeBubble.tsx       # Recharts ScatterChart (X:거래량, Y:멘션, Z:사이즈)
    ├── NarrativeQualityBoard.tsx     # Stacked BarChart + 상세 테이블
    ├── MediaSocialDivergence.tsx     # ComposedChart (Bar+Line 듀얼축) + 인사이트 박스
    ├── AlphaLeakTimeline.tsx         # 커스텀 수평 바 타임라인
    ├── HiddenOriginChart.tsx         # Recharts Vertical BarChart (티어별 색상)
    ├── RetailIntentSpectrum.tsx      # Recharts Vertical BarChart + 키워드 전환
    └── SEOBattlefield.tsx            # Recharts PieChart 도넛 x2 (Google + Naver)
```

### 데이터 플로우
```
KOL DB (PostgreSQL 직접 연결 via pg Pool)
  ├─ telegram.daily_keyword_stats ──────────→ PulseWidgets (BTC 멘션)
  ├─ telegram.views_growth_tracking ────────→ PulseWidgets (트렌딩 스코어)
  ├─ search_analytics.monthly_naver_search_stats → PulseWidgets (네이버 검색량)
  ├─ crypto_market.cmc_exchange_market_pairs ──→ PulseWidgets (거래량) + ShillIndex
  ├─ telegram.daily_keyword_stats + CMC + storyteller grades → ShillToVolumeBubble
  ├─ telegram.projects + project_keywords + storyteller grades/scores → NarrativeQualityBoard
  ├─ search_analytics.google_news_results + telegram.daily_keyword_stats → MediaSocialDivergence
  ├─ telegram.hourly_channel_keyword_stats + channels + kol.nodes → AlphaLeakTimeline
  ├─ telegram.messages(chat_id, fwd_peer_id) + channel_discussion_mapping + channels + kol.nodes → HiddenOriginChart
  ├─ search_analytics.monthly_naver_related_keywords + keywords → RetailIntentSpectrum
  └─ search_analytics.google_domain_distribution + news_scraper.naver_news_articles → SEOBattlefield
```

### 레이아웃
```
Row 1: Pulse Widgets (4개 KPI 박스)
Row 2: Shill-to-Volume (60%) + Narrative Quality (40%)    — grid-cols-5
Row 3: Media vs Social (50%) + Alpha Leak (50%)           — grid-cols-2
Row 4: Hidden Origin (50%) + Retail Intent (50%)          — grid-cols-2 (NEW)
Row 5: SEO Battlefield (100%)                             — full-width (NEW)
```

### 신규 3개 섹션 (2026-02-12 추가)

#### Hidden Origin — 포워딩 발원지 분석
- **질문**: "구독자 수가 아니라, 누구의 글이 가장 많이 퍼 날라지는가?"
- **데이터**: `telegram.messages` (fwd_peer_id, chat_id) + `channel_discussion_mapping` (자동포워딩 제외) + `channels` + `kol.nodes`
- **시각화**: Recharts BarChart (layout="vertical"), 티어별 색상 (A+=빨강, A=주황, B=노랑, C=파랑, D=회색)
- **핵심 로직**: `NOT EXISTS (channel_discussion_mapping WHERE cdm.channel_id = fwd_peer_id AND cdm.groupchat_id = chat_id)` — 채널→연결 채팅방 자동포워딩 제외
- **Unknown 방지**: `JOIN telegram.channels` (LEFT JOIN 대신 INNER JOIN)

#### Retail Intent Spectrum — 검색 의도 분석
- **질문**: "한국 개미는 투기를 원하나, 기술을 원하나, 온보딩을 원하나?"
- **데이터**: `search_analytics.monthly_naver_related_keywords` + `keywords`
- **시각화**: Recharts BarChart (layout="vertical"), 의도별 색상 (Investment=파랑, Onboarding=초록, Technology=보라, General=회색)
- **키워드 전환**: 비트코인/이더리움/솔라나/리플 (서버 액션 재호출)
- **의도 분류**: SQL CASE문 정규식 — '시세|가격|차트' → Investment, '하는법|가입|지갑' → Onboarding, 'ETF|스테이킹' → Technology

#### SEO Battlefield — 미디어 점유율
- **질문**: "PR 기사를 냈을 때 실제로 노출되는 곳은 어디인가?"
- **데이터**: `search_analytics.google_domain_distribution` + `news_scraper.naver_news_articles`
- **시각화**: Recharts PieChart 도넛 2개 나란히 (Google 도메인 점유율 + Naver 뉴스 제공자)
- **Recharts v3 주의**: PieChart data prop에 typed interface 직접 사용 불가 → `Record<string, unknown>[]`로 변환 필요

### 캐싱 전략
- 페이지 ISR: 300초 (5분)
- 클라이언트 새로고침 버튼으로 수동 갱신 가능
- MediaSocialDivergence, RetailIntentSpectrum은 키워드 변경 시 서버 액션 재호출

---

## 9. Supabase 인스턴스 정리

| 인스턴스 | 환경변수 | 용도 | 연결 방식 |
|----------|---------|------|----------|
| **Main DB** | `NEXT_PUBLIC_SUPABASE_URL` / `_ANON_KEY` | KOL 정산(kol_channels, kol_settlements, monthly_settlements) | Supabase REST (`@supabase/ssr`) |
| **Oracle DB** | `NEXT_PUBLIC_ORACLE_SUPABASE_URL` / `_ANON_KEY` | 시장 데이터(crypto_candle_feeds, stock_candle_feeds) | Supabase REST |
| **KOL DB** | `KOL_DB_HOST/PORT/NAME/USER/PASSWORD` | 텔레그램/검색/유튜브/CMC 전체 분석 데이터 | **PostgreSQL 직접 연결** (`pg` 패키지) |

---

## 10. 주의사항

- Privy 임베디드 지갑은 **절대 unlinkWallet 호출 금지** (영구 삭제됨)
- Solana `useWallets` 타입에 `walletClientType`이 없으므로 `as any` 캐스팅 필요
- `settlement/page.tsx`는 약 2200줄로 큰 파일. 읽을 때 offset/limit 사용 필요
- 공용 RPC는 rate limit 있으므로 잔액 조회 실패 가능. Promise.allSettled로 처리
- KOL DB는 **read-only** 계정 (analyst_ro) — INSERT/UPDATE/DELETE 불가
- CMC 데이터 35M+ 행 — 반드시 파티션 테이블 지정 (`getCmcPartitionTable()`) 후 쿼리, 전체 테이블 스캔 금지
- `daily_keyword_stats` / `hourly_keyword_stats`에는 **channel_id가 없음** — 채널별 분석은 `_channel_` 버전 사용
- 네이버 검색 데이터는 **월간만** 제공 — 일간 트렌드는 구글 뉴스로 대체
- `telegram.messages` 파티션 테이블의 채널 컬럼은 **`chat_id`** (NOT `channel_id`) — 실제 DB 검증 완료
- `telegram.channel_discussion_mapping` (956행): 채널→연결 채팅방 매핑. 포워딩 분석 시 자동포워딩 제외 필수
- **전체 DB 컬럼 레퍼런스**: `DB_SCHEMA.md` 참고 (information_schema에서 덤프)
- Recharts v3: PieChart data에 typed interface 직접 불가 → `Record<string, unknown>[]`로 변환
- Gemini CLI 모델: `gemini-3-flash-preview` 사용 (2.5-pro, 2.5-flash 등은 429 에러 빈발)
