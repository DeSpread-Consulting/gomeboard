"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signIn, signOut } from "next-auth/react";

export default function Navbar() {
  const pathname = usePathname();
  const { data: session } = useSession();
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
          {session?.user ? (
            <div className="flex items-center gap-3">
              {/* [수정] 이메일 다시 추가됨 */}
              <div className="text-right hidden sm:block">
                <p className="text-xs font-bold text-gray-900">
                  {session.user.name}
                </p>
                <p className="text-[10px] text-gray-500">
                  {session.user.email}
                </p>
              </div>
              <button
                onClick={() => signOut()}
                className="w-8 h-8 rounded-full overflow-hidden border border-gray-200"
              >
                {session.user.image ? (
                  <img
                    src={session.user.image}
                    alt="Profile"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-blue-500" />
                )}
              </button>
            </div>
          ) : (
            <button
              onClick={() => signIn("google")}
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
