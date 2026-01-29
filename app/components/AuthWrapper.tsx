"use client";

import React, { useEffect } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useRouter, usePathname } from "next/navigation";
import Navbar from "./Navbar";
import LoginGuard from "./LoginGuard";
import Footer from "./Footer";
import { useUserRole } from "../hooks/useUserRole";

export default function AuthWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const { ready, authenticated } = usePrivy();
  const role = useUserRole();
  const router = useRouter();
  const pathname = usePathname();

  // [수정 1] 리다이렉트 로직을 useEffect 안으로 이동
  useEffect(() => {
    // 로딩이 끝났고(ready), 로그인 상태이며(authenticated), 외부 사용자(external)인 경우
    if (ready && authenticated && role === "external") {
      // 허용되지 않은 페이지에 있다면 강제 이동
      if (!pathname.startsWith("/storyteller")) {
        router.replace("/storyteller");
      }
    }
  }, [ready, authenticated, role, pathname, router]);

  // 1. 로딩 중 (흰 화면)
  if (!ready) {
    return <div className="min-h-screen bg-[#F3F4F6]" />;
  }

  // 2. 비로그인 상태 -> 로그인 가드 노출
  if (!authenticated) {
    return <LoginGuard />;
  }

  // [수정 2] 외부 사용자가 잘못된 페이지에 있을 때, 리다이렉트가 일어나기 전까지 잠시 빈 화면 노출
  if (role === "external" && !pathname.startsWith("/storyteller")) {
    return <div className="min-h-screen bg-[#F3F4F6]" />;
  }

  // 3. 정상 접근 허용
  return (
    <div className="flex flex-col min-h-screen bg-[#F3F4F6]">
      {/* 네비게이션바 (고정) */}
      <div className="flex-none z-50 sticky top-0">
        <Navbar />
      </div>

      {/* [중요] flex-1: 남은 공간을 모두 차지함 
         컨텐츠가 짧아도 이 영역이 늘어나서 푸터를 바닥으로 밀어버립니다.
         w-full: 가로 꽉 채움
      */}
      <main className="flex-1 flex flex-col w-full relative bg-mesh">{children}</main>

      {/* 푸터 (고정) */}
      <div className="flex-none">
        <Footer />
      </div>
    </div>
  );
}
