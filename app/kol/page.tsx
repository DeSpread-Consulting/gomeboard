import { createClient } from "@/utils/supabase/server"; // 본인 프로젝트 경로에 맞게 수정
import KOLClient from "./KOLClient";
import { GlobeAltIcon } from "@heroicons/react/24/outline";

export default async function KOLPage() {
  const supabase = await createClient();

  // 1. 노드 데이터 (영향력 순)
  const { data: nodes, error: nodeError } = await supabase
    .from("kol_graph_nodes")
    .select("*")
    .order("total_cited", { ascending: false });

  // 2. 엣지 데이터 (최소 2회 이상 연결된 관계만 시각화하여 깔끔하게)
  const { data: edges, error: edgeError } = await supabase
    .from("kol_graph_edges")
    .select("*")
    .gte("weight", 2);

  if (nodeError || edgeError) {
    console.error("Data fetch error:", nodeError, edgeError);
    return <div>데이터를 불러오는 중 오류가 발생했습니다.</div>;
  }

  return (
    <div className="w-full max-w-7xl mx-auto py-10 px-4">
      <div className="mb-12">
        <h1 className="text-4xl font-black text-gray-900 tracking-tight mb-1 flex items-center gap-2"><GlobeAltIcon className="w-7 h-7 text-[#0037F0]" /> KOL 평판 생태계</h1>
        <p className="text-gray-500 text-sm font-medium">
          Tier A 채널들의 샤라웃(Forwarding)을 기반으로 분석한 암호화폐 채널
          영향력 지도입니다.
        </p>
      </div>

      <KOLClient initialNodes={nodes || []} initialEdges={edges || []} />
    </div>
  );
}
