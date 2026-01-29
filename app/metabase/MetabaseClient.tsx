/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useMemo } from "react";

// 블록 타입 정의
type Block = any;

interface MetabaseClientProps {
  blocks: Block[];
}

export default function MetabaseClient({ blocks }: MetabaseClientProps) {
  return (
    <div className="flex-1 w-full bg-[#F3F4F6] text-[#1D1D1F] font-sans">
      <main className="max-w-7xl mx-auto px-6 py-10">
        <div className="mb-12">
          <h1 className="text-4xl font-black text-gray-900 tracking-tight mb-1">
            Metabase
          </h1>
          <p className="text-gray-500 text-sm font-medium">
            데이터 시각화 차트 및 관련 가이드
          </p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-8 md:p-12 shadow-glass">
          <BlockListRenderer blocks={blocks} level={0} />

          {blocks.length === 0 && (
            <p className="text-gray-400 text-center py-10">
              표시할 콘텐츠가 없습니다.
            </p>
          )}
        </div>
      </main>
    </div>
  );
}

// ----------------------------------------------------------------------
// 내부 컴포넌트 및 로직
// ----------------------------------------------------------------------

// 블록 리스트를 그룹화하여 렌더링하는 컴포넌트
function BlockListRenderer({
  blocks,
  level,
}: {
  blocks: Block[];
  level: number;
}) {
  // 연속된 리스트 아이템을 그룹화 (ol, ul 태그로 감싸기 위함)
  const groupedBlocks = useMemo(() => {
    const result: Block[] = [];
    let currentListType: string | null = null;
    let currentListGroup: Block[] = [];

    blocks.forEach((block) => {
      const type = block.type;

      // 리스트 아이템인 경우 (numbered 또는 bulleted)
      if (type === "numbered_list_item" || type === "bulleted_list_item") {
        if (currentListType === type) {
          // 이미 같은 종류의 리스트가 진행 중이면 그룹에 추가
          currentListGroup.push(block);
        } else {
          // 다른 종류의 리스트가 시작되거나 리스트가 없던 경우
          if (currentListGroup.length > 0) {
            // 이전 그룹 저장
            result.push({
              type: "list_group",
              listType: currentListType,
              items: currentListGroup,
            });
          }
          // 새 그룹 시작
          currentListType = type;
          currentListGroup = [block];
        }
      } else {
        // 리스트가 아닌 블록을 만남 -> 이전 리스트 그룹이 있다면 저장
        if (currentListGroup.length > 0) {
          result.push({
            type: "list_group",
            listType: currentListType,
            items: currentListGroup,
          });
          currentListGroup = [];
          currentListType = null;
        }
        // 현재 블록 그대로 추가
        result.push(block);
      }
    });

    // 루프 종료 후 남은 그룹 저장
    if (currentListGroup.length > 0) {
      result.push({
        type: "list_group",
        listType: currentListType,
        items: currentListGroup,
      });
    }

    return result;
  }, [blocks]);

  return (
    <div className="space-y-4">
      {groupedBlocks.map((node, idx) => {
        if (node.type === "list_group") {
          const Tag = node.listType === "numbered_list_item" ? "ol" : "ul";
          const listClass =
            node.listType === "numbered_list_item"
              ? "list-decimal list-outside pl-5 space-y-1"
              : "list-disc list-outside pl-5 space-y-1";

          return (
            <Tag key={`group-${idx}`} className={listClass}>
              {node.items.map((item: Block) => (
                <BlockRenderer key={item.id} block={item} level={level} />
              ))}
            </Tag>
          );
        }
        return <BlockRenderer key={node.id} block={node} level={level} />;
      })}
    </div>
  );
}

// 개별 블록 렌더러
function BlockRenderer({ block, level = 0 }: { block: Block; level?: number }) {
  const { type } = block;
  const value = block[type];

  if (!value) return null;

  // 메타베이스 링크 감지
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
        className="block my-4 group no-underline"
        contentEditable={false} // 드래그 등 방지
      >
        <div className="flex items-center gap-4 p-4 rounded-xl border border-gray-200 bg-gray-50 hover:bg-white hover:border-blue-500 transition-all shadow-sm hover:shadow-md">
          <div className="w-10 h-10 flex items-center justify-center bg-blue-100 text-blue-600 rounded-lg shrink-0">
            {/* 아이콘: 차트 모양 */}
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

  // 자식 블록 렌더링 (재귀 대신 BlockListRenderer 사용 -> 중첩 리스트도 그룹화 적용)
  const renderChildren = () => {
    if (!block.children || block.children.length === 0) return null;
    return (
      <div className="mt-2 ml-1">
        <BlockListRenderer blocks={block.children} level={level + 1} />
      </div>
    );
  };

  // 텍스트 필터링: 메타베이스 URL이 카드 형태로 표시된다면, 텍스트에서는 숨김
  const richTextData = metabaseUrl
    ? value.rich_text.filter(
        (t: any) => t.href !== metabaseUrl && t.plain_text !== metabaseUrl
      )
    : value.rich_text;

  switch (type) {
    case "paragraph":
      return (
        <div className="mb-2">
          {/* 텍스트가 남아있을 때만 렌더링 */}
          {richTextData && richTextData.length > 0 && (
            <p className="text-gray-700 leading-7 text-[15px]">
              <RichText text={richTextData} />
            </p>
          )}
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
    case "numbered_list_item":
      // BlockListRenderer에서 이미 ul/ol로 감쌌으므로 li만 반환
      return (
        <li className="text-gray-700 leading-7 text-[15px] pl-1">
          {/* 내용 */}
          <span>
            <RichText text={richTextData} />
          </span>
          {renderMetabaseEmbed()}
          {renderChildren()}
        </li>
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
    case "callout":
      return (
        <div className="my-4">
          <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 flex gap-3">
            <div className="text-xl">{value.icon?.emoji || "💡"}</div>
            <div className="text-gray-700 text-[15px] leading-relaxed">
              <RichText text={richTextData} />
            </div>
          </div>
          {renderMetabaseEmbed()}
          {renderChildren()}
        </div>
      );
    case "divider":
      return <hr className="border-gray-100 my-8" />;
    case "embed":
      return (
        <div className="my-8">
          <div className="w-full aspect-[16/9] rounded-xl overflow-hidden border border-gray-200 shadow-sm bg-gray-50">
            <iframe src={value.url} className="w-full h-full" title="embed" />
          </div>
          {renderChildren()}
        </div>
      );
    default:
      return null;
  }
}

// 리치 텍스트 렌더러
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
