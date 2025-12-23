// app/components/Navbar.tsx
"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth"; // [변경] NextAuth -> Privy

export default function Navbar() {
  const pathname = usePathname();
  // [변경] session 대신 privy 훅 사용
  const { user, authenticated, login, logout } = usePrivy();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const getNavLinkClass = (path: string) =>
    pathname === path
      ? "text-black font-bold block py-2"
      : "text-gray-500 hover:text-black transition-colors block py-2";

  const navLinks = [
    { name: "Overview", path: "/" },
    { name: "Projects", path: "/projects" },
    { name: "Reports", path: "/reports" },
    { name: "PM Guide", path: "/pm-guide" },
    { name: "Metabase", path: "/metabase" },
    { name: "Storyteller", path: "/storyteller" },
  ];

  // 표시할 이메일 (구글, 애플, 이메일 등에서 가져옴)
  const displayEmail =
    user?.email?.address || user?.google?.email || user?.apple?.email || "";

  return (
    <nav className="sticky top-0 z-50 w-full bg-white/70 backdrop-blur-md border-b border-gray-200/50">
      <div className="max-w-[1600px] mx-auto px-6 h-14 flex items-center justify-between">
        {/* 로고 */}
        <Link
          href="/"
          className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          onClick={() => setIsMenuOpen(false)}
        >
          <div className="w-8 h-8 bg-black text-white rounded-lg flex items-center justify-center font-bold shadow-sm">
            B
          </div>
          <span className="font-semibold text-lg tracking-tight">Ops</span>
        </Link>

        {/* 데스크탑 메뉴 */}
        <div className="hidden md:flex items-center gap-8 text-sm font-medium">
          {navLinks.map((link) => (
            <Link
              key={link.path}
              href={link.path}
              className={getNavLinkClass(link.path)}
            >
              {link.name}
            </Link>
          ))}
        </div>

        {/* 우측 컨트롤 */}
        <div className="flex items-center gap-4">
          {/* [변경] session?.user 대신 authenticated 체크 */}
          {authenticated ? (
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-bold text-gray-900">User</p>
                <p className="text-[10px] text-gray-500">{displayEmail}</p>
              </div>
              <button
                onClick={logout} // [변경] signOut -> logout
                className="w-8 h-8 rounded-full overflow-hidden border border-gray-200 bg-gray-100 flex items-center justify-center text-xs font-bold"
              >
                {/* 이미지가 없으면 이니셜 표시 */}
                {displayEmail.slice(0, 1).toUpperCase()}
              </button>
            </div>
          ) : (
            <button
              onClick={login} // [변경] signIn -> login
              className="bg-black text-white px-4 py-2 rounded-lg text-xs font-bold"
            >
              Sign In
            </button>
          )}

          {/* 햄버거 버튼 */}
          <button
            className="md:hidden text-gray-600 hover:text-black focus:outline-none"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? (
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            ) : (
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* 모바일 메뉴 드롭다운 */}
      {isMenuOpen && (
        <div className="md:hidden absolute top-14 left-0 w-full bg-white border-b border-gray-200 shadow-lg px-6 py-4 flex flex-col gap-2">
          {navLinks.map((link) => (
            <Link
              key={link.path}
              href={link.path}
              className={getNavLinkClass(link.path)}
              onClick={() => setIsMenuOpen(false)}
            >
              {link.name}
            </Link>
          ))}
        </div>
      )}
    </nav>
  );
}
