/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import GuideClient, { GuideGroup, GuideItem } from "./GuideClient";
import { unstable_cache } from "next/cache";

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const GUIDE_PAGE_ID = process.env.NOTION_PM_GUIDE_PAGE_ID;
const API_VERSION = "2025-09-03";
const BASE_URL = "https://api.notion.com/v1";

const headers = {
  Authorization: `Bearer ${NOTION_TOKEN}`,
  "Content-Type": "application/json",
  "Notion-Version": API_VERSION,
};

// [헬퍼] 블록의 자식들 가져오기
async function fetchChildren(blockId: string) {
  try {
    const res = await fetch(
      `${BASE_URL}/blocks/${blockId}/children?page_size=100`,
      {
        headers,
        next: { revalidate: 3600 }, // 1시간 캐시 (가이드는 자주 안바뀌니까)
      }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data.results || [];
  } catch {
    return [];
  }
}

// [헬퍼] 페이지 상세정보(아이콘) 가져오기
async function fetchPageDetails(pageId: string) {
  try {
    const res = await fetch(`${BASE_URL}/pages/${pageId}`, {
      headers,
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// ---------------------------------------------------------
// 2. 블록 구조 평탄화 (병렬 처리 적용됨)
// ---------------------------------------------------------
async function getFlattenedBlocks(blockId: string): Promise<any[]> {
  const children = await fetchChildren(blockId);

  const childrenPromises = children.map(async (block: any) => {
    if (block.type === "column_list") {
      const columns = await fetchChildren(block.id);
      const columnBlocks = await Promise.all(
        columns.map(async (col: any) => getFlattenedBlocks(col.id))
      );
      return columnBlocks.flat();
    } else {
      return [block];
    }
  });

  const results = await Promise.all(childrenPromises);
  return results.flat();
}

// ---------------------------------------------------------
// 3. [핵심 변경] 기존 getGuideData 로직을 여기로 옮김 (이름 변경)
//    이 함수는 "진짜로 노션 API를 호출하는" 무거운 함수입니다.
// ---------------------------------------------------------
async function fetchGuideDataRaw() {
  if (!NOTION_TOKEN || !GUIDE_PAGE_ID) return [];

  try {
    // 블록 다 가져오기
    const blocks = await getFlattenedBlocks(GUIDE_PAGE_ID);

    // 그룹핑 로직
    const groups: GuideGroup[] = [];
    let currentGroup: GuideGroup | null = null;
    const defaultGroup: GuideGroup = {
      id: "default",
      title: "General",
      items: [],
    };

    for (const block of blocks) {
      // 헤딩 체크
      if (
        block.type === "heading_1" ||
        block.type === "heading_2" ||
        block.type === "heading_3"
      ) {
        if (currentGroup && currentGroup.items.length > 0)
          groups.push(currentGroup);
        const textContent = block[block.type].rich_text
          .map((t: any) => t.plain_text)
          .join("");
        currentGroup = {
          id: block.id,
          title: textContent || "Untitled Section",
          items: [],
        };
      }
      // 콜아웃 체크
      else if (block.type === "callout") {
        if (currentGroup && currentGroup.items.length > 0)
          groups.push(currentGroup);
        const textContent = block.callout.rich_text
          .map((t: any) => t.plain_text)
          .join("");
        currentGroup = {
          id: block.id,
          title: textContent || "Section",
          items: [],
        };
      }
      // 페이지 체크
      else if (block.type === "child_page") {
        const pageId = block.id.replace(/-/g, "");
        const pageUrl = `https://www.notion.so/${pageId}`;
        const item: GuideItem = {
          id: block.id,
          title: block.child_page.title,
          url: pageUrl,
          icon: null,
        };

        if (currentGroup) currentGroup.items.push(item);
        else defaultGroup.items.push(item);
      }
    }

    if (currentGroup && currentGroup.items.length > 0)
      groups.push(currentGroup);
    if (defaultGroup.items.length > 0) groups.unshift(defaultGroup);

    // 아이콘 채우기
    await Promise.all(
      groups.map(async (group) => {
        await Promise.all(
          group.items.map(async (item) => {
            const details = await fetchPageDetails(item.id);
            if (details) {
              let icon = details.icon?.emoji || null;
              if (!icon && details.icon?.type === "external")
                icon = details.icon.external.url;
              if (!icon && details.icon?.type === "file")
                icon = details.icon.file.url;
              item.icon = icon;
            }
          })
        );
      })
    );

    return groups;
  } catch (e) {
    console.error(e);
    return [];
  }
}

// ---------------------------------------------------------
// 4. [새로 추가] 위 함수를 감싸서 캐싱하는 껍데기
//    이제 페이지는 이 함수를 부릅니다.
// ---------------------------------------------------------
const getCachedGuideData = unstable_cache(
  async () => fetchGuideDataRaw(), // 실행할 진짜 함수
  ["pm-guide-data-v1"], // 캐시 키 (버전 올리면 캐시 초기화됨)
  { revalidate: 86400 } // 24시간 동안 저장
);

// ---------------------------------------------------------
// 5. 페이지 컴포넌트
// ---------------------------------------------------------
export default async function GuidePage() {
  // [변경] getGuideData() -> getCachedGuideData() 호출
  const groups = await getCachedGuideData();

  return <GuideClient groups={groups} />;
}
