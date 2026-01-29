// app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";
import Providers from "./providers";
import AuthWrapper from "./components/AuthWrapper";

export const metadata: Metadata = {
  title: "gomeboard",
  description: "Unified Operations Dashboard",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <head>
        <link
          rel="stylesheet"
          as="style"
          crossOrigin="anonymous"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard-dynamic-subset.min.css"
        />
        <link
          href="https://api.fontshare.com/v2/css?f[]=general-sans@700,600,500&display=swap"
          rel="stylesheet"
        />
      </head>
      {/* [핵심] bg-white로 설정하여 모든 틈새를 하얗게 만듭니다 */}
      <body className="font-sans antialiased bg-[#F3F4F6] text-[#1D1D1F]">
        <Providers>
          <AuthWrapper>{children}</AuthWrapper>
        </Providers>
      </body>
    </html>
  );
}
