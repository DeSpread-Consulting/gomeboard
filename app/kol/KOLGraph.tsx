"use client";

import { useMemo, useState, useCallback, memo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  type Node,
  type Edge,
  type NodeMouseHandler,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import Graph from "graphology";
import { circular } from "graphology-layout";
import forceAtlas2 from "graphology-layout-forceatlas2";

// ─── Types ─────────────────────────────────────────────

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

interface KOLNodeData {
  title: string;
  image: string | null;
  tier: string;
  tierColor: string;
  nodeSize: number;
  showLabel: boolean;
  mainGroup: string;
  totalCited: number;
  citedByAp: number;
  citedByA: number;
  nobleScore: number;
  username: string | null;
  isLeader: boolean;
  [key: string]: unknown;
}

interface TooltipState {
  x: number;
  y: number;
  data: KOLNodeData;
}

// ─── Helpers ───────────────────────────────────────────

function getTierColor(tier: string): string {
  switch (tier) {
    case "Tier A+":
      return "#DC2626";
    case "Tier A":
      return "#F97316";
    case "Tier B+":
      return "#F59E0B";
    case "Tier B":
      return "#8B5CF6";
    case "Tier C":
      return "#10B981";
    default:
      return "#94a3b8";
  }
}

// ─── Custom Node Component ─────────────────────────────

const KOLNodeComponent = memo(function KOLNodeComponent({
  data,
}: {
  data: KOLNodeData;
}) {
  return (
    <div className="flex flex-col items-center">
      {/* Invisible handles for edges */}
      <Handle
        type="target"
        position={Position.Top}
        className="!opacity-0 !w-0 !h-0 !min-w-0 !min-h-0 !border-0"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="!opacity-0 !w-0 !h-0 !min-w-0 !min-h-0 !border-0"
      />

      {/* Profile circle */}
      <div
        className="rounded-full overflow-hidden shadow-md hover:shadow-xl transition-shadow duration-200"
        style={{
          width: data.nodeSize,
          height: data.nodeSize,
          border: `3px solid ${data.tierColor}`,
        }}
      >
        {data.image ? (
          <img
            src={data.image}
            alt={data.title}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={(e) => {
              const target = e.currentTarget;
              target.style.display = "none";
              const fallback = target.nextElementSibling as HTMLElement;
              if (fallback) fallback.style.display = "flex";
            }}
          />
        ) : null}
        <div
          className="w-full h-full items-center justify-center text-white font-bold"
          style={{
            backgroundColor: data.tierColor,
            fontSize: Math.max(data.nodeSize * 0.35, 10),
            display: data.image ? "none" : "flex",
          }}
        >
          {data.title.charAt(0)}
        </div>
      </div>

      {/* Label */}
      {data.showLabel && (
        <div className="mt-1 px-2 py-0.5 bg-white/90 backdrop-blur-sm rounded-md shadow-sm max-w-[120px]">
          <p className="text-[10px] font-bold text-gray-900 text-center leading-tight truncate">
            {data.tier === "Tier A+"
              ? "👑👑 "
              : data.tier === "Tier A"
                ? "👑 "
                : ""}
            {data.title}
          </p>
        </div>
      )}
    </div>
  );
});

// Must be defined outside component to prevent re-renders
const nodeTypes = { kol: KOLNodeComponent };

// ─── Main Component ────────────────────────────────────

export default function KOLGraph({
  nodes,
  edges,
}: {
  nodes: KOLNode[];
  edges: KOLEdge[];
}) {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  // Build graph, compute layout, convert to React Flow format
  const { rfNodes, rfEdges } = useMemo(() => {
    const graph = new Graph();

    // Filter
    const validNodes = nodes.filter(
      (n) => n.calculated_tier !== "Tier D" && n.total_cited > 0,
    );
    const validNodeIds = new Set(validNodes.map((n) => n.channel_id));
    const validEdges = edges.filter(
      (e) => validNodeIds.has(e.source_id) && validNodeIds.has(e.target_id),
    );

    // Build graphology graph for layout computation
    for (const node of validNodes) {
      graph.addNode(String(node.channel_id), { x: 0, y: 0, size: 1 });
    }

    const edgeSet = new Set<string>();
    for (const edge of validEdges) {
      const src = String(edge.source_id);
      const tgt = String(edge.target_id);
      const key = `${src}-${tgt}`;
      if (graph.hasNode(src) && graph.hasNode(tgt) && !edgeSet.has(key)) {
        edgeSet.add(key);
        graph.addEdge(src, tgt);
      }
    }

    // Compute layout: circular → ForceAtlas2
    circular.assign(graph);
    forceAtlas2.assign(graph, {
      iterations: 400,
      settings: {
        gravity: 5,
        scalingRatio: 2,
        barnesHutOptimize: true,
        strongGravityMode: true,
        adjustSizes: true,
        slowDown: 3,
      },
    });

    // Read positions and scale to pixel space
    const positions: Record<string, { x: number; y: number }> = {};
    graph.forEachNode((nodeId, attrs) => {
      positions[nodeId] = { x: attrs.x as number, y: attrs.y as number };
    });

    const allX = Object.values(positions).map((p) => p.x);
    const allY = Object.values(positions).map((p) => p.y);
    const minX = Math.min(...allX);
    const maxX = Math.max(...allX);
    const minY = Math.min(...allY);
    const maxY = Math.max(...allY);
    const rangeX = maxX - minX || 1;
    const rangeY = maxY - minY || 1;
    const CANVAS = 800;
    const scale = CANVAS / Math.max(rangeX, rangeY);

    // Convert to React Flow nodes
    const rfNodes: Node[] = validNodes.map((node) => {
      const isLeader = node.title === node.main_group;
      const tier = node.calculated_tier;
      const tierColor = getTierColor(tier);
      const showLabel =
        isLeader || ["Tier A+", "Tier A"].includes(tier);
      const nodeSize = isLeader
        ? tier === "Tier A+"
          ? 64
          : tier === "Tier A"
            ? 52
            : 44
        : Math.max(24, Math.min(node.total_cited * 1.5, 42));

      const pos = positions[String(node.channel_id)];

      return {
        id: String(node.channel_id),
        type: "kol",
        position: {
          x: (pos.x - minX) * scale,
          y: (pos.y - minY) * scale,
        },
        data: {
          title: node.title,
          image:
            node.profile_image_url &&
            node.profile_image_url.length > 5
              ? node.profile_image_url
              : null,
          tier,
          tierColor,
          nodeSize,
          showLabel,
          mainGroup: node.main_group || "-",
          totalCited: node.total_cited,
          citedByAp: node.cited_by_ap_count,
          citedByA: node.cited_by_a_count,
          nobleScore: node.noble_score,
          username: node.username,
          isLeader,
        } satisfies KOLNodeData,
      };
    });

    // Convert to React Flow edges
    const rfEdges: Edge[] = [];
    const addedEdges = new Set<string>();
    for (const edge of validEdges) {
      const src = String(edge.source_id);
      const tgt = String(edge.target_id);
      const key = `${src}-${tgt}`;
      if (
        validNodeIds.has(edge.source_id) &&
        validNodeIds.has(edge.target_id) &&
        !addedEdges.has(key)
      ) {
        addedEdges.add(key);
        rfEdges.push({
          id: key,
          source: src,
          target: tgt,
          type: "straight",
          style: {
            stroke: edge.is_golden_link
              ? "#F59E0B"
              : "rgba(203,213,225,0.2)",
            strokeWidth: edge.is_golden_link
              ? Math.min(edge.weight * 0.8, 3)
              : 0.4,
            pointerEvents: "none",
          },
          focusable: false,
          interactionWidth: 0,
        });
      }
    }

    return { rfNodes, rfEdges };
  }, [nodes, edges]);

  const onNodeMouseEnter: NodeMouseHandler = useCallback((event, node) => {
    const rect = (event.target as HTMLElement)
      .closest(".react-flow__node")
      ?.getBoundingClientRect();
    if (rect) {
      setTooltip({
        x: rect.right + 12,
        y: rect.top + rect.height / 2,
        data: node.data as KOLNodeData,
      });
    }
  }, []);

  const onNodeMouseLeave = useCallback(() => {
    setTooltip(null);
  }, []);

  return (
    <div className="relative w-full h-full">
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        onNodeMouseEnter={onNodeMouseEnter}
        onNodeMouseLeave={onNodeMouseLeave}
        fitView
        fitViewOptions={{ padding: 0.08 }}
        minZoom={0.1}
        maxZoom={4}
        nodesDraggable={true}
        nodesConnectable={false}
        edgesFocusable={false}
        elementsSelectable={false}
        panOnDrag
        zoomOnScroll
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#f1f5f9" gap={30} size={1} />
        <Controls
          position="bottom-right"
          showInteractive={false}
        />
        <MiniMap
          position="top-right"
          pannable
          zoomable
          nodeColor={(n) => {
            const data = n.data as KOLNodeData | undefined;
            return data?.tierColor || "#94a3b8";
          }}
          nodeStrokeWidth={2}
          maskColor="rgba(240,240,245,0.7)"
          style={{ borderRadius: 8, border: "1px solid #e2e8f0", width: 160, height: 110 }}
        />
      </ReactFlow>

      {/* Floating Tooltip */}
      {tooltip && (
        <div
          className="fixed z-[9999] pointer-events-none bg-white/95 backdrop-blur-md rounded-xl shadow-2xl border border-gray-200/80 p-4 text-sm min-w-[230px]"
          style={{
            left: Math.min(tooltip.x, window.innerWidth - 280),
            top: tooltip.y,
            transform: "translateY(-50%)",
          }}
        >
          <div className="flex items-center gap-3 mb-3">
            {tooltip.data.image ? (
              <img
                src={tooltip.data.image}
                alt=""
                className="w-11 h-11 rounded-full border-2 object-cover shrink-0"
                style={{ borderColor: tooltip.data.tierColor }}
                onError={(e) => (e.currentTarget.style.display = "none")}
              />
            ) : (
              <div
                className="w-11 h-11 rounded-full shrink-0 flex items-center justify-center text-white text-sm font-bold"
                style={{ backgroundColor: tooltip.data.tierColor }}
              >
                {tooltip.data.title.charAt(0)}
              </div>
            )}
            <div>
              <p className="font-bold text-gray-900 text-sm leading-tight">
                {tooltip.data.title}
              </p>
              <span
                className="inline-block mt-0.5 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                style={{
                  backgroundColor: tooltip.data.tierColor + "18",
                  color: tooltip.data.tierColor,
                }}
              >
                {tooltip.data.tier}
              </span>
            </div>
          </div>
          <div className="space-y-1.5 text-xs text-gray-600 border-t border-gray-100 pt-2">
            <div className="flex justify-between">
              <span>그룹</span>
              <span className="font-semibold text-gray-800">
                {tooltip.data.mainGroup}
              </span>
            </div>
            <div className="flex justify-between">
              <span>총 인용</span>
              <span className="font-semibold text-gray-800">
                {tooltip.data.totalCited}
              </span>
            </div>
            <div className="flex justify-between">
              <span>A+ 샤라웃</span>
              <span className="font-bold text-red-600">
                {tooltip.data.citedByAp > 0
                  ? `${tooltip.data.citedByAp}회`
                  : "-"}
              </span>
            </div>
            <div className="flex justify-between">
              <span>A 샤라웃</span>
              <span className="font-bold text-orange-600">
                {tooltip.data.citedByA > 0
                  ? `${tooltip.data.citedByA}회`
                  : "-"}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Score</span>
              <span className="font-semibold text-gray-800">
                {tooltip.data.nobleScore}
              </span>
            </div>
            {tooltip.data.username && (
              <div className="flex justify-between">
                <span>채널</span>
                <span className="text-blue-500 font-medium">
                  @{tooltip.data.username}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-white/95 backdrop-blur-sm rounded-lg border border-gray-200/80 shadow-sm px-4 py-2.5 text-[11px] flex items-center gap-4 z-10">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-red-600" /> A+
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-orange-500" /> A
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-amber-500" /> B+
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-purple-500" /> B
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-emerald-500" /> C
        </span>
        <span className="ml-1 text-gray-300">|</span>
        <span className="flex items-center gap-1.5 text-amber-600 font-medium">
          <span className="w-4 h-[2px] bg-amber-400 rounded" /> Golden Link
        </span>
      </div>
    </div>
  );
}
