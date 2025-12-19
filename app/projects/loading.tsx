export default function Loading() {
  return (
    <div className="min-h-screen bg-[#F5F5F7] flex flex-col items-center justify-center">
      <div className="w-12 h-12 border-4 border-gray-200 border-t-black rounded-full animate-spin mb-4"></div>
      <p className="text-gray-500 font-medium animate-pulse">
        데이터를 불러오고 있습니다...
      </p>
    </div>
  );
}
