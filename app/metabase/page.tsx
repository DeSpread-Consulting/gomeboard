/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import { unstable_cache } from "next/cache";

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
      <div className="min-h-screen bg-[#F5F5F7] flex flex-col items-center justify-center p-10">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200 text-center">
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

  return (
    <div className="min-h-screen bg-[#F5F5F7] text-[#1D1D1F] font-sans">
      <main className="max-w-[1000px] mx-auto px-6 py-10">
        <div className="mb-10">
          <h1 className="text-3xl font-bold tracking-tight mb-3 text-gray-900">
            Metabase
          </h1>
          <p className="text-gray-500 text-base">
            데이터 시각화 차트 및 관련 가이드를 확인하세요.
          </p>
        </div>

        <div className="bg-white rounded-3xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-gray-100 p-8 md:p-12">
          <div className="space-y-6 [counter-reset:list-counter]">
            {blocks.length > 0 ? (
              blocks.map((block: any) => (
                <BlockRenderer key={block.id} block={block} level={0} />
              ))
            ) : (
              <p className="text-gray-400 text-center py-10">
                표시할 콘텐츠가 없습니다. 노션 페이지를 확인해주세요.
              </p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

// 노션 블록 렌더러
function BlockRenderer({
  block,
  level = 0,
}: {
  block: any & { isFirstOfList?: boolean };
  level?: number;
}) {
  const { type } = block;
  const value = block[type];

  if (!value) return null;

  // 메타베이스 링크 감지 및 임베딩
  const metabaseUrl = value.rich_text?.find((t: any) =>
    t.href?.includes("metabase.despreadlabs.io/question")
  )?.href;

  const renderMetabaseEmbed = () => {
    if (!metabaseUrl) return null;
    return (
      <a
        href={metabaseUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="block my-4 group"
      >
        <div className="flex items-center gap-4 p-4 rounded-xl border border-gray-200 bg-gray-50 hover:bg-white hover:border-blue-500 transition-all shadow-sm hover:shadow-md">
          <div className="w-10 h-10 flex items-center justify-center bg-blue-100 text-blue-600 rounded-lg shrink-0">
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-bold text-gray-900 truncate group-hover:text-blue-600 transition-colors">
              Metabase 데이터 시각화 보기
            </h4>
          </div>
          <div className="text-gray-400 group-hover:text-blue-500 transition-colors">
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
              />
            </svg>
          </div>
        </div>
      </a>
    );
  };

  // 자식 블록 렌더링 (재귀)
  const renderChildren = () => {
    if (!block.children || block.children.length === 0) return null;
    return (
      <div className="pl-6 mt-2 space-y-2 border-l border-gray-100 ml-1 [counter-reset:list-counter]">
        {block.children.map((child: any) => (
          <BlockRenderer key={child.id} block={child} level={level + 1} />
        ))}
      </div>
    );
  };

  switch (type) {
    case "paragraph":
      return (
        <div className="mb-2">
          <p className="text-gray-700 leading-7 text-[15px]">
            <RichText text={value.rich_text} />
          </p>
          {renderMetabaseEmbed()}
          {renderChildren()}
        </div>
      );
    case "heading_1":
      return (
        <div className="mt-10 mb-4">
          <h1 className="text-2xl font-bold text-gray-900 pb-2 border-b border-gray-100">
            <RichText text={value.rich_text} />
          </h1>
          {renderChildren()}
        </div>
      );
    case "heading_2":
      return (
        <div className="mt-8 mb-3">
          <h2 className="text-xl font-bold text-gray-900">
            <RichText text={value.rich_text} />
          </h2>
          {renderChildren()}
        </div>
      );
    case "heading_3":
      return (
        <div className="mt-6 mb-2">
          <h3 className="text-lg font-bold text-gray-900">
            <RichText text={value.rich_text} />
          </h3>
          {renderChildren()}
        </div>
      );
    case "bulleted_list_item":
      return (
        <div className="mb-1">
          <div className="flex gap-3 text-gray-700 pl-1">
            <span className="text-gray-400 select-none">•</span>
            <p className="leading-7 text-[15px]">
              <RichText text={value.rich_text} />
            </p>
          </div>
          {renderMetabaseEmbed()}
          {renderChildren()}
        </div>
      );
    case "numbered_list_item":
      const isFirstOfList = block.isFirstOfList && level === 0;
      return (
        <div
          className={`mb-1 [counter-increment:list-counter] ${
            isFirstOfList ? "first:mt-0 mt-4" : ""
          }`}
        >
          <div className="flex gap-3 text-gray-700 pl-1">
            <span
              className={`text-gray-400 select-none font-medium text-sm pt-1 ${
                level % 2 === 0
                  ? "before:content-[counter(list-counter,decimal)_'.']"
                  : "before:content-[counter(list-counter,lower-alpha)_'.']"
              }`}
            ></span>
            <p className="leading-7 text-[15px]">
              <RichText text={value.rich_text} />
            </p>
          </div>
          {renderMetabaseEmbed()}
          {renderChildren()}
        </div>
      );
    case "image":
      const imgUrl =
        value.type === "external" ? value.external.url : value.file?.url;
      const caption = value.caption?.[0]?.plain_text;
      return (
        <figure className="my-6 mb-8">
          <div className="rounded-xl overflow-hidden border border-gray-100 shadow-sm bg-gray-50">
            <img
              src={imgUrl}
              alt={caption || "Notion Image"}
              className="w-full h-auto object-contain max-h-[600px]"
              loading="lazy"
            />
          </div>
          {caption && (
            <figcaption className="text-center text-xs text-gray-400 mt-2">
              {caption}
            </figcaption>
          )}
          {renderChildren()}
        </figure>
      );
    case "embed":
      return (
        <div className="my-8">
          <div className="w-full aspect-[16/9] rounded-xl overflow-hidden border border-gray-200 shadow-sm bg-gray-50">
            <iframe
              src={value.url}
              className="w-full h-full"
              frameBorder="0"
              allowFullScreen
              title="Embedded Content"
            />
          </div>
          {renderChildren()}
        </div>
      );
    case "divider":
      return <hr className="border-gray-100 my-8" />;
    case "callout":
      return (
        <div className="my-4">
          <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 flex gap-3">
            <div className="text-xl">{value.icon?.emoji || "💡"}</div>
            <div className="text-gray-700 text-[15px] leading-relaxed">
              <RichText text={value.rich_text} />
            </div>
          </div>
          {renderMetabaseEmbed()}
          {renderChildren()}
        </div>
      );
    default:
      return null;
  }
}

// 리치 텍스트 렌더러 (볼드, 이탤릭, 링크 등 처리)
function RichText({ text }: { text: any[] }) {
  if (!text || text.length === 0) return null;
  return (
    <>
      {text.map((t: any, i: number) => {
        const { annotations } = t;
        let className = "";
        if (annotations.bold) className += " font-bold";
        if (annotations.italic) className += " italic";
        if (annotations.strikethrough) className += " line-through";
        if (annotations.underline) className += " underline";
        if (annotations.code)
          className +=
            " bg-gray-100 text-red-500 px-1 py-0.5 rounded text-sm font-mono";

        if (t.href) {
          return (
            <a
              key={i}
              href={t.href}
              target="_blank"
              rel="noopener noreferrer"
              className={`text-blue-600 hover:underline ${className}`}
            >
              {t.plain_text}
            </a>
          );
        }

        return (
          <span key={i} className={className}>
            {t.plain_text}
          </span>
        );
      })}
    </>
  );
}
