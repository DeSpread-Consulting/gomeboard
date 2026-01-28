"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";

const supabase = createClient();

// --- Types ---
type Channel = {
  id: number;
  tier: string;
  channel_name: string;
  subscriber: string;
  url: string;
  channel_link: string;
  username: string;
  price_write: number;
  price_forward: number;
  wallet_address: string;
  memo: string;
  is_active: boolean; // [New] 활성 상태 필드
};

type Settlement = {
  id: number;
  created_at: string;
  link_url: string;
  post_type: "write" | "forward";
  amount: number;
  wallet_address: string;
  channel_id: number;
  kol_channels: {
    channel_name: string;
    username: string;
    tier: string;
  } | null;
};

// 요약 데이터 타입
type MonthlySummary = {
  channel_id: number;
  channel_name: string;
  username: string;
  tier: string;
  wallet_address: string;
  write_count: number;
  forward_count: number;
  total_amount: number;
  details: Settlement[];
};

// [New] 티어 정렬 우선순위 정의 (낮을수록 우선)
const tierPriority: Record<string, number> = {
  "A+": 1,
  A: 2,
  "B+": 3,
  B: 4,
  C: 5,
};

export default function SettlementPage() {
  const [activeTab, setActiveTab] = useState<
    "submit" | "dashboard" | "channels"
  >("dashboard");

  const [channels, setChannels] = useState<Channel[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [summary, setSummary] = useState<MonthlySummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedChannelId, setExpandedChannelId] = useState<number | null>(
    null,
  );

  // --- 날짜 필터 (조회용) ---
  const [selectedDate, setSelectedDate] = useState(new Date());

  // --- 링크 등록 폼 상태 ---
  const [inputLinks, setInputLinks] = useState("");
  const [postType, setPostType] = useState<"write" | "forward">("write");
  const [submitDate, setSubmitDate] = useState(""); // 등록 날짜 (빈값이면 오늘)

  // --- 채널 관리 상태 ---
  const [newChannel, setNewChannel] = useState<Partial<Channel>>({
    tier: "",
    channel_name: "",
    subscriber: "",
    url: "",
    channel_link: "",
    price_write: 0,
    price_forward: 0,
    wallet_address: "",
    memo: "",
    is_active: true, // [New] 기본값 true
  });

  // --- 모달 상태 관리 ---
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingChannel, setEditingChannel] = useState<Channel | null>(null);

  // [New] 정산 내역 수정 모달 상태
  const [isSettlementEditOpen, setIsSettlementEditOpen] = useState(false);
  const [editingSettlement, setEditingSettlement] = useState<{
    id: number;
    post_type: "write" | "forward";
    created_at: string;
    price_write: number; // 단가 재계산을 위해 필요
    price_forward: number;
  } | null>(null);

  useEffect(() => {
    fetchData();
  }, [selectedDate]);

  const fetchData = async () => {
    // 1. 채널 목록
    const { data: chData } = await supabase.from("kol_channels").select("*");
    // .order("tier", { ascending: true }) // [Modified] JS에서 커스텀 정렬 수행

    if (chData) {
      // [New] 커스텀 티어 정렬 (A+ -> A -> B+ -> B)
      const sorted = (chData as Channel[]).sort((a, b) => {
        const tierA = a.tier?.toUpperCase().trim();
        const tierB = b.tier?.toUpperCase().trim();
        const scoreA = tierPriority[tierA] || 99;
        const scoreB = tierPriority[tierB] || 99;

        if (scoreA !== scoreB) return scoreA - scoreB;
        return a.channel_name.localeCompare(b.channel_name);
      });
      setChannels(sorted);
    }

    // 2. 정산 내역 (월별 필터)
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth() + 1;
    const startDate = new Date(year, month - 1, 1).toISOString(); // 1일 00:00
    const endDate = new Date(year, month, 0, 23, 59, 59).toISOString(); // 마지막 날

    const { data: stData } = await supabase
      .from("kol_settlements")
      .select(
        `*, kol_channels (channel_name, username, tier, price_write, price_forward)`,
      )
      .gte("created_at", startDate)
      .lte("created_at", endDate)
      .order("created_at", { ascending: false });

    if (stData) {
      const rawSettlements = stData as any[];
      setSettlements(rawSettlements);
      processSummary(rawSettlements);
    }
  };

  // --- 데이터 가공 ---
  const processSummary = (data: Settlement[]) => {
    const map = new Map<number, MonthlySummary>();

    data.forEach((item) => {
      const chId = item.channel_id;
      if (!item.kol_channels) return;

      if (!map.has(chId)) {
        map.set(chId, {
          channel_id: chId,
          channel_name: item.kol_channels.channel_name,
          username: item.kol_channels.username,
          tier: item.kol_channels.tier,
          wallet_address: item.wallet_address,
          write_count: 0,
          forward_count: 0,
          total_amount: 0,
          details: [],
        });
      }

      const entry = map.get(chId)!;
      if (item.post_type === "write") entry.write_count += 1;
      else entry.forward_count += 1;

      entry.total_amount += item.amount;
      entry.details.push(item);
    });

    setSummary(
      Array.from(map.values()).sort((a, b) => b.total_amount - a.total_amount),
    );
  };

  const moveMonth = (offset: number) => {
    const newDate = new Date(selectedDate);
    newDate.setMonth(newDate.getMonth() + offset);
    setSelectedDate(newDate);
    setExpandedChannelId(null);
  };

  // --- 기능: 다중 링크 제출 (중복 검사 포함) ---
  const handleBulkSubmit = async () => {
    if (!inputLinks.trim()) return;
    setLoading(true);

    const rawLinks = inputLinks
      .split(/[\s,\n]+/)
      .filter((l) => l.trim().length > 0);
    const results = { success: 0, fail: 0, logs: [] as string[] };

    const targetDate = submitDate
      ? new Date(submitDate).toISOString()
      : new Date().toISOString();

    for (const link of rawLinks) {
      try {
        // [New] 1. 중복 검사: DB에 이미 존재하는 링크인지 확인
        const { data: exist } = await supabase
          .from("kol_settlements")
          .select("id")
          .eq("link_url", link)
          .single();

        if (exist) throw new Error(`[이미 등록됨] ${link}`);

        // 2. 채널 찾기
        const match = link.match(/t\.me\/([^/]+)/);
        if (!match) throw new Error(`[형식 오류] ${link}`);
        const targetUsername = match[1];

        let { data: channels } = await supabase
          .from("kol_channels")
          .select("*")
          .eq("username", targetUsername)
          .limit(1);

        let channel = channels && channels.length > 0 ? channels[0] : null;

        if (!channel) {
          const { data: fallback } = await supabase
            .from("kol_channels")
            .select("*")
            .ilike("channel_link", `%${targetUsername}%`)
            .limit(1);
          channel = fallback && fallback.length > 0 ? fallback[0] : null;
        }

        if (!channel) throw new Error(`[채널 없음] @${targetUsername}`);

        // [New] 비활성 채널 체크
        if (!channel.is_active)
          throw new Error(
            `[비활성 채널] @${targetUsername} (채널 관리에서 활성화 필요)`,
          );

        const amount =
          postType === "write" ? channel.price_write : channel.price_forward;

        const { error } = await supabase.from("kol_settlements").insert({
          channel_id: channel.id,
          link_url: link,
          post_type: postType,
          amount: amount,
          wallet_address: channel.wallet_address,
          created_at: targetDate,
        });

        if (error) throw error;
        results.success++;
      } catch (e: any) {
        results.fail++;
        results.logs.push(e.message);
      }
    }

    setLoading(false);
    setInputLinks("");
    fetchData();

    let msg = `처리 완료!\n✅ 성공: ${results.success}건\n❌ 실패: ${results.fail}건`;
    if (results.logs.length > 0)
      msg += `\n\n[실패 사유]\n${results.logs.join("\n")}`;
    alert(msg);
  };

  // --- 기능: 채널 추가 ---
  const handleAddChannel = async () => {
    if (!newChannel.channel_name || !newChannel.channel_link)
      return alert("필수 정보 누락");
    const linkClean = newChannel.channel_link
      .replace("https://", "")
      .replace("http://", "");
    const match = linkClean.match(/t\.me\/([^/]+)/);
    const username = match ? match[1] : linkClean.split("/")[1] || "";

    const { error } = await supabase
      .from("kol_channels")
      .insert({ ...newChannel, username });
    if (error) alert("오류: " + error.message);
    else {
      alert("채널 등록 완료");
      setNewChannel({
        tier: "",
        channel_name: "",
        subscriber: "",
        url: "",
        channel_link: "",
        price_write: 0,
        price_forward: 0,
        wallet_address: "",
        memo: "",
        is_active: true, // 초기화
      });
      fetchData();
    }
  };

  // --- 기능: 채널 수정 (Update) ---
  const openEditModal = (channel: Channel) => {
    setEditingChannel({ ...channel });
    setIsEditModalOpen(true);
  };

  const handleUpdateChannel = async () => {
    if (!editingChannel) return;

    const linkClean = editingChannel.channel_link
      .replace("https://", "")
      .replace("http://", "");
    const match = linkClean.match(/t\.me\/([^/]+)/);
    const username = match
      ? match[1]
      : linkClean.split("/")[1] || editingChannel.username;

    const { error } = await supabase
      .from("kol_channels")
      .update({
        tier: editingChannel.tier,
        channel_name: editingChannel.channel_name,
        subscriber: editingChannel.subscriber,
        url: editingChannel.url,
        channel_link: editingChannel.channel_link,
        username: username,
        price_write: editingChannel.price_write,
        price_forward: editingChannel.price_forward,
        wallet_address: editingChannel.wallet_address,
        memo: editingChannel.memo,
        is_active: editingChannel.is_active, // [New] 상태 업데이트
      })
      .eq("id", editingChannel.id);

    if (error) {
      alert("수정 실패: " + error.message);
    } else {
      alert("채널 정보가 수정되었습니다.");
      setIsEditModalOpen(false);
      setEditingChannel(null);
      fetchData();
    }
  };

  // --- [New] 기능: 정산 내역 수정 (Update Settlement) ---
  const openSettlementEditModal = (settlement: any) => {
    // settlement 객체 안에 kol_channels 정보가 포함되어 있음 (fetchData 참고)
    setEditingSettlement({
      id: settlement.id,
      post_type: settlement.post_type,
      created_at: settlement.created_at.split("T")[0], // YYYY-MM-DD 형식으로 변환
      price_write: settlement.kol_channels.price_write,
      price_forward: settlement.kol_channels.price_forward,
    });
    setIsSettlementEditOpen(true);
  };

  const handleUpdateSettlement = async () => {
    if (!editingSettlement) return;

    // 유형이 변경되면 금액도 해당 채널의 단가에 맞춰 변경
    const newAmount =
      editingSettlement.post_type === "write"
        ? editingSettlement.price_write
        : editingSettlement.price_forward;

    // 날짜 포맷 (시간은 현재 시간 유지하거나 00:00으로 셋팅, 여기선 날짜만 변경하므로 T00:00:00Z 붙임)
    const newDateIso = new Date(editingSettlement.created_at).toISOString();

    const { error } = await supabase
      .from("kol_settlements")
      .update({
        post_type: editingSettlement.post_type,
        amount: newAmount,
        created_at: newDateIso,
      })
      .eq("id", editingSettlement.id);

    if (error) {
      alert("수정 실패: " + error.message);
    } else {
      alert("정산 정보가 수정되었습니다.");
      setIsSettlementEditOpen(false);
      setEditingSettlement(null);
      fetchData();
    }
  };

  // --- Helper: 클립보드 복사 ---
  const copyToClipboard = (text: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    alert(`지갑 주소가 복사되었습니다:\n${text}`);
  };

  // --- Style Helpers ---
  const formatMonth = (date: Date) =>
    date.toLocaleDateString("ko-KR", { year: "numeric", month: "long" });

  const getTierStyle = (tier: string) => {
    const t = tier?.toUpperCase() || "";
    if (t.includes("A")) return "bg-red-50 hover:bg-red-100";
    if (t.includes("B")) return "bg-yellow-50 hover:bg-yellow-100";
    if (t.includes("C")) return "bg-green-50 hover:bg-green-100";
    return "bg-white hover:bg-gray-50";
  };

  const getTierBadgeColor = (tier: string) => {
    const t = tier?.toUpperCase() || "";
    if (t.includes("A")) return "bg-red-100 text-red-700 border-red-200";
    if (t.includes("B"))
      return "bg-yellow-100 text-yellow-800 border-yellow-200";
    if (t.includes("C")) return "bg-green-100 text-green-700 border-green-200";
    return "bg-gray-100 text-gray-600 border-gray-200";
  };

  const monthlyTotal = summary.reduce(
    (sum, item) => sum + item.total_amount,
    0,
  );

  return (
    <div className="bg-gray-50 min-h-screen pb-20 relative">
      <div className="max-w-7xl mx-auto p-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-gray-200 pb-6">
          <div>
            <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">
              KOL Settlement
            </h1>
            <p className="text-gray-500 mt-1">
              텔레그램 KOL 월별 정산 대시보드
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center bg-white rounded-lg border shadow-sm px-2 py-1">
              <button
                onClick={() => moveMonth(-1)}
                className="p-2 hover:bg-gray-100 rounded text-gray-500"
              >
                ◀
              </button>
              <span className="px-4 font-bold text-gray-800 min-w-[100px] text-center">
                {formatMonth(selectedDate)}
              </span>
              <button
                onClick={() => moveMonth(1)}
                className="p-2 hover:bg-gray-100 rounded text-gray-500"
              >
                ▶
              </button>
            </div>
            <div className="bg-white px-6 py-3 rounded-xl shadow-sm border border-blue-100 text-right min-w-[200px]">
              <p className="text-xs text-blue-500 uppercase font-semibold tracking-wider mb-1">
                Total Payout
              </p>
              <p className="text-3xl font-extrabold text-blue-600">
                ${monthlyTotal.toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white p-1.5 rounded-lg border inline-flex shadow-sm">
          {[
            { id: "dashboard", label: "📊 정산 요약", icon: "" },
            { id: "submit", label: "🚀 링크 등록", icon: "" },
            { id: "channels", label: "⚙️ 채널 관리", icon: "" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-5 py-2.5 text-sm font-bold rounded-md transition-all duration-200 ${
                activeTab === tab.id
                  ? "bg-gray-900 text-white shadow-md"
                  : "text-gray-500 hover:text-gray-900 hover:bg-gray-100"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="transition-all duration-300">
          {/* TAB 1: 정산 요약 */}
          {activeTab === "dashboard" && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <table className="w-full text-sm text-left">
                <thead className="bg-blue-600 text-white">
                  <tr>
                    <th className="px-6 py-4">Tier</th>
                    <th className="px-6 py-4">Channel</th>
                    <th className="px-6 py-4">
                      Wallet Address (Click to Copy)
                    </th>
                    <th className="px-6 py-4 text-center">Original</th>
                    <th className="px-6 py-4 text-center">Forward</th>
                    <th className="px-6 py-4 text-right">Total Amount</th>
                    <th className="px-6 py-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {summary.map((item) => (
                    <>
                      <tr
                        key={item.channel_id}
                        className={`hover:bg-blue-50 transition-colors ${expandedChannelId === item.channel_id ? "bg-blue-50" : ""}`}
                      >
                        <td className="px-6 py-4">
                          <span
                            className={`px-2 py-1 rounded text-xs font-bold border ${getTierBadgeColor(item.tier)}`}
                          >
                            {item.tier || "-"}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-bold text-gray-900">
                            {item.channel_name}
                          </div>
                          <div className="text-xs text-gray-500">
                            @{item.username}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => copyToClipboard(item.wallet_address)}
                            className="font-mono text-xs text-gray-500 bg-gray-100 hover:bg-blue-100 hover:text-blue-600 px-2 py-1 rounded transition-colors flex items-center gap-1"
                            title="클릭하여 복사"
                          >
                            {item.wallet_address
                              ? `${item.wallet_address.substring(0, 8)}...${item.wallet_address.substring(item.wallet_address.length - 6)}`
                              : "(미등록)"}
                            {item.wallet_address && <span>📋</span>}
                          </button>
                        </td>
                        <td className="px-6 py-4 text-center font-medium text-gray-700">
                          {item.write_count}
                        </td>
                        <td className="px-6 py-4 text-center font-medium text-gray-700">
                          {item.forward_count}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="text-lg font-bold text-blue-600">
                            ${item.total_amount.toLocaleString()}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <button
                            onClick={() =>
                              setExpandedChannelId(
                                expandedChannelId === item.channel_id
                                  ? null
                                  : item.channel_id,
                              )
                            }
                            className="text-gray-500 hover:text-blue-600 text-xs font-bold underline decoration-dotted"
                          >
                            {expandedChannelId === item.channel_id
                              ? "접기"
                              : "상세보기"}
                          </button>
                        </td>
                      </tr>
                      {expandedChannelId === item.channel_id && (
                        <tr className="bg-gray-50">
                          <td
                            colSpan={7}
                            className="p-4 border-b border-blue-100 inset-shadow"
                          >
                            <div className="bg-white rounded border border-gray-200 p-4">
                              <h4 className="font-bold text-sm mb-3 text-gray-700">
                                📜 {item.channel_name} -{" "}
                                {formatMonth(selectedDate)} 상세 내역
                              </h4>
                              <div className="space-y-2">
                                {item.details.map((detail, idx) => (
                                  <div
                                    key={detail.id}
                                    className="flex justify-between items-center text-xs p-2 hover:bg-gray-50 rounded border border-gray-100"
                                  >
                                    <div className="flex items-center gap-2">
                                      <span className="text-gray-400 font-mono w-6 text-center">
                                        {idx + 1}
                                      </span>
                                      <span
                                        className={`px-1.5 py-0.5 rounded border ${detail.post_type === "write" ? "bg-blue-100 text-blue-700 border-blue-200" : "bg-orange-100 text-orange-700 border-orange-200"}`}
                                      >
                                        {detail.post_type === "write"
                                          ? "작성"
                                          : "Fwd"}
                                      </span>
                                      <span className="text-gray-500">
                                        {new Date(
                                          detail.created_at,
                                        ).toLocaleDateString()}
                                      </span>
                                      <a
                                        href={detail.link_url}
                                        target="_blank"
                                        className="text-blue-600 hover:underline truncate max-w-[300px] block"
                                      >
                                        {detail.link_url}
                                      </a>
                                    </div>
                                    <div className="flex items-center gap-3">
                                      <div className="font-bold text-gray-700">
                                        ${detail.amount}
                                      </div>
                                      {/* [New] 정산 내역 수정 버튼 */}
                                      <button
                                        onClick={() =>
                                          openSettlementEditModal(detail)
                                        }
                                        className="text-xs text-gray-400 hover:text-blue-600 underline"
                                      >
                                        수정
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                  {summary.length === 0 && (
                    <tr>
                      <td
                        colSpan={7}
                        className="p-12 text-center text-gray-400"
                      >
                        해당 월에 등록된 정산 내역이 없습니다.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 2: 링크 등록 */}
          {activeTab === "submit" && (
            <div className="max-w-3xl mx-auto">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="bg-gray-900 px-6 py-4">
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    📝 작업 등록 (Bulk Upload)
                  </h2>
                </div>
                <div className="p-8 space-y-6">
                  {/* 날짜 선택 */}
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      날짜 선택 (미선택 시 오늘 날짜)
                    </label>
                    <input
                      type="date"
                      className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                      value={submitDate}
                      onChange={(e) => setSubmitDate(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      작업 유형 선택
                    </label>
                    <div className="flex gap-4">
                      <label
                        className={`flex-1 p-4 rounded-xl border-2 cursor-pointer transition-all ${postType === "write" ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 hover:border-gray-300"}`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="radio"
                            className="w-5 h-5"
                            checked={postType === "write"}
                            onChange={() => setPostType("write")}
                          />
                          <span className="font-bold">
                            Original Content (작성)
                          </span>
                        </div>
                      </label>
                      <label
                        className={`flex-1 p-4 rounded-xl border-2 cursor-pointer transition-all ${postType === "forward" ? "border-orange-500 bg-orange-50 text-orange-700" : "border-gray-200 hover:border-gray-300"}`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="radio"
                            className="w-5 h-5"
                            checked={postType === "forward"}
                            onChange={() => setPostType("forward")}
                          />
                          <span className="font-bold">Forwarding (포워딩)</span>
                        </div>
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      텔레그램 링크 (여러 개 입력 가능)
                    </label>
                    <textarea
                      value={inputLinks}
                      onChange={(e) => setInputLinks(e.target.value)}
                      placeholder={`t.me/channelA/101\nt.me/channelB/202`}
                      className="w-full h-48 p-4 border rounded-xl outline-none resize-none font-mono text-sm leading-relaxed"
                    />
                  </div>

                  <button
                    onClick={handleBulkSubmit}
                    disabled={loading}
                    className="w-full py-4 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all"
                  >
                    {loading
                      ? "처리 중..."
                      : `등록하기 (${submitDate ? submitDate : "오늘"})`}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: 채널 관리 */}
          {activeTab === "channels" && (
            <div className="space-y-8">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-800 text-white">
                    <tr>
                      <th className="px-6 py-4">Tier</th>
                      <th className="px-6 py-4">Channel Info</th>
                      <th className="px-6 py-4">Stats</th>
                      <th className="px-6 py-4">Wallet</th>
                      <th className="px-6 py-4 text-right">Price (W/F)</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4 text-center">Edit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {channels.map((ch, idx) => {
                      const prevTier = idx > 0 ? channels[idx - 1].tier : null;
                      const isNewTier = prevTier !== ch.tier;
                      return (
                        <tr
                          key={ch.id}
                          className={`${getTierStyle(ch.tier)} ${isNewTier && idx !== 0 ? "border-t-[3px] border-gray-300" : "border-b border-gray-100"} ${!ch.is_active ? "opacity-60 grayscale" : ""}`}
                        >
                          <td className="px-6 py-4">
                            <span
                              className={`px-2 py-1 rounded text-xs font-bold border ${getTierBadgeColor(ch.tier)}`}
                            >
                              {ch.tier}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="font-bold flex items-center gap-2">
                              {ch.channel_name}
                            </div>
                            <div className="text-xs text-gray-500">
                              @{ch.username}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="bg-white/50 px-2 py-1 rounded border border-gray-200 text-xs">
                              👥 {ch.subscriber}
                            </span>
                          </td>
                          <td
                            className="px-6 py-4 font-mono text-xs text-gray-500 max-w-[100px] truncate"
                            title={ch.wallet_address}
                          >
                            {ch.wallet_address || "-"}
                          </td>
                          <td className="px-6 py-4 text-right font-bold">
                            ${ch.price_write} / ${ch.price_forward}
                          </td>
                          {/* [New] Status Column */}
                          <td className="px-6 py-4 text-xs text-gray-500 truncate max-w-[150px]">
                            {ch.memo}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <button
                              onClick={() => openEditModal(ch)}
                              className="px-3 py-1 bg-white border border-gray-300 rounded hover:bg-gray-100 text-xs font-bold text-gray-700"
                            >
                              수정
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* 채널 추가 폼 */}
              <div className="bg-white p-6 rounded-xl border border-gray-200">
                <h3 className="font-bold mb-4">🆕 신규 채널 등록</h3>
                <div className="grid grid-cols-6 gap-3 text-sm items-end">
                  {/* items-end: 라벨이 추가되어 높이가 달라져도 입력창 라인을 맞춤 */}
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">
                      Tier
                    </label>
                    <input
                      className="w-full p-2 border rounded"
                      placeholder="A+"
                      value={newChannel.tier}
                      onChange={(e) =>
                        setNewChannel({ ...newChannel, tier: e.target.value })
                      }
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-gray-500 mb-1">
                      채널명
                    </label>
                    <input
                      className="w-full p-2 border rounded"
                      placeholder="채널 이름"
                      value={newChannel.channel_name}
                      onChange={(e) =>
                        setNewChannel({
                          ...newChannel,
                          channel_name: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="col-span-3">
                    <label className="block text-xs font-bold text-gray-500 mb-1">
                      링크
                    </label>
                    <input
                      className="w-full p-2 border rounded"
                      placeholder="https://t.me/..."
                      value={newChannel.channel_link}
                      onChange={(e) =>
                        setNewChannel({
                          ...newChannel,
                          channel_link: e.target.value,
                        })
                      }
                    />
                  </div>
                  {/* [수정] 단가 입력 부분: 라벨 추가로 0이 표시되어도 헷갈리지 않게 함 */}
                  <div>
                    <label className="block text-xs font-bold text-blue-600 mb-1">
                      작성 단가 ($)
                    </label>
                    <input
                      className="w-full p-2 border rounded font-bold text-right"
                      placeholder="0"
                      type="number"
                      value={newChannel.price_write}
                      onChange={(e) =>
                        setNewChannel({
                          ...newChannel,
                          price_write: +e.target.value,
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-orange-600 mb-1">
                      Fwd 단가 ($)
                    </label>
                    <input
                      className="w-full p-2 border rounded font-bold text-right"
                      placeholder="0"
                      type="number"
                      value={newChannel.price_forward}
                      onChange={(e) =>
                        setNewChannel({
                          ...newChannel,
                          price_forward: +e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="col-span-3">
                    <label className="block text-xs font-bold text-gray-500 mb-1">
                      지갑주소
                    </label>
                    <input
                      className="w-full p-2 border rounded font-mono"
                      placeholder="0x..."
                      value={newChannel.wallet_address}
                      onChange={(e) =>
                        setNewChannel({
                          ...newChannel,
                          wallet_address: e.target.value,
                        })
                      }
                    />
                  </div>
                  {/* 신규 등록 시 Active 체크박스 */}
                  <div className="col-span-1 flex items-center gap-2 h-10">
                    <input
                      type="checkbox"
                      id="new_active"
                      checked={newChannel.is_active}
                      onChange={(e) =>
                        setNewChannel({
                          ...newChannel,
                          is_active: e.target.checked,
                        })
                      }
                      className="w-4 h-4"
                    />
                    <label
                      htmlFor="new_active"
                      className="font-bold text-gray-700"
                    >
                      Active
                    </label>
                  </div>
                  <div className="col-span-5 flex justify-end">
                    <button
                      onClick={handleAddChannel}
                      className="bg-gray-900 text-white rounded font-bold px-6 py-2 hover:bg-black transition-colors"
                    >
                      등록
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* --- 수정 모달 (Edit Channel Modal) --- */}
      {isEditModalOpen && editingChannel && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white w-full max-w-2xl rounded-xl shadow-2xl p-8 max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-6">채널 정보 수정</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">
                  Tier
                </label>
                <input
                  className="w-full p-2 border rounded"
                  value={editingChannel.tier}
                  onChange={(e) =>
                    setEditingChannel({
                      ...editingChannel,
                      tier: e.target.value,
                    })
                  }
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">
                  구독자 수
                </label>
                <input
                  className="w-full p-2 border rounded"
                  value={editingChannel.subscriber}
                  onChange={(e) =>
                    setEditingChannel({
                      ...editingChannel,
                      subscriber: e.target.value,
                    })
                  }
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-bold text-gray-500 mb-1">
                  채널명
                </label>
                <input
                  className="w-full p-2 border rounded"
                  value={editingChannel.channel_name}
                  onChange={(e) =>
                    setEditingChannel({
                      ...editingChannel,
                      channel_name: e.target.value,
                    })
                  }
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-bold text-gray-500 mb-1">
                  채널 링크
                </label>
                <input
                  className="w-full p-2 border rounded"
                  value={editingChannel.channel_link}
                  onChange={(e) =>
                    setEditingChannel({
                      ...editingChannel,
                      channel_link: e.target.value,
                    })
                  }
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">
                  작성 단가 ($)
                </label>
                <input
                  type="number"
                  className="w-full p-2 border rounded"
                  value={editingChannel.price_write}
                  onChange={(e) =>
                    setEditingChannel({
                      ...editingChannel,
                      price_write: Number(e.target.value),
                    })
                  }
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">
                  포워딩 단가 ($)
                </label>
                <input
                  type="number"
                  className="w-full p-2 border rounded"
                  value={editingChannel.price_forward}
                  onChange={(e) =>
                    setEditingChannel({
                      ...editingChannel,
                      price_forward: Number(e.target.value),
                    })
                  }
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-bold text-gray-500 mb-1">
                  지갑 주소
                </label>
                <input
                  className="w-full p-2 border rounded font-mono"
                  value={editingChannel.wallet_address}
                  onChange={(e) =>
                    setEditingChannel({
                      ...editingChannel,
                      wallet_address: e.target.value,
                    })
                  }
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-bold text-gray-500 mb-1">
                  비고
                </label>
                <input
                  className="w-full p-2 border rounded"
                  value={editingChannel.memo}
                  onChange={(e) =>
                    setEditingChannel({
                      ...editingChannel,
                      memo: e.target.value,
                    })
                  }
                />
              </div>

              {/* [New] Active Status Toggle */}
              <div className="col-span-2 bg-gray-50 p-4 rounded-lg flex items-center justify-between border border-gray-100 mt-2">
                <span className="font-bold text-gray-700">
                  채널 운영 상태 (Active)
                </span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={editingChannel.is_active}
                    onChange={(e) =>
                      setEditingChannel({
                        ...editingChannel,
                        is_active: e.target.checked,
                      })
                    }
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-8">
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="px-5 py-2.5 rounded-lg border border-gray-300 font-bold text-gray-600 hover:bg-gray-100"
              >
                취소
              </button>
              <button
                onClick={handleUpdateChannel}
                className="px-5 py-2.5 rounded-lg bg-blue-600 font-bold text-white hover:bg-blue-700"
              >
                저장하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- [New] 정산 내역 수정 모달 (Settlement Edit Modal) --- */}
      {isSettlementEditOpen && editingSettlement && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white w-full max-w-md rounded-xl shadow-2xl p-6">
            <h2 className="text-xl font-bold mb-4">정산 내역 수정</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-600 mb-1">
                  날짜 변경
                </label>
                <input
                  type="date"
                  className="w-full p-2 border rounded"
                  value={editingSettlement.created_at}
                  onChange={(e) =>
                    setEditingSettlement({
                      ...editingSettlement,
                      created_at: e.target.value,
                    })
                  }
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-600 mb-1">
                  작업 유형
                </label>
                <select
                  className="w-full p-2 border rounded"
                  value={editingSettlement.post_type}
                  onChange={(e) =>
                    setEditingSettlement({
                      ...editingSettlement,
                      post_type: e.target.value as "write" | "forward",
                    })
                  }
                >
                  <option value="write">Original (작성)</option>
                  <option value="forward">Forward (포워딩)</option>
                </select>
                <p className="text-xs text-gray-400 mt-1">
                  * 유형 변경 시 해당 채널의 현재 단가로 금액이 자동 업데이트
                  됩니다.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setIsSettlementEditOpen(false)}
                className="px-4 py-2 text-sm font-bold text-gray-500 hover:bg-gray-100 rounded"
              >
                취소
              </button>
              <button
                onClick={handleUpdateSettlement}
                className="px-4 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded"
              >
                수정 완료
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
