# DeSpread Internal Dashboard

텔레그램 KOL 캠페인 운영을 위한 내부 관리 대시보드.

## Tech Stack

- **Framework**: Next.js 16 (App Router, Turbopack)
- **Auth**: Privy (Google/Apple 소셜 로그인 + 임베디드 EVM/Solana 지갑)
- **DB**: Supabase
- **Styling**: Tailwind CSS
- **Blockchain**: viem, @solana/web3.js

## Getting Started

```bash
npm install
npm run dev
```

`.env.local`에 필요한 환경변수:
- `NEXT_PUBLIC_PRIVY_APP_ID` - Privy 앱 ID
- Supabase 관련 키

## Pages

### `/` - Home
프로젝트 홈. 대시보드 진입점.

### `/mypage` - My Page
사용자 계정 및 지갑 관리.
- **Linked Accounts**: Telegram, Google, Apple, Twitter, Discord, Email 연동/해제
- **Privy Wallet**: Privy 임베디드 EVM/Solana 지갑 주소 표시, 잔액 조회 (ETH, SOL, USDT on Ethereum/Arbitrum/Solana)
- **External Wallet**: MetaMask 등 외부 지갑 연결/해제
- **채널 인증**: 텔레그램 채널 소유권 인증 (봇 기반)
- **My Rankings**: 인증된 채널의 캠페인별 순위 표시

### `/settlement` - KOL Settlement
월별 KOL 정산 관리 대시보드. 4개 탭 구성.
- **정산 요약**: 채널별 월간 정산 요약 (작성/포워딩 건수, 금액), 정산 안내 DM 전송, PDF 공유, **USDT 지급** (Privy 지갑 또는 외부 개인지갑 선택 가능)
- **링크 등록**: 텔레그램 게시글 링크 다중 등록 (중복 검사, 마감월 차단)
- **컨텐츠 요청**: KOL에게 텔레그램 DM으로 컨텐츠 작성/포워딩 요청 일괄 전송
- **채널 관리**: KOL 채널 CRUD (티어, 단가, 지갑주소, 활성 상태 관리)

### `/kol` - KOL Leaderboard
KOL 리더보드 (공개).

### `/crypto-dashboard` - Crypto Dashboard
크립토 시장 데이터 대시보드.

### `/projects` - Projects
프로젝트 목록 및 관리.

### `/reports` - Reports
리포트 조회.

### `/storyteller` - Storyteller
스토리텔러 기능.

### `/kimchimap` - Kimchi Map
김치맵 시각화.

## API Routes

| Route | 설명 |
|-------|------|
| `/api/auth/[...nextauth]` | NextAuth 인증 |
| `/api/my-rank` | 사용자 채널 순위 조회 |
| `/api/verify-channel` | 텔레그램 채널 소유권 인증 |
| `/api/mindshare` | 마인드셰어 데이터 |
| `/api/history` | 히스토리 데이터 |
| `/api/cron/storyteller` | 스토리텔러 크론 |
| `/api/cron/update-channels` | 채널 정보 업데이트 크론 |

## Utilities

| 파일 | 설명 |
|------|------|
| `utils/payment.ts` | USDT 전송 - EVM(ERC-20 인코딩) + Solana(SPL Token 트랜잭션 빌드) |
| `utils/balance.ts` | 잔액 조회 - ETH/USDT(Ethereum, Arbitrum) + SOL/USDT(Solana) |
| `utils/supabase/` | Supabase 클라이언트 (client/server/oracle) |
