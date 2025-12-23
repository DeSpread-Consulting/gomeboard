// app/api/verify-channel/route.ts
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { channelId, userId } = await request.json();

    if (!channelId || !userId) {
      return NextResponse.json(
        { error: "Missing parameters" },
        { status: 400 }
      );
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    // 1. 채널 ID 형식 정리 (@ 붙이기)
    const chat_id = channelId.startsWith("@") ? channelId : `@${channelId}`;

    // 2. 텔레그램 API 호출: getChatMember
    // (이 봇이 들어가 있는 채널에서, 특정 유저(userId)의 정보를 가져옴)
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/getChatMember?chat_id=${chat_id}&user_id=${userId}`
    );

    const data = await response.json();

    // 3. 텔레그램 API 에러 처리 (봇이 채널에 없거나, 채널이 없거나)
    if (!data.ok) {
      // 봇이 채널에 없을 때 주로 발생
      return NextResponse.json(
        {
          success: false,
          message:
            "봇이 채널에 없습니다. 봇을 관리자로 추가했는지 확인해주세요.",
          detail: data.description,
        },
        { status: 400 }
      );
    }

    // 4. 유저 권한 확인
    const status = data.result.status; // 'creator', 'administrator', 'member', 'left' ...

    // 생성자(creator)이거나 관리자(administrator)인 경우만 인정
    if (status === "creator" || status === "administrator") {
      return NextResponse.json({
        success: true,
        role: status,
        channel: data.result.chat,
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          message: "채널의 관리자 권한이 확인되지 않았습니다.",
        },
        { status: 403 }
      );
    }
  } catch (error) {
    console.error("Verification Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
