"use client";

import type { NarrativeItem } from "../actions";

function GradeBar({ a, b, c, d }: { a: number; b: number; c: number; d: number }) {
  const total = a + b + c + d;
  if (total === 0) return <span className="text-[10px] text-gray-400">-</span>;

  const pA = (a / total) * 100;
  const pB = (b / total) * 100;
  const pC = (c / total) * 100;
  const pD = (d / total) * 100;

  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1 h-4 rounded-full overflow-hidden bg-gray-100 flex">
        {pA > 0 && <div className="h-full bg-green-500" style={{ width: `${pA}%` }} />}
        {pB > 0 && <div className="h-full bg-blue-500" style={{ width: `${pB}%` }} />}
        {pC > 0 && <div className="h-full bg-amber-400" style={{ width: `${pC}%` }} />}
        {pD > 0 && <div className="h-full bg-red-400" style={{ width: `${pD}%` }} />}
      </div>
      <span className="text-[10px] text-gray-500 w-8 text-right shrink-0">{total}</span>
    </div>
  );
}

export default function NarrativeQualityBoard({
  data,
}: {
  data: NarrativeItem[];
}) {
  if (!data.length) {
    return (
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 h-full">
        <h3 className="text-lg font-bold text-gray-900 mb-4">내러티브 품질</h3>
        <div className="h-40 flex items-center justify-center text-gray-400 text-sm">
          데이터가 없습니다
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 h-full flex flex-col">
      <div className="mb-3">
        <h3 className="text-lg font-bold text-gray-900">내러티브 품질 리더보드</h3>
        <p className="text-xs text-gray-500 mt-0.5">
          트렌딩 프로젝트 Storyteller 등급 분포 · 최근 7일 · {new Date().toLocaleDateString("ko-KR")} 기준
        </p>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 text-[10px] text-gray-500 mb-3">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" />A</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" />B</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" />C</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400" />D</span>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-white">
            <tr className="border-b border-gray-100">
              <th className="text-left py-2 px-1 text-gray-500 font-medium w-[90px]">프로젝트</th>
              <th className="text-right py-2 px-1 text-gray-500 font-medium w-[50px]">멘션</th>
              <th className="text-left py-2 px-1 text-gray-500 font-medium">등급 분포</th>
              <th className="text-right py-2 px-1 text-gray-500 font-medium w-[40px]">품질</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => {
              const totalGrades = d.gradeA + d.gradeB + d.gradeC + d.gradeD;
              const qualityPct =
                totalGrades > 0
                  ? Math.round(((d.gradeA + d.gradeB) / totalGrades) * 100)
                  : null;
              return (
                <tr key={d.ticker} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-1.5 px-1">
                    <div className="flex items-center gap-1.5">
                      {d.logo && (
                        <img src={d.logo} alt="" className="w-4 h-4 rounded-full shrink-0" />
                      )}
                      <span className="font-semibold text-gray-900 truncate">{d.ticker}</span>
                    </div>
                  </td>
                  <td className="text-right py-1.5 px-1 text-gray-600 font-medium tabular-nums">
                    {d.totalMentions.toLocaleString()}
                  </td>
                  <td className="py-1.5 px-1">
                    <GradeBar a={d.gradeA} b={d.gradeB} c={d.gradeC} d={d.gradeD} />
                  </td>
                  <td className="text-right py-1.5 px-1">
                    {qualityPct !== null ? (
                      <span
                        className={`font-bold ${
                          qualityPct >= 60
                            ? "text-green-600"
                            : qualityPct >= 30
                            ? "text-amber-600"
                            : "text-red-600"
                        }`}
                      >
                        {qualityPct}%
                      </span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
