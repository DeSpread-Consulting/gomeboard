/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import DashboardClient, {
  ProjectCard,
  AutomationItem,
} from "./DashboardClient";
import { unstable_cache } from "next/cache"; // [NEW] 캐시 함수 불러오기

// 환경변수
const NOTION_TOKEN = process.env.NOTION_TOKEN;
const PROJECT_DB_ID = process.env.NOTION_DATABASE_ID;
const AUTOMATION_DB_ID = process.env.NOTION_AUTOMATION_DB_ID;
const API_BASE_URL = "https://mashboard-api.despreadlabs.io"; // 실제 API 주소

const headers = {
  Authorization: `Bearer ${NOTION_TOKEN}`,
  "Content-Type": "application/json",
  "Notion-Version": "2025-09-03",
};

// [로직] 프로젝트별 지난달 보고서 상태 체크
async function fetchReportStatus(projectId: string) {
  if (!projectId) return "N/A";

  try {
    const res = await fetch(`${API_BASE_URL}/projects/${projectId}/reports`, {
      method: "GET",
      next: { revalidate: 0 }, // [수정] 내부 캐시는 끔 (상위 캐시가 제어)
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
  } catch (e) {
    console.error(`Report fetch error:`, e);
    return "Error";
  }
}

// [RAW] 실제 데이터를 가져오는 무거운 함수 (이름 변경: getDashboardData -> getDashboardDataRaw)
async function getDashboardDataRaw() {
  if (!NOTION_TOKEN || !PROJECT_DB_ID || !AUTOMATION_DB_ID) return null;

  // ------------------------------------------------------------
  // 1. 노션 프로젝트 DB 조회
  // ------------------------------------------------------------
  const dbRes = await fetch(
    `https://api.notion.com/v1/databases/${PROJECT_DB_ID}`,
    { headers, next: { revalidate: 0 } } // [수정] 내부 캐시 끔
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
        next: { revalidate: 0 }, // [수정] 내부 캐시 끔
      }
    );
    const queryData = await queryRes.json();

    // 병렬 처리로 속도 향상
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
          workScope,
          reportStatus,
          apiProjectId,
        };
      })
    );

    allProjects.push(...mappedPages);
  }

  // ------------------------------------------------------------
  // 2. 자동화 DB 조회
  // ------------------------------------------------------------
  const autoDbRes = await fetch(
    `https://api.notion.com/v1/databases/${AUTOMATION_DB_ID}`,
    { headers, next: { revalidate: 0 } } // [수정] 내부 캐시 끔
  );
  const autoDbData = await autoDbRes.json();
  const autoSourceId = autoDbData.data_sources?.[0]?.id;

  const automationList: AutomationItem[] = [];

  if (autoSourceId) {
    const autoQueryRes = await fetch(
      `https://api.notion.com/v1/data_sources/${autoSourceId}/query`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          page_size: 100,
          sorts: [{ property: "순서", direction: "ascending" }],
        }),
        next: { revalidate: 0 }, // [수정] 내부 캐시 끔
      }
    );
    const autoQueryData = await autoQueryRes.json();

    (autoQueryData.results || []).forEach((page: any) => {
      const props = page.properties || {};
      let icon = page.icon?.emoji || null;
      if (!icon && page.icon?.type === "external")
        icon = page.icon.external.url;
      if (!icon && page.icon?.type === "file") icon = page.icon.file.url;

      automationList.push({
        id: page.id,
        title: props["이름"]?.title?.[0]?.plain_text || "No Title",
        status: props["상태"]?.select?.name || "MANUAL",
        description: props["설명"]?.rich_text?.[0]?.plain_text || "",
        notionUrl: props["가이드링크"]?.url || "#",
        techStack:
          props["기술스택"]?.multi_select?.map((tag: any) => tag.name) || [],
        category: props["카테고리"]?.select?.name || "기타",
        icon: icon,
      });
    });
  }

  return {
    title: dbData.title?.[0]?.plain_text,
    projects: allProjects,
    automations: automationList,
  };
}

// ------------------------------------------------------------
// [CACHE] 캐싱 적용 (5분 = 300초)
// ------------------------------------------------------------
const getCachedDashboardData = unstable_cache(
  async () => getDashboardDataRaw(), // 실행할 진짜 함수
  ["overview-dashboard-v1"], // 캐시 키
  { revalidate: 300 } // 캐시 유지 시간 (초)
);

export default async function Page() {
  // [변경] 캐싱된 함수 호출
  const data = await getCachedDashboardData();

  if (!data) return <div>Data Load Error</div>;

  return (
    <DashboardClient
      projects={data.projects}
      automations={data.automations}
      title={data.title}
      isOverview={true}
    />
  );
}
