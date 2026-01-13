"use client";

import React, { useMemo, useState } from "react";
import ReactECharts from "echarts-for-react";

// 타입 정의 (기존과 동일)
interface KOLNode {
  channel_id: number;
  title: string;
  username: string | null;
  calculated_tier: string;
  main_group: string | null;
  total_cited: number;
  endorsed_by_a_count: number;
}

interface KOLEdge {
  source_id: number;
  target_id: number;
  weight: number;
  is_golden_link: boolean;
}

export default function KOLClient({
  initialNodes,
  initialEdges,
}: {
  initialNodes: KOLNode[];
  initialEdges: KOLEdge[];
}) {
  // 상태 관리
  const [selectedTier, setSelectedTier] = useState<string>("ALL");
  const [searchTerm, setSearchTerm] = useState<string>(""); // 🔍 검색어
  const [currentPage, setCurrentPage] = useState<number>(1); // 📄 페이지
  const itemsPerPage = 20; // 페이지당 항목 수

  // 1. 그래프 옵션 (문제 1, 2 해결)
  const chartOption = useMemo(() => {
    const validNodes = initialNodes.filter(
      (n) => n.calculated_tier !== "Tier D" && n.total_cited > 0
    );
    const validNodeIds = new Set(validNodes.map((n) => n.channel_id));
    const validEdges = initialEdges.filter(
      (e) => validNodeIds.has(e.source_id) && validNodeIds.has(e.target_id)
    );

    // 그룹 카테고리 (상위 15개)
    const topGroups = validNodes
      .filter((n) => n.main_group)
      .reduce((acc, curr) => {
        acc[curr.main_group!] = (acc[curr.main_group!] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

    const sortedGroupNames = Object.keys(topGroups)
      .sort((a, b) => topGroups[b] - topGroups[a])
      .slice(0, 15);
    const categories = [
      { name: "Unknown Group" },
      ...sortedGroupNames.map((name) => ({ name })),
    ];

    const graphNodes = validNodes.map((node) => {
      let categoryIdx = sortedGroupNames.indexOf(node.main_group || "");
      let categoryName = categoryIdx !== -1 ? node.main_group : "Unknown Group";

      return {
        id: String(node.channel_id),
        name: node.title,
        value: node.total_cited,
        symbolSize: Math.max(5, Math.min(node.total_cited * 1.5, 60)),
        category: categoryName,
        // [수정] 노드 드래그 비활성화 (화면 이동 편의성 증대)
        draggable: false,
        label: {
          show: ["Tier A", "Tier B"].includes(node.calculated_tier),
          color: "#333",
          fontSize: 11,
        },
        tooltip: {
          formatter: `<b>${node.title}</b><br/>Group: ${
            node.main_group || "-"
          }<br/>Cited: ${node.total_cited}`,
        },
      };
    });

    const graphLinks = validEdges.map((edge) => ({
      source: String(edge.source_id),
      target: String(edge.target_id),
      lineStyle: {
        width: edge.is_golden_link ? Math.min(edge.weight, 4) : 0.5,
        color: edge.is_golden_link ? "#f59e0b" : "#e5e7eb",
        opacity: edge.is_golden_link ? 0.6 : 0.2,
        curveness: 0.2,
      },
    }));

    return {
      backgroundColor: "#ffffff",
      tooltip: {},
      legend: [
        {
          data: sortedGroupNames,
          type: "scroll",
          orient: "vertical",
          right: 10,
          top: 40,
          bottom: 20,
        },
      ],
      series: [
        {
          type: "graph",
          layout: "force",
          data: graphNodes,
          links: graphLinks,
          categories: categories,
          roam: true, // [필수] 줌/팬 활성화
          zoom: 0.7,
          label: { position: "right" },
          force: {
            // [수정] 그래프 안정화 설정
            initLayout: "circular", // 초기에 원형으로 배치 후 힘 계산 (좀 더 예쁨)
            repulsion: 300,
            gravity: 0.08,
            edgeLength: [50, 200],
            layoutAnimation: false, // [핵심] 애니메이션 끄기 -> 새로고침 시 춤추지 않고 바로 결과 표시
          },
        },
      ],
    };
  }, [initialNodes, initialEdges]);

  // 2. 리스트 필터링 & 페이지네이션 (문제 3 해결)
  const filteredList = useMemo(() => {
    return initialNodes.filter((n) => {
      // 티어 필터
      const tierMatch =
        selectedTier === "ALL" || n.calculated_tier === selectedTier;
      // 검색 필터 (대소문자 무시)
      const searchMatch =
        n.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (n.username &&
          n.username.toLowerCase().includes(searchTerm.toLowerCase()));
      return tierMatch && searchMatch;
    });
  }, [initialNodes, selectedTier, searchTerm]);

  // 현재 페이지 데이터 자르기
  const paginatedList = filteredList.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const totalPages = Math.ceil(filteredList.length / itemsPerPage);

  return (
    <div className="flex flex-col gap-8">
      {/* 그래프 영역 */}
      <div className="bg-white p-4 rounded-xl shadow-sm border h-[600px] relative overflow-hidden">
        <ReactECharts
          option={chartOption}
          style={{ height: "100%", width: "100%" }}
        />
        <div className="absolute bottom-4 left-4 text-xs text-gray-400 bg-white/90 p-2 rounded shadow-sm">
          * 마우스 휠로 확대/축소, 빈 공간을 드래그하여 이동하세요.
        </div>
      </div>

      {/* 리스트 영역 */}
      <div className="bg-white p-6 rounded-xl shadow-sm border">
        {/* 컨트롤 패널 (티어 선택 + 검색) */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
          <h2 className="text-xl font-bold">
            📋 KOL 티어 리스트 ({filteredList.length})
          </h2>

          <div className="flex gap-2 w-full md:w-auto">
            {/* 검색 입력창 */}
            <input
              type="text"
              placeholder="채널명 검색..."
              className="border rounded-md p-2 text-sm w-full md:w-64"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1); // 검색 시 1페이지로 리셋
              }}
            />
            {/* 티어 선택 */}
            <select
              className="border rounded-md p-2 bg-gray-50 text-sm min-w-[120px]"
              value={selectedTier}
              onChange={(e) => {
                setSelectedTier(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="ALL">전체 보기</option>
              <option value="Tier A">Tier A</option>
              <option value="Tier B">Tier B</option>
              <option value="Tier B-1">Tier B-1</option>
              <option value="Tier C">Tier C</option>
              <option value="Tier D">Tier D</option>
            </select>
          </div>
        </div>

        {/* 테이블 */}
        <div className="overflow-x-auto min-h-[500px]">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b text-gray-500 text-sm bg-gray-50">
                <th className="py-3 px-4">티어</th>
                <th className="py-3 px-4">채널명</th>
                <th className="py-3 px-4">소속 그룹</th>
                <th className="py-3 px-4 text-right">총 인용됨</th>
                <th className="py-3 px-4 text-right text-amber-600 font-bold">
                  A티어 샤라웃
                </th>
              </tr>
            </thead>
            <tbody>
              {paginatedList.map((node) => (
                <tr
                  key={node.channel_id}
                  className="border-b hover:bg-gray-50 transition-colors"
                >
                  <td className="py-3 px-4">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-bold whitespace-nowrap
                      ${
                        node.calculated_tier === "Tier A"
                          ? "bg-red-100 text-red-700"
                          : node.calculated_tier === "Tier B"
                          ? "bg-amber-100 text-amber-700"
                          : node.calculated_tier === "Tier B-1"
                          ? "bg-purple-100 text-purple-700"
                          : node.calculated_tier === "Tier C"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {node.calculated_tier}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-medium text-gray-800">
                    {node.title}
                    {node.username && (
                      <a
                        href={`https://t.me/${node.username}`}
                        target="_blank"
                        className="ml-2 text-gray-400"
                      >
                        ↗
                      </a>
                    )}
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-600">
                    {node.main_group ? (
                      <span className="font-semibold text-gray-700">
                        @{node.main_group}
                      </span>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="py-3 px-4 text-right text-sm">
                    {node.total_cited.toLocaleString()}
                  </td>
                  <td className="py-3 px-4 text-right font-bold text-amber-600 text-sm">
                    {node.endorsed_by_a_count > 0
                      ? `${node.endorsed_by_a_count}회`
                      : "-"}
                  </td>
                </tr>
              ))}
              {paginatedList.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-gray-400">
                    검색 결과가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* 페이지네이션 UI */}
        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-2 mt-6">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 border rounded disabled:opacity-30 hover:bg-gray-50"
            >
              &lt; 이전
            </button>

            {/* 페이지 번호 표시 (간단하게 구현) */}
            <span className="text-sm text-gray-600 mx-2">
              Page <b>{currentPage}</b> of {totalPages}
            </span>

            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 border rounded disabled:opacity-30 hover:bg-gray-50"
            >
              다음 &gt;
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
