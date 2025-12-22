/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { put } from "@vercel/blob";

const API_BASE_URL =
  "https://mashboard-api.despreadlabs.io/storyteller-leaderboard";
const NOTION_TOKEN = process.env.NOTION_TOKEN;
const DB_ID = process.env.NOTION_STORYTELLER_DB_ID;

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  console.log("--> [Cron] Data Source Job Started (All Projects)");

  // 1. 보안 체크
  const authHeader = request.headers.get("authorization");
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  if (!NOTION_TOKEN || !DB_ID) {
    return NextResponse.json({ error: "Env missing" }, { status: 500 });
  }

  const today = new Date().toISOString().split("T")[0];
  const headers = {
    Authorization: `Bearer ${NOTION_TOKEN}`,
    "Content-Type": "application/json",
    "Notion-Version": "2025-09-03", // 최신 버전 명시
  };

  try {
    // ---------------------------------------------------------
    // 1. DB 메타데이터 조회
    // ---------------------------------------------------------
    const dbRes = await fetch(`https://api.notion.com/v1/databases/${DB_ID}`, {
      headers,
    });
    if (!dbRes.ok) throw new Error(`DB Metadata Error: ${dbRes.statusText}`);

    const dbData = await dbRes.json();
    const dataSources = dbData.data_sources || [];

    if (dataSources.length === 0) {
      return NextResponse.json({
        error: "No Data Sources found. (Please check connection)",
      });
    }

    // ---------------------------------------------------------
    // 2. Data Source Query (필터 없이 조회)
    // ---------------------------------------------------------
    const allPages: any[] = [];

    await Promise.all(
      dataSources.map(async (source: any) => {
        const queryRes = await fetch(
          `https://api.notion.com/v1/data_sources/${source.id}/query`,
          {
            method: "POST",
            headers,
            // 필터 없이 모든 데이터를 가져옵니다.
            body: JSON.stringify({}),
          }
        );

        if (queryRes.ok) {
          const data = await queryRes.json();
          allPages.push(...(data.results || []));
        } else {
          console.error(
            `Query Error for Source ${source.id}:`,
            await queryRes.text()
          );
        }
      })
    );

    console.log(`Total Pages Found (No Filter): ${allPages.length}`);

    // ---------------------------------------------------------
    // 3. 필터링 (Status 체크 제거 -> GroupID 존재 여부만 확인)
    // ---------------------------------------------------------
    // 기존의 "진행중" 상태 체크 로직을 삭제했습니다.
    // 대신 API 요청에 필수적인 GroupID가 있는지만 확인하여 대상을 선정합니다.
    const targetProjects = allPages.filter((page: any) => {
      const props = page.properties;
      const groupProp =
        props["GroupID"] || props["Group ID"] || props["그룹ID"];

      // GroupID가 유효한 값을 가지고 있는지 확인
      if (groupProp?.number) return true;
      if (groupProp?.rich_text?.[0]?.plain_text) return true;
      if (groupProp?.title?.[0]?.plain_text) return true;

      return false;
    });

    console.log(`--> Target Projects (With GroupID): ${targetProjects.length}`);

    // ---------------------------------------------------------
    // 4. GroupID 추출 및 저장
    // ---------------------------------------------------------
    const results = [];

    for (const page of targetProjects) {
      const props = page.properties;
      const groupProp =
        props["GroupID"] || props["Group ID"] || props["그룹ID"];

      let groupId = null;
      if (groupProp?.number) groupId = String(groupProp.number);
      else if (groupProp?.rich_text)
        groupId = groupProp.rich_text[0]?.plain_text;
      else if (groupProp?.title) groupId = groupProp.title[0]?.plain_text;

      if (groupId) {
        try {
          const apiUrl = `${API_BASE_URL}/${groupId}/timeseries-group?limit=20&lookbacks=30`;
          const res = await fetch(apiUrl);
          if (res.ok) {
            const data = await res.json();
            const filename = `history/${groupId}/${today}.json`;
            const blob = await put(filename, JSON.stringify(data), {
              access: "public",
              contentType: "application/json",
              addRandomSuffix: false,
            });
            console.log(`   Saved: ${filename}`);
            results.push({ groupId, url: blob.url });
          }
        } catch (e) {
          console.error(`   Error Group ${groupId}:`, e);
        }
      }
    }

    return NextResponse.json({
      success: true,
      count: results.length,
      saved: results,
    });
  } catch (error) {
    console.error("Critical Error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
