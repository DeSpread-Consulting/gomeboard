import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function POST(request: Request) {
  try {
    const { channelId, userId } = await request.json();

    if (!channelId || !userId) {
      return NextResponse.json(
        { error: "Missing parameters" },
        { status: 400 },
      );
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 },
      );
    }

    // 1. 입력값 정제
    let cleanId = channelId.trim();
    if (cleanId.includes("t.me/")) {
      cleanId = cleanId.split("t.me/")[1].split("/")[0];
    }
    cleanId = cleanId.replace("@", "");
    const chatId = `@${cleanId}`;

    // 2. [API 1] 채널 기본 정보 가져오기 (getChat)
    const chatRes = await fetch(
      `https://api.telegram.org/bot${botToken}/getChat?chat_id=${chatId}`,
    );
    const chatData = await chatRes.json();

    if (!chatData.ok) {
      return NextResponse.json(
        {
          success: false,
          message: "채널을 찾을 수 없습니다. 봇이 추가되었는지 확인해주세요.",
        },
        { status: 400 },
      );
    }

    // 3. [API 2] 관리자 권한 검증 (getChatMember)
    const memberRes = await fetch(
      `https://api.telegram.org/bot${botToken}/getChatMember?chat_id=${chatId}&user_id=${userId}`,
    );
    const memberData = await memberRes.json();

    if (
      !memberData.ok ||
      !["creator", "administrator"].includes(memberData.result.status)
    ) {
      // creator만 허용할지 administrator도 허용할지 정책에 따라 수정 (보통 creator 권장)
      if (memberData.result.status !== "creator") {
        return NextResponse.json(
          {
            success: false,
            message: "소유주(Creator) 권한이 확인되지 않았습니다.",
          },
          { status: 403 },
        );
      }
    }

    // 4. [API 3] 구독자 수 가져오기 (getChatMemberCount) <- DB에 값이 있다면 해당 값 참조 없다면 사용하지 않음
    const countRes = await fetch(
      `https://api.telegram.org/bot${botToken}/getChatMemberCount?chat_id=${chatId}`,
    );
    const countData = await countRes.json();
    const subscriberCount = countData.ok ? countData.result : 0;

    // 5. [API 4] 프로필 사진 가져오기 (있다면) <- DB에 값이 있다면 해당 값 참조 없다면 사용하지 않음
    let photoUrl = null;
    if (chatData.result.photo?.big_file_id) {
      const fileRes = await fetch(
        `https://api.telegram.org/bot${botToken}/getFile?file_id=${chatData.result.photo.big_file_id}`,
      );
      const fileData = await fileRes.json();
      if (fileData.ok) {
        photoUrl = `https://api.telegram.org/file/bot${botToken}/${fileData.result.file_path}`;
      }
    }

    // 6. Supabase에 채널 정보 저장
    const supabase = await createClient();
    const { error: dbError } = await supabase.from("channels").upsert(
      {
        channel_id: cleanId,
        channel_title: chatData.result.title,
        owner_telegram_id: userId.toString(),
        owner_username: chatData.result.username || null,
        subscribers_count: subscriberCount,
        photo_url: photoUrl,
        verified_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "channel_id",
      },
    );

    if (dbError) {
      console.error("Database error:", dbError);
      // DB 저장 실패해도 검증은 성공으로 처리 (향후 정책에 따라 변경 가능)
    }

    // 7. 성공 결과 리턴
    return NextResponse.json({
      success: true,
      role: memberData.result.status,
      channel: {
        id: cleanId,
        title: chatData.result.title,
        subscribers: subscriberCount,
        photoUrl: photoUrl,
        url: `https://t.me/${cleanId}`,
      },
    });
  } catch (error) {
    console.error("Verification Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
