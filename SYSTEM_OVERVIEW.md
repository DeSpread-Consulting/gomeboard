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

## 7. 주의사항

- Privy 임베디드 지갑은 **절대 unlinkWallet 호출 금지** (영구 삭제됨)
- Solana `useWallets` 타입에 `walletClientType`이 없으므로 `as any` 캐스팅 필요
- `settlement/page.tsx`는 약 2200줄로 큰 파일. 읽을 때 offset/limit 사용 필요
- 공용 RPC는 rate limit 있으므로 잔액 조회 실패 가능. Promise.allSettled로 처리
