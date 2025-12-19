"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

// 데이터 타입 정의
export interface ProjectCard {
  id: string;
  title: string;
  icon: string | null;
  team: string;
  status: string;
  progress: number;
  period: string;
  periodStart: string;
  manager: string;
  managerImage: string | null;
  poc: string;
  workScope: string[];
  reportStatus?: string;
  apiProjectId?: string;
}

export interface AutomationItem {
  id: string;
  title: string;
  status: string;
  description: string;
  notionUrl: string;
  techStack?: string[];
  category: string;
  icon: string | null;
}

interface DashboardClientProps {
  projects: ProjectCard[];
  automations?: AutomationItem[];
  title: string;
  isOverview?: boolean;
}

type SortKey = "team" | "periodStart" | "manager";
type SortOrder = "asc" | "desc";

export default function DashboardClient({
  projects,
  automations = [],
  title,
  isOverview = false,
}: DashboardClientProps) {
  const [filter, setFilter] = useState("active");
  const [sortKey, setSortKey] = useState<SortKey>("team");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [selectedProcess, setSelectedProcess] = useState<AutomationItem | null>(
    null
  );

  const pathname = usePathname();
  const getNavLinkClass = (path: string) =>
    pathname === path
      ? "text-black font-bold"
      : "text-gray-500 hover:text-black transition-colors";

  const groupedAutomations = useMemo(() => {
    const groups: Record<string, AutomationItem[]> = {};
    automations.forEach((item) => {
      const cat = item.category || "Uncategorized";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(item);
    });
    return groups;
  }, [automations]);

  const processedProjects = useMemo(() => {
    let temp = projects.filter((p) => {
      if (filter === "all") return true;
      if (filter === "active") return p.status === "진행 중";
      if (filter === "done") return p.status !== "진행 중";
      return true;
    });

    temp = temp.sort((a, b) => {
      const valA = a[sortKey] || "";
      const valB = b[sortKey] || "";
      const comparison = String(valA).localeCompare(String(valB));
      return sortOrder === "asc" ? comparison : -comparison;
    });

    if (isOverview) return temp.slice(0, 4);
    return temp;
  }, [projects, filter, sortKey, sortOrder, isOverview]);

  return (
    <div className="min-h-screen bg-[#F5F5F7] text-[#1D1D1F] font-sans">
      <main className="max-w-[1600px] mx-auto px-6 py-10">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between mb-8 gap-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight mb-2 text-gray-900">
              {isOverview ? "Overview" : title}
            </h1>
            <p className="text-gray-500 text-base">
              {isOverview
                ? "주요 프로젝트 현황 및 자동화 프로세스 요약입니다."
                : "전체 프로젝트 현황을 관리하고 모니터링하세요."}
            </p>
          </div>

          {!isOverview && (
            <div className="flex flex-col sm:flex-row gap-3">
              {/* 1. 정렬 버튼 */}
              <div className="flex items-center bg-white rounded-lg p-1 shadow-sm border border-gray-200 h-9">
                <span className="px-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
                  Sort by
                </span>
                <div className="w-px h-3 bg-gray-200 mx-1"></div>
                {[
                  { key: "team", label: "팀" },
                  { key: "periodStart", label: "계약일" },
                  { key: "manager", label: "담당자" },
                ].map((opt) => (
                  <button
                    key={opt.key}
                    // [수정됨] 클릭 시 현재 키와 같으면 순서 반전(Toggle), 다르면 오름차순 초기화
                    onClick={() => {
                      if (sortKey === opt.key) {
                        setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                      } else {
                        setSortKey(opt.key as SortKey);
                        setSortOrder("asc");
                      }
                    }}
                    className={`px-3 py-1 text-xs font-medium rounded transition-colors flex items-center gap-1 ${
                      sortKey === opt.key
                        ? "bg-gray-100 text-black font-semibold"
                        : "text-gray-500 hover:text-gray-800"
                    }`}
                  >
                    {opt.label}
                    {/* 화살표 아이콘도 상태에 따라 바뀌도록 표시 */}
                    {sortKey === opt.key && (
                      <span className="text-[10px] text-gray-400">
                        {sortOrder === "asc" ? "▲" : "▼"}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* 2. 필터 탭 (복구됨) */}
              <div className="bg-gray-200/80 p-1 rounded-lg inline-flex h-9 self-start sm:self-auto">
                {[
                  { key: "all", label: "전체" },
                  { key: "active", label: "진행 중" },
                  { key: "done", label: "종료" },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setFilter(tab.key)}
                    className={`px-4 py-0.5 rounded-md text-xs font-medium transition-all duration-200 ${
                      filter === tab.key
                        ? "bg-white text-black shadow-sm"
                        : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <section className="mb-16">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              📂 Active Projects{" "}
              {isOverview && (
                <span className="text-xs font-normal text-gray-400 ml-2">
                  최근 4개 항목
                </span>
              )}
            </h2>
            {isOverview && (
              <Link
                href="/projects"
                className="text-sm font-medium text-blue-600 hover:text-blue-800"
              >
                더 보기 →
              </Link>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {processedProjects.map((project) => (
              <div
                key={project.id}
                className="group bg-white rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_20px_rgba(0,0,0,0.08)] border border-gray-100 transition-all duration-300 flex flex-col hover:-translate-y-1 overflow-hidden"
              >
                {/* 카드 헤더: 레이아웃 고정 */}
                <div className="px-5 py-4 flex justify-between items-start h-[60px]">
                  <span
                    className={`px-2 py-0.5 h-fit rounded text-[10px] font-bold uppercase tracking-wider ${
                      project.team.includes("1팀")
                        ? "bg-red-50 text-red-600"
                        : project.team.includes("2팀")
                        ? "bg-orange-50 text-orange-600"
                        : project.team.includes("3팀")
                        ? "bg-purple-50 text-purple-600"
                        : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {project.team}
                  </span>

                  <div className="flex items-center gap-2">
                    <span
                      className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                        project.status === "진행 중"
                          ? "bg-blue-50 text-blue-600 border-blue-100"
                          : "bg-gray-50 text-gray-500 border-gray-100"
                      }`}
                    >
                      {project.status === "진행 중" && (
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse"></span>
                      )}
                      {project.status}
                    </span>

                    {/* 리포트 상태 아이콘 (미니멀 디자인) */}
                    {project.reportStatus && project.reportStatus !== "N/A" && (
                      <div
                        className={`w-5 h-5 flex items-center justify-center rounded-full border shadow-sm transition-transform hover:scale-110 cursor-help ${
                          project.reportStatus === "Approved"
                            ? "bg-green-100 border-green-200 text-green-600"
                            : project.reportStatus === "Pending"
                            ? "bg-yellow-50 border-yellow-200 text-yellow-600"
                            : "bg-red-50 border-red-200 text-red-600"
                        }`}
                        title={`지난달 보고서: ${project.reportStatus}`}
                      >
                        {project.reportStatus === "Approved" ? (
                          <svg
                            className="w-3 h-3"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="3"
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        ) : (
                          <span className="text-[10px] font-bold">!</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="px-5 pb-4 flex-1">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 flex items-center justify-center text-xl bg-gray-50 rounded-lg border border-gray-100 shadow-sm shrink-0">
                      {project.icon && !project.icon.startsWith("http") ? (
                        project.icon
                      ) : project.icon ? (
                        <img
                          src={project.icon}
                          alt="icon"
                          className="w-6 h-6 object-contain"
                        />
                      ) : (
                        "📄"
                      )}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-lg font-bold text-gray-900 leading-tight truncate">
                        {project.title}
                      </h3>
                      <p className="text-[11px] text-gray-400 mt-1 font-medium tracking-wide">
                        {project.period}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-2 pt-1">
                    <div className="flex justify-between items-center text-xs group/row">
                      <span className="text-gray-400 font-medium">Manager</span>
                      <div className="flex items-center gap-2">
                        {project.managerImage ? (
                          <img
                            src={project.managerImage}
                            alt={project.manager}
                            className="w-5 h-5 rounded-full border border-gray-200 object-cover"
                          />
                        ) : (
                          <div className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center text-[8px] text-gray-500 border border-gray-200">
                            {project.manager.slice(0, 1)}
                          </div>
                        )}
                        <span className="font-semibold text-gray-700">
                          {project.manager}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-5 flex flex-wrap gap-1.5">
                    {project.workScope.length > 0
                      ? [...project.workScope]
                          .sort((a, b) => a.localeCompare(b, "ko"))
                          .map((scope, idx) => (
                            <span
                              key={idx}
                              className="px-1.5 py-0.5 bg-gray-50 text-gray-500 text-[10px] font-medium rounded border border-gray-100"
                            >
                              {scope}
                            </span>
                          ))
                      : null}
                  </div>
                </div>

                <div className="px-5 py-4 mt-auto bg-gray-50/50 border-t border-gray-100">
                  <div className="flex justify-between text-[10px] mb-1.5">
                    <span className="text-gray-400 font-medium">Progress</span>
                    <span
                      className={`font-bold ${
                        project.progress === 100
                          ? "text-green-600"
                          : "text-blue-600"
                      }`}
                    >
                      {project.progress}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-1 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-1000 ease-out ${
                        project.progress === 100
                          ? "bg-green-500"
                          : "bg-blue-600"
                      }`}
                      style={{ width: `${project.progress}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {isOverview && (
          <section className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm">
            <div className="flex items-center gap-3 mb-8">
              <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  ></path>
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  컨설팅팀 자동화 현황
                </h2>
                <p className="text-sm text-gray-500">
                  노션에서 정의된 프로세스가 자동으로 동기화됩니다.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
              {Object.entries(groupedAutomations).map(([category, items]) => (
                <div key={category}>
                  <h3 className="font-semibold text-gray-800 mb-6 flex items-center gap-2">
                    {category}
                  </h3>
                  <div className="space-y-4 relative">
                    <div className="absolute left-[19px] top-4 bottom-4 w-0.5 bg-gray-100"></div>
                    {items.map((item) => (
                      <ProcessItem
                        key={item.id}
                        data={item}
                        onClick={() => setSelectedProcess(item)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* 모달 팝업 */}
      {selectedProcess && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
            onClick={() => setSelectedProcess(null)}
          ></div>
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-[fadeIn_0.2s_ease-out]">
            {/* [수정됨] 모달 헤더 색상 분기 */}
            <div
              className={`px-6 py-4 border-b flex justify-between items-center ${
                selectedProcess.status === "AUTO"
                  ? "bg-green-50/50"
                  : selectedProcess.status === "PARTIAL"
                  ? "bg-orange-50/50"
                  : "bg-gray-50"
              }`}
            >
              <h3 className="font-bold text-lg text-gray-900">
                {selectedProcess.title}
              </h3>
              <button
                onClick={() => setSelectedProcess(null)}
                className="text-gray-400"
              >
                ✕
              </button>
            </div>
            <div className="p-6">
              <p className="text-gray-600 text-sm mb-6 whitespace-pre-line">
                {selectedProcess.description}
              </p>
              {selectedProcess.techStack &&
                selectedProcess.techStack.length > 0 && (
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-100 mb-6">
                    <h4 className="text-[10px] font-bold text-gray-400 uppercase mb-2">
                      Tech Stack
                    </h4>
                    <div className="flex gap-2 flex-wrap">
                      {selectedProcess.techStack.map((tag) => (
                        <span
                          key={tag}
                          className="px-2 py-1 bg-white border border-gray-200 rounded text-xs font-medium text-gray-600"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              <a
                href={selectedProcess.notionUrl}
                target="_blank"
                className="block w-full bg-black text-white text-center py-3 rounded-xl text-sm font-semibold"
              >
                노션 가이드 이동 →
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// [수정됨] ProcessItem: PARTIAL -> Orange
function ProcessItem({
  data,
  onClick,
}: {
  data: AutomationItem;
  onClick: () => void;
}) {
  const { title, status, icon } = data;

  let badgeStyle = "bg-gray-100 text-gray-400";
  let iconStyle = "bg-gray-100 text-gray-400";
  let hoverBorder = "group-hover:border-gray-300";

  if (status === "AUTO") {
    badgeStyle = "bg-green-50 text-green-600";
    iconStyle = "bg-green-100 text-green-600";
    hoverBorder = "group-hover:border-green-300";
  } else if (status === "PARTIAL") {
    badgeStyle = "bg-orange-50 text-orange-600";
    iconStyle = "bg-orange-100 text-orange-600";
    hoverBorder = "group-hover:border-orange-300";
  }

  return (
    <div
      onClick={onClick}
      className="relative flex items-center gap-4 cursor-pointer group"
    >
      <div
        className={`w-10 h-10 rounded-full flex items-center justify-center border-4 border-white z-10 shadow-sm group-hover:scale-110 transition-transform ${iconStyle} overflow-hidden`}
      >
        {icon && !icon.startsWith("http") ? (
          <span className="text-lg">{icon}</span>
        ) : icon ? (
          <img src={icon} alt="" className="w-6 h-6 object-contain" />
        ) : (
          "🤖"
        )}
      </div>
      <div
        className={`flex-1 bg-gray-50 p-4 rounded-xl border border-gray-100 transition-all ${hoverBorder}`}
      >
        <div className="flex justify-between items-center mb-1">
          <span className="font-bold text-sm text-gray-900">{title}</span>
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded ${badgeStyle}`}
          >
            {status}
          </span>
        </div>
      </div>
    </div>
  );
}
