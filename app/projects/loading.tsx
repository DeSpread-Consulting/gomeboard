export default function Loading() {
  return (
    <div className="min-h-screen bg-[#F3F4F6] flex flex-col items-center justify-center">
      <div className="glass-card p-8 flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-gray-200 border-t-[#0037F0] rounded-full animate-spin"></div>
        <p className="text-gray-500 font-medium animate-pulse">
          데이터를 불러오고 있습니다...
        </p>
      </div>
    </div>
  );
}
