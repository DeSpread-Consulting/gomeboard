"use client";

import React, { useMemo, useState } from "react";
import dynamic from "next/dynamic";

const KOLGraph = dynamic(() => import("./KOLGraph"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-gray-50 rounded-xl">
      <div className="text-sm text-gray-400">그래프 로딩 중...</div>
    </div>
  ),
});

interface KOLNode {
  channel_id: number;
  title: string;
  username: string | null;
  calculated_tier: string;
  main_group: string | null;
  total_cited: number;
  cited_by_ap_count: number;
  cited_by_a_count: number;
  noble_score: number;
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
      <div className="bg-white rounded-xl shadow-glass border border-gray-200 h-[700px] relative overflow-hidden">
        <KOLGraph nodes={initialNodes} edges={initialEdges} />
      </div>

      {/* 리스트 영역 */}
      <div className="bg-white p-6 rounded-xl shadow-glass border border-gray-200">
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
          <h2 className="text-xl font-bold">
            KOL 티어 리스트 ({filteredList.length})
          </h2>
          <div className="flex gap-2 w-full md:w-auto">
            <input
              type="text"
              placeholder="채널명 검색..."
              className="border border-gray-200 rounded-xl p-2 text-sm w-full md:w-64 bg-white outline-none focus:ring-2 focus:ring-[#0037F0]/30"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
            />
            <select
              className="border border-gray-200 rounded-xl p-2 bg-white text-sm min-w-[120px]"
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
              <tr className="border-b border-gray-200/50 text-gray-500 text-sm bg-gray-50">
                <th className="py-3 px-4">티어</th>
                <th className="py-3 px-4">채널명</th>
                <th className="py-3 px-4">소속 그룹</th>
                <th className="py-3 px-4 text-right">총 인용</th>
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
                  className="border-b border-gray-200 hover:bg-gray-50 transition-colors"
                >
                  <td className="py-3 px-4">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-bold whitespace-nowrap ${
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
                  <td className="py-3 px-4 font-medium text-gray-800">
                    <div className="flex items-center gap-2">
                      {node.profile_image_url ? (
                        <img
                          src={node.profile_image_url}
                          alt=""
                          className="w-7 h-7 rounded-full border-2 border-gray-200 object-cover shrink-0"
                          onError={(e) =>
                            (e.currentTarget.style.display = "none")
                          }
                        />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-gray-200 shrink-0 flex items-center justify-center text-[10px] font-bold text-gray-500">
                          {node.title.charAt(0)}
                        </div>
                      )}
                      <span className="truncate">{node.title}</span>
                      {node.username && (
                        <a
                          href={`https://t.me/${node.username}`}
                          target="_blank"
                          className="ml-1 text-gray-400 hover:text-blue-500 shrink-0"
                        >
                          ↗
                        </a>
                      )}
                    </div>
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

        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-2 mt-6">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 border border-gray-200 rounded-xl bg-white disabled:opacity-30 hover:bg-gray-50"
            >
              &lt; 이전
            </button>
            <span className="text-sm text-gray-600 mx-2">
              Page <b>{currentPage}</b> of {totalPages}
            </span>
            <button
              onClick={() =>
                setCurrentPage((p) => Math.min(totalPages, p + 1))
              }
              disabled={currentPage === totalPages}
              className="px-3 py-1 border border-gray-200 rounded-xl bg-white disabled:opacity-30 hover:bg-gray-50"
            >
              다음 &gt;
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
