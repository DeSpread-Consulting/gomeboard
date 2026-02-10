/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { useWallets as useSolanaWallets } from "@privy-io/react-auth/solana";
import Link from "next/link";
import {
  fetchEvmBalance,
  fetchEvmUsdtBalance,
  fetchSolBalance,
  fetchSolanaUsdtBalance,
} from "@/utils/balance";

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

  const { wallets: evmWallets } = useWallets();
  const { wallets: solanaWallets } = useSolanaWallets();

  // [State] - Wallet balances
  const [balances, setBalances] = useState({
    ethMainnet: "0",
    ethArbitrum: "0",
    sol: "0",
    usdtEth: "0",
    usdtArb: "0",
    usdtSol: "0",
  });
  const [balanceLoading, setBalanceLoading] = useState(false);

  // [State]
  const [channelInput, setChannelInput] = useState("");
  const [myChannel, setMyChannel] = useState<ChannelData | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [myRanks, setMyRanks] = useState<LeaderboardItem[]>([]);
  const [isLoadingRank, setIsLoadingRank] = useState(false);

  // 팝업 모달 상태
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [verifyStep, setVerifyStep] = useState<
    "guide" | "verify" | "success" | "error"
  >("guide");
  const [verifyError, setVerifyError] = useState("");

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

  // 채널 인증 버튼 클릭 (모달 열기)
  const handleOpenVerifyModal = () => {
    setShowVerifyModal(true);
    setVerifyStep("guide");
    setChannelInput("");
    setVerifyError("");
  };

  // 가이드 단계에서 다음 버튼 클릭
  const handleNextToVerify = () => {
    setVerifyStep("verify");
  };

  // 채널 인증 실행
  const handleVerifyChannel = async () => {
    if (!channelInput || !user?.telegram?.telegramUserId) return;

    const cleanId = cleanInput(channelInput);

    setIsVerifying(true);
    setVerifyError("");

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
          JSON.stringify(channelData),
        );

        // 성공 단계로 이동
        setVerifyStep("success");

        // 인증 성공 후 랭킹 즉시 조회
        fetchMyRank(channelData.handle);
      } else {
        // 에러 단계로 이동
        setVerifyError(data.message || "오류가 발생했습니다.");
        setVerifyStep("error");
      }
    } catch (e) {
      setVerifyError("서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
      setVerifyStep("error");
    } finally {
      setIsVerifying(false);
    }
  };

  // 모달 닫기
  const handleCloseModal = () => {
    setShowVerifyModal(false);
    setChannelInput("");
    setVerifyError("");
    setVerifyStep("guide");
  };

  const handleDeleteChannel = () => {
    if (confirm("채널 연동을 해제하시겠습니까?")) {
      setMyChannel(null);
      setMyRanks([]);
      localStorage.removeItem("my_telegram_channel");
    }
  };

  // --- Wallet address extraction ---
  const embeddedEvmWallet = user?.linkedAccounts?.find(
    (a: any) =>
      a.type === "wallet" &&
      a.chainType === "ethereum" &&
      (a.walletClientType === "privy" || a.walletClientType === "privy-v2")
  );
  const evmAddress =
    (embeddedEvmWallet as any)?.address || user?.wallet?.address || null;

  const embeddedSolWallet = user?.linkedAccounts?.find(
    (a: any) =>
      a.type === "wallet" &&
      a.chainType === "solana" &&
      (a.walletClientType === "privy" || a.walletClientType === "privy-v2")
  );
  // linkedAccounts에서 먼저 찾고, 없으면 Solana useWallets 훅에서 fallback
  const solWalletFromHook = solanaWallets.find(
    (w) => (w as any).walletClientType === "privy" || (w as any).walletClientType === "privy-v2"
  );
  const solAddress =
    (embeddedSolWallet as any)?.address ||
    solWalletFromHook?.address ||
    null;

  // External wallets (non-privy)
  const externalWallets = (user?.linkedAccounts || []).filter(
    (a: any) =>
      a.type === "wallet" &&
      a.walletClientType !== "privy" &&
      a.walletClientType !== "privy-v2"
  );

  // --- Balance fetching ---
  const loadBalances = useCallback(async () => {
    if (!evmAddress && !solAddress) return;
    setBalanceLoading(true);
    try {
      const results = await Promise.allSettled([
        evmAddress ? fetchEvmBalance(evmAddress, "ethereum") : Promise.resolve("0"),
        evmAddress ? fetchEvmBalance(evmAddress, "arbitrum") : Promise.resolve("0"),
        solAddress ? fetchSolBalance(solAddress) : Promise.resolve("0"),
        evmAddress ? fetchEvmUsdtBalance(evmAddress, "ethereum") : Promise.resolve("0"),
        evmAddress ? fetchEvmUsdtBalance(evmAddress, "arbitrum") : Promise.resolve("0"),
        solAddress ? fetchSolanaUsdtBalance(solAddress) : Promise.resolve("0"),
      ]);
      setBalances({
        ethMainnet: results[0].status === "fulfilled" ? results[0].value : "0",
        ethArbitrum: results[1].status === "fulfilled" ? results[1].value : "0",
        sol: results[2].status === "fulfilled" ? results[2].value : "0",
        usdtEth: results[3].status === "fulfilled" ? results[3].value : "0",
        usdtArb: results[4].status === "fulfilled" ? results[4].value : "0",
        usdtSol: results[5].status === "fulfilled" ? results[5].value : "0",
      });
    } finally {
      setBalanceLoading(false);
    }
  }, [evmAddress, solAddress]);

  useEffect(() => {
    if (ready && authenticated && user) {
      loadBalances();
    }
  }, [ready, authenticated, user, loadBalances]);

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
                  <div className="flex flex-col gap-2 justify-center">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xl">📢</span>
                      <h4 className="text-xs font-bold text-gray-900">
                        채널 인증 필요
                      </h4>
                    </div>
                    <button
                      onClick={handleOpenVerifyModal}
                      className="bg-[#0037F0] text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-blue-800 transition-colors"
                    >
                      채널 인증하기
                    </button>
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
              </div>
            </div>

            {/* Privy Wallet 카드 */}
            <div className="bg-white rounded-lg overflow-hidden shadow-glass border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-200/50 bg-gray-50 flex justify-between items-center">
                <h3 className="font-bold text-gray-900 text-sm">
                  Privy Wallet
                </h3>
                <button
                  onClick={loadBalances}
                  disabled={balanceLoading}
                  className="text-xs font-bold text-gray-400 hover:text-[#0037F0] transition-colors disabled:opacity-50"
                >
                  {balanceLoading ? "Loading..." : "Refresh"}
                </button>
              </div>
              <div className="p-6 space-y-4">
                {/* EVM 주소 */}
                {evmAddress && (
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-[10px] text-gray-400 font-bold uppercase mb-0.5">
                        EVM Address
                      </p>
                      <p className="text-xs font-mono text-gray-700 truncate max-w-[280px]">
                        {evmAddress}
                      </p>
                    </div>
                    <button
                      onClick={() => navigator.clipboard.writeText(evmAddress)}
                      className="text-gray-300 hover:text-[#0037F0] transition-colors shrink-0 ml-2"
                      title="Copy"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>
                  </div>
                )}

                {/* Solana 주소 */}
                {solAddress && (
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-[10px] text-gray-400 font-bold uppercase mb-0.5">
                        Solana Address
                      </p>
                      <p className="text-xs font-mono text-gray-700 truncate max-w-[280px]">
                        {solAddress}
                      </p>
                    </div>
                    <button
                      onClick={() => navigator.clipboard.writeText(solAddress)}
                      className="text-gray-300 hover:text-[#0037F0] transition-colors shrink-0 ml-2"
                      title="Copy"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>
                  </div>
                )}

                {!evmAddress && !solAddress && (
                  <p className="text-xs text-gray-400 text-center py-2">
                    No embedded wallet found
                  </p>
                )}

                {/* 잔액 그리드 */}
                {(evmAddress || solAddress) && (
                  <div className="grid grid-cols-3 gap-3 pt-2">
                    <BalanceItem label="ETH (Mainnet)" value={balances.ethMainnet} symbol="ETH" loading={balanceLoading} />
                    <BalanceItem label="ETH (Arbitrum)" value={balances.ethArbitrum} symbol="ETH" loading={balanceLoading} />
                    <BalanceItem label="SOL" value={balances.sol} symbol="SOL" loading={balanceLoading} />
                    <BalanceItem label="USDT (Eth)" value={balances.usdtEth} symbol="USDT" loading={balanceLoading} />
                    <BalanceItem label="USDT (Arb)" value={balances.usdtArb} symbol="USDT" loading={balanceLoading} />
                    <BalanceItem label="USDT (Sol)" value={balances.usdtSol} symbol="USDT" loading={balanceLoading} />
                  </div>
                )}
              </div>
            </div>

            {/* External Wallet 카드 */}
            <div className="bg-white rounded-lg overflow-hidden shadow-glass border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-200/50 bg-gray-50 flex justify-between items-center">
                <h3 className="font-bold text-gray-900 text-sm">
                  External Wallet
                </h3>
                <button
                  onClick={() => linkWallet()}
                  className="bg-black text-white px-3 py-1.5 rounded-lg text-[11px] font-bold hover:bg-gray-800 transition-colors"
                >
                  Connect Wallet
                </button>
              </div>
              <div className="divide-y divide-gray-100">
                {externalWallets.length === 0 ? (
                  <div className="px-6 py-8 text-center">
                    <p className="text-xs text-gray-400">
                      No external wallets connected
                    </p>
                  </div>
                ) : (
                  externalWallets.map((wallet: any) => (
                    <div
                      key={wallet.address}
                      className="flex items-center justify-between px-6 py-4 hover:bg-white transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-center text-sm">
                          {wallet.chainType === "solana" ? "◎" : "⟠"}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-mono text-gray-700 truncate max-w-[200px]">
                            {wallet.address}
                          </p>
                          <p className="text-[10px] text-gray-400 mt-0.5 capitalize">
                            {wallet.walletClientType} · {wallet.chainType}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => unlinkWallet(wallet.address)}
                        className="px-3 py-1.5 rounded-lg text-[11px] font-bold border border-gray-200 text-gray-400 hover:text-red-600 hover:border-red-200 hover:bg-red-50 bg-white transition-all"
                      >
                        Disconnect
                      </button>
                    </div>
                  ))
                )}
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

      {/* 채널 인증 프로세스 모달 */}
      {showVerifyModal && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={handleCloseModal}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-fadeIn"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Step 1: 가이드 */}
            {verifyStep === "guide" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-gray-900">
                    채널 소유권 인증
                  </h3>
                  <button
                    onClick={handleCloseModal}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
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
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>

                <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">ℹ️</span>
                    <div className="flex-1">
                      <h4 className="text-sm font-bold text-blue-900 mb-2">
                        인증 전 준비사항
                      </h4>
                      <p className="text-xs text-blue-700 leading-relaxed">
                        채널 소유권을 확인하기 위해 봇을 임시로 추가해야 합니다.
                        인증 완료 후 제거하셔도 됩니다.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="text-sm font-bold text-gray-900">
                    ✅ 진행 단계
                  </h4>
                  <div className="space-y-2">
                    <div className="flex items-start gap-3 text-xs">
                      <span className="bg-[#0037F0] text-white font-bold rounded-full w-5 h-5 flex items-center justify-center shrink-0 text-[10px]">
                        1
                      </span>
                      <p className="text-gray-700 leading-relaxed">
                        텔레그램 앱에서 인증하려는 <strong>채널</strong>로 이동
                      </p>
                    </div>
                    <div className="flex items-start gap-3 text-xs">
                      <span className="bg-[#0037F0] text-white font-bold rounded-full w-5 h-5 flex items-center justify-center shrink-0 text-[10px]">
                        2
                      </span>
                      <p className="text-gray-700 leading-relaxed">
                        채널 설정 → <strong>관리자(Administrators)</strong>{" "}
                        메뉴로 이동
                      </p>
                    </div>
                    <div className="flex items-start gap-3 text-xs">
                      <span className="bg-[#0037F0] text-white font-bold rounded-full w-5 h-5 flex items-center justify-center shrink-0 text-[10px]">
                        3
                      </span>
                      <p className="text-gray-700 leading-relaxed">
                        <strong className="text-[#0037F0]">@BGT_gomebot</strong>{" "}
                        검색 후 관리자로 추가
                      </p>
                    </div>
                    <div className="flex items-start gap-3 text-xs">
                      <span className="bg-[#0037F0] text-white font-bold rounded-full w-5 h-5 flex items-center justify-center shrink-0 text-[10px]">
                        4
                      </span>
                      <p className="text-gray-700 leading-relaxed">
                        봇 추가 완료 후 아래 <strong>"다음"</strong> 버튼 클릭
                      </p>
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleNextToVerify}
                  className="w-full bg-[#0037F0] text-white py-3 rounded-lg font-bold text-sm hover:bg-blue-800 transition-colors"
                >
                  다음
                </button>
              </div>
            )}

            {/* Step 2: 채널 입력 및 인증 */}
            {verifyStep === "verify" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-gray-900">
                    채널 주소 입력
                  </h3>
                  <button
                    onClick={handleCloseModal}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
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
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>

                <div className="space-y-3">
                  <label className="block">
                    <span className="text-xs font-bold text-gray-700 mb-2 block">
                      채널 주소 또는 핸들
                    </span>
                    <input
                      type="text"
                      placeholder="예: t.me/your_channel 또는 @your_channel"
                      value={channelInput}
                      onChange={(e) => setChannelInput(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-sm font-medium focus:border-[#0037F0] focus:bg-white outline-none transition-all"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && channelInput && !isVerifying) {
                          handleVerifyChannel();
                        }
                      }}
                    />
                  </label>

                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                    <p className="text-[10px] text-gray-600 leading-relaxed">
                      <strong>💡 팁:</strong> 채널 링크(t.me/channel),
                      핸들(@channel), 또는 핸들명(channel) 모두 가능합니다.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setVerifyStep("guide")}
                    className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-lg font-bold text-sm hover:bg-gray-200 transition-colors"
                  >
                    이전
                  </button>
                  <button
                    onClick={handleVerifyChannel}
                    disabled={!channelInput || isVerifying}
                    className="flex-1 bg-[#0037F0] text-white py-3 rounded-lg font-bold text-sm hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isVerifying ? "인증 중..." : "인증하기"}
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: 성공 */}
            {verifyStep === "success" && myChannel && (
              <div className="space-y-4">
                <div className="flex flex-col items-center text-center py-6">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                    <svg
                      className="w-8 h-8 text-green-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">
                    ✅ 인증 완료!
                  </h3>
                  <p className="text-sm text-gray-600">
                    채널 소유권이 확인되었습니다.
                  </p>
                </div>

                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-3">
                    {myChannel.photoUrl ? (
                      <img
                        src={myChannel.photoUrl}
                        alt=""
                        className="w-12 h-12 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center text-[#0037F0] font-bold text-lg">
                        {myChannel.title[0]}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-sm text-gray-900 truncate">
                        {myChannel.title}
                      </h4>
                      <p className="text-xs text-gray-500">
                        @{myChannel.handle}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-600">구독자 수</span>
                    <span className="font-bold text-gray-900">
                      {myChannel.subscribers?.toLocaleString() || 0}명
                    </span>
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <span className="text-lg">💡</span>
                    <div className="flex-1">
                      <p className="text-xs text-blue-700 leading-relaxed">
                        <strong>안내:</strong> 이제{" "}
                        <strong className="text-[#0037F0]">@BGT_gomebot</strong>
                        을 채널 관리자에서 제거하셔도 됩니다.
                      </p>
                      <p className="text-xs text-blue-700 mt-2 leading-relaxed">
                        ⚠️ 소유주 연동 유지를 위해{" "}
                        <strong>텔레그램 계정 연결은 해제하지 마세요</strong>.
                      </p>
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleCloseModal}
                  className="w-full bg-[#0037F0] text-white py-3 rounded-lg font-bold text-sm hover:bg-blue-800 transition-colors"
                >
                  확인
                </button>
              </div>
            )}

            {/* Step 4: 실패 */}
            {verifyStep === "error" && (
              <div className="space-y-4">
                <div className="flex flex-col items-center text-center py-6">
                  <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                    <svg
                      className="w-8 h-8 text-red-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">
                    ❌ 인증 실패
                  </h3>
                  <p className="text-sm text-red-600 font-medium">
                    {verifyError}
                  </p>
                </div>

                <div className="bg-orange-50 border border-orange-100 rounded-lg p-4">
                  <h4 className="text-xs font-bold text-orange-900 mb-2">
                    📋 확인 사항
                  </h4>
                  <ul className="space-y-1.5 text-xs text-orange-700">
                    <li className="flex items-start gap-2">
                      <span>•</span>
                      <span>
                        <strong>@BGT_gomebot</strong>이 채널의 관리자로 추가되어
                        있는지 확인
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span>•</span>
                      <span>
                        채널 주소가 올바른지 확인 (예: t.me/channel_name)
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span>•</span>
                      <span>
                        본인이 채널의 <strong>소유주(Creator)</strong>인지 확인
                      </span>
                    </li>
                  </ul>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={handleCloseModal}
                    className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-lg font-bold text-sm hover:bg-gray-200 transition-colors"
                  >
                    닫기
                  </button>
                  <button
                    onClick={() => {
                      setVerifyStep("verify");
                      setVerifyError("");
                    }}
                    className="flex-1 bg-[#0037F0] text-white py-3 rounded-lg font-bold text-sm hover:bg-blue-800 transition-colors"
                  >
                    다시 시도
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
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

// ----------------------------------------------------------------------
// BalanceItem (Wallet Balance Display)
// ----------------------------------------------------------------------
function BalanceItem({
  label,
  value,
  symbol,
  loading,
}: {
  label: string;
  value: string;
  symbol: string;
  loading: boolean;
}) {
  const formatted = (() => {
    const num = parseFloat(value);
    if (isNaN(num)) return "0";
    if (num === 0) return "0";
    if (num < 0.0001) return "<0.0001";
    return num.toLocaleString(undefined, { maximumFractionDigits: 4 });
  })();

  return (
    <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
      <p className="text-[10px] text-gray-400 font-bold mb-1 truncate">
        {label}
      </p>
      {loading ? (
        <div className="h-5 bg-gray-200 rounded animate-pulse w-16" />
      ) : (
        <p className="text-sm font-bold text-gray-900 truncate">
          {formatted}{" "}
          <span className="text-[10px] text-gray-400 font-medium">
            {symbol}
          </span>
        </p>
      )}
    </div>
  );
}
