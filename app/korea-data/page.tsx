import KoreaDataClient from "./components/KoreaDataClient";
import { fetchProjectList, fetchNewsData } from "./actions";

export const revalidate = 300; // 5 min ISR

export default async function KoreaDataPage() {
  const [projectsRes, newsRes] = await Promise.all([
    fetchProjectList(),
    fetchNewsData(),
  ]);

  return (
    <KoreaDataClient
      initialProjects={projectsRes.data ?? []}
      initialNewsData={newsRes.data ?? null}
    />
  );
}
