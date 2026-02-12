import { fetchDashboardData } from "./actions";
import DashboardContent from "./components/DashboardContent";

// 1 Minute ISR revalidation as a fallback/base
export const revalidate = 60; 

export default async function CryptoDashboardPage() {
  const { data, error } = await fetchDashboardData();

  if (error || !data) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">가상화폐 시장 대시보드</h1>
        <div className="text-red-500">
          데이터를 불러오는 중 오류가 발생했습니다.
          <pre className="mt-2 text-sm text-gray-500">{error || "No data"}</pre>
        </div>
      </div>
    );
  }

  return (
    <DashboardContent 
      initialCrypto={data.crypto} 
      initialIndices={data.indices} 
      initialMajors={data.majors} 
    />
  );
}
