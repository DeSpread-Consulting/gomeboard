/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import DashboardClient, { ProjectCard } from "../components/DashboardClient";
import { unstable_cache } from "next/cache"; // [NEW] 캐시 import

// ----------------------------------------------------------------------
// 1. 설정 및 환경변수
// ----------------------------------------------------------------------
const NOTION_TOKEN = process.env.NOTION_TOKEN;
const PROJECT_DB_ID = process.env.NOTION_DATABASE_ID;
const API_BASE_URL = "https://mashboard-api.despreadlabs.io"; // 보고서 API 주소

const headers = {
  Authorization: `Bearer ${NOTION_TOKEN}`,
  "Content-Type": "application/json",
  "Notion-Version": "2025-09-03",
};

// 1. 리포트 상태 조회 (이건 API라 빠르지만 같이 캐싱됨)
async function fetchReportStatus(projectId: string) {
  if (!projectId) return "N/A";
  try {
    const res = await fetch(`${API_BASE_URL}/projects/${projectId}/reports`, {
      method: "GET",
      next: { revalidate: 0 }, // 내부 캐시는 끔 (상위에서 통제)
    });
    if (!res.ok) return "Unknown";
    const data: any[] = await res.json();

    const now = new Date();
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const targetPrefix = prevMonth.toISOString().substring(0, 7);

    const targetReports = data.filter((item: any) =>
      item.date.startsWith(targetPrefix)
    );
    if (targetReports.length === 0) return "Missing";
    const isAllApproved = targetReports.every(
      (item: any) => !!item.approval?._id
    );
    return isAllApproved ? "Approved" : "Pending";
  } catch {
    return "Error";
  }
}

// 2. [RAW] 실제 데이터를 가져오는 무거운 함수
async function fetchProjectsRaw() {
  if (!NOTION_TOKEN || !PROJECT_DB_ID) return null;

  const dbRes = await fetch(
    `https://api.notion.com/v1/databases/${PROJECT_DB_ID}`,
    { headers, next: { revalidate: 0 } }
  );
  const dbData = await dbRes.json();
  const dataSourcesList = dbData.data_sources || [];
  const allProjects: ProjectCard[] = [];

  for (const source of dataSourcesList) {
    const queryRes = await fetch(
      `https://api.notion.com/v1/data_sources/${source.id}/query`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({ page_size: 100 }),
        next: { revalidate: 0 },
      }
    );
    const queryData = await queryRes.json();

    const mappedPages = await Promise.all(
      (queryData.results || []).map(async (page: any) => {
        const props = page.properties || {};

        const title = props["프로젝트"]?.title?.[0]?.plain_text || "Untitled";
        let icon = page.icon?.emoji || null;
        if (!icon && page.icon?.type === "external")
          icon = page.icon.external.url;
        if (!icon && page.icon?.type === "file") icon = page.icon.file.url;

        const team = props["팀"]?.select?.name || "-";
        const status = props["상태"]?.status?.name || "대기";

        let progress = 0;
        if (props["진행률"]?.type === "number")
          progress = props["진행률"].number || 0;
        else if (props["진행률"]?.type === "rollup")
          progress = props["진행률"].rollup?.number || 0;
        else if (props["진행률"]?.type === "formula")
          progress = props["진행률"].formula?.number || 0;

        const dateStart = props["계약 기간"]?.date?.start || "";
        const dateEnd = props["계약 기간"]?.date?.end || "";
        const period = dateStart
          ? `${dateStart.slice(2).replace(/-/g, ".")} ~ ${
              dateEnd ? dateEnd.slice(2).replace(/-/g, ".") : ""
            }`
          : "-";

        const manager = props["담당자"]?.people?.[0]?.name || "-";
        const managerImage = props["담당자"]?.people?.[0]?.avatar_url || null;
        const poc = props["PoC"]?.people?.[0]?.name || "-";
        const pocImage = props["PoC"]?.people?.[0]?.avatar_url || null;

        const workScope: string[] = [];
        const rollupProp = props["업무_표시용"];
        if (rollupProp && rollupProp.type === "rollup") {
          rollupProp.rollup.array?.forEach((item: any) => {
            if (item.type === "select") workScope.push(item.select?.name);
            if (item.type === "multi_select")
              item.multi_select.forEach((m: any) => workScope.push(m.name));
            if (item.type === "title")
              item.title.forEach((t: any) => workScope.push(t.plain_text));
          });
        }

        const apiProjectId =
          props["Project_API_ID"]?.rich_text?.[0]?.plain_text || "";
        let reportStatus = "N/A";
        if (apiProjectId) {
          reportStatus = await fetchReportStatus(apiProjectId);
        }

        return {
          id: page.id,
          title,
          icon,
          team,
          status,
          progress,
          period,
          periodStart: dateStart,
          manager,
          managerImage,
          poc,
          pocImage,
          workScope,
          reportStatus,
          apiProjectId,
        };
      })
    );

    allProjects.push(...mappedPages);
  }

  return { title: dbData.title?.[0]?.plain_text, projects: allProjects };
}

// 3. [CACHE] 캐싱 적용 (5분)
const getCachedProjects = unstable_cache(
  async () => fetchProjectsRaw(),
  ["projects-data-v1"],
  { revalidate: 300 }
);

export default async function ProjectPage() {
  const data = await getCachedProjects();
  if (!data) return <div>Data Load Error</div>;

  return <DashboardClient projects={data.projects} title={data.title} />;
}
