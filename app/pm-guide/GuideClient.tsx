"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";

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
  const { user, authenticated } = usePrivy();

  return (
    <div className="flex-1 w-full bg-[#F3F4F6] text-[#1D1D1F] font-sans">
      <main className="max-w-7xl mx-auto px-6 py-10">
        {/* 헤더 섹션 */}
        <div className="mb-12">
          <h1 className="text-4xl font-black text-gray-900 tracking-tight mb-1">
            PM Guide
          </h1>
          <p className="text-gray-500 text-sm font-medium">
            업무 온보딩 및 필수 가이드 모음
          </p>
        </div>

        {/* 가이드 그리드 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 items-start">
          {groups.map((group) => (
            <div key={group.id} className="flex flex-col gap-4">
              <div className="px-1 py-2 border-b-2 border-gray-200">
                <h2 className="text-lg font-bold text-gray-900 uppercase tracking-wide">
                  {group.title}
                </h2>
              </div>
              <div className="flex flex-col gap-3">
                {group.items.map((item) => (
                  <a
                    key={item.id}
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    // 대시보드 카드와 동일한 인터랙션 스타일 적용
                    className="group flex items-center gap-4 p-4 rounded-xl bg-white border border-gray-200 transition-all duration-300 hover:bg-gray-50 hover:shadow-md hover:border-[#0037F0] hover:-translate-y-1"
                  >
                    <div className="w-10 h-10 flex items-center justify-center text-xl shrink-0 bg-white rounded-lg group-hover:bg-blue-50/50 transition-colors">
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
                    <span className="text-sm font-bold text-gray-700 group-hover:text-[#0037F0] transition-colors">
                      {item.title}
                    </span>
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>

        {groups.length === 0 && (
          <div className="text-center py-20 text-gray-400 bg-white rounded-lg border border-gray-200 border-dashed">
            <p className="mb-2">데이터를 불러오지 못했습니다.</p>
            <code className="text-xs bg-gray-100 px-2 py-1 rounded">
              NOTION_PM_GUIDE_PAGE_ID
            </code>{" "}
            확인 필요
          </div>
        )}
      </main>
    </div>
  );
}
