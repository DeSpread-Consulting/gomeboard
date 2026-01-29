/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import { unstable_cache } from "next/cache";
import MetabaseClient from "./MetabaseClient"; // 클라이언트 컴포넌트 import

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const METABASE_PAGE_ID = process.env.NOTION_METABASE_PAGE_ID;

const headers = {
  Authorization: `Bearer ${NOTION_TOKEN}`,
  "Content-Type": "application/json",
  "Notion-Version": "2025-09-03",
};

// 노션 블록 데이터 가져오기
async function getNotionBlocks(blockId: string) {
  if (!NOTION_TOKEN || !blockId) return [];

  try {
    const res = await fetch(
      `https://api.notion.com/v1/blocks/${blockId}/children?page_size=100`,
      { headers, next: { revalidate: 0 } }
    );

    if (!res.ok) {
      console.error("Failed to fetch Notion blocks:", await res.text());
      return [];
    }

    const data = await res.json();
    const blocks = data.results || [];

    // 자식 블록이 있는 경우 재귀적으로 가져오기
    const blocksWithChildren = await Promise.all(
      blocks.map(async (block: any) => {
        if (block.has_children) {
          const children = await getNotionBlocks(block.id);
          return { ...block, children };
        }
        return block;
      })
    );

    return blocksWithChildren;
  } catch (e) {
    console.error("Error fetching Notion blocks:", e);
    return [];
  }
}

// 데이터 캐싱 (5분)
const getCachedMetabaseContent = unstable_cache(
  async () => getNotionBlocks(METABASE_PAGE_ID || ""),
  ["metabase-page-content"],
  { revalidate: 300 }
);

export default async function MetabasePage() {
  const blocks = await getCachedMetabaseContent();

  if (!METABASE_PAGE_ID) {
    return (
      <div className="min-h-screen bg-[#F3F4F6] flex flex-col items-center justify-center p-10">
        <div className="bg-white p-8 rounded-lg shadow-sm border border-gray-200 text-center">
          <h2 className="text-lg font-bold text-gray-900 mb-2">
            환경변수 설정 필요
          </h2>
          <p className="text-gray-500 text-sm">
            .env 파일에 <code>NOTION_METABASE_PAGE_ID</code>를 추가해주세요.
          </p>
        </div>
      </div>
    );
  }

  // 데이터를 Client Component로 전달
  return <MetabaseClient blocks={blocks} />;
}
