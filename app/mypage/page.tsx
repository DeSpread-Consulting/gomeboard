/* eslint-disable @typescript-eslint/no-explicit-any */
// app/mypage/page.tsx
"use client";

import React from "react";
import { usePrivy } from "@privy-io/react-auth";
import Image from "next/image";
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

              {/* [수정] onLink -> onClick 으로 변경 */}
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
            <div className="absolute bottom-0 right-0 bg-blue-600 text-white p-1.5 rounded-full border-2 border-white shadow-sm">
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
                  d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                ></path>
              </svg>
            </div>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-1">
            {displayName}
          </h2>
          <p className="text-gray-400 text-sm font-medium">
            {user.telegram ? "Telegram Verified" : "Guest User"}
          </p>
        </div>

        {/* 3. 계정 연동 리스트 */}
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
              onLink={linkTelegram}
              onUnlink={() => unlinkTelegram(user.telegram!.telegramUserId)}
              isPrimary={true}
            />

            {/* Google */}
            <AccountRow
              icon="G"
              name="Google"
              isConnected={!!user.google}
              identifier={user.google?.email}
              onLink={linkGoogle}
              onUnlink={() => unlinkGoogle(user.google!.subject)}
            />

            {/* Apple */}
            <AccountRow
              icon="🍎"
              name="Apple"
              isConnected={!!user.apple}
              identifier={user.apple?.email}
              onLink={linkApple}
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
              onLink={linkTwitter}
              onUnlink={() => unlinkTwitter(user.twitter!.subject)}
            />

            {/* Discord */}
            <AccountRow
              icon="👾"
              name="Discord"
              isConnected={!!user.discord}
              identifier={user.discord?.username}
              onLink={linkDiscord}
              onUnlink={() => unlinkDiscord(user.discord!.subject)}
            />

            {/* Email */}
            <AccountRow
              icon="✉️"
              name="Email"
              isConnected={!!user.email}
              identifier={user.email?.address}
              onLink={linkEmail}
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
              onLink={linkWallet}
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

// 재사용 가능한 계정 행 컴포넌트
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
            // 구글 로고 SVG 예시
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
