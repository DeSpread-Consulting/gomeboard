/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { put } from "@vercel/blob";

// API 기본 주소
const API_BASE_URL =
  "https://mashboard-api.despreadlabs.io/storyteller-leaderboard";

// 환경변수
const NOTION_TOKEN = process.env.NOTION_TOKEN;
const DB_ID = process.env.NOTION_STORYTELLER_DB_ID;

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// [Filter] 진행중인 프로젝트만 필터링하기 위한 조건 객체
const FILTER_QUERY = {
  filter: {
    or: [
      { property: "Status", status: { equals: "진행중" } },
      { property: "Status", status: { equals: "In Progress" } },
      { property: "상태", status: { equals: "진행중" } },
      { property: "상태", status: { equals: "In Progress" } },
    ],
  },
};

export async function GET() {
  console.log("--> [Cron] Data Snapshot Job Started (v2025-09-03)");

  if (!NOTION_TOKEN || !DB_ID) {
    console.error("Missing Notion Env Variables");
    return NextResponse.json({ error: "Env missing" }, { status: 500 });
  }

  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  const results = [];

  // Notion API 공통 헤더
  const headers = {
    Authorization: `Bearer ${NOTION_TOKEN}`,
    "Content-Type": "application/json",
    "Notion-Version": "2025-09-03", // [중요] 최신 버전 명시
  };

  try {
    // ---------------------------------------------------------
    // 1. Notion DB 메타데이터 조회 (Data Source 확인용)
    // ---------------------------------------------------------
    console.log("1. Fetching DB Metadata...");
    const dbRes = await fetch(`https://api.notion.com/v1/databases/${DB_ID}`, {
      headers,
    });

    if (!dbRes.ok) {
      throw new Error(`Failed to fetch DB Metadata: ${dbRes.statusText}`);
    }

    const dbData = await dbRes.json();
    const dataSources = dbData.data_sources || [];
    const allPages: any[] = [];

    // ---------------------------------------------------------
    // 2. 데이터 조회 (Data Source 방식 vs Legacy 방식 분기)
    // ---------------------------------------------------------
    if (dataSources.length > 0) {
      // [New Way] Data Source가 연결된 경우
      console.log(
        `   Data Sources detected (${dataSources.length}). Using Source Query.`
      );

      await Promise.all(
        dataSources.map(async (source: any) => {
          const queryRes = await fetch(
            `https://api.notion.com/v1/data_sources/${source.id}/query`,
            {
              method: "POST",
              headers,
              body: JSON.stringify(FILTER_QUERY), // 필터 적용
            }
          );
          if (queryRes.ok) {
            const data = await queryRes.json();
            allPages.push(...(data.results || []));
          }
        })
      );
    } else {
      // [Legacy Way] Data Source가 없는 경우 (기존 DB Query)
      console.log("   No Data Sources. Using Legacy DB Query.");

      const legacyRes = await fetch(
        `https://api.notion.com/v1/databases/${DB_ID}/query`,
        {
          method: "POST",
          headers,
          body: JSON.stringify(FILTER_QUERY), // 필터 적용
        }
      );

      if (legacyRes.ok) {
        const data = await legacyRes.json();
        allPages.push(...(data.results || []));
      }
    }

    // ---------------------------------------------------------
    // 3. GroupID 추출 (중복 제거)
    // ---------------------------------------------------------
    const groupIds = new Set<string>();

    allPages.forEach((page: any) => {
      const props = page.properties;
      // 노션 속성 타입별 GroupID 추출
      const groupProp =
        props["GroupID"] || props["Group ID"] || props["그룹ID"];
      let idValue: string | null = null;

      if (groupProp) {
        if (groupProp.type === "number") idValue = String(groupProp.number);
        else if (groupProp.type === "rich_text")
          idValue = groupProp.rich_text[0]?.plain_text;
        else if (groupProp.type === "select") idValue = groupProp.select?.name;
        else if (groupProp.type === "title")
          idValue = groupProp.title[0]?.plain_text;
      }

      if (idValue && idValue !== "null" && idValue !== "undefined") {
        groupIds.add(idValue);
      }
    });

    const targetIds = Array.from(groupIds);
    console.log(`   Found active Group IDs: [${targetIds.join(", ")}]`);

    if (targetIds.length === 0) {
      return NextResponse.json({ message: "No active projects found." });
    }

    // ---------------------------------------------------------
    // 4. API 데이터 수집 및 Vercel Blob 저장
    // ---------------------------------------------------------
    for (const groupId of targetIds) {
      try {
        // 4-1. 외부 API 호출
        const apiUrl = `${API_BASE_URL}/${groupId}/timeseries-group?limit=20&lookbacks=30`;
        const res = await fetch(apiUrl);

        if (!res.ok) {
          console.error(`   Failed to fetch API for Group ${groupId}`);
          continue;
        }

        const data = await res.json();

        // 4-2. JSON 파일 저장 (경로: history/63/2025-12-19.json)
        const filename = `history/${groupId}/${today}.json`;

        const blob = await put(filename, JSON.stringify(data), {
          access: "public",
          contentType: "application/json",
          addRandomSuffix: false, // 덮어쓰기 허용 (하루 1회 갱신)
        });

        console.log(`   Saved JSON: ${filename}`);
        results.push({ groupId, url: blob.url });
      } catch (innerError) {
        console.error(`   Error processing Group ${groupId}:`, innerError);
      }
    }

    return NextResponse.json({
      success: true,
      count: results.length,
      saved: results,
    });
  } catch (error) {
    console.error("Critical Error:", error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
