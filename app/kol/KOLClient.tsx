"use client";

import React, { useMemo, useState } from "react";
import ReactECharts from "echarts-for-react";

// [수정] profile_image_url 추가된 인터페이스
interface KOLNode {
  channel_id: number;
  title: string;
  username: string | null;
  calculated_tier: string;
  main_group: string | null;
  total_cited: number;
  endorsed_by_a_count: number;
  profile_image_url?: string | null; // 프로필 이미지
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

  // 1. 그래프 옵션 (디자인 & 기능 개선 적용)
  const chartOption = useMemo(() => {
    // (1) 데이터 필터링 (D등급 제외, 고립 노드 제외)
    const validNodes = initialNodes.filter(
      (n) => n.calculated_tier !== "Tier D" && n.total_cited > 0
    );
    const validNodeIds = new Set(validNodes.map((n) => n.channel_id));
    const validEdges = initialEdges.filter(
      (e) => validNodeIds.has(e.source_id) && validNodeIds.has(e.target_id)
    );

    // (2) 그룹 카테고리 추출 (상위 15개)
    const topGroups = validNodes
      .filter((n) => n.main_group)
      .reduce((acc, curr) => {
        acc[curr.main_group!] = (acc[curr.main_group!] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

    const sortedGroupNames = Object.keys(topGroups)
      .sort((a, b) => topGroups[b] - topGroups[a])
      .slice(0, 15);

    // Unknown 카테고리 + 상위 그룹명
    const categories = [
      { name: "Unknown Group" },
      ...sortedGroupNames.map((name) => ({ name })),
    ];

    // (3) 노드 매핑 (이미지 적용, 리더 스타일링)
    const graphNodes = validNodes.map((node) => {
      // 본인이 그룹장이면 리더
      const isLeader = node.title === node.main_group;

      let categoryIdx = sortedGroupNames.indexOf(node.main_group || "");
      let categoryName = categoryIdx !== -1 ? node.main_group : "Unknown Group";

      // 이미지 URL 결정 (DB 이미지 -> 없으면 이니셜 아바타)
      // profile_image_url이 유효한지(빈 문자열이 아닌지) 체크
      const avatarUrl =
        node.profile_image_url && node.profile_image_url.length > 5
          ? node.profile_image_url
          : `https://ui-avatars.com/api/?name=${encodeURIComponent(
              node.title
            )}&background=random&color=fff&size=128&font-size=0.5`;

      return {
        id: String(node.channel_id),
        name: node.title,
        value: node.total_cited,

        // [디자인] 이미지 노드
        symbol: `image://${avatarUrl}`,
        // 리더는 좀 더 크게 (55), 일반 노드는 인용 수 비례
        symbolSize: isLeader
          ? 55
          : Math.max(15, Math.min(node.total_cited * 1.5, 45)),

        category: categoryName,
        draggable: false, // [기능] 노드 고정 (화면 이동 편의성)

        // [디자인] 리더 강조 스타일 (금색 테두리)
        itemStyle: {
          borderColor: isLeader ? "#FFD700" : "#fff",
          borderWidth: isLeader ? 4 : 1,
          shadowBlur: isLeader ? 15 : 0,
          shadowColor: "rgba(255, 215, 0, 0.6)",
        },

        // [디자인] 라벨 (리더는 왕관 뱃지)
        label: {
          show: isLeader || ["Tier A", "Tier B"].includes(node.calculated_tier),
          position: "bottom",
          formatter: isLeader ? "{a|👑} {b}" : "{b}",
          rich: {
            a: { fontSize: 14, lineHeight: 20 },
          },
          color: "#333",
          fontSize: 11,
          backgroundColor: "rgba(255,255,255,0.7)",
          padding: [2, 4],
          borderRadius: 4,
        },

        tooltip: {
          formatter: `
                <div style="display:flex; align-items:center; gap:10px;">
                    <img src="${avatarUrl}" style="width:40px; height:40px; border-radius:50%; object-fit:cover;" />
                    <div>
                        <b>${node.title}</b> ${isLeader ? "👑" : ""}<br/>
                        Group: ${node.main_group || "-"}<br/>
                        Cited: ${node.total_cited}
                    </div>
                </div>
            `,
        },
      };
    });

    // (4) 엣지 매핑 (골든 링크 색상 구분)
    const graphLinks = validEdges.map((edge) => ({
      source: String(edge.source_id),
      target: String(edge.target_id),
      lineStyle: {
        // [디자인] 골든 링크(리더->멤버)는 금색, 일반 링크는 회색
        color: edge.is_golden_link ? "#F59E0B" : "#E5E7EB",
        width: edge.is_golden_link ? Math.min(edge.weight, 5) : 1,
        opacity: edge.is_golden_link ? 0.8 : 0.3,
        curveness: 0.2,
      },
    }));

    return {
      backgroundColor: "#f8f9fa",
      tooltip: { trigger: "item", padding: 0, borderWidth: 0 },
      legend: [
        {
          data: sortedGroupNames,
          type: "scroll",
          orient: "vertical",
          right: 10,
          top: 40,
          bottom: 20,
          backgroundColor: "rgba(255,255,255,0.9)",
          padding: 10,
          borderRadius: 6,
          shadowBlur: 5,
        },
      ],
      series: [
        {
          type: "graph",
          layout: "force",
          data: graphNodes,
          links: graphLinks,
          categories: categories,
          roam: true, // [기능] 줌/팬 활성화
          zoom: 0.7,
          label: { position: "right" },
          force: {
            // [기능] 그래프 안정화
            initLayout: "circular",
            repulsion: 350,
            gravity: 0.12, // 뭉침 정도 조절
            edgeLength: [50, 200],
            layoutAnimation: false, // [핵심] 새로고침 시 춤추지 않음
          },
        },
      ],
    };
  }, [initialNodes, initialEdges]);

  // 2. 리스트 필터링 & 페이지네이션
  const filteredList = useMemo(() => {
    return initialNodes.filter((n) => {
      // 티어 필터
      const tierMatch =
        selectedTier === "ALL" || n.calculated_tier === selectedTier;
      // 검색 필터
      const searchMatch =
        n.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (n.username &&
          n.username.toLowerCase().includes(searchTerm.toLowerCase()));
      return tierMatch && searchMatch;
    });
  }, [initialNodes, selectedTier, searchTerm]);

  const paginatedList = filteredList.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const totalPages = Math.ceil(filteredList.length / itemsPerPage);

  return (
    <div className="flex flex-col gap-8">
      {/* 그래프 영역 */}
      <div className="bg-white p-0 rounded-xl shadow-sm border h-[700px] relative overflow-hidden">
        <ReactECharts
          option={chartOption}
          style={{ height: "100%", width: "100%" }}
        />
        {/* 범례 설명 */}
        <div className="absolute bottom-4 left-4 text-xs text-gray-500 bg-white/90 p-3 rounded shadow-sm z-10 border">
          <div className="flex items-center mb-1">
            <span className="inline-block w-8 h-1 bg-[#F59E0B] mr-2"></span>
            <span>Golden Link (Leader's Pick)</span>
          </div>
          <div className="flex items-center">
            <span className="inline-block w-8 h-[1px] bg-[#E5E7EB] mr-2"></span>
            <span>Normal Link</span>
          </div>
          <div className="mt-2 text-[10px] text-gray-400">
            * 빈 공간을 드래그하여 이동, 휠로 확대/축소
          </div>
        </div>
      </div>

      {/* 리스트 영역 */}
      <div className="bg-white p-6 rounded-xl shadow-sm border">
        {/* 컨트롤 패널 */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
          <h2 className="text-xl font-bold">
            📋 KOL 티어 리스트 ({filteredList.length})
          </h2>

          <div className="flex gap-2 w-full md:w-auto">
            <input
              type="text"
              placeholder="채널명 검색..."
              className="border rounded-md p-2 text-sm w-full md:w-64"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
            />
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
                  <td className="py-3 px-4 font-medium text-gray-800 flex items-center gap-2">
                    {/* 리스트에도 작은 프로필 이미지 표시 (선택사항) */}
                    {node.profile_image_url && (
                      <img
                        src={node.profile_image_url}
                        alt=""
                        className="w-6 h-6 rounded-full object-cover border"
                        onError={(e) =>
                          (e.currentTarget.style.display = "none")
                        }
                      />
                    )}
                    {node.title}
                    {node.username && (
                      <a
                        href={`https://t.me/${node.username}`}
                        target="_blank"
                        className="ml-1 text-gray-400 hover:text-blue-500"
                      >
                        ↗
                      </a>
                    )}
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-600">
                    {node.main_group ? (
                      <span className="font-semibold text-gray-700">
                        {node.main_group === node.title ? "👑 " : ""}@
                        {node.main_group}
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

        {/* 페이지네이션 */}
        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-2 mt-6">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 border rounded disabled:opacity-30 hover:bg-gray-50"
            >
              &lt; 이전
            </button>
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
