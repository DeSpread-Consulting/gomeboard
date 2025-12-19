/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import ReportClient, { ReportTableRow } from "./ReportClient";
import { unstable_cache } from "next/cache";

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const PROJECT_DB_ID = process.env.NOTION_DATABASE_ID;
const API_BASE_URL = "https://mashboard-api.despreadlabs.io";

const headers = {
  Authorization: `Bearer ${NOTION_TOKEN}`,
  "Content-Type": "application/json",
  "Notion-Version": "2025-09-03",
};

// [RAW] 데이터 조회
async function fetchReportsRaw() {
  if (!NOTION_TOKEN || !PROJECT_DB_ID) return { targetMonth: "", rows: [] };

  const now = new Date();
  const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const targetMonthPrefix = prevDate.toISOString().substring(0, 7);
  const targetMonthDisplay = prevDate.toLocaleString("default", {
    month: "long",
    year: "numeric",
  });

  const dbRes = await fetch(
    `https://api.notion.com/v1/databases/${PROJECT_DB_ID}`,
    { headers, next: { revalidate: 0 } }
  );
  const dbData = await dbRes.json();
  const sourceId = dbData.data_sources?.[0]?.id;

  if (!sourceId) return { targetMonth: targetMonthDisplay, rows: [] };

  const queryRes = await fetch(
    `https://api.notion.com/v1/data_sources/${sourceId}/query`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({ page_size: 100 }),
      next: { revalidate: 0 },
    }
  );
  const queryData = await queryRes.json();

  const rowsPromises = (queryData.results || []).map(async (page: any) => {
    const props = page.properties || {};

    const projectStatus = props["상태"]?.status?.name;
    if (projectStatus !== "진행 중") return null;

    const projectName = props["프로젝트"]?.title?.[0]?.plain_text || "Untitled";
    const manager = props["담당자"]?.people?.[0]?.name || "-";
    const managerImg = props["담당자"]?.people?.[0]?.avatar_url || null;
    const team = props["팀"]?.select?.name || "-";
    const apiProjectId =
      props["Project_API_ID"]?.rich_text?.[0]?.plain_text || "";

    let status = "N/A";
    let details = "";

    if (apiProjectId) {
      try {
        const res = await fetch(
          `${API_BASE_URL}/projects/${apiProjectId}/reports`,
          {
            method: "GET",
            next: { revalidate: 0 },
          }
        );
        if (res.ok) {
          const reports: any[] = await res.json();
          const monthlyItems = reports.filter((r: any) =>
            r.date.startsWith(targetMonthPrefix)
          );

          if (monthlyItems.length === 0) {
            status = "Missing";
          } else {
            const total = monthlyItems.length;
            const approved = monthlyItems.filter(
              (r: any) => !!r.approval?._id
            ).length;
            details = `${approved}/${total}`;
            status = total > 0 && total === approved ? "Approved" : "Pending";
          }
        } else {
          status = "Error";
        }
      } catch {
        status = "Error";
      }
    }

    return {
      id: page.id,
      projectName,
      manager,
      managerImg,
      team,
      targetMonth: targetMonthPrefix,
      status,
      details,
    };
  });

  const rows = (await Promise.all(rowsPromises)).filter(
    (row: any) => row !== null
  ) as ReportTableRow[];

  rows.sort((a, b) => {
    if (a.status === "Approved") return 1;
    if (b.status === "Approved") return -1;
    return 0;
  });

  return { targetMonth: targetMonthDisplay, rows };
}

// [CACHE] 캐싱 적용 (5분)
const getCachedReports = unstable_cache(
  async () => fetchReportsRaw(),
  ["reports-data-v1"],
  { revalidate: 300 }
);

export default async function ReportPage() {
  const { targetMonth, rows } = await getCachedReports();
  return <ReportClient targetMonth={targetMonth} rows={rows} />;
}
