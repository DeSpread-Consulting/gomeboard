"use client";

import React from "react";
import { signIn } from "next-auth/react";

export default function LoginGuard() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] bg-[#F5F5F7] text-center px-4">
      <div className="bg-white p-10 rounded-3xl shadow-xl max-w-md w-full border border-gray-100">
        <div className="w-16 h-16 bg-gray-900 text-white rounded-2xl flex items-center justify-center text-3xl font-bold mx-auto mb-6 shadow-md">
          🔒
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          로그인이 필요합니다
        </h2>
        <p className="text-gray-500 mb-8 leading-relaxed">
          이 페이지는 관계자 전용입니다.
          <br />
          Google 계정으로 로그인하여 접근 권한을 확인해주세요.
        </p>

        <button
          onClick={() => signIn("google")}
          className="w-full bg-black text-white text-base font-bold py-4 rounded-xl hover:bg-gray-800 hover:scale-[1.02] transition-all duration-200 shadow-lg"
        >
          Google 계정으로 로그인
        </button>
      </div>
    </div>
  );
}
