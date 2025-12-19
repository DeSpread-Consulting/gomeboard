// app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";
import AuthSessionProvider from "./providers";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer"; // [NEW]
import LoginGuard from "./components/LoginGuard"; // [NEW] 로그인 안내창

// [NEW] 서버 사이드 세션 체크를 위한 도구들
import { getServerSession } from "next-auth";
import { authOptions } from "./api/auth/[...nextauth]/route";

export const metadata: Metadata = {
  title: "gomeboard",
  description: "Internal Operations Dashboard",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // [핵심] 서버에서 미리 로그인 여부 확인
  const session = await getServerSession(authOptions);
  return (
    <html lang="ko">
      <head>
        {/* [NEW] 프리텐다드 폰트 CDN 로드 */}
        <link
          rel="stylesheet"
          as="style"
          crossOrigin="anonymous"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard-dynamic-subset.min.css"
        />
      </head>
      {/* 폰트 패밀리 적용 */}
      <body className="font-sans antialiased bg-[#F5F5F7]">
        <AuthSessionProvider>
          {/* 1. 네비게이션 바는 항상 보임 (로그인 버튼 때문에) */}
          <Navbar />

          {/* 2. 본문 내용(children)은 로그인이 된 사람에게만 보냄 */}
          {session ? (
            children
          ) : (
            // 로그인이 안 된 경우 본문 대신 이 컴포넌트를 보여줌
            <LoginGuard />
          )}
          {session && <Footer />}
        </AuthSessionProvider>
      </body>
    </html>
  );
}
