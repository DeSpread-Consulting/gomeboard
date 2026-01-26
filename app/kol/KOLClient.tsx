"use client";

import React, { useMemo, useState } from "react";
import ReactECharts from "echarts-for-react";

// [수정] 분리된 카운트 컬럼 반영
interface KOLNode {
  channel_id: number;
  title: string;
  username: string | null;
  calculated_tier: string;
  main_group: string | null;
  total_cited: number;
  cited_by_ap_count: number; // A+ 인용 횟수
  cited_by_a_count: number; // A 인용 횟수
  noble_score: number; // 참고용 점수
  profile_image_url?: string | null;
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
  const [selectedTier, setSelectedTier] = useState<string>("ALL");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 20;

  // 1. 그래프 옵션
  const chartOption = useMemo(() => {
    const validNodes = initialNodes.filter(
      (n) => n.calculated_tier !== "Tier D" && n.total_cited > 0,
    );
    const validNodeIds = new Set(validNodes.map((n) => n.channel_id));
    const validEdges = initialEdges.filter(
      (e) => validNodeIds.has(e.source_id) && validNodeIds.has(e.target_id),
    );

    const topGroups = validNodes
      .filter((n) => n.main_group)
      .reduce(
        (acc, curr) => {
          acc[curr.main_group!] = (acc[curr.main_group!] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      );

    const sortedGroupNames = Object.keys(topGroups)
      .sort((a, b) => topGroups[b] - topGroups[a])
      .slice(0, 15);

    const categories = [
      { name: "Unknown Group" },
      ...sortedGroupNames.map((name) => ({ name })),
    ];

    const graphNodes = validNodes.map((node) => {
      const isLeader = node.title === node.main_group;
      const tier = node.calculated_tier;
      let categoryName = sortedGroupNames.includes(node.main_group || "")
        ? node.main_group!
        : "Unknown Group";

      const avatarUrl =
        node.profile_image_url && node.profile_image_url.length > 5
          ? node.profile_image_url
          : `https://ui-avatars.com/api/?name=${encodeURIComponent(
              node.title,
            )}&background=random&color=fff&size=128`;

      let borderColor = "#fff";
      if (tier === "Tier A+") borderColor = "#DC2626";
      else if (tier === "Tier A") borderColor = "#F97316";
      else if (tier === "Tier B+") borderColor = "#F59E0B";
      else if (tier === "Tier B") borderColor = "#8B5CF6";
      else if (tier === "Tier C") borderColor = "#10B981";

      return {
        id: String(node.channel_id),
        name: node.title,
        value: node.total_cited,
        symbol: `image://${avatarUrl}`,
        symbolSize: isLeader
          ? tier === "Tier A+"
            ? 65
            : tier === "Tier A"
              ? 60
              : 55
          : Math.max(15, Math.min(node.total_cited * 1.5, 45)),
        category: categoryName,
        draggable: false,

        itemStyle: {
          borderColor: isLeader ? borderColor : "#fff",
          borderWidth: isLeader ? 4 : 1,
          shadowBlur: isLeader ? 15 : 0,
          shadowColor: isLeader ? borderColor : "transparent",
        },

        label: {
          show: isLeader || ["Tier A+", "Tier A", "Tier B+"].includes(tier),
          position: "bottom",
          formatter:
            tier === "Tier A+"
              ? "{a|👑👑} {b}"
              : tier === "Tier A"
                ? "{a|👑} {b}"
                : "{b}",
          rich: { a: { fontSize: 14 } },
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
                        <b>${
                          node.title
                        }</b> <span style="color:${borderColor}">[${tier}]</span><br/>
                        Group: ${node.main_group || "-"}<br/>
                        Cited: ${node.total_cited} (A+: ${
                          node.cited_by_ap_count
                        }, A: ${node.cited_by_a_count})<br/>
                        Score: ${node.noble_score}
                    </div>
                </div>
            `,
        },
      };
    });

    const graphLinks = validEdges.map((edge) => ({
      source: String(edge.source_id),
      target: String(edge.target_id),
      lineStyle: {
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
        },
      ],
      series: [
        {
          type: "graph",
          layout: "force",
          data: graphNodes,
          links: graphLinks,
          categories: categories,
          roam: true,
          zoom: 0.7,
          label: { position: "right" },
          force: {
            initLayout: "circular",
            repulsion: 350,
            gravity: 0.12,
            layoutAnimation: false,
          },
        },
      ],
    };
  }, [initialNodes, initialEdges]);

  // 2. 리스트 필터링
  const filteredList = useMemo(() => {
    return initialNodes.filter((n) => {
      const tierMatch =
        selectedTier === "ALL" || n.calculated_tier === selectedTier;
      const searchMatch =
        n.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (n.username &&
          n.username.toLowerCase().includes(searchTerm.toLowerCase()));
      return tierMatch && searchMatch;
    });
  }, [initialNodes, selectedTier, searchTerm]);

  const paginatedList = filteredList.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
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
      </div>

      {/* 리스트 영역 */}
      <div className="bg-white p-6 rounded-xl shadow-sm border">
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
              <option value="Tier A+">Tier A+ (Emperor)</option>
              <option value="Tier A">Tier A (King)</option>
              <option value="Tier B+">Tier B+ (Lord)</option>
              <option value="Tier B">Tier B (Knight)</option>
              <option value="Tier C">Tier C (Citizen)</option>
              <option value="Tier D">Tier D (Commoner)</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto min-h-[500px]">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b text-gray-500 text-sm bg-gray-50">
                <th className="py-3 px-4">티어</th>
                <th className="py-3 px-4">채널명</th>
                <th className="py-3 px-4">소속 그룹</th>
                <th className="py-3 px-4 text-right">총 인용</th>
                {/* [수정] A+ / A 분리 표시 */}
                <th className="py-3 px-4 text-right text-red-600 font-bold">
                  A+ 샤라웃
                </th>
                <th className="py-3 px-4 text-right text-orange-600 font-bold">
                  A 샤라웃
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
                        node.calculated_tier === "Tier A+"
                          ? "bg-red-100 text-red-700"
                          : node.calculated_tier === "Tier A"
                            ? "bg-orange-100 text-orange-700"
                            : node.calculated_tier === "Tier B+"
                              ? "bg-amber-100 text-amber-700"
                              : node.calculated_tier === "Tier B"
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
                    {node.profile_image_url && (
                      <img
                        src={node.profile_image_url}
                        className="w-6 h-6 rounded-full border"
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
                        @{node.main_group}
                      </span>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="py-3 px-4 text-right text-sm">
                    {node.total_cited.toLocaleString()}
                  </td>
                  {/* [수정] A+ / A 카운트 표시 */}
                  <td className="py-3 px-4 text-right font-bold text-red-600 text-sm">
                    {node.cited_by_ap_count > 0
                      ? `${node.cited_by_ap_count}회`
                      : "-"}
                  </td>
                  <td className="py-3 px-4 text-right font-bold text-orange-600 text-sm">
                    {node.cited_by_a_count > 0
                      ? `${node.cited_by_a_count}회`
                      : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 페이지네이션 (기존 동일) */}
        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-2 mt-6">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 border rounded disabled:opacity-30 hover:bg-gray-50"
            >
              &lt; Prev
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
