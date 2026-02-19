# CLAUDE.md

## 프로젝트 개요
DeSpread Internal Dashboard (gomeboard)
- Next.js 16 App Router + Privy Auth + Supabase + Tailwind CSS

## 핵심 문서 (변경 시 반드시 동기화)
| 문서 | 역할 | 동기화 조건 |
|------|------|------------|
| ARCHITECTURE.md | 프로젝트 구조/아키텍처/변경이력 | 페이지 추가/삭제, 구조 변경, 유틸 변경 시 |
| DB_SCHEMA.md | KOL DB 전체 스키마 레퍼런스 | DB 쿼리/컬럼 변경 발견 시 |
| KOREAN_MARKET_INSIGHTS_SPEC.md | Korea 페이지 설계 스펙 | korea-insights/korea-data 페이지 변경 시 |

## 문서 동기화 규칙
1. 코드 변경 시 관련 문서를 반드시 함께 업데이트
2. 새 페이지/기능 추가 시 ARCHITECTURE.md 섹션 2(구조), 5(변경이력) 갱신
3. DB 쿼리 작성 시 DB_SCHEMA.md의 컬럼/타입 참조. 불일치 발견 시 문서 수정
4. korea-insights/korea-data 변경 시 KOREAN_MARKET_INSIGHTS_SPEC.md + ARCHITECTURE.md 동시 업데이트

## 페이지 구조 규칙
- page.tsx는 항상 Server Component (use client 금지)
- 클라이언트 로직은 별도 {Page}Client.tsx로 분리
- 컴포넌트 3개 이상이면 components/ 디렉토리 사용
- Server Actions은 actions.ts에 분리
- 2개 이상 페이지에서 공유하는 컴포넌트는 app/components/에 배치

## DB 스키마 주의사항
- telegram.messages 파티션: chat_id 사용 (NOT channel_id)
- daily/hourly_keyword_stats: channel_id 없음 → 채널별은 _channel_ 버전
- telegram.projects.tge: boolean (NOT timestamp)
- project_keywords.is_active: 실제 DB에 없음
- CMC 35M+ 행: 반드시 파티션 테이블 지정 후 쿼리
- KOL DB는 read-only (analyst_ro)
- storyteller_message_grades: numeric scores 방식 (grade enum 제거됨)
- daily_project_channel_scores_v2: 대시보드 코드에서 미사용 (DB에만 존재)

## 기술 스택 주의사항
- Recharts v3: PieChart data에 Record<string, unknown>[] 필요
- Privy 임베디드 지갑: unlinkWallet 절대 금지
- Windows 환경: .env 파싱 시 \r\n 주의
- KOLGraph.tsx: sigma.js 사용 → dynamic import (ssr: false) 필수
