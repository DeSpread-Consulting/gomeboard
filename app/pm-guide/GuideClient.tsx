"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth"; // [변경] NextAuth -> Privy

// 데이터 타입
export interface GuideGroup {
  id: string;
  title: string;
  items: GuideItem[];
}

export interface GuideItem {
  id: string;
  title: string;
  url: string;
  icon?: string | null;
}

export default function GuideClient({ groups }: { groups: GuideGroup[] }) {
  const pathname = usePathname();
  // [변경] useSession() 제거하고 usePrivy() 사용
  const { user, authenticated } = usePrivy();

  const getNavLinkClass = (path: string) =>
    pathname === path
      ? "text-black font-bold"
      : "text-gray-500 hover:text-black transition-colors";

  return (
    <div className="min-h-screen bg-[#F5F5F7] text-[#1D1D1F] font-sans">
      <main className="max-w-[1600px] mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight mb-2 text-gray-900">
            PM Guide
          </h1>
          <p className="text-gray-500">업무 온보딩 및 필수 가이드 모음</p>
        </div>

        {/* ... (이하 기존 JSX 코드 그대로 유지) ... */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 items-start">
          {groups.map((group) => (
            <div key={group.id} className="flex flex-col gap-4">
              <div className="bg-gray-100/80 px-4 py-2 rounded-lg border border-gray-200/50">
                <h2 className="text-lg font-bold text-gray-800">
                  {group.title}
                </h2>
              </div>
              <div className="flex flex-col gap-2">
                {group.items.map((item) => (
                  <a
                    key={item.id}
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="group flex items-center gap-3 p-3 rounded-xl bg-white border border-gray-100 shadow-sm hover:shadow-md hover:border-gray-300 transition-all duration-200 hover:-translate-y-0.5"
                  >
                    <div className="w-8 h-8 flex items-center justify-center text-lg shrink-0">
                      {item.icon && !item.icon.startsWith("http") ? (
                        <span>{item.icon}</span>
                      ) : item.icon ? (
                        <img
                          src={item.icon}
                          alt=""
                          className="w-6 h-6 object-contain"
                        />
                      ) : (
                        <span className="text-gray-300">📄</span>
                      )}
                    </div>
                    <span className="text-sm font-medium text-gray-700 group-hover:text-black transition-colors underline-offset-4 group-hover:underline">
                      {item.title}
                    </span>
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>

        {groups.length === 0 && (
          <div className="text-center py-20 text-gray-400">
            노션 페이지에서 데이터를 불러오지 못했습니다. <br />
            환경변수 <code>NOTION_PM_GUIDE_PAGE_ID</code>를 확인해주세요.
          </div>
        )}
      </main>
    </div>
  );
}
