"use client";

import React from "react";
import { usePrivy } from "@privy-io/react-auth";
import Image from "next/image";
import { ArrowRightIcon } from "@heroicons/react/24/outline";

export default function LoginGuard() {
  const { login } = usePrivy();

  return (
    // 1. 전체 화면 컨테이너 (스크롤 허용)
    <div className="h-[100dvh] w-full overflow-y-auto bg-white">
      {/* 2. 내부 레이아웃
          - min-h-[600px]: 화면이 너무 작아지면 찌그러지지 않고 스크롤 생성
          - gap-16: 요소들(로고, 버튼, 텍스트) 사이에 최소 64px 간격 강제 유지
      */}
      <div className="relative flex min-h-[600px] h-full w-full flex-col justify-between p-6 sm:p-12 gap-24">
        {/* 배경 패턴 */}
        <div className="fixed inset-0 opacity-[0.03] bg-[radial-gradient(#0037F0_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none"></div>

        {/* [상단] 로고 영역 (flex-1로 남는 공간 차지) */}
        <div className="flex-1 flex items-start justify-start z-20">
          <div className="relative w-28 h-8 md:w-36 md:h-10">
            {/* 로고 색상 변경: 검정 로고를 브랜드 블루(#0037F0)로 변환 */}
            <Image
              src="/logo.svg"
              alt="Company Logo"
              fill
              className="object-contain object-left"
              style={{
                filter:
                  "brightness(0) invert(13%) sepia(94%) saturate(7466%) hue-rotate(243deg) brightness(96%) contrast(142%)",
              }}
              priority
            />
          </div>
        </div>

        {/* [중앙] 로그인 버튼 (shrink-0으로 크기 고정, 위아래 flex-1 + gap-16으로 정중앙 및 간격 유지) */}
        <div className="shrink-0 flex flex-col items-center justify-center gap-5 z-30 animate-in fade-in zoom-in duration-500">
          <button
            onClick={login}
            className="group relative flex items-center justify-center gap-3 overflow-hidden rounded-full bg-[#0037F0] px-12 py-5 text-base font-bold text-white shadow-brand-glow transition-all duration-300 hover:scale-105 hover:bg-blue-700 active:scale-95"
          >
            <span className="relative z-10">Login / Sign up</span>
            <ArrowRightIcon className="relative z-10 h-4 w-4 text-white/70 transition-colors group-hover:text-white" />
          </button>

          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#0037F0]/40">
            Powered by Privy
          </p>
        </div>

        {/* [하단] 슬로건 영역 (flex-1로 남는 공간 차지) */}
        <div className="flex-1 flex items-end justify-start z-20">
          <div className="w-full max-w-4xl text-left">
            <h1
              className="text-[#0037F0] mb-6 uppercase leading-[0.85] tracking-[-0.04em]"
              style={{
                fontFamily: "'General Sans', sans-serif",
                fontSize: "clamp(40px, 9vw, 100px)",
              }}
            >
              Spread
              <br />
              Your
              <br />
              Own
              <br />
              Narrative
            </h1>

            <div className="text-[#0037F0] space-y-3 md:space-y-4 max-w-md">
              <p className="text-sm md:text-lg font-bold leading-snug">
                We set the standard to drive web3&apos;s growth and expansion
              </p>
              <p className="text-xs md:text-sm font-medium leading-relaxed opacity-70">
                DeSpread is a web3 growth studio providing data-driven strategy
                for global teams looking to expand into the Asian market.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
