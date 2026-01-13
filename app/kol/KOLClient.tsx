"use client";

import React, { useMemo, useState } from "react";
import ReactECharts from "echarts-for-react";

interface KOLNode {
  channel_id: number;
  title: string;
  username: string | null;
  calculated_tier: string;
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
  const [selectedTier, setSelectedTier] = useState<string>("ALL");

  // 그래프 옵션 생성
  const chartOption = useMemo(() => {
    // 노드 필터링: 영향력이 있거나 A티어인 경우만 그래프에 표시 (너무 많으면 느림)
    const validNodes = initialNodes.filter(
      (n) => n.total_cited > 0 || n.calculated_tier === "Tier A"
    );

    // 노드 스타일링
    const graphNodes = validNodes.map((node) => ({
      id: String(node.channel_id),
      name: node.title,
      value: node.total_cited,
      // 영향력에 따라 크기 조절 (최소 10, 최대 70)
      symbolSize: Math.max(10, Math.min(node.total_cited * 2, 70)),
      category: node.calculated_tier,
      // A티어거나 영향력이 큰(20 이상) 채널은 이름 항상 표시
      label: {
        show: node.calculated_tier === "Tier A" || node.total_cited >= 20,
        color: "#333",
      },
      itemStyle: {
        color:
          node.calculated_tier === "Tier A"
            ? "#ef4444" // Red
            : node.calculated_tier === "Tier B"
            ? "#f59e0b" // Amber
            : node.calculated_tier.includes("Leader")
            ? "#10b981" // Emerald
            : "#9ca3af", // Gray
      },
      // 툴팁에 보여줄 추가 정보
      tooltip: {
        formatter: `${node.title}<br/>Total Cited: ${node.total_cited}<br/>Endorsed by A: ${node.endorsed_by_a_count}`,
      },
    }));

    // 엣지 스타일링
    const graphLinks = initialEdges.map((edge) => ({
      source: String(edge.source_id),
      target: String(edge.target_id),
      value: edge.weight,
      lineStyle: {
        // A가 샤라웃한 링크(Golden Link)는 굵고 진하게
        width: edge.is_golden_link
          ? Math.min(edge.weight, 8)
          : Math.min(edge.weight, 3),
        curveness: 0.2,
        color: edge.is_golden_link ? "#f59e0b" : "#e5e7eb",
        opacity: edge.is_golden_link ? 0.9 : 0.4,
      },
    }));

    const categories = [
      { name: "Tier A" },
      { name: "Tier B" },
      { name: "Tier C (Leader)" },
      { name: "Tier C" },
      { name: "Tier D" },
    ];

    return {
      tooltip: {},
      legend: [{ data: categories.map((a) => a.name) }],
      series: [
        {
          type: "graph",
          layout: "force",
          data: graphNodes,
          links: graphLinks,
          categories: categories,
          roam: true,
          label: { position: "right" },
          force: {
            repulsion: 400,
            edgeLength: [50, 250],
            gravity: 0.1,
          },
          lineStyle: {
            curveness: 0.2,
          },
        },
      ],
    };
  }, [initialNodes, initialEdges]);

  // 리스트 필터링 로직
  const filteredList = initialNodes.filter((n) =>
    selectedTier === "ALL" ? true : n.calculated_tier === selectedTier
  );

  return (
    <div className="flex flex-col gap-8">
      {/* 1. 소셜 그래프 영역 */}
      <div className="bg-white p-4 rounded-xl shadow-sm border h-[650px] relative">
        <ReactECharts
          option={chartOption}
          style={{ height: "100%", width: "100%" }}
        />
        <div className="absolute bottom-4 right-4 text-xs text-gray-400 bg-white/80 p-2 rounded">
          * A티어(Red)가 샤라웃하면 Golden Link(Amber)로 연결됩니다.
        </div>
      </div>

      {/* 2. KOL 리스트 영역 */}
      <div className="bg-white p-6 rounded-xl shadow-sm border">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold">📋 KOL 티어 리스트</h2>
          <select
            className="border rounded-md p-2 bg-gray-50 text-sm"
            value={selectedTier}
            onChange={(e) => setSelectedTier(e.target.value)}
          >
            <option value="ALL">전체 보기</option>
            <option value="Tier A">👑 Tier A (King)</option>
            <option value="Tier B">⚔️ Tier B (Knight)</option>
            <option value="Tier C (Leader)">🏰 Tier C (Leader)</option>
            <option value="Tier C">🏠 Tier C (Citizen)</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b text-gray-500 text-sm bg-gray-50">
                <th className="py-3 px-4">티어</th>
                <th className="py-3 px-4">채널명</th>
                <th className="py-3 px-4 text-right">총 인용됨</th>
                <th className="py-3 px-4 text-right text-amber-600 font-bold">
                  A티어 샤라웃
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredList.slice(0, 50).map((node) => (
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
                          : node.calculated_tier.includes("Leader")
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
                        rel="noreferrer"
                        className="ml-2 text-gray-400 text-xs hover:text-blue-500 inline-block translate-y-[-1px]"
                      >
                        ↗
                      </a>
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
            </tbody>
          </table>
          {filteredList.length === 0 && (
            <div className="text-center py-8 text-gray-400">
              해당 티어의 채널이 없습니다.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
