"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signIn, signOut } from "next-auth/react"; // [NEW] import 추가

export interface ReportTableRow {
  id: string;
  projectName: string;
  manager: string;
  managerImg: string | null;
  team: string;
  targetMonth: string;
  status: string; // Approved, Pending, Missing, N/A, Error
  details: string; // "3/5"
}

export default function ReportClient({
  targetMonth,
  rows,
}: {
  targetMonth: string;
  rows: ReportTableRow[];
}) {
  const pathname = usePathname();
  const { data: session } = useSession(); // [NEW] 세션 데이터 가져오기
  const getNavLinkClass = (path: string) =>
    pathname === path
      ? "text-black font-bold"
      : "text-gray-500 hover:text-black";

  return (
    <div className="min-h-screen bg-[#F5F5F7] text-[#1D1D1F] font-sans">
      <main className="max-w-[1200px] mx-auto px-6 py-12">
        <div className="mb-10">
          <h1 className="text-3xl font-bold tracking-tight mb-2 text-gray-900">
            Monthly Reports Status
          </h1>
          <p className="text-gray-500">
            Target Period:{" "}
            <span className="font-semibold text-black">{targetMonth}</span>{" "}
            (Last Month)
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                <th className="px-6 py-4">Project</th>
                <th className="px-6 py-4">Manager</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Items Approved</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="font-bold text-gray-900">
                        {row.projectName}
                      </span>
                      <span className="text-xs text-gray-400">{row.team}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      {row.managerImg ? (
                        <img
                          src={row.managerImg}
                          alt=""
                          className="w-6 h-6 rounded-full border border-gray-200"
                        />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-[10px]">
                          {row.manager.slice(0, 1)}
                        </div>
                      )}
                      <span className="text-sm text-gray-700">
                        {row.manager}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                        row.status === "Approved"
                          ? "bg-green-50 text-green-700 border-green-200"
                          : row.status === "Pending"
                          ? "bg-yellow-50 text-yellow-700 border-yellow-200"
                          : row.status === "Missing"
                          ? "bg-red-50 text-red-700 border-red-200"
                          : "bg-gray-100 text-gray-500 border-gray-200"
                      }`}
                    >
                      {row.status === "Approved" && "✅ Done"}
                      {row.status === "Pending" && "⏳ Pending"}
                      {row.status === "Missing" && "🚨 Missing"}
                      {row.status === "N/A" && "－"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right font-mono text-sm text-gray-600">
                    {row.details || "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
