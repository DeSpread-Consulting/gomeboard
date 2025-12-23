// app/mypage/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import { usePrivy } from "@privy-io/react-auth";
import Link from "next/link";

export default function MyPage() {
  const {
    user,
    ready,
    authenticated,
    linkGoogle,
    unlinkGoogle,
    linkApple,
    unlinkApple,
    linkDiscord,
    unlinkDiscord,
    linkTelegram,
    unlinkTelegram,
    linkTwitter,
    unlinkTwitter,
    linkWallet,
    unlinkWallet,
    linkEmail,
    unlinkEmail,
  } = usePrivy();

  // [State] 채널 검증 및 관리 상태
  const [channelInput, setChannelInput] = useState("");
  const [myChannel, setMyChannel] = useState<{
    handle: string;
    url: string;
    role?: string;
  } | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  // [Effect] 로컬 스토리지에서 저장된 채널 정보 불러오기
  useEffect(() => {
    const saved = localStorage.getItem("my_telegram_channel");
    if (saved) {
      setMyChannel(JSON.parse(saved));
    }
  }, []);

  // [Handler] 채널 소유권 검증 요청
  const handleVerifyChannel = async () => {
    if (!channelInput || !user?.telegram?.telegramUserId) return;

    setIsVerifying(true);

    try {
      const response = await fetch("/api/verify-channel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channelId: channelInput,
          userId: user.telegram.telegramUserId, // Privy가 제공하는 유저의 텔레그램 숫자 ID
        }),
      });

      const data = await response.json();

      if (data.success) {
        // 성공 시 데이터 정제 및 저장
        const handle = channelInput
          .replace("@", "")
          .replace("t.me/", "")
          .replace("https://", "");

        const channelData = {
          handle: handle,
          url: `https://t.me/${handle}`,
          role: data.role, // 'creator' 또는 'administrator'
        };

        setMyChannel(channelData);
        localStorage.setItem(
          "my_telegram_channel",
          JSON.stringify(channelData)
        );
        setChannelInput("");
        alert("✅ 채널 소유권이 확인되었습니다!");
      } else {
        // 실패 시 에러 메시지
        alert(`❌ 검증 실패: ${data.message || "알 수 없는 오류"}`);
      }
    } catch (e) {
      console.error(e);
      alert("서버 통신 중 오류가 발생했습니다.");
    } finally {
      setIsVerifying(false);
    }
  };

  // [Handler] 채널 삭제
  const handleDeleteChannel = () => {
    if (confirm("등록된 채널 정보를 삭제하시겠습니까?")) {
      setMyChannel(null);
      localStorage.removeItem("my_telegram_channel");
    }
  };

  if (!ready || !authenticated || !user) {
    return null; // 또는 로딩 스피너
  }

  // 텔레그램 연동 여부 확인
  const isTelegramLinked = !!user.telegram;

  // 프로필 정보 우선순위: 텔레그램 > 트위터 > 구글 > 지갑/이메일
  const profileImage =
    user.telegram?.photoUrl || user.twitter?.profilePictureUrl || null;

  const displayName =
    user.telegram?.username ||
    user.twitter?.username ||
    user.google?.name ||
    user.email?.address ||
    user.wallet?.address.slice(0, 6);

  return (
    <div className="min-h-screen bg-[#F5F5F7] font-sans">
      <main className="max-w-2xl mx-auto px-6 py-12">
        {/* 헤더 영역 */}
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">My Account</h1>
          <p className="text-gray-500">계정 설정 및 연결 관리</p>
        </div>

        {/* 1. [중요] 텔레그램 미연동 시 경고 메시지 */}
        {!isTelegramLinked && (
          <div className="mb-8 bg-orange-50 border border-orange-100 rounded-2xl p-6 flex flex-col sm:flex-row items-center gap-5 shadow-sm animate-in fade-in slide-in-from-bottom-2">
            <div className="w-12 h-12 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center shrink-0 text-2xl">
              📢
            </div>
            <div className="flex-1 text-center sm:text-left">
              <h3 className="font-bold text-orange-800 text-lg mb-1">
                텔레그램 연동이 필요합니다
              </h3>
              <p className="text-sm text-orange-700 mb-3">
                스토리텔러 등 핵심 서비스에 참여하려면 텔레그램 계정을
                연결해주세요.
                <br className="hidden sm:block" />
                프로필 사진과 닉네임도 텔레그램 정보를 사용합니다.
              </p>

              {/* [수정] onLink -> onClick 으로 변경하여 HTML 표준 준수 */}
              <button
                onClick={() => linkTelegram()}
                className="bg-orange-600 hover:bg-orange-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-md active:scale-95"
              >
                지금 텔레그램 연결하기 →
              </button>
            </div>
          </div>
        )}

        {/* 2. 프로필 카드 */}
        <div className="bg-white rounded-[32px] p-8 shadow-sm border border-gray-100 mb-8 flex flex-col items-center">
          <div className="relative mb-4 group">
            <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-white shadow-lg bg-gray-100">
              {profileImage ? (
                <img
                  src={profileImage}
                  alt="Profile"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-300 text-4xl font-bold bg-gray-50">
                  {displayName?.slice(0, 1).toUpperCase()}
                </div>
              )}
            </div>
            {/* 텔레그램 인증 뱃지 */}
            {isTelegramLinked && (
              <div
                className="absolute bottom-0 right-0 bg-[#2AABEE] text-white p-1.5 rounded-full border-2 border-white shadow-sm"
                title="Telegram Verified"
              >
                <svg
                  className="w-4 h-4"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 11.944 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                </svg>
              </div>
            )}
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-1">
            {displayName}
          </h2>
          <p className="text-gray-400 text-sm font-medium">
            {user.telegram ? "Verified User" : "Guest User"}
          </p>
        </div>

        {/* 3. [NEW] 내 채널 검증 및 설정 섹션 */}
        {isTelegramLinked && (
          <div className="bg-white rounded-[32px] overflow-hidden shadow-sm border border-gray-100 mb-8 animate-in fade-in slide-in-from-bottom-4">
            <div className="px-8 py-6 border-b border-gray-50 bg-[#F4F9FD]">
              <h3 className="font-bold text-[#2AABEE] flex items-center gap-2">
                📢 My Channel Verification
              </h3>
            </div>
            <div className="p-8">
              {!myChannel ? (
                <div className="flex flex-col gap-4">
                  {/* 안내 문구 */}
                  <div className="bg-blue-50 text-blue-800 text-xs p-4 rounded-xl leading-relaxed">
                    <strong>[인증 방법]</strong>
                    <br />
                    1. 텔레그램에서 <strong>@BGT_gomebot</strong>을 본인 채널의{" "}
                    <strong>관리자(Admin)</strong>로 추가해주세요.
                    <br />
                    2. 아래에 채널 ID를 입력하고 &apos;소유권 확인&apos; 버튼을
                    눌러주세요.
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3">
                    <input
                      type="text"
                      placeholder="@channel_id 입력"
                      value={channelInput}
                      onChange={(e) => setChannelInput(e.target.value)}
                      className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2AABEE]/20 focus:border-[#2AABEE] transition-all"
                    />
                    <button
                      onClick={handleVerifyChannel}
                      disabled={!channelInput || isVerifying}
                      className="bg-[#2AABEE] hover:bg-[#229ED9] disabled:bg-gray-200 disabled:text-gray-400 text-white font-bold px-6 py-3 rounded-xl text-sm transition-all flex items-center gap-2 whitespace-nowrap justify-center"
                    >
                      {isVerifying ? "확인 중..." : "소유권 확인"}
                    </button>
                  </div>
                </div>
              ) : (
                // 인증 완료된 상태 카드
                <div className="flex items-center justify-between bg-white border border-gray-100 rounded-2xl p-4 shadow-sm group hover:border-[#2AABEE]/30 transition-all">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#2AABEE] to-[#229ED9] flex items-center justify-center text-white text-xl font-bold">
                      {myChannel.handle.slice(0, 1).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900 flex items-center gap-2">
                        @{myChannel.handle}
                        <span className="bg-green-100 text-green-700 text-[10px] px-1.5 py-0.5 rounded border border-green-200">
                          {myChannel.role === "creator" ? "OWNER" : "ADMIN"}
                        </span>
                      </h4>
                      <a
                        href={myChannel.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-gray-500 hover:text-[#2AABEE] hover:underline"
                      >
                        {myChannel.url}
                      </a>
                    </div>
                  </div>
                  <button
                    onClick={handleDeleteChannel}
                    className="text-gray-400 hover:text-red-500 p-2 rounded-lg hover:bg-red-50 transition-colors"
                    title="삭제"
                  >
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
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 4. 계정 연동 리스트 */}
        <div className="bg-white rounded-[32px] overflow-hidden shadow-sm border border-gray-100">
          <div className="px-8 py-6 border-b border-gray-50 bg-gray-50/50">
            <h3 className="font-bold text-gray-900">Linked Accounts</h3>
          </div>
          <div className="divide-y divide-gray-100">
            {/* Telegram */}
            <AccountRow
              icon="✈️"
              name="Telegram"
              isConnected={!!user.telegram}
              identifier={
                user.telegram?.username
                  ? `@${user.telegram.username}`
                  : user.telegram?.telegramUserId
              }
              onLink={() => linkTelegram()} // [수정] 화살표 함수로 감싸기
              onUnlink={() => unlinkTelegram(user.telegram!.telegramUserId)}
              isPrimary={true}
            />

            {/* Google */}
            <AccountRow
              icon="G"
              name="Google"
              isConnected={!!user.google}
              identifier={user.google?.email}
              onLink={() => linkGoogle()} // [수정] 화살표 함수로 감싸기
              onUnlink={() => unlinkGoogle(user.google!.subject)}
            />

            {/* Apple */}
            <AccountRow
              icon="🍎"
              name="Apple"
              isConnected={!!user.apple}
              identifier={user.apple?.email}
              onLink={() => linkApple()}
              onUnlink={() => unlinkApple(user.apple!.subject)}
            />

            {/* Twitter */}
            <AccountRow
              icon="𝕏"
              name="Twitter"
              isConnected={!!user.twitter}
              identifier={
                user.twitter?.username ? `@${user.twitter.username}` : undefined
              }
              onLink={() => linkTwitter()}
              onUnlink={() => unlinkTwitter(user.twitter!.subject)}
            />

            {/* Discord */}
            <AccountRow
              icon="👾"
              name="Discord"
              isConnected={!!user.discord}
              identifier={user.discord?.username}
              onLink={() => linkDiscord()}
              onUnlink={() => unlinkDiscord(user.discord!.subject)}
            />

            {/* Email */}
            <AccountRow
              icon="✉️"
              name="Email"
              isConnected={!!user.email}
              identifier={user.email?.address}
              onLink={() => linkEmail()}
              onUnlink={() => unlinkEmail(user.email!.address)}
            />

            {/* Wallet */}
            <AccountRow
              icon="🦊"
              name="Wallet"
              isConnected={!!user.wallet}
              identifier={
                user.wallet?.address
                  ? `${user.wallet.address.slice(
                      0,
                      6
                    )}...${user.wallet.address.slice(-4)}`
                  : undefined
              }
              onLink={() => linkWallet()}
              onUnlink={() => unlinkWallet(user.wallet!.address)}
            />
          </div>
        </div>

        <div className="mt-8 text-center">
          <Link
            href="/"
            className="text-gray-400 text-sm hover:text-gray-600 hover:underline transition-all"
          >
            ← 메인으로 돌아가기
          </Link>
        </div>
      </main>
    </div>
  );
}

// 5. AccountRow 컴포넌트 (타입 정의 수정 및 onClick 적용)
interface AccountRowProps {
  icon: React.ReactNode | string;
  name: string;
  isConnected: boolean;
  identifier?: string | null;
  onLink: () => void; // 인자 없는 함수 타입
  onUnlink: () => void;
  isPrimary?: boolean;
}

function AccountRow({
  icon,
  name,
  isConnected,
  identifier,
  onLink,
  onUnlink,
  isPrimary = false,
}: AccountRowProps) {
  return (
    <div className="flex items-center justify-between p-6 hover:bg-gray-50/50 transition-colors">
      <div className="flex items-center gap-4">
        <div
          className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl shadow-sm ${
            isConnected
              ? "bg-white border border-gray-100"
              : "bg-gray-100 text-gray-400 grayscale"
          }`}
        >
          {icon === "G" ? (
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27 3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10 5.35 0 9.25-3.67 9.25-9.09 0-1.15-.15-1.81-.15-1.81z"
              />
            </svg>
          ) : (
            icon
          )}
        </div>
        <div>
          <h4 className="font-bold text-gray-900 text-sm flex items-center gap-2">
            {name}
            {isPrimary && isConnected && (
              <span className="bg-blue-100 text-blue-600 text-[10px] px-1.5 py-0.5 rounded font-extrabold">
                MAIN
              </span>
            )}
          </h4>
          <p className="text-xs text-gray-500 font-medium">
            {isConnected ? identifier || "Connected" : "Not linked"}
          </p>
        </div>
      </div>

      <button
        // [중요] 여기를 onLink={...} 가 아니라 onClick={...} 으로 수정했습니다.
        onClick={isConnected ? onUnlink : onLink}
        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
          isConnected
            ? "border-gray-200 text-gray-400 hover:text-red-600 hover:border-red-200 hover:bg-red-50"
            : "border-black bg-black text-white hover:bg-gray-800 hover:scale-105 shadow-sm"
        }`}
      >
        {isConnected ? "Unlink" : "Connect"}
      </button>
    </div>
  );
}
