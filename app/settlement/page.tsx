"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import {
  ChartBarIcon,
  RocketLaunchIcon,
  Cog6ToothIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClipboardDocumentIcon,
  PencilSquareIcon,
  PlusCircleIcon,
  PaperAirplaneIcon,
  MegaphoneIcon,
  DocumentArrowDownIcon,
} from "@heroicons/react/24/outline";
import jsPDF from "jspdf";

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
  owner_username?: string; // [New] 소유주 개인 아이디 (DM용)
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
    owner_username?: string; // [New] 소유주 아이디 추가
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
  owner_username?: string; // [New]
  details: Settlement[];
};

type MonthlySettlementStatus = {
  year: number;
  month: number;
  is_closed: boolean;
  closed_at: string | null;
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
    "submit" | "dashboard" | "channels" | "request"
  >("dashboard");

  const [isMonthClosed, setIsMonthClosed] = useState(false); // [New]
  const [channels, setChannels] = useState<Channel[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [summary, setSummary] = useState<MonthlySummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [channelUsageMap, setChannelUsageMap] = useState<Map<number, number>>(new Map());
  const [expandedChannelId, setExpandedChannelId] = useState<number | null>(
    null,
  );

  // --- 날짜 필터 (조회용) ---
  const [selectedDate, setSelectedDate] = useState(new Date());

  // --- 링크 등록 폼 상태 ---
  const [inputLinks, setInputLinks] = useState("");
  const [postType, setPostType] = useState<"write" | "forward">("write");
  const [submitDate, setSubmitDate] = useState(""); // 등록 날짜 (빈값이면 오늘)
  const [toastMessage, setToastMessage] = useState<string | null>(null); // [New] Toast Message State

  // --- 컨텐츠 요청 상태 ---
  const [requestLink, setRequestLink] = useState("");
  const [selectedKolIds, setSelectedKolIds] = useState<number[]>([]);
  const [requestType, setRequestType] = useState<"write" | "forward">("write");
  const [requestSort, setRequestSort] = useState<"tier" | "usage_asc" | "usage_desc">("tier");
  const [requestUsageFilter, setRequestUsageFilter] = useState<"all" | "0" | "lt5" | "lt10">("all");
  const [requestCustomMsg, setRequestCustomMsg] = useState("");

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

  // PDF 공유 모달 상태
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [pdfEmail, setPdfEmail] = useState("");
  const [pdfLoading, setPdfLoading] = useState(false);

  // [New] 정산 내역 수정 모달 상태
  const [isSettlementEditOpen, setIsSettlementEditOpen] = useState(false);
  const [editingSettlement, setEditingSettlement] = useState<{
    id: number;
    post_type: "write" | "forward";
    created_at: string;
    price_write: number; // 단가 재계산을 위해 필요
    price_forward: number;
    link_url: string; // [New] 링크 수정
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
        `*, kol_channels (channel_name, username, tier, price_write, price_forward, owner_username)`,
      )
      .gte("created_at", startDate)
      .lte("created_at", endDate)
      .order("created_at", { ascending: false });

    if (stData) {
      const rawSettlements = stData as any[];
      setSettlements(rawSettlements);
      processSummary(rawSettlements);
    }

    // 3. [New] 월별 마감 상태 확인
    const { data: monthData } = await supabase
      .from("monthly_settlements")
      .select("*")
      .eq("year", year)
      .eq("month", month)
      .single();

    setIsMonthClosed(monthData?.is_closed ?? false);

    // 4. 채널별 전체 사용 횟수 조회 (전체 기간)
    const { data: usageData } = await supabase
      .from("kol_settlements")
      .select("channel_id");

    if (usageData) {
      const usageMap = new Map<number, number>();
      usageData.forEach((row: any) => {
        usageMap.set(row.channel_id, (usageMap.get(row.channel_id) || 0) + 1);
      });
      setChannelUsageMap(usageMap);
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
          owner_username: item.kol_channels.owner_username, // [New]
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

  // [New] 정산 마감 토글
  const toggleSettleStatus = async () => {
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth() + 1;
    const newStatus = !isMonthClosed;

    const { error } = await supabase.from("monthly_settlements").upsert(
      {
        year,
        month,
        is_closed: newStatus,
        closed_at: newStatus ? new Date().toISOString() : null,
      },
      { onConflict: "year, month" },
    );

    if (error) {
      alert("상태 변경 실패: " + error.message);
    } else {
      setIsMonthClosed(newStatus);
      alert(newStatus ? "정산이 마감되었습니다." : "마감이 해제되었습니다.");
    }
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

    // [New] 마감된 월인지 확인
    const tDate = new Date(targetDate);
    const tYear = tDate.getFullYear();
    const tMonth = tDate.getMonth() + 1;

    const { data: monthStatus } = await supabase
      .from("monthly_settlements")
      .select("is_closed")
      .eq("year", tYear)
      .eq("month", tMonth)
      .single();

    if (monthStatus?.is_closed) {
      alert(`[차단됨] ${tYear}년 ${tMonth}월은 정산이 마감되었습니다.`);
      setLoading(false);
      return;
    }

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
    // [New] 마감 체크
    if (isMonthClosed) {
      alert("마감된 월의 내역은 수정할 수 없습니다.");
      return;
    }

    // settlement 객체 안에 kol_channels 정보가 포함되어 있음 (fetchData 참고)
    setEditingSettlement({
      id: settlement.id,
      post_type: settlement.post_type,
      created_at: settlement.created_at.split("T")[0], // YYYY-MM-DD 형식으로 변환
      price_write: settlement.kol_channels.price_write,
      price_forward: settlement.kol_channels.price_forward,
      link_url: settlement.link_url, // [New]
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
        link_url: editingSettlement.link_url, // [New]
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

  // --- 기능: 컨텐츠 요청 전송 ---
  const activeChannels = channels.filter((ch) => ch.is_active && ch.owner_username);

  // 컨텐츠 요청 탭용: 필터링 + 정렬 적용
  const filteredRequestChannels = activeChannels
    .filter((ch) => {
      const count = channelUsageMap.get(ch.id) || 0;
      if (requestUsageFilter === "0") return count === 0;
      if (requestUsageFilter === "lt5") return count < 5;
      if (requestUsageFilter === "lt10") return count < 10;
      return true;
    })
    .sort((a, b) => {
      if (requestSort === "usage_asc") {
        return (channelUsageMap.get(a.id) || 0) - (channelUsageMap.get(b.id) || 0);
      }
      if (requestSort === "usage_desc") {
        return (channelUsageMap.get(b.id) || 0) - (channelUsageMap.get(a.id) || 0);
      }
      // tier (default)
      const scoreA = tierPriority[a.tier?.toUpperCase().trim()] || 99;
      const scoreB = tierPriority[b.tier?.toUpperCase().trim()] || 99;
      if (scoreA !== scoreB) return scoreA - scoreB;
      return a.channel_name.localeCompare(b.channel_name);
    });

  const toggleKolSelection = (id: number) => {
    setSelectedKolIds((prev) =>
      prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id],
    );
  };

  const toggleAllKols = () => {
    if (selectedKolIds.length === filteredRequestChannels.length) {
      setSelectedKolIds([]);
    } else {
      setSelectedKolIds(filteredRequestChannels.map((ch) => ch.id));
    }
  };

  const handleSendContentRequest = (channel: Channel) => {
    if (!requestLink.trim()) {
      alert("요청할 컨텐츠 링크를 입력해주세요.");
      return;
    }
    if (!channel.owner_username) {
      alert("소유주 아이디(owner_username)가 등록되지 않은 채널입니다.");
      return;
    }

    const ownerName = channel.channel_name;
    const typeLabel = requestType === "write" ? "작성" : "포워딩";
    const extra = requestCustomMsg.trim() ? `\n\n${requestCustomMsg.trim()}` : "";
    const msg = `${ownerName} 님 디스프레드 광고 컨텐츠 ${typeLabel} 요청 드립니다.\n\n${requestLink.trim()}${extra}\n\n감사합니다!`;

    const target = channel.owner_username.replace("@", "");
    const url = `https://t.me/${target}?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");
  };

  const handleBulkContentRequest = () => {
    if (!requestLink.trim()) {
      alert("요청할 컨텐츠 링크를 입력해주세요.");
      return;
    }
    if (selectedKolIds.length === 0) {
      alert("요청을 보낼 KOL을 선택해주세요.");
      return;
    }

    const selected = channels.filter((ch) => selectedKolIds.includes(ch.id));
    const noOwner = selected.filter((ch) => !ch.owner_username);

    if (noOwner.length > 0) {
      alert(
        `다음 채널은 소유주 아이디가 없어 전송이 불가합니다:\n${noOwner.map((ch) => ch.channel_name).join(", ")}`,
      );
    }

    const sendable = selected.filter((ch) => ch.owner_username);
    sendable.forEach((channel, idx) => {
      // 팝업 차단 방지를 위해 약간의 딜레이
      setTimeout(() => {
        handleSendContentRequest(channel);
      }, idx * 500);
    });
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

  // --- [New] 기능: 안내 메시지 복사 ---
  const handleCopyNotice = (item: MonthlySummary) => {
    const month = selectedDate.getMonth() + 1;
    const links = item.details.map((d) => d.link_url).join("\n");
    const msg = `${item.channel_name}님 ${month}월 중간정산 확인요청드립니다.
작성${item.write_count}건 포워딩 ${item.forward_count}건 총 ${item.total_amount}불
${links}`;

    navigator.clipboard.writeText(msg);
    // alert("정산 안내 메시지가 복사되었습니다."); // [Moved] Toast로 변경
    setToastMessage("복사가 완료되었습니다");
    setTimeout(() => setToastMessage(null), 3000);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // --- [New] 기능: 텔레그램 DM 바로가기 (Deep Link) ---
  const handleSendDM = (item: MonthlySummary) => {
    if (!item.owner_username) {
      alert("소유주 아이디(owner_username)가 등록되지 않은 채널입니다.");
      return;
    }

    const month = selectedDate.getMonth() + 1;
    const links = item.details.map((d) => d.link_url).join("\n");
    const msg = `${item.channel_name}님 ${month}월 중간정산 확인요청드립니다.
작성${item.write_count}건 포워딩 ${item.forward_count}건 총 ${item.total_amount}불
${links}`;

    // Deep Link 생성 (Web/App 모두 호환)
    const target = item.owner_username.replace("@", ""); // @ 제거
    const url = `https://t.me/${target}?text=${encodeURIComponent(msg)}`;

    // 새 창으로 열기 (팝업 차단 확인 필요할 수도 있음)
    window.open(url, "_blank");
  };

  // --- PDF 생성 ---
  const handleGeneratePdf = async () => {
    if (!pdfEmail.trim()) {
      alert("이메일을 입력해주세요.");
      return;
    }
    setPdfLoading(true);

    try {
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth(); // 210
      const pageHeight = doc.internal.pageSize.getHeight(); // 297

      // 한글 폰트 로드
      const fontRes = await fetch("/fonts/NotoSansKR-Regular.ttf");
      const fontBuf = await fontRes.arrayBuffer();
      const fontBase64 = btoa(
        new Uint8Array(fontBuf).reduce((data, byte) => data + String.fromCharCode(byte), ""),
      );
      doc.addFileToVFS("NotoSansKR-Regular.ttf", fontBase64);
      doc.addFont("NotoSansKR-Regular.ttf", "NotoSansKR", "normal");
      doc.setFont("NotoSansKR");

      // 티어별 RGB 색상 (채널관리 탭과 동일)
      const getTierColor = (tier: string): [number, number, number] => {
        const t = tier?.toUpperCase().trim() || "";
        if (t.includes("A")) return [185, 28, 28];   // red-700
        if (t.includes("B")) return [161, 98, 7];     // yellow-800
        if (t.includes("C")) return [21, 128, 61];    // green-700
        return [75, 85, 99];                           // gray-600
      };

      // 워터마크 함수
      const addWatermark = () => {
        doc.saveGraphicsState();
        doc.setTextColor(200, 200, 200);
        doc.setFontSize(16);
        doc.setFont("NotoSansKR");
        for (let y = -pageHeight; y < pageHeight * 2; y += 40) {
          for (let x = -pageWidth; x < pageWidth * 2; x += 120) {
            doc.text(pdfEmail.trim(), x, y, { angle: -35 });
          }
        }
        doc.restoreGraphicsState();
      };

      // 활성 채널만
      const activeChList = channels.filter((ch) => ch.is_active);

      // PDF 뷰어 이메일 자동감지 방지: @뒤에 zero-width space 삽입
      const breakAtSign = (s: string) => s.replace(/@/g, "@\u200B");

      // 테이블 헤더 그리기 함수 (Subscriber 줄이고 Channel Link 넓힘)
      const colX = [14, 30, 110, 145, 165];
      const colLabels = ["Tier", "Channel", "Owner", "Subs", "Channel Link"];

      const drawTableHeader = (y: number) => {
        doc.setFontSize(8);
        doc.setTextColor(0, 0, 0);
        doc.setFont("NotoSansKR");
        colLabels.forEach((label, i) => {
          doc.text(label, colX[i], y);
        });
        doc.setDrawColor(200, 200, 200);
        doc.line(14, y + 2, pageWidth - 14, y + 2);
        return y + 8;
      };

      // 첫 페이지 헤더
      addWatermark();
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(18);
      doc.setFont("NotoSansKR");
      doc.text("DeSpread KOL listup", 14, 18);
      doc.setFontSize(9);
      doc.setTextColor(60, 60, 60);
      doc.text(`Generated: ${new Date().toLocaleDateString("ko-KR")} | For: ${pdfEmail.trim()}`, 14, 24);

      let curY = drawTableHeader(34);

      // 데이터 행
      doc.setFontSize(8);
      for (const ch of activeChList) {
        if (curY > pageHeight - 15) {
          doc.addPage();
          addWatermark();
          doc.setFont("NotoSansKR");
          curY = drawTableHeader(18);
          doc.setFontSize(8);
        }

        // Tier (색상 적용)
        const [tr, tg, tb] = getTierColor(ch.tier);
        doc.setTextColor(tr, tg, tb);
        doc.setFont("NotoSansKR");
        doc.text(ch.tier || "-", colX[0], curY);

        // Channel (breakAtSign으로 이메일 자동감지 방지)
        doc.setTextColor(0, 0, 0);
        const chInfo = breakAtSign(`${ch.channel_name} (@${ch.username})`);
        doc.text(chInfo.length > 32 ? chInfo.substring(0, 32) + "..." : chInfo, colX[1], curY);

        // Owner
        const ownerText = ch.owner_username ? breakAtSign(`@${ch.owner_username.replace("@", "")}`) : "-";
        doc.text(ownerText, colX[2], curY);

        // Subscriber
        doc.text(String(ch.subscriber || "-"), colX[3], curY);

        // Channel Link (클릭 시 해당 채널로 이동)
        const rawLink = ch.channel_link || `https://t.me/${ch.username}`;
        const fullUrl = rawLink.startsWith("http") ? rawLink : `https://${rawLink}`;
        const linkDisplay = rawLink.replace(/^https?:\/\//, "");
        const linkTruncated = linkDisplay.length > 30 ? linkDisplay.substring(0, 30) + "..." : linkDisplay;
        doc.setTextColor(37, 99, 235); // blue-600
        doc.textWithLink(linkTruncated, colX[4], curY, { url: fullUrl });
        doc.setTextColor(0, 0, 0);

        curY += 7;
      }

      doc.save(`KOL_Channels_${pdfEmail.trim()}.pdf`);
      setIsPdfModalOpen(false);
      setPdfEmail("");
    } catch (e: any) {
      alert("PDF 생성 실패: " + e.message);
    } finally {
      setPdfLoading(false);
    }
  };

  return (
    <div className="bg-[#F3F4F6] min-h-screen pb-20 relative">
      <div className="max-w-7xl mx-auto p-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-gray-200 pb-6">
          <div>
            <h1 className="text-4xl font-black text-gray-900 tracking-tight mb-1">
              KOL Settlement
            </h1>
            <p className="text-gray-500 text-sm font-medium">
              텔레그램 KOL 월별 정산 대시보드
            </p>
          </div>
          <div className="flex items-center gap-4">
            {/* [New] 마감 버튼 */}
            <button
              onClick={toggleSettleStatus}
              className={`px-4 py-2 rounded-lg font-bold text-sm transition-colors shadow-sm border ${
                isMonthClosed
                  ? "bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200"
                  : "bg-red-50 text-red-600 border-red-100 hover:bg-red-100"
              }`}
            >
              {isMonthClosed ? "🔒 마감 해제" : "✅ 정산 마감"}
            </button>

            <div className="flex items-center bg-white rounded-xl border border-gray-200 shadow-glass px-2 py-1">
              <button
                onClick={() => moveMonth(-1)}
                className="p-2 hover:bg-gray-100 rounded text-gray-500"
              >
                <ChevronLeftIcon className="w-5 h-5" />
              </button>
              <span className="px-4 font-bold text-gray-800 min-w-[100px] text-center">
                {formatMonth(selectedDate)}
              </span>
              <button
                onClick={() => moveMonth(1)}
                className="p-2 hover:bg-gray-100 rounded text-gray-500"
              >
                <ChevronRightIcon className="w-5 h-5" />
              </button>
            </div>
            <div className="bg-white px-6 py-3 rounded-lg border border-gray-200 shadow-glass text-right min-w-[200px]">
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
        <div className="flex items-center justify-between">
          <div className="bg-white p-1.5 rounded-xl border border-gray-200 inline-flex shadow-glass">
            {[
              { id: "dashboard", label: "정산 요약", Icon: ChartBarIcon },
              { id: "submit", label: "링크 등록", Icon: RocketLaunchIcon },
              { id: "request", label: "컨텐츠 요청", Icon: MegaphoneIcon },
              { id: "channels", label: "채널 관리", Icon: Cog6ToothIcon },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-5 py-2.5 text-sm font-bold rounded-md transition-all duration-200 flex items-center gap-1.5 ${
                  activeTab === tab.id
                    ? "bg-[#0037F0] text-white shadow-brand-glow"
                    : "text-gray-500 hover:text-gray-900 hover:bg-gray-100"
                }`}
              >
                <tab.Icon className="w-4 h-4 inline" />
                {tab.label}
              </button>
            ))}
          </div>
          {activeTab === "channels" && (
            <button
              onClick={() => setIsPdfModalOpen(true)}
              className="px-4 py-2.5 bg-white border border-gray-300 rounded-lg font-bold text-sm text-gray-700 hover:bg-gray-100 transition-colors shadow-sm flex items-center gap-1.5"
            >
              <DocumentArrowDownIcon className="w-4 h-4" />
              공유 (PDF)
            </button>
          )}
        </div>

        <div className="transition-all duration-300">
          {/* TAB 1: 정산 요약 */}
          {activeTab === "dashboard" && (
            <div className="bg-white rounded-lg border border-gray-200 shadow-glass overflow-hidden">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 text-gray-600 font-bold uppercase text-xs">
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
                            {item.wallet_address && (
                              <ClipboardDocumentIcon className="w-3 h-3" />
                            )}
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
                          <div className="flex flex-col gap-1 items-center">
                            <button
                              onClick={() => handleCopyNotice(item)}
                              className="text-white bg-blue-500 hover:bg-blue-600 px-2 py-1 rounded text-xs font-bold transition-colors mb-1"
                            >
                              안내복사
                            </button>
                            {/* [New] 전송(DM) 버튼 */}
                            <button
                              onClick={() => handleSendDM(item)}
                              className={`px-2 py-1 rounded text-xs font-bold transition-colors mb-1 flex items-center gap-1 ${
                                item.owner_username
                                  ? "text-white bg-green-500 hover:bg-green-600"
                                  : "text-gray-400 bg-gray-200 cursor-not-allowed"
                              }`}
                              title={
                                item.owner_username
                                  ? "텔레그램 앱 열기"
                                  : "소유주 아이디 미등록"
                              }
                            >
                              <PaperAirplaneIcon className="w-3 h-3" />
                              전송
                            </button>
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
                          </div>
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
                                {item.channel_name} -{" "}
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
              <div className="bg-white rounded-lg border border-gray-200 shadow-glass overflow-hidden">
                <div className="bg-[#0037F0] px-6 py-4">
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <PencilSquareIcon className="w-5 h-5 inline" />
                    작업 등록 (Bulk Upload)
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
                      className="w-full p-3 bg-white border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0037F0]/30 outline-none border"
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
                      className="w-full h-48 p-4 bg-white border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0037F0]/30 outline-none resize-none font-mono text-sm leading-relaxed border"
                    />
                  </div>

                  <button
                    onClick={handleBulkSubmit}
                    disabled={loading}
                    className="w-full py-4 bg-[#0037F0] text-white font-bold rounded-lg shadow-brand-glow hover:bg-blue-700 transition-all"
                  >
                    {loading
                      ? "처리 중..."
                      : `등록하기 (${submitDate ? submitDate : "오늘"})`}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: 컨텐츠 요청 */}
          {activeTab === "request" && (
            <div className="max-w-4xl mx-auto space-y-6">
              {/* 링크 입력 */}
              <div className="bg-white rounded-lg border border-gray-200 shadow-glass overflow-hidden">
                <div className="bg-[#0037F0] px-6 py-4">
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <MegaphoneIcon className="w-5 h-5 inline" />
                    컨텐츠 요청 전송
                  </h2>
                </div>
                <div className="p-6 space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      요청할 컨텐츠 링크
                    </label>
                    <input
                      type="text"
                      className="w-full p-3 bg-white border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0037F0]/30 outline-none border font-mono text-sm"
                      placeholder="https://t.me/... 또는 컨텐츠 URL"
                      value={requestLink}
                      onChange={(e) => setRequestLink(e.target.value)}
                    />
                  </div>

                  {/* 요청 유형 선택 */}
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      요청 유형
                    </label>
                    <div className="flex gap-4">
                      <label
                        className={`flex-1 p-4 rounded-xl border-2 cursor-pointer transition-all ${requestType === "write" ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 hover:border-gray-300"}`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="radio"
                            className="w-5 h-5"
                            checked={requestType === "write"}
                            onChange={() => setRequestType("write")}
                          />
                          <span className="font-bold">작성 요청 (Original)</span>
                        </div>
                      </label>
                      <label
                        className={`flex-1 p-4 rounded-xl border-2 cursor-pointer transition-all ${requestType === "forward" ? "border-orange-500 bg-orange-50 text-orange-700" : "border-gray-200 hover:border-gray-300"}`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="radio"
                            className="w-5 h-5"
                            checked={requestType === "forward"}
                            onChange={() => setRequestType("forward")}
                          />
                          <span className="font-bold">포워딩 요청 (Forward)</span>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* KOL 선택 리스트 */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-bold text-gray-700">
                        요청 대상 KOL 선택
                      </label>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-500">
                          {selectedKolIds.length}명 선택됨
                        </span>
                        <button
                          onClick={toggleAllKols}
                          className="text-xs font-bold text-blue-600 hover:text-blue-800"
                        >
                          {selectedKolIds.length === filteredRequestChannels.length
                            ? "전체 해제"
                            : "전체 선택"}
                        </button>
                      </div>
                    </div>

                    {/* 정렬 + 필터 컨트롤 */}
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className="text-xs font-bold text-gray-500">정렬:</span>
                      {[
                        { value: "tier", label: "티어순" },
                        { value: "usage_asc", label: "사용 적은순" },
                        { value: "usage_desc", label: "사용 많은순" },
                      ].map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => setRequestSort(opt.value as any)}
                          className={`px-2.5 py-1 rounded-full text-xs font-bold transition-colors ${
                            requestSort === opt.value
                              ? "bg-[#0037F0] text-white"
                              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                      <span className="text-gray-300 mx-1">|</span>
                      <span className="text-xs font-bold text-gray-500">필터:</span>
                      {[
                        { value: "all", label: "전체" },
                        { value: "0", label: "0회 (미사용)" },
                        { value: "lt5", label: "5회 미만" },
                        { value: "lt10", label: "10회 미만" },
                      ].map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => setRequestUsageFilter(opt.value as any)}
                          className={`px-2.5 py-1 rounded-full text-xs font-bold transition-colors ${
                            requestUsageFilter === opt.value
                              ? "bg-orange-500 text-white"
                              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                      <span className="text-xs text-gray-400 ml-auto">
                        {filteredRequestChannels.length}개 채널
                      </span>
                    </div>

                    <div className="border border-gray-200 rounded-xl max-h-[400px] overflow-y-auto divide-y divide-gray-100">
                      {filteredRequestChannels.length === 0 && (
                        <div className="p-8 text-center text-gray-400 text-sm">
                          {activeChannels.length === 0
                            ? "owner_username이 등록된 활성 채널이 없습니다."
                            : "해당 필터 조건에 맞는 채널이 없습니다."}
                        </div>
                      )}
                      {filteredRequestChannels.map((ch) => {
                        const usageCount = channelUsageMap.get(ch.id) || 0;
                        const usageColor = usageCount === 0
                          ? "bg-gray-100 text-gray-400"
                          : usageCount < 5
                            ? "bg-red-100 text-red-600"
                            : usageCount < 10
                              ? "bg-yellow-100 text-yellow-700"
                              : "bg-green-100 text-green-700";
                        return (
                          <div
                            key={ch.id}
                            className={`flex items-center justify-between px-4 py-3 hover:bg-blue-50 transition-colors cursor-pointer ${
                              selectedKolIds.includes(ch.id) ? "bg-blue-50" : ""
                            }`}
                            onClick={() => toggleKolSelection(ch.id)}
                          >
                            <div className="flex items-center gap-3">
                              <input
                                type="checkbox"
                                className="w-4 h-4 rounded"
                                checked={selectedKolIds.includes(ch.id)}
                                onChange={() => toggleKolSelection(ch.id)}
                                onClick={(e) => e.stopPropagation()}
                              />
                              <div>
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`px-1.5 py-0.5 rounded text-xs font-bold border ${getTierBadgeColor(ch.tier)}`}
                                  >
                                    {ch.tier}
                                  </span>
                                  <span className="font-bold text-gray-900 text-sm">
                                    {ch.channel_name}
                                  </span>
                                  <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${usageColor}`}>
                                    {usageCount}회
                                  </span>
                                </div>
                                <div className="text-xs text-gray-500 mt-0.5">
                                  @{ch.username} · 소유주: @{ch.owner_username?.replace("@", "")}
                                </div>
                              </div>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSendContentRequest(ch);
                              }}
                              className="px-3 py-1.5 rounded text-xs font-bold text-white bg-green-500 hover:bg-green-600 transition-colors flex items-center gap-1"
                            >
                              <PaperAirplaneIcon className="w-3 h-3" />
                              개별전송
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* 추가 메시지 입력 + 미리보기 */}
                  {requestLink.trim() && (
                    <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 space-y-3">
                      <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">
                          추가 메시지 (선택)
                        </label>
                        <textarea
                          className="w-full p-3 bg-white border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0037F0]/30 outline-none border text-sm resize-none"
                          rows={2}
                          placeholder="추가할 내용을 입력하세요 (링크 아래에 삽입됩니다)"
                          value={requestCustomMsg}
                          onChange={(e) => setRequestCustomMsg(e.target.value)}
                        />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-gray-500 mb-1">
                          메시지 미리보기
                        </p>
                        <div className="text-sm text-gray-700 whitespace-pre-line bg-white rounded-lg p-3 border border-gray-100">
                          {`[채널명] 님 디스프레드 광고 컨텐츠 ${requestType === "write" ? "작성" : "포워딩"} 요청 드립니다.\n\n${requestLink.trim()}${requestCustomMsg.trim() ? `\n\n${requestCustomMsg.trim()}` : ""}\n\n감사합니다!`}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 일괄 전송 버튼 */}
                  <button
                    onClick={handleBulkContentRequest}
                    disabled={!requestLink.trim() || selectedKolIds.length === 0}
                    className={`w-full py-4 font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
                      requestLink.trim() && selectedKolIds.length > 0
                        ? "bg-green-500 text-white shadow-lg hover:bg-green-600"
                        : "bg-gray-200 text-gray-400 cursor-not-allowed"
                    }`}
                  >
                    <PaperAirplaneIcon className="w-5 h-5" />
                    선택된 {selectedKolIds.length}명에게 일괄 전송
                  </button>
                  <p className="text-xs text-gray-400 text-center">
                    * 각 KOL의 텔레그램 DM 창이 순차적으로 열립니다. 팝업 허용이 필요할 수 있습니다.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: 채널 관리 */}
          {activeTab === "channels" && (
            <div className="space-y-8">
              <div className="bg-white rounded-lg border border-gray-200 shadow-glass overflow-hidden">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50 text-gray-600 font-bold uppercase text-xs">
                    <tr>
                      <th className="px-6 py-4">Tier</th>
                      <th className="px-6 py-4">Channel Info</th>
                      <th className="px-6 py-4">Stats</th>
                      <th className="px-6 py-4 text-center">Usage</th>
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
                            {ch.owner_username && (
                              <a
                                href={`https://t.me/${ch.owner_username.replace("@", "")}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-1 mt-0.5"
                              >
                                <PaperAirplaneIcon className="w-3 h-3" />
                                Owner: @{ch.owner_username.replace("@", "")}
                              </a>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <span className="bg-white px-2 py-1 rounded border border-gray-200 text-xs">
                              👥 {ch.subscriber}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            {(() => {
                              const count = channelUsageMap.get(ch.id) || 0;
                              const color = count === 0
                                ? "bg-gray-100 text-gray-400"
                                : count < 5
                                  ? "bg-red-100 text-red-600"
                                  : count < 10
                                    ? "bg-yellow-100 text-yellow-700"
                                    : "bg-green-100 text-green-700";
                              return (
                                <span className={`px-2 py-1 rounded text-xs font-bold ${color}`}>
                                  {count}회
                                </span>
                              );
                            })()}
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
              <div className="glass-card p-6">
                <h3 className="font-bold mb-4 flex items-center gap-2">
                  <PlusCircleIcon className="w-5 h-5 inline" />
                  신규 채널 등록
                </h3>
                <div className="grid grid-cols-6 gap-3 text-sm items-end">
                  {/* items-end: 라벨이 추가되어 높이가 달라져도 입력창 라인을 맞춤 */}
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">
                      Tier
                    </label>
                    <input
                      className="w-full p-2 bg-white border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0037F0]/30 outline-none border"
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
                      className="w-full p-2 bg-white border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0037F0]/30 outline-none border"
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
                      className="w-full p-2 bg-white border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0037F0]/30 outline-none border"
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
                      className="w-full p-2 bg-white border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0037F0]/30 outline-none border font-bold text-right"
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
                      className="w-full p-2 bg-white border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0037F0]/30 outline-none border font-bold text-right"
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
                      className="w-full p-2 bg-white border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0037F0]/30 outline-none border font-mono"
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
                      className="bg-[#0037F0] text-white rounded-lg shadow-brand-glow font-bold px-6 py-2 hover:bg-blue-700 transition-colors"
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
        <div className="fixed inset-0 glass-modal-backdrop flex items-center justify-center z-50">
          <div className="glass-modal w-full max-w-2xl p-8 max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-6">채널 정보 수정</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">
                  Tier
                </label>
                <input
                  className="w-full p-2 bg-white border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0037F0]/30 outline-none border"
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
                  className="w-full p-2 bg-white border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0037F0]/30 outline-none border"
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
                  className="w-full p-2 bg-white border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0037F0]/30 outline-none border"
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
                  className="w-full p-2 bg-white border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0037F0]/30 outline-none border"
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
                  className="w-full p-2 bg-white border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0037F0]/30 outline-none border"
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
                  className="w-full p-2 bg-white border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0037F0]/30 outline-none border"
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
                  className="w-full p-2 bg-white border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0037F0]/30 outline-none border font-mono"
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
                  className="w-full p-2 bg-white border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0037F0]/30 outline-none border"
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
        <div className="fixed inset-0 glass-modal-backdrop flex items-center justify-center z-50">
          <div className="glass-modal w-full max-w-md p-6">
            <h2 className="text-xl font-bold mb-4">정산 내역 수정</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-600 mb-1">
                  날짜 변경
                </label>
                <input
                  type="date"
                  className="w-full p-2 bg-white border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0037F0]/30 outline-none border"
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
                  className="w-full p-2 bg-white border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0037F0]/30 outline-none border"
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

              {/* [New] Link URL Edit */}
              <div>
                <label className="block text-sm font-bold text-gray-600 mb-1">
                  Link URL
                </label>
                <input
                  type="text"
                  className="w-full p-2 bg-white border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0037F0]/30 outline-none border font-mono text-xs"
                  value={editingSettlement.link_url}
                  onChange={(e) =>
                    setEditingSettlement({
                      ...editingSettlement,
                      link_url: e.target.value,
                    })
                  }
                />
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

      {/* --- PDF 공유 모달 --- */}
      {isPdfModalOpen && (
        <div className="fixed inset-0 glass-modal-backdrop flex items-center justify-center z-50">
          <div className="glass-modal w-full max-w-md p-6">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <DocumentArrowDownIcon className="w-5 h-5" />
              채널 리스트 PDF 공유
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              입력한 이메일이 워터마크로 삽입됩니다. 활성 채널만 포함되며 가격/지갑 정보는 제외됩니다.
            </p>
            <div>
              <label className="block text-sm font-bold text-gray-600 mb-1">
                수신자 이메일
              </label>
              <input
                type="email"
                className="w-full p-3 bg-white border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0037F0]/30 outline-none border"
                placeholder="example@company.com"
                value={pdfEmail}
                onChange={(e) => setPdfEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleGeneratePdf()}
              />
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => { setIsPdfModalOpen(false); setPdfEmail(""); }}
                className="px-4 py-2 text-sm font-bold text-gray-500 hover:bg-gray-100 rounded"
              >
                취소
              </button>
              <button
                onClick={handleGeneratePdf}
                disabled={pdfLoading || !pdfEmail.trim()}
                className={`px-4 py-2 text-sm font-bold text-white rounded flex items-center gap-1.5 ${
                  pdfLoading || !pdfEmail.trim()
                    ? "bg-gray-300 cursor-not-allowed"
                    : "bg-[#0037F0] hover:bg-blue-700"
                }`}
              >
                <DocumentArrowDownIcon className="w-4 h-4" />
                {pdfLoading ? "생성 중..." : "PDF 다운로드"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- [New] Toast Notification UI --- */}
      {toastMessage && (
        <div className="fixed bottom-10 left-1/2 transform -translate-x-1/2 z-50 animate-fade-in-up">
          <div className="bg-gray-800 text-white px-6 py-3 rounded-full shadow-lg flex items-center gap-2">
            <svg
              className="w-5 h-5 text-green-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            <span className="font-bold text-sm">{toastMessage}</span>
          </div>
        </div>
      )}
    </div>
  );
}
