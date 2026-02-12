import { queryKolNodes, queryKolEdges } from "@/utils/kol-db";
import KOLClient from "./KOLClient";
import { GlobeAltIcon } from "@heroicons/react/24/outline";

export default async function KOLPage() {
  try {
    const [nodes, edges] = await Promise.all([
      queryKolNodes(),
      queryKolEdges(),
    ]);

    return (
      <div className="w-full max-w-7xl mx-auto py-10 px-4">
        <div className="mb-12">
          <h1 className="text-4xl font-black text-gray-900 tracking-tight mb-1 flex items-center gap-2"><GlobeAltIcon className="w-7 h-7 text-[#0037F0]" /> KOL 평판 생태계</h1>
          <p className="text-gray-500 text-sm font-medium">
            Tier A 채널들의 샤라웃(Forwarding)을 기반으로 분석한 암호화폐 채널
            영향력 지도입니다.
          </p>
        </div>

        <KOLClient initialNodes={nodes} initialEdges={edges} />
      </div>
    );
  } catch (error) {
    console.error("Data fetch error:", error);
    return <div>데이터를 불러오는 중 오류가 발생했습니다.</div>;
  }
}
