// app/components/Navbar.tsx
"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { useUserRole } from "../hooks/useUserRole";
import {
  Bars3Icon,
  ArrowRightStartOnRectangleIcon,
  ChartBarIcon,
  FireIcon,
  Cog6ToothIcon,
} from "@heroicons/react/24/outline";

export default function Navbar() {
  const pathname = usePathname();
  const { authenticated, login, logout, user } = usePrivy();
  const role = useUserRole();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // [추가] 드롭다운 상태 관리
  const [hoveredMenu, setHoveredMenu] = useState<string | null>(null);

  // 메뉴 리스트 구조 변경 (children 속성 추가)
  const navLinks = [
    { name: "Overview", path: "/", allowed: ["internal"] },
    { name: "Crypto", path: "/crypto-dashboard", allowed: ["internal"] },
    { name: "Projects", path: "/projects", allowed: ["internal"] },
    { name: "Reports", path: "/reports", allowed: ["internal"] },
    {
      name: "Mindshare",
      path: "/storyteller",
      allowed: ["internal"],
      children: [
        {
          name: "Storyteller",
          path: "/storyteller",
          description: "Influence Intelligence",
        },
        {
          name: "Kimchi Map",
          path: "/kimchimap",
          description: "Community Mindshare",
        },
      ],
    },
    { name: "KOL", path: "/kol", allowed: ["internal"] },
    { name: "Settle", path: "/settlement", allowed: ["internal"] },
  ];

  const visibleLinks = navLinks.filter((link) => link.allowed.includes(role));

  const getNavLinkClass = (path: string) =>
    pathname === path
      ? "text-black font-bold block py-2"
      : "text-gray-500 hover:text-black transition-colors block py-2";

  // [수정] 프로필 정보 우선순위 로직 (텔레그램 최우선)
  const getProfileInfo = () => {
    if (!user) return { name: "Guest", image: null };

    // 1. Telegram
    if (user.telegram) {
      return {
        name:
          user.telegram.username || user.telegram.firstName || "Telegram User",
        image: user.telegram.photoUrl,
        type: "telegram",
      };
    }
    // 2. Twitter
    if (user.twitter) {
      return {
        name: user.twitter.username || "Twitter User",
        image: user.twitter.profilePictureUrl,
        type: "twitter",
      };
    }
    // 3. Google
    if (user.google) {
      return {
        name: user.google.name || user.google.email,
        type: "google",
      };
    }
    // 4. Default (Email/Wallet)
    return {
      name: user.email?.address || user.wallet?.address.slice(0, 6) || "User",
      image: null,
      type: "default",
    };
  };

  const profile = getProfileInfo();

  return (
    <nav className="sticky top-0 z-50 w-full glass-nav">
      <div className="max-w-[1600px] mx-auto px-6 h-14 flex items-center justify-between">
        {/* 로고 */}
        <Link
          href={role === "external" ? "/storyteller" : "/"}
          className="flex items-center gap-2 hover:opacity-80 transition-opacity"
        >
          <div className="w-8 h-8 bg-[#0037F0] text-white rounded-lg flex items-center justify-center font-bold shadow-brand-glow">
            B
          </div>
          <span className="font-semibold text-lg tracking-tight">Ops</span>
        </Link>

        {/* 데스크탑 메뉴 */}
        <div className="hidden md:flex items-center gap-1 text-sm font-medium h-full">
          {visibleLinks.map((link) => (
            <div
              key={link.name}
              className="relative h-full flex items-center"
              onMouseEnter={() => setHoveredMenu(link.name)}
            >
              {link.children ? (
                // 드롭다운이 있는 메뉴 (Mindshare)
                <button
                  className={`px-4 py-2 transition-colors ${
                    pathname.startsWith(link.path) ||
                    link.children.some((c) => pathname === c.path)
                      ? "text-black font-bold"
                      : "text-gray-500 hover:text-black"
                  }`}
                >
                  {link.name}
                </button>
              ) : (
                // 일반 링크
                <Link
                  href={link.path}
                  className={`px-4 py-2 transition-colors ${
                    pathname === link.path
                      ? "text-black font-bold"
                      : "text-gray-500 hover:text-black"
                  }`}
                >
                  {link.name}
                </Link>
              )}
            </div>
          ))}
        </div>

        {/* 우측 컨트롤 */}
        <div className="flex items-center gap-4">
          {authenticated ? (
            <div className="flex items-center gap-3">
              {/* [수정] 프로필 클릭 시 마이페이지 이동 */}
              <Link
                href="/mypage"
                className="group flex items-center gap-3 cursor-pointer"
              >
                <div className="text-right hidden sm:block">
                  <p className="text-xs font-bold text-gray-900 group-hover:text-[#0037F0] transition-colors">
                    {profile.name}
                  </p>
                  <p className="text-[10px] text-gray-500 uppercase flex items-center justify-end gap-1">
                    {profile.type === "telegram" && (
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                    )}
                    {role}
                  </p>
                </div>
                <div className="w-8 h-8 rounded-full overflow-hidden border border-gray-200 bg-white flex items-center justify-center text-xs font-bold relative group-hover:ring-2 group-hover:ring-[#0037F0]/20 transition-all">
                  {profile.image ? (
                    <img
                      src={profile.image}
                      alt="Profile"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-gray-500">
                      {profile.name.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                </div>
              </Link>

              {/* 로그아웃 버튼 */}
              <button
                onClick={logout}
                className="ml-2 text-gray-400 hover:text-red-500 transition-colors"
                title="Sign Out"
              >
                <ArrowRightStartOnRectangleIcon className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <button
              onClick={login}
              className="bg-[#0037F0] text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-blue-700 transition-colors shadow-brand-glow"
            >
              Sign In
            </button>
          )}

          {/* 모바일 햄버거 버튼 */}
          <button
            className="md:hidden"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            <Bars3Icon className="w-6 h-6 text-gray-600" />
          </button>
        </div>
      </div>

      {/* [추가] 애플 스타일 드롭다운 메뉴 */}
      <div
        className={`absolute top-14 left-0 w-full glass-modal overflow-hidden transition-all duration-300 ease-in-out z-10 rounded-none rounded-b-xl ${
          hoveredMenu === "Mindshare"
            ? "max-h-64 opacity-100 visible"
            : "max-h-0 opacity-0 invisible"
        }`}
        onMouseEnter={() => setHoveredMenu("Mindshare")}
        onMouseLeave={() => setHoveredMenu(null)}
      >
        <div className="max-w-[1000px] mx-auto py-8 px-6 grid grid-cols-2 gap-12">
          <div className="col-span-1">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">
              Analytics
            </h3>
            <div className="flex flex-col gap-2">
              {navLinks
                .find((l) => l.name === "Mindshare")
                ?.children?.map((sub) => (
                  <Link
                    key={sub.path}
                    href={sub.path}
                    onClick={() => setHoveredMenu(null)}
                    className="group flex items-start gap-4 p-3 rounded-xl hover:bg-gray-50 transition-all"
                  >
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                        sub.name === "Storyteller"
                          ? "bg-blue-100/80 text-blue-600"
                          : "bg-orange-100/80 text-orange-600"
                      }`}
                    >
                      {sub.name === "Storyteller" ? (
                        <ChartBarIcon className="w-5 h-5" />
                      ) : (
                        <FireIcon className="w-5 h-5" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900 group-hover:text-[#0037F0]">
                        {sub.name}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {sub.description}
                      </p>
                    </div>
                  </Link>
                ))}
            </div>
          </div>
          <div className="col-span-1 border-l border-gray-200 pl-8">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">
              Latest Insights
            </h3>
            <p className="text-xs text-gray-500 leading-relaxed">
              Check out the latest community trends and mindshare analysis
              across various crypto sectors.
            </p>
          </div>
        </div>
      </div>

      {/* 모바일 메뉴 Drawer */}
      {isMenuOpen && (
        <div className="md:hidden absolute top-14 left-0 w-full glass-modal rounded-none rounded-b-xl px-6 py-6 flex flex-col gap-1 z-50 animate-in slide-in-from-top-2">
          {visibleLinks.map((link) => (
            <div key={link.name}>
              {link.children ? (
                // 하위 메뉴가 있는 경우 (Mindshare)
                <div className="py-2">
                  <div className="text-gray-900 font-bold text-sm mb-2">
                    {link.name}
                  </div>
                  <div className="flex flex-col gap-1 pl-4 border-l-2 border-gray-200 ml-1">
                    {link.children.map((child) => (
                      <Link
                        key={child.path}
                        href={child.path}
                        onClick={() => setIsMenuOpen(false)}
                        className="py-2 text-gray-500 hover:text-[#0037F0] text-sm font-medium flex items-center gap-2"
                      >
                        {child.name}
                        {child.name === "Kimchi Map" && (
                          <span className="text-[9px] bg-red-100 text-red-600 px-1.5 rounded-full font-bold">
                            HOT
                          </span>
                        )}
                      </Link>
                    ))}
                  </div>
                </div>
              ) : (
                // 일반 메뉴
                <Link
                  href={link.path}
                  className={getNavLinkClass(link.path)}
                  onClick={() => setIsMenuOpen(false)}
                >
                  {link.name}
                </Link>
              )}
            </div>
          ))}

          <hr className="my-3 border-gray-200" />

          <Link
            href="/mypage"
            className="text-gray-500 py-2 font-medium flex items-center gap-2 text-sm"
            onClick={() => setIsMenuOpen(false)}
          >
            <Cog6ToothIcon className="w-4 h-4" />
            <span>Account Settings</span>
          </Link>
        </div>
      )}
    </nav>
  );
}
