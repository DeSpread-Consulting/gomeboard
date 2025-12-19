/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import StorytellerClient from "./StorytellerClient";
import { unstable_cache } from "next/cache";

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const STORYTELLER_DB_ID = process.env.NOTION_STORYTELLER_DB_ID;
const API_BASE_URL =
  "https://mashboard-api.despreadlabs.io/storyteller-leaderboard";

const headers = {
  Authorization: `Bearer ${NOTION_TOKEN}`,
  "Content-Type": "application/json",
  "Notion-Version": "2025-09-03",
};

// ----------------------------------------------------------------------
// 1. 노션 데이터 가져오기
// ----------------------------------------------------------------------
async function fetchNotionTasksRaw() {
  if (!NOTION_TOKEN || !STORYTELLER_DB_ID) return [];

  try {
    // [Step 1] DB 메타데이터 조회
    const dbRes = await fetch(
      `https://api.notion.com/v1/databases/${STORYTELLER_DB_ID}`,
      { headers, next: { revalidate: 0 } }
    );
    if (!dbRes.ok) return [];

    const dbData = await dbRes.json();
    const dataSources = dbData.data_sources || [];
    const allResults: any[] = [];

    // [Step 2] 데이터 조회
    if (dataSources.length === 0) {
      const legacyRes = await fetch(
        `https://api.notion.com/v1/databases/${STORYTELLER_DB_ID}/query`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({ page_size: 100 }),
          next: { revalidate: 0 },
        }
      );
      if (legacyRes.ok)
        allResults.push(...((await legacyRes.json()).results || []));
    } else {
      await Promise.all(
        dataSources.map(async (source: any) => {
          const queryRes = await fetch(
            `https://api.notion.com/v1/data_sources/${source.id}/query`,
            {
              method: "POST",
              headers,
              body: JSON.stringify({ page_size: 100 }),
              next: { revalidate: 0 },
            }
          );
          if (queryRes.ok)
            allResults.push(...((await queryRes.json()).results || []));
        })
      );
    }

    // [Step 3] 데이터 매핑
    const tasks = allResults.map((page: any) => {
      const props = page.properties || {};

      // 제목 ("프로젝트" 속성 우선)
      const titleProp =
        props["프로젝트"] ||
        props["이름"] ||
        props["Name"] ||
        props["Title"] ||
        props["제목"];
      const title = titleProp?.title?.[0]?.plain_text || "Untitled";

      // GroupID 추출
      const groupProp =
        props["GroupID"] || props["Group ID"] || props["그룹ID"];
      let groupId: string | null = null;
      if (groupProp?.type === "number")
        groupId = groupProp.number?.toString() || null;
      else if (groupProp?.type === "rich_text")
        groupId = groupProp.rich_text?.[0]?.plain_text || null;
      else if (groupProp?.type === "select")
        groupId = groupProp.select?.name || null;

      // 날짜 처리
      const dateProp =
        props["날짜"] || props["Date"] || props["Period"] || props["일정"];
      let dateStart: string | null = null;
      let dateEnd: string | null = null;

      if (dateProp?.type === "date" && dateProp.date) {
        dateStart = dateProp.date.start;
        dateEnd = dateProp.date.end || dateStart;
      } else if (dateProp?.type === "rich_text" || dateProp?.type === "title") {
        const textContent =
          dateProp.rich_text?.[0]?.plain_text ||
          dateProp.title?.[0]?.plain_text ||
          "";
        const parsed = parseKoreanDate(textContent);
        dateStart = parsed.start;
        dateEnd = parsed.end;
      }

      // 상태 및 기타 속성
      const statusProp = props["상태"] || props["Status"] || props["State"];
      const categoryProp = props["분류"] || props["Category"];
      const personProp = props["담당자"] || props["Person"];

      return {
        id: page.id,
        title,
        groupId,
        dateStart,
        dateEnd,
        status: statusProp?.status?.name || statusProp?.select?.name || "Ready",
        category:
          categoryProp?.select?.name ||
          categoryProp?.multi_select?.[0]?.name ||
          "General",
        manager: personProp?.people?.[0]?.name || "-",
        managerImg: personProp?.people?.[0]?.avatar_url || null,
      };
    });

    // [Filter Active] "진행중" 상태만 필터링 (다시 활성화됨)
    return tasks.filter(
      (t: any) =>
        t.status === "진행중" ||
        t.status === "In Progress" ||
        t.status === "진행 중" ||
        t.status === "Ongoing"
    );
  } catch (e) {
    console.error("Notion Fetch Error:", e);
    return [];
  }
}

// ----------------------------------------------------------------------
// 2. API 데이터 가져오기
// ----------------------------------------------------------------------
async function fetchAllApiData(groupIds: string[]) {
  const apiDataMap: Record<string, any> = {};
  await Promise.all(
    groupIds.map(async (id) => {
      try {
        const url = `${API_BASE_URL}/${id}/timeseries-group?limit=20&lookbacks=30`;
        const res = await fetch(url, { next: { revalidate: 3600 } });
        if (res.ok) apiDataMap[id] = await res.json();
      } catch (e) {
        console.error(`API Fetch Error for Group ${id}:`, e);
      }
    })
  );
  return apiDataMap;
}

// ----------------------------------------------------------------------
// 유틸리티
// ----------------------------------------------------------------------
function parseKoreanDate(text: string) {
  if (!text) return { start: null, end: null };
  const matches = text.match(/(\d+)\s*월\s*(\d+)\s*일/g);
  if (!matches || matches.length === 0) return { start: null, end: null };

  const currentYear = new Date().getFullYear();
  const parseToISO = (dateStr: string) => {
    const m = dateStr.match(/(\d+)\s*월\s*(\d+)\s*일/);
    if (!m) return null;
    const date = new Date(
      currentYear,
      parseInt(m[1], 10) - 1,
      parseInt(m[2], 10)
    );
    return !isNaN(date.getTime()) ? date.toISOString() : null;
  };
  const start = parseToISO(matches[0]);
  const end = matches.length > 1 ? parseToISO(matches[1]) : start;
  return { start, end };
}

const getCachedNotion = unstable_cache(
  fetchNotionTasksRaw,
  ["storyteller-notion-v8"],
  { revalidate: 60 }
);

export default async function StorytellerPage() {
  const notionTasks = await getCachedNotion();

  // 1. GroupID 추출
  const uniqueGroupIds = Array.from(
    new Set(
      notionTasks
        .map((t: any) => t.groupId)
        .filter((id: any) => id !== null && id !== undefined && id !== "")
    )
  ) as string[];

  // 기본값 (데이터가 없거나 ID가 없는 경우)
  if (uniqueGroupIds.length === 0) uniqueGroupIds.push("63");

  // 2. GroupID -> ProjectName 매핑
  const projectNames: Record<string, string> = {};
  notionTasks.forEach((t: any) => {
    if (t.groupId && t.title) {
      if (!projectNames[t.groupId]) {
        projectNames[t.groupId] = t.title;
      }
    }
  });

  // 3. API 데이터 가져오기
  const apiDataMap = await fetchAllApiData(uniqueGroupIds);

  return (
    <StorytellerClient
      notionTasks={notionTasks}
      apiDataMap={apiDataMap}
      availableGroupIds={uniqueGroupIds}
      projectNames={projectNames}
    />
  );
}
