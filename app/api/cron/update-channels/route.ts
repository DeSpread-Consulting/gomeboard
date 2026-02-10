import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function GET(request: Request) {
  // 1. 보안 체크 (storyteller cron 패턴)
  const authHeader = request.headers.get("authorization");
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    return NextResponse.json(
      { error: "TELEGRAM_BOT_TOKEN not configured" },
      { status: 500 },
    );
  }

  // 2. Supabase 클라이언트 (서버 전용, 쿠키 불필요)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  // 3. 모든 채널 조회
  const { data: channels, error: fetchError } = await supabase
    .from("kol_channels")
    .select("id, username, channel_name, subscriber");

  if (fetchError || !channels) {
    return NextResponse.json(
      { error: "Failed to fetch channels", detail: fetchError?.message },
      { status: 500 },
    );
  }

  const results: { id: number; username: string; status: string; updates?: Record<string, string> }[] = [];

  // 4. 채널별 개별 처리 (실패해도 나머지 계속)
  for (const ch of channels) {
    if (!ch.username) {
      results.push({ id: ch.id, username: "", status: "skipped_no_username" });
      continue;
    }

    try {
      const chatId = `@${ch.username}`;

      // getChat → channel_name 업데이트 (chat.title)
      const chatRes = await fetch(
        `https://api.telegram.org/bot${botToken}/getChat?chat_id=${encodeURIComponent(chatId)}`,
      );
      const chatData = await chatRes.json();

      if (!chatData.ok) {
        results.push({ id: ch.id, username: ch.username, status: `getChat_failed: ${chatData.description}` });
        await delay(100);
        continue;
      }

      // getChatMemberCount → subscriber 업데이트
      const countRes = await fetch(
        `https://api.telegram.org/bot${botToken}/getChatMemberCount?chat_id=${encodeURIComponent(chatId)}`,
      );
      const countData = await countRes.json();

      const updates: Record<string, string> = {};
      const newTitle = chatData.result.title;
      const newCount = countData.ok ? String(countData.result) : null;

      if (newTitle && newTitle !== ch.channel_name) {
        updates.channel_name = newTitle;
      }
      if (newCount && newCount !== ch.subscriber) {
        updates.subscriber = newCount;
      }

      if (Object.keys(updates).length > 0) {
        const { error: updateError } = await supabase
          .from("kol_channels")
          .update(updates)
          .eq("id", ch.id);

        if (updateError) {
          results.push({ id: ch.id, username: ch.username, status: `db_error: ${updateError.message}` });
        } else {
          results.push({ id: ch.id, username: ch.username, status: "updated", updates });
        }
      } else {
        results.push({ id: ch.id, username: ch.username, status: "no_changes" });
      }
    } catch (e: any) {
      results.push({ id: ch.id, username: ch.username, status: `error: ${e.message}` });
    }

    // Rate limit: 100ms 딜레이 (Telegram 30req/s 제한 대응)
    await delay(100);
  }

  const updated = results.filter((r) => r.status === "updated").length;
  const failed = results.filter((r) => r.status.startsWith("error") || r.status.startsWith("getChat_failed") || r.status.startsWith("db_error")).length;

  return NextResponse.json({
    success: true,
    total: channels.length,
    updated,
    failed,
    results,
  });
}
