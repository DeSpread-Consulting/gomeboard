"use client";

import React from "react";

export default function Footer() {
  // 바로가기 링크 목록 (수정해서 사용하세요)
  const links = [
    { name: "디스프레드 홈페이지", url: "https://despread.io/" },
    {
      name: "디스프레드 노션",
      url: "https://www.notion.so/despread-creative/",
    }, // 예시
    { name: "메타베이스", url: "https://metabase.despreadlabs.io/" },
    {
      name: "대시보드",
      url: "https://dashboard.despreadlabs.io/projects",
    },
    { name: "대시보드 api", url: "https://mashboard-api.despreadlabs.io/api" },
    { name: "디스프레드 리서치", url: "https://research.despread.io/" }, // 예시
  ];

  return (
    <footer className="bg-white border-t border-gray-200 py-12 mt-auto">
      <div className="max-w-[1600px] mx-auto px-6">
        <div className="flex flex-col md:flex-row justify-between items-start gap-8">
          {/* 왼쪽: 로고 및 카피라이트 */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-6 h-6 bg-gray-900 text-white rounded flex items-center justify-center text-xs font-bold">
                D
              </div>
              <span className="font-bold text-gray-900">gomeboard</span>
            </div>
            <p className="text-sm text-gray-500">
              웹3 산업의 성장과 확장을 위해 새로운 표준을 제시합니다.
              <br />
              DeSpread.
            </p>
          </div>

          {/* 오른쪽: 바로가기 링크들 */}
          <div className="flex gap-12">
            <div>
              <h4 className="font-bold text-gray-900 mb-4 text-sm">
                Company Links
              </h4>
              <ul className="space-y-2 text-sm text-gray-500">
                {links.map((link) => (
                  <li key={link.name}>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noreferrer"
                      className="hover:text-blue-600 transition-colors"
                    >
                      {link.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* 필요하다면 섹션 추가 가능 */}
            <div>
              <h4 className="font-bold text-gray-900 mb-4 text-sm">Support</h4>
              <ul className="space-y-2 text-sm text-gray-500">
                <li>
                  <a href="#" className="hover:text-blue-600">
                    hangome
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-blue-600">
                    Admin Contact
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
