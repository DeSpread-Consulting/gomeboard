"use client";

interface Props {
  label: string;
  icon: string;
  score: number | null;
  available: boolean;
  active: boolean;
  subtitle?: string;
  onClick: () => void;
}

export default function ScoreCard({
  label,
  icon,
  score,
  available,
  active,
  subtitle,
  onClick,
}: Props) {
  if (!available) {
    return (
      <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 opacity-50 cursor-not-allowed">
        <div className="flex items-center gap-1.5 mb-1">
          <span className="text-sm">{icon}</span>
          <span className="text-xs font-bold text-gray-400">{label}</span>
        </div>
        <div className="text-[10px] text-gray-400">Post-TGE only</div>
      </div>
    );
  }

  const scoreColor =
    score === null
      ? "text-gray-400"
      : score >= 70
      ? "text-green-600"
      : score >= 40
      ? "text-amber-600"
      : "text-red-500";

  const borderColor = active
    ? "border-[#0037F0] shadow-brand-glow"
    : "border-gray-100 hover:border-gray-200";

  return (
    <button
      onClick={onClick}
      className={`bg-white rounded-xl p-4 shadow-sm border-2 transition-all text-left w-full ${borderColor}`}
    >
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <span className="text-sm">{icon}</span>
          <span className="text-xs font-bold text-gray-700">{label}</span>
        </div>
        {active && (
          <span className="w-2 h-2 rounded-full bg-[#0037F0]" />
        )}
      </div>
      {score !== null ? (
        <>
          <div className="flex items-baseline gap-1">
            <span className={`text-2xl font-black ${scoreColor}`}>{score}</span>
            <span className="text-xs text-gray-400">/100</span>
          </div>
          {subtitle && (
            <div className="text-[10px] text-gray-400 mt-0.5">{subtitle}</div>
          )}
        </>
      ) : (
        <div className="text-sm text-gray-400 font-medium">N/A</div>
      )}
      {/* Mini sparkline bar */}
      {score !== null && (
        <div className="mt-2 h-1 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              score >= 70
                ? "bg-green-500"
                : score >= 40
                ? "bg-amber-500"
                : "bg-red-500"
            }`}
            style={{ width: `${score}%` }}
          />
        </div>
      )}
    </button>
  );
}
