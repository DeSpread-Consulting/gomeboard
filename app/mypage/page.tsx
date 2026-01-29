/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState, useEffect } from "react";
import { usePrivy } from "@privy-io/react-auth";
import Link from "next/link";

// ----------------------------------------------------------------------
// [타입 정의]
// ----------------------------------------------------------------------
interface ChannelData {
  handle: string;
  title: string;
  subscribers?: number;
  photoUrl: string | null;
  url: string;
  role?: string;
}

interface LeaderboardItem {
  campaign: string;
  rank: number;
  score: number;
  change: number;
  handle: string;
}

export default function MyPage() {
  const {
    user,
    ready,
    authenticated,
    linkTelegram,
    unlinkTelegram,
    linkGoogle,
    unlinkGoogle,
    linkApple,
    unlinkApple,
    linkTwitter,
    unlinkTwitter,
    linkDiscord,
    unlinkDiscord,
    linkEmail,
    unlinkEmail,
    linkWallet,
    unlinkWallet,
  } = usePrivy();

  // [State]
  const [channelInput, setChannelInput] = useState("");
  const [myChannel, setMyChannel] = useState<ChannelData | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [myRanks, setMyRanks] = useState<LeaderboardItem[]>([]);
  const [isLoadingRank, setIsLoadingRank] = useState(false);

  // 1. 초기화 (저장된 채널 정보 로드)
  useEffect(() => {
    const saved = localStorage.getItem("my_telegram_channel");
    if (saved) {
      const parsed = JSON.parse(saved);
      setMyChannel(parsed);
      // 저장된 정보가 있으면 바로 랭킹 조회
      fetchMyRank(parsed.handle);
    }
  }, []);

  // 2. 랭킹 조회 함수
  const fetchMyRank = async (handle: string) => {
    setIsLoadingRank(true); // 로딩 시작
    try {
      const response = await fetch("/api/my-rank", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle }),
      });
      const data = await response.json();
      setMyRanks(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoadingRank(false); // 로딩 종료
    }
  };

  // [Logic] 입력값 정제 (링크 -> 핸들 변환)
  const cleanInput = (input: string) => {
    let clean = input.trim();
    // t.me/ 또는 telegram.me/ 링크 처리
    if (clean.includes("t.me/") || clean.includes("telegram.me/")) {
      const parts = clean.split("me/"); // t.me/abc -> abc
      if (parts.length > 1) {
        clean = parts[1].split("/")[0]; // abc/123 -> abc
        clean = clean.split("?")[0]; // abc?start=1 -> abc
      }
    }
    return clean
      .replace("@", "")
      .replace("https://", "")
      .replace("http://", "");
  };

  // 채널 인증 핸들러
  const handleVerifyChannel = async () => {
    if (!channelInput || !user?.telegram?.telegramUserId) return;

    const cleanId = cleanInput(channelInput); // 링크를 핸들로 변환

    setIsVerifying(true);
    try {
      const response = await fetch("/api/verify-channel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channelId: cleanId,
          userId: user.telegram.telegramUserId,
        }),
      });
      const data = await response.json();

      if (data.success) {
        const channelData: ChannelData = {
          handle: data.channel.id,
          title: data.channel.title,
          subscribers: data.channel.subscribers || 0,
          photoUrl: data.channel.photoUrl,
          url: data.channel.url,
          role: data.role,
        };
        setMyChannel(channelData);
        localStorage.setItem(
          "my_telegram_channel",
          JSON.stringify(channelData)
        );
        setChannelInput("");

        // 인증 성공 후 랭킹 즉시 조회 (로딩 표시됨)
        fetchMyRank(channelData.handle);
      } else {
        alert(`❌ 검증 실패: ${data.message || "오류가 발생했습니다."}`);
      }
    } catch (e) {
      alert("서버 오류가 발생했습니다.");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleDeleteChannel = () => {
    if (confirm("채널 연동을 해제하시겠습니까?")) {
      setMyChannel(null);
      setMyRanks([]);
      localStorage.removeItem("my_telegram_channel");
    }
  };

  if (!ready || !authenticated || !user) return null;

  const isTelegramLinked = !!user.telegram;
  const isChannelLinked = !!myChannel;

  // 배너 로직
  const getBannerContent = () => {
    if (!isTelegramLinked) {
      return {
        type: "warning",
        title: "텔레그램 계정 연동 필요",
        desc: "서비스 참여를 위해 텔레그램을 먼저 연결해주세요.",
      };
    }
    if (isTelegramLinked && !isChannelLinked) {
      return {
        type: "warning",
        title: "채널 소유권 인증 필요",
        desc: "리더보드 확인을 위해 운영 중인 채널을 인증해주세요.",
      };
    }
    return {
      type: "info",
      title: "연동 상태 유지 필수",
      desc: "캠페인 보상 지급을 위해 계정과 채널 연동 상태를 계속 유지해주세요.",
    };
  };

  const banner = getBannerContent();
  const profileImage =
    user.telegram?.photoUrl || user.twitter?.profilePictureUrl || null;
  const displayName =
    user.telegram?.username ||
    user.twitter?.username ||
    user.google?.name ||
    user.email?.address ||
    "User";

  return (
    <div className="min-h-screen bg-[#F3F4F6] text-[#1D1D1F] font-sans selection:bg-[#0037F0] selection:text-white">
      <main className="max-w-7xl mx-auto px-6 py-10">
        {/* 헤더 */}
        <div className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h1 className="text-4xl font-black text-gray-900 tracking-tight mb-1">
              My Page
            </h1>
            <p className="text-gray-500 text-sm font-medium">
              계정 및 활동 관리 대시보드
            </p>
          </div>
          <Link
            href="/"
            className="text-xs font-bold text-gray-400 hover:text-black transition-colors mb-1"
          >
            ← Back to Home
          </Link>
        </div>

        {/* 메인 그리드 */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* [왼쪽] 계정 정보 (lg:col-span-7) */}
          <div className="lg:col-span-7 space-y-6">
            {/* 프로필 & 채널 카드 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 프로필 카드 */}
              <div className="glass-card p-5 flex items-center gap-4 relative overflow-hidden h-[100px] transition-all glass-card-hover">
                <div className="relative shrink-0">
                  <img
                    src={profileImage || ""}
                    alt=""
                    className="w-14 h-14 rounded-full object-cover border border-gray-100 bg-gray-50"
                  />
                  {!profileImage && (
                    <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 font-bold border border-gray-200">
                      {displayName.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  {isTelegramLinked && (
                    <div className="absolute -bottom-1 -right-1 bg-[#2AABEE] text-white p-0.5 rounded-full border-2 border-white shadow-sm z-10">
                      <svg
                        className="w-3 h-3"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 11.944 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                      </svg>
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <h2 className="font-bold text-gray-900 text-lg leading-tight truncate">
                    {displayName}
                  </h2>
                  <p className="text-xs text-gray-400 mt-0.5 font-medium truncate">
                    {isTelegramLinked ? "Verified User" : "Guest"}
                  </p>
                </div>
              </div>

              {/* 채널 설정 카드 */}
              <div className="glass-card p-5 flex flex-col justify-center h-[100px] transition-all glass-card-hover">
                {!isTelegramLinked ? (
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-xl">
                      🔒
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-gray-900">
                        로그인 필요
                      </p>
                      <p className="text-[10px] text-gray-500">
                        채널 설정을 위해 연결하세요.
                      </p>
                    </div>
                    <button
                      onClick={() => linkTelegram()}
                      className="bg-black text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-gray-800 shrink-0 transition-colors"
                    >
                      Connect
                    </button>
                  </div>
                ) : !myChannel ? (
                  <div className="space-y-2">
                    <div className="flex gap-2 items-center">
                      <input
                        type="text"
                        placeholder="t.me/channel"
                        value={channelInput}
                        onChange={(e) => setChannelInput(e.target.value)}
                        className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs font-bold focus:border-[#0037F0] focus:bg-white outline-none transition-all"
                      />
                      <button
                        onClick={handleVerifyChannel}
                        disabled={!channelInput || isVerifying}
                        className="bg-[#0037F0] text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-blue-800 whitespace-nowrap transition-colors"
                      >
                        {isVerifying ? "..." : "인증"}
                      </button>
                    </div>
                    <p className="text-[10px] text-gray-400 pl-1">
                      * <strong>@gome_login_bot</strong> 관리자 추가 필수
                    </p>
                  </div>
                ) : (
                  // [수정] 채널 인증 완료 상태: 이미지 크기 및 정보 표시 개선
                  <div className="flex items-center justify-between w-full gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {/* [수정] 이미지 크기 w-14 h-14로 키워서 프로필과 통일, rounded-xl 유지 */}
                      <div className="w-14 h-14 rounded-xl bg-gray-50 shrink-0 overflow-hidden relative border border-gray-100">
                        {myChannel.photoUrl ? (
                          <img
                            src={myChannel.photoUrl}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[#0037F0] font-bold text-xl bg-blue-50">
                            {myChannel.title[0]}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <h4 className="font-bold text-sm text-gray-900 truncate max-w-[120px]">
                            {myChannel.title}
                          </h4>
                          <span className="text-[9px] bg-[#0037F0] text-white px-1.5 py-0.5 rounded font-bold uppercase">
                            OWNER
                          </span>
                        </div>
                        {/* [수정] 구독자 수 0명일 때도 표시되도록 조건 수정 */}
                        <p className="text-[10px] text-gray-400 truncate mt-0.5 font-medium">
                          @{myChannel.handle} ·{" "}
                          <span className="text-gray-600">
                            {typeof myChannel.subscribers === "number"
                              ? myChannel.subscribers.toLocaleString()
                              : 0}{" "}
                            subs
                          </span>
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={handleDeleteChannel}
                      className="text-gray-300 hover:text-red-500 hover:bg-red-50 p-2 rounded-lg transition-all shrink-0"
                    >
                      <svg
                        className="w-4 h-4"
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

            {/* 안내 배너 */}
            <div
              className={`border rounded-xl p-4 flex items-center gap-4 shadow-sm ${
                banner.type === "success" || banner.type === "info"
                  ? "bg-blue-50 border-blue-100"
                  : "bg-orange-50 border-orange-100"
              }`}
            >
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-base font-bold ${
                  banner.type === "success" || banner.type === "info"
                    ? "bg-white text-[#0037F0] border border-blue-100"
                    : "bg-white text-orange-500 border border-orange-100"
                }`}
              >
                {banner.type === "success" || banner.type === "info"
                  ? "i"
                  : "!"}
              </div>
              <div className="flex-1">
                <h3
                  className={`font-bold text-xs mb-0.5 ${
                    banner.type === "success" || banner.type === "info"
                      ? "text-[#0037F0]"
                      : "text-orange-700"
                  }`}
                >
                  {banner.title}
                </h3>
                <p
                  className={`text-[11px] font-medium ${
                    banner.type === "success" || banner.type === "info"
                      ? "text-blue-600"
                      : "text-orange-600"
                  }`}
                >
                  {banner.desc}
                </p>
              </div>
            </div>

            {/* 연결된 계정 리스트 */}
            <div className="bg-white rounded-lg overflow-hidden shadow-glass border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-200/50 bg-gray-50 flex justify-between items-center">
                <h3 className="font-bold text-gray-900 text-sm">
                  Linked Accounts
                </h3>
              </div>
              <div className="divide-y divide-gray-100">
                <AccountRow
                  icon="✈️"
                  name="Telegram"
                  isConnected={!!user.telegram}
                  identifier={user.telegram?.username}
                  onLink={linkTelegram}
                  onUnlink={() => unlinkTelegram(user.telegram!.telegramUserId)}
                  isPrimary={true}
                />
                <AccountRow
                  icon="G"
                  name="Google"
                  isConnected={!!user.google}
                  identifier={user.google?.email}
                  onLink={linkGoogle}
                  onUnlink={() => unlinkGoogle(user.google!.subject)}
                />
                <AccountRow
                  icon="🍎"
                  name="Apple"
                  isConnected={!!user.apple}
                  identifier={user.apple?.email}
                  onLink={linkApple}
                  onUnlink={() => unlinkApple(user.apple!.subject)}
                />
                <AccountRow
                  icon="𝕏"
                  name="Twitter"
                  isConnected={!!user.twitter}
                  identifier={user.twitter?.username}
                  onLink={linkTwitter}
                  onUnlink={() => unlinkTwitter(user.twitter!.subject)}
                />
                <AccountRow
                  icon="👾"
                  name="Discord"
                  isConnected={!!user.discord}
                  identifier={user.discord?.username}
                  onLink={linkDiscord}
                  onUnlink={() => unlinkDiscord(user.discord!.subject)}
                />
                <AccountRow
                  icon="✉️"
                  name="Email"
                  isConnected={!!user.email}
                  identifier={user.email?.address}
                  onLink={linkEmail}
                  onUnlink={() => unlinkEmail(user.email!.address)}
                />
                <AccountRow
                  icon="🦊"
                  name="Wallet"
                  isConnected={!!user.wallet}
                  identifier={
                    user.wallet?.address
                      ? `${user.wallet.address.slice(0, 6)}...`
                      : null
                  }
                  onLink={linkWallet}
                  onUnlink={() => unlinkWallet(user.wallet!.address)}
                />
              </div>
            </div>
          </div>

          {/* [오른쪽] 리더보드 (lg:col-span-5) */}
          <div className="lg:col-span-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                My Rankings
              </h2>
              {isChannelLinked && (
                <span className="bg-green-50 text-green-700 text-[10px] px-2 py-0.5 rounded border border-green-100 font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                  LIVE
                </span>
              )}
            </div>

            {!isChannelLinked ? (
              <div className="bg-white rounded-lg border border-dashed border-gray-200 p-8 text-center flex flex-col items-center justify-center h-64">
                <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center text-2xl mb-3 grayscale opacity-50 border border-gray-100">
                  🔒
                </div>
                <p className="text-sm font-bold text-gray-600">
                  Rankings Locked
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  채널 인증 후 확인 가능합니다.
                </p>
              </div>
            ) : isLoadingRank ? (
              <div className="grid grid-cols-2 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="h-[80px] bg-gray-50 rounded-lg animate-pulse border border-gray-200"
                  ></div>
                ))}
              </div>
            ) : myRanks.length > 0 ? (
              <div className="grid grid-cols-2 gap-4">
                {myRanks.map((item, idx) => (
                  <div
                    key={idx}
                    className="bg-white rounded-lg p-4 shadow-glass border border-gray-200 flex flex-col justify-between hover:bg-gray-50 hover:shadow-md hover:border-gray-200 transition-all group h-[90px]"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded bg-gray-50 border border-gray-100 flex items-center justify-center text-xs text-gray-400 font-bold group-hover:bg-blue-50 group-hover:text-[#0037F0] transition-colors">
                          {item.campaign.slice(0, 1).toUpperCase()}
                        </div>
                        <h4
                          className="font-bold text-gray-900 text-xs truncate max-w-[80px]"
                          title={item.campaign}
                        >
                          {item.campaign}
                        </h4>
                      </div>
                      <span className="text-lg font-black text-[#0037F0]">
                        #{item.rank}
                      </span>
                    </div>

                    <div className="flex items-center justify-between mt-auto">
                      <span className="text-[10px] text-gray-400 font-medium">
                        Rank Change
                      </span>
                      <span
                        className={`text-[10px] font-bold ${
                          item.change > 0
                            ? "text-red-500"
                            : item.change < 0
                            ? "text-blue-500"
                            : "text-gray-400"
                        }`}
                      >
                        {item.change !== 0
                          ? item.change > 0
                            ? `▲ ${item.change}`
                            : `▼ ${Math.abs(item.change)}`
                          : "-"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-lg border border-gray-200 p-8 text-center h-64 flex flex-col items-center justify-center">
                <div className="text-2xl mb-2">📉</div>
                <p className="text-sm font-bold text-gray-900">No Data</p>
                <p className="text-xs text-gray-500 mt-1">
                  30일 내 활동 기록이 없습니다.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

// ----------------------------------------------------------------------
// AccountRow (Compact Style)
// ----------------------------------------------------------------------
function AccountRow({
  icon,
  name,
  isConnected,
  identifier,
  onLink,
  onUnlink,
  isPrimary = false,
}: any) {
  return (
    <div className="flex items-center justify-between px-6 py-4 hover:bg-white transition-colors group">
      <div className="flex items-center gap-4">
        <div
          className={`w-9 h-9 rounded-lg flex items-center justify-center text-lg shadow-sm transition-colors ${
            isConnected
              ? "bg-white border border-gray-200 text-black"
              : "bg-gray-50 text-gray-300 grayscale"
          }`}
        >
          {icon === "G" ? (
            <svg className="w-4 h-4" viewBox="0 0 24 24">
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
          <h4 className="font-bold text-gray-900 text-sm flex items-center gap-1.5">
            {name}{" "}
            {isPrimary && isConnected && (
              <span className="bg-[#0037F0] text-white text-[9px] px-1.5 py-0.5 rounded font-bold leading-none">
                MAIN
              </span>
            )}
          </h4>
          <p className="text-[11px] text-gray-500 font-medium max-w-[180px] truncate mt-0.5">
            {isConnected ? identifier || "Connected" : "Not linked"}
          </p>
        </div>
      </div>
      <button
        onClick={isConnected ? onUnlink : onLink}
        className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all border ${
          isConnected
            ? "border-gray-200 text-gray-400 hover:text-red-600 hover:border-red-200 hover:bg-red-50 bg-white"
            : "border-transparent bg-black text-white hover:bg-gray-800 shadow-sm"
        }`}
      >
        {isConnected ? "Disconnect" : "Connect"}
      </button>
    </div>
  );
}
