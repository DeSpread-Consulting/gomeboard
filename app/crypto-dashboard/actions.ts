"use server";

import { createOracleClient } from "@/utils/supabase/oracle-server";

export interface ChartData {
  time: string;
  upbitPrice: number;
  binancePrice: number;
  premium: number;
}

export interface StockData {
  time: string;
  value1: number; // KOSPI or Samsung
  value2: number; // KOSDAQ or Hynix
}

export interface DashboardData {
  crypto: ChartData[];
  indices: StockData[]; // value1: KOSPI, value2: KOSDAQ
  majors: StockData[];  // value1: Samsung, value2: Hynix
}

export async function fetchDashboardData(date?: string): Promise<{ 
  data: DashboardData | null, 
  error: string | null 
}> {
  try {
    const supabase = await createOracleClient();

    // Determine Time Range
    // User input date is likely in KST context (e.g. 2026-01-30)
    // We need to query the DB which uses ISO timestamp (likely UTC).
    
    // Helper to get KST start/end ISO strings
    // Date string: "YYYY-MM-DD"
    const getRange = (dateStr: string) => {
        // Create date object in KST
        // Since we are running in environment where timezone might be UTC,
        // we manually construct ISO string with offset.
        // Actually, let's treat dateStr as local date for KST.
        // Start: T00:00:00+09:00
        // End:   T23:59:59+09:00
        
        // However, Supabase might expect UTC ISO string for comparison.
        // Let's assume input "2026-01-30"
        // Start KST: 2026-01-30 00:00:00 = 2026-01-29 15:00:00 UTC
        // End KST:   2026-01-30 23:59:59 = 2026-01-30 14:59:59 UTC
        
        const kstOffset = 9 * 60 * 60 * 1000;
        const targetDate = new Date(dateStr); // Local time? No, let's parse explicitly.
        
        // Naive parse: "2026-01-30" -> UTC 00:00
        // We want KST 00:00
        const y = parseInt(dateStr.split('-')[0]);
        const m = parseInt(dateStr.split('-')[1]) - 1;
        const d = parseInt(dateStr.split('-')[2]);
        
        const startKst = new Date(Date.UTC(y, m, d, 0, 0, 0) - kstOffset);
        const endKst = new Date(Date.UTC(y, m, d, 23, 59, 59) - kstOffset);
        
        return { 
            start: startKst.toISOString(), 
            end: endKst.toISOString() 
        };
    };

    let timeFilter = { start: "", end: "" };
    
    if (date) {
        timeFilter = getRange(date);
    } else {
        // Default to "Last 24 Hours" or "Today"? 
        // User request: "Select date... to view that day's data".
        // Default behavior: Let's show Today's data (from 00:00 KST to Now).
        const now = new Date();
        // Get KST YYYY-MM-DD
        const kstNow = new Date(now.getTime() + (9 * 60 * 60 * 1000));
        const todayStr = kstNow.toISOString().split('T')[0];
        timeFilter = getRange(todayStr);
    }

    // ... (previous code)
    
    // Debug Logging
    console.log("Date:", date || "Default Today", "TimeFilter:", timeFilter);

    // 1. Fetch Crypto Data
    let cryptoQuery = supabase
      .from("crypto_candle_feeds")
      .select("*")
      .eq("symbol", "BTC")
      .eq("timeframe", "1m")
      .gte("candle_time", timeFilter.start)
      .lte("candle_time", timeFilter.end)
      .order("candle_time", { ascending: true });
    // 2. Fetch Stock Data (Indices & Majors)




    // 2. Fetch Stock Data directly with separate queries to ensure no overlapping limits
    const indicesQuery = supabase
      .from("stock_candle_feeds")
      .select("*")
      .in("symbol", ["KOSPI", "KOSDAQ"])
      .gte("candle_time", timeFilter.start)
      .lte("candle_time", timeFilter.end)
      .order("candle_time", { ascending: true })
      .limit(5000);

    const majorsQuery = supabase
      .from("stock_candle_feeds")
      .select("*")
      .in("symbol", ["005930", "000660"])
      .gte("candle_time", timeFilter.start)
      .lte("candle_time", timeFilter.end)
      .order("candle_time", { ascending: true })
      .limit(5000);

    const [cryptoRes, indicesRes, majorsRes] = await Promise.all([cryptoQuery, indicesQuery, majorsQuery]);

    if (cryptoRes.error) throw new Error("Crypto Fetch Error: " + cryptoRes.error.message);
    if (indicesRes.error) throw new Error("Indices Fetch Error: " + indicesRes.error.message);
    if (majorsRes.error) throw new Error("Majors Fetch Error: " + majorsRes.error.message);

    // DEBUG: Analyze Majors Timestamps
    const majorRows = majorsRes.data || [];
    console.log("Majors Row Count:", majorRows.length);
    if (majorRows.length > 0) {
        // Count rows per UTC hour
        const hourDist = new Map<number, number>();
        majorRows.forEach(r => {
            const h = new Date(r.candle_time).getUTCHours();
            hourDist.set(h, (hourDist.get(h) || 0) + 1);
        });
        console.log("Majors UTC Hour Distribution:", Object.fromEntries(hourDist));
        console.log("Majors Sample Time:", majorRows[0].candle_time);
    }

    // --- Process Crypto ---
    const cryptoData = (cryptoRes.data || [])
      .map((item) => {
        const upbitKrw = Number(item.close_krw) || 0;
        const binanceUsd = Number(item.close_usd) || 0;
        const exchangeRate = Number(item.real_exchange_rate) || 1400;
        const upbitUsd = exchangeRate > 0 ? upbitKrw / exchangeRate : 0;
        const premium = item.kimp_close 
          ? Number(item.kimp_close)
          : binanceUsd > 0 
            ? ((upbitUsd - binanceUsd) / binanceUsd) * 100 
            : 0;

        return {
          time: new Date(item.candle_time).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Seoul' }),
          upbitPrice: upbitUsd,
          binancePrice: binanceUsd,
          premium: premium,
        };
      });

    // Helper to process stock rows into { time, value1, value2 }
    const processStockData = (rows: any[], sym1: string, sym2: string) => {
        const map = new Map<string, { v1: number | null, v2: number | null }>();
        
        rows.forEach(r => {
        // 1. KST 기준으로 시/분 추출 (Asia/Seoul 강제 지정)
        const kstTime = new Date(r.candle_time).toLocaleTimeString('en-GB', { 
            hour: '2-digit', 
            minute: '2-digit', 
            hour12: false, 
            timeZone: 'Asia/Seoul' 
        }); // 예: "09:30"

        // 2. 문자열로 직접 비교 (09:00 ~ 15:30)
        // DEBUG: Log first few timestamp conversions
        if (rows.indexOf(r) < 5) {
            console.log(`Debug Time: ${r.candle_time} -> KST: ${kstTime}`);
        }

        if (kstTime >= "09:00" && kstTime <= "15:30") {
            if (!map.has(r.candle_time)) {
                map.set(r.candle_time, { v1: null, v2: null });
            }
            const entry = map.get(r.candle_time)!;
            if (r.symbol === sym1) entry.v1 = Number(r.close);
            if (r.symbol === sym2) entry.v2 = Number(r.close);
        }
       });

        const sortedTimes = Array.from(map.keys()).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
        
        return sortedTimes.map(timeStr => {
            const entry = map.get(timeStr)!;
            return {
                time: new Date(timeStr).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Seoul' }),
                value1: entry.v1 || 0,
                value2: entry.v2 || 0
            };
        }).filter(d => d.value1 > 0 || d.value2 > 0);
    };

    const indicesData = processStockData(indicesRes.data || [], "KOSPI", "KOSDAQ");
    const majorsData = processStockData(majorsRes.data || [], "005930", "000660"); // Samsung, Hynix

    return { 
        data: {
            crypto: cryptoData,
            indices: indicesData,
            majors: majorsData
        }, 
        error: null 
    };

  } catch (err: any) {
    console.error("Dashboard Fetch Error:", err);
    return { data: null, error: err.message || "Internal Server Error" };
  }
}
