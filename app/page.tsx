"use client";

import { useState, useEffect, useCallback } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import Papa from "papaparse";

// 스프레드시트 ID
const SPREADSHEET_ID = "1hNuZ_4r69CQ7prjCXdFK3sXGX8jkzC1NH7PlYjXzmYg";

// 타입 정의
interface SurveyData {
  [key: string]: string;
}

interface ToolUsage {
  name: string;
  신입: number;
  기존: number;
}

interface GroupStats {
  total: number;
  rookie: number;
  veteran: number;
  paidRate전체: number;
}

interface TenureData {
  tenure: string;
  fullTenure: string;
  count: number;
  paidRate: number;
  avgPayment: number;
}

interface ConversionData {
  name: string;
  users: number;
  paid: number;
  rate: number;
}

interface PainPointData {
  category: string;
  count: number;
}

// 색상 정의
const COLORS = {
  rookie: "#6366f1",
  veteran: "#10b981",
  pie: ["#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#3b82f6"],
};

// 도구 목록
const TOOLS_대화형 = ["ChatGPT", "Claude", "Gemini", "뤼튼", "Copilot", "Perplexity"];
const TOOLS_코딩 = ["GitHub Copilot", "Cursor", "Google Colab", "Replit", "Claude Code"];
const TOOLS_이미지 = ["Midjourney", "DALL-E", "Stable Diffusion", "Canva AI", "Adobe Firefly"];

// 년차 순서 정의
const TENURE_ORDER = ["1년 미만", "1년 이상 ~ 5년 미만", "5년 이상 ~ 10년 미만", "10년 이상 ~ 15년 미만", "15년 이상"];
const TENURE_SHORT = ["~1년", "1-5년", "5-10년", "10-15년", "15년+"];

export default function Dashboard() {
  const [mounted, setMounted] = useState(false);
  const [data, setData] = useState<SurveyData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<string>("");
  const [showAllPainPoints, setShowAllPainPoints] = useState(false);
  const [insights, setInsights] = useState<string>("");
  const [insightsLoading, setInsightsLoading] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // 컬럼 찾기 함수 (개선됨)
  const findColumn = useCallback((columns: string[], keywords: string[]) => {
    for (const col of columns) {
      let matchCount = 0;
      for (const keyword of keywords) {
        if (col.includes(keyword)) matchCount++;
      }
      // 모든 키워드가 포함되어야 함
      if (matchCount === keywords.length) return col;
    }
    // 폴백: 하나라도 포함되면
    for (const col of columns) {
      for (const keyword of keywords) {
        if (col.includes(keyword)) return col;
      }
    }
    return null;
  }, []);

  // 체크박스 파싱 함수
  const parseCheckbox = useCallback((responses: string[]) => {
    const counter: { [key: string]: number } = {};
    const excludeKeywords = ["사용 안", "없음", "안 함", "해당"];

    responses.forEach((response) => {
      if (!response) return;
      const items = response.split(", ").map((s) => s.trim());
      items.forEach((item) => {
        if (!excludeKeywords.some((ex) => item.includes(ex))) {
          counter[item] = (counter[item] || 0) + 1;
        }
      });
    });

    return counter;
  }, []);

  // 그룹별 비율 계산
  const calcGroupPercentage = useCallback(
    (groupData: SurveyData[], column: string, tools: string[]) => {
      const n = groupData.length;
      if (n === 0) return tools.map(() => 0);

      const responses = groupData.map((d) => d[column] || "");
      const counter = parseCheckbox(responses);

      return tools.map((tool) => {
        let count = counter[tool] || 0;
        if (count === 0) {
          Object.keys(counter).forEach((key) => {
            if (key.toLowerCase().includes(tool.toLowerCase()) || 
                tool.toLowerCase().includes(key.toLowerCase())) {
              count = Math.max(count, counter[key]);
            }
          });
        }
        return Math.round((count / n) * 100);
      });
    },
    [parseCheckbox]
  );

  // 데이터 로드
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export?format=csv`;
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error("스프레드시트를 불러올 수 없습니다.");
      }

      const csvText = await response.text();

      Papa.parse(csvText, {
        header: true,
        complete: (results) => {
          const validData = (results.data as SurveyData[]).filter(d => d["Q1. 귀하의 소속은?"] || Object.values(d).some(v => v));
          setData(validData);
          setLastUpdate(new Date().toLocaleTimeString("ko-KR"));
          setLoading(false);
        },
        error: (err: Error) => {
          setError(err.message);
          setLoading(false);
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "데이터 로드 실패");
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 통계 계산
  const getStats = useCallback((): GroupStats => {
    if (data.length === 0) return { total: 0, rookie: 0, veteran: 0, paidRate전체: 0 };

    const columns = Object.keys(data[0] || {});
    const col소속 = findColumn(columns, ["소속"]);
    const col결제 = findColumn(columns, ["Q16", "금액"]);

    if (!col소속) return { total: data.length, rookie: 0, veteran: 0, paidRate전체: 0 };

    const rookieData = data.filter((d) => d[col소속]?.includes("신입"));
    const veteranData = data.filter((d) => !d[col소속]?.includes("신입") && d[col소속]);

    // 전체 유료 결제율
    let paidRate = 0;
    if (col결제) {
      const paid = data.filter(d => {
        const val = d[col결제] || "";
        return val && !val.includes("0원 (유료 결제 없음)");
      }).length;
      paidRate = data.length > 0 ? Math.round((paid / data.length) * 100) : 0;
    }

    return {
      total: data.length,
      rookie: rookieData.length,
      veteran: veteranData.length,
      paidRate전체: paidRate,
    };
  }, [data, findColumn]);

  // 차트 데이터 생성
  const getChartData = useCallback(
    (tools: string[], columnKeywords: string[]): ToolUsage[] => {
      if (data.length === 0) return [];

      const columns = Object.keys(data[0] || {});
      const col소속 = findColumn(columns, ["소속"]);
      const colTarget = findColumn(columns, columnKeywords);

      if (!col소속 || !colTarget) return [];

      const rookieData = data.filter((d) => d[col소속]?.includes("신입"));
      const veteranData = data.filter((d) => !d[col소속]?.includes("신입") && d[col소속]);

      const rookieRates = calcGroupPercentage(rookieData, colTarget, tools);
      const veteranRates = calcGroupPercentage(veteranData, colTarget, tools);

      return tools.map((tool, i) => ({
        name: tool,
        신입: rookieRates[i],
        기존: veteranRates[i],
      }));
    },
    [data, findColumn, calcGroupPercentage]
  );

  // 년차별 데이터 (신입 포함!)
  const getTenureData = useCallback((): TenureData[] => {
    if (data.length === 0) return [];

    const columns = Object.keys(data[0] || {});
    const col소속 = findColumn(columns, ["소속"]);
    const col년차 = findColumn(columns, ["Q2", "근속"]);
    const col결제 = findColumn(columns, ["Q16", "금액"]);

    if (!col결제) return [];

    const parsePayment = (text: string): number => {
      if (!text || text.includes("0원 (유료 결제 없음)")) return 0;
      if (text.includes("0원 초과 ~ 5만원 미만")) return 2.5;
      if (text.includes("5만원 이상 ~ 10만원 미만")) return 7.5;
      if (text.includes("10만원 이상 ~ 20만원 미만")) return 15;
      if (text.includes("20만원 이상")) return 25;
      return 0;
    };

    const tenureGroups: { [key: string]: { payments: number[], paidCount: number } } = {};
    
    // 신입사원 그룹 먼저 처리
    if (col소속) {
      const rookies = data.filter(d => d[col소속]?.includes("신입"));
      if (rookies.length > 0) {
        tenureGroups["신입"] = { payments: [], paidCount: 0 };
        rookies.forEach(d => {
          const payment = parsePayment(d[col결제] || "");
          tenureGroups["신입"].payments.push(payment);
          if (payment > 0) tenureGroups["신입"].paidCount++;
        });
      }
    }
    
    // 기존 직원 년차별 그룹
    if (col년차) {
      data.forEach(d => {
        const tenure = d[col년차];
        if (!tenure) return;
        
        if (!tenureGroups[tenure]) {
          tenureGroups[tenure] = { payments: [], paidCount: 0 };
        }
        
        const payment = parsePayment(d[col결제] || "");
        tenureGroups[tenure].payments.push(payment);
        if (payment > 0) tenureGroups[tenure].paidCount++;
      });
    }

    // 신입 + 기존 년차 순서
    const fullOrder = ["신입", ...TENURE_ORDER];
    const shortLabels = ["신입", ...TENURE_SHORT];

    return fullOrder
      .filter(t => tenureGroups[t])
      .map((tenure) => {
        const group = tenureGroups[tenure];
        const count = group.payments.length;
        const avgPayment = count > 0 ? group.payments.reduce((a, b) => a + b, 0) / count : 0;
        const paidRate = count > 0 ? (group.paidCount / count) * 100 : 0;
        const idx = fullOrder.indexOf(tenure);
        
        return {
          tenure: shortLabels[idx] || tenure,
          fullTenure: tenure,
          count,
          paidRate: Math.round(paidRate),
          avgPayment: Math.round(avgPayment * 10) / 10,
        };
      });
  }, [data, findColumn]);

  // 전공별 데이터
  const getMajorData = useCallback(() => {
    if (data.length === 0) return [];

    const columns = Object.keys(data[0] || {});
    const col전공 = findColumn(columns, ["Q3", "전공"]);

    if (!col전공) return [];

    const counter: { [key: string]: number } = {};
    data.forEach(d => {
      const major = d[col전공];
      if (major) counter[major] = (counter[major] || 0) + 1;
    });

    return Object.entries(counter)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name, value }));
  }, [data, findColumn]);

  // AI 도구별 유료 전환율
  const getConversionData = useCallback((): { category: string, data: ConversionData[] }[] => {
    if (data.length === 0) return [];

    const columns = Object.keys(data[0] || {});
    
    const categories = [
      { 
        name: "💬 대화형 AI", 
        useCol: ["Q4", "대화형", "사용한"], 
        paidCol: ["Q5", "대화형", "유료"],
        tools: [
          { name: "ChatGPT", paidKey: "ChatGPT" },
          { name: "Claude", paidKey: "Claude" },
          { name: "Gemini", paidKey: "Gemini" },
          { name: "Perplexity", paidKey: "Perplexity" },
          { name: "Copilot", paidKey: "Copilot" },
        ]
      },
      { 
        name: "💻 코딩·개발 AI", 
        useCol: ["Q6", "코딩", "사용한"], 
        paidCol: ["Q7", "코딩", "유료"],
        tools: [
          { name: "Cursor", paidKey: "Cursor" },
          { name: "Google Colab", paidKey: "Colab" },
          { name: "GitHub Copilot", paidKey: "Copilot" },
        ]
      },
      { 
        name: "📝 문서·생산성 AI", 
        useCol: ["Q12", "문서", "사용한"], 
        paidCol: ["Q13", "문서", "유료"],
        tools: [
          { name: "Google Workspace AI", paidKey: "Google Workspace" },
          { name: "Notion AI", paidKey: "Notion" },
          { name: "MS Copilot", paidKey: "MS Copilot" },
        ]
      },
      { 
        name: "🔄 자동화/노코드", 
        useCol: ["Q14", "자동화", "사용한"], 
        paidCol: ["Q15", "자동화", "유료"],
        tools: [
          { name: "n8n", paidKey: "n8n" },
          { name: "Make", paidKey: "Make" },
          { name: "Zapier", paidKey: "Zapier" },
        ]
      },
    ];

    return categories.map(cat => {
      const useColumn = findColumn(columns, cat.useCol);
      const paidColumn = findColumn(columns, cat.paidCol);
      
      if (!useColumn || !paidColumn) return { category: cat.name, data: [] };

      const toolData = cat.tools.map(tool => {
        let users = 0;
        let paid = 0;
        
        data.forEach(row => {
          const useVal = row[useColumn] || "";
          const paidVal = row[paidColumn] || "";
          
          if (useVal.includes(tool.name)) {
            users++;
            if (paidVal.includes(tool.paidKey) && !paidVal.includes("유료 결제 없음")) {
              paid++;
            }
          }
        });

        return {
          name: tool.name,
          users,
          paid,
          rate: users > 0 ? Math.round((paid / users) * 100) : 0,
        };
      }).filter(d => d.users >= 3);

      return { category: cat.name, data: toolData.sort((a, b) => b.rate - a.rate) };
    }).filter(cat => cat.data.length > 0);
  }, [data, findColumn]);

  // 주관식 귀찮은 업무 분석
  const getPainPointData = useCallback((): { top5: PainPointData[], all: string[] } => {
    if (data.length === 0) return { top5: [], all: [] };

    const columns = Object.keys(data[0] || {});
    const col = findColumn(columns, ["Q20", "귀찮은"]);
    
    if (!col) return { top5: [], all: [] };

    const allItems: string[] = [];
    const keywords: { [key: string]: number } = {
      "데이터 복붙/처리": 0,
      "행정/기안/공문": 0,
      "영수증/전표 처리": 0,
      "보고서/PPT 작성": 0,
      "회의록 정리": 0,
      "메일 관련": 0,
    };

    data.forEach(d => {
      const val = (d[col] || "").trim();
      if (!val || val === "-" || val === "." || val === "없음" || val === " ") return;
      
      allItems.push(val);
      const lower = val.toLowerCase();
      
      if (lower.includes("데이터") || lower.includes("복붙") || lower.includes("처리") || lower.includes("정리") || lower.includes("편집")) {
        keywords["데이터 복붙/처리"]++;
      }
      if (lower.includes("행정") || lower.includes("기안") || lower.includes("공문")) {
        keywords["행정/기안/공문"]++;
      }
      if (lower.includes("영수증") || lower.includes("전표") || lower.includes("정산") || lower.includes("erp")) {
        keywords["영수증/전표 처리"]++;
      }
      if (lower.includes("보고서") || lower.includes("ppt") || lower.includes("장표")) {
        keywords["보고서/PPT 작성"]++;
      }
      if (lower.includes("회의록")) {
        keywords["회의록 정리"]++;
      }
      if (lower.includes("메일") || lower.includes("이메일")) {
        keywords["메일 관련"]++;
      }
    });

    const top5 = Object.entries(keywords)
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .filter(d => d.count > 0);

    return { top5, all: allItems };
  }, [data, findColumn]);

  // 결제 금액 분포 데이터
  const getPaymentData = useCallback(() => {
    if (data.length === 0) return [];

    const columns = Object.keys(data[0] || {});
    const col결제 = findColumn(columns, ["Q16", "금액"]);

    if (!col결제) return [];

    const counter: { [key: string]: number } = {};
    data.forEach((d) => {
      const val = d[col결제];
      if (val) counter[val] = (counter[val] || 0) + 1;
    });

    const order = ["0원 (유료 결제 없음)", "0원 초과 ~ 5만원 미만", "5만원 이상 ~ 10만원 미만", "10만원 이상 ~ 20만원 미만", "20만원 이상"];
    
    return order.filter(k => counter[k]).map(key => ({
      name: key.replace("0원 (유료 결제 없음)", "0원").replace("0원 초과 ~ 5만원 미만", "~5만원").replace("5만원 이상 ~ 10만원 미만", "5~10만원").replace("10만원 이상 ~ 20만원 미만", "10~20만원").replace("20만원 이상", "20만원+"),
      value: counter[key],
      fullName: key,
    }));
  }, [data, findColumn]);

  // Gemini 인사이트 생성
  const generateInsights = async () => {
    setInsightsLoading(true);
    const stats = getStats();
    const chartData = getChartData(TOOLS_대화형, ["Q4", "대화형", "사용한"]);

    try {
      const response = await fetch("/api/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stats, chartData }),
      });

      const result = await response.json();
      setInsights(result.insights || "인사이트 생성 실패");
    } catch {
      setInsights("API 연결 실패. 환경변수를 확인해주세요.");
    }

    setInsightsLoading(false);
  };

  const stats = getStats();
  const 대화형Data = getChartData(TOOLS_대화형, ["Q4", "대화형", "사용한"]);
  const 코딩Data = getChartData(TOOLS_코딩, ["Q6", "코딩", "사용한"]);
  const 이미지Data = getChartData(TOOLS_이미지, ["Q8", "이미지", "사용한"]);
  const tenureData = getTenureData();
  const majorData = getMajorData();
  const conversionData = getConversionData();
  const painPointData = getPainPointData();
  const paymentData = getPaymentData();

  if (!mounted || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-slate-600">{loading ? "데이터를 불러오는 중..." : "로딩중..."}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
        <div className="text-center bg-white/60 backdrop-blur-xl p-8 rounded-3xl shadow-xl border border-white/50">
          <p className="text-red-500 text-xl mb-4">⚠️ {error}</p>
          <button onClick={loadData} className="px-6 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition">
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 p-4 md:p-6">
      {/* 헤더 */}
      <header className="max-w-6xl mx-auto mb-8 text-center">
        <div className="inline-block px-5 py-2 rounded-full bg-white/40 backdrop-blur-md border border-white/50 shadow-sm mb-4">
          <span className="text-indigo-600 font-bold">🎯 2026 KPC AI Dashboard</span>
        </div>
        <h1 className="text-4xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-pink-600 mb-3">
          AI, 어디까지 써봤니?
        </h1>
        <p className="text-slate-600 text-lg mb-4">KPC 직원 AI 활용 현황 실시간 대시보드 📊</p>
        <div className="flex justify-center items-center gap-4">
          <button onClick={loadData} className="px-4 py-2 bg-white/50 hover:bg-white/70 backdrop-blur-md rounded-xl border border-white/50 transition flex items-center gap-2 text-slate-700">
            🔄 새로고침
          </button>
          <span className="text-slate-500 text-sm">마지막 업데이트: {lastUpdate}</span>
        </div>
      </header>

      <div className="max-w-6xl mx-auto space-y-6">
        {/* 요약 카드 */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="group relative overflow-hidden rounded-2xl p-5 bg-white/50 backdrop-blur-xl border border-white/60 shadow-lg hover:shadow-2xl hover:-translate-y-1 transition-all duration-300">
            <div className="absolute top-2 right-2 text-4xl opacity-10 group-hover:opacity-20 transition-opacity">📊</div>
            <p className="text-slate-500 text-sm font-medium">총 응답자</p>
            <p className="text-3xl font-black text-slate-800">{stats.total}<span className="text-sm font-normal text-slate-400 ml-1">명</span></p>
          </div>
          
          <div className="group relative overflow-hidden rounded-2xl p-5 bg-gradient-to-br from-indigo-400/80 to-indigo-600/80 backdrop-blur-xl border border-white/30 shadow-lg hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 text-white">
            <div className="absolute top-2 right-2 text-4xl opacity-20 group-hover:opacity-30 transition-opacity">🆕</div>
            <p className="text-indigo-100 text-sm font-medium">신입사원</p>
            <p className="text-3xl font-black">{stats.rookie}<span className="text-sm font-normal text-indigo-100 ml-1">명</span></p>
            <p className="text-indigo-200 text-xs">({stats.total > 0 ? Math.round((stats.rookie / stats.total) * 100) : 0}%)</p>
          </div>
          
          <div className="group relative overflow-hidden rounded-2xl p-5 bg-gradient-to-br from-emerald-400/80 to-emerald-600/80 backdrop-blur-xl border border-white/30 shadow-lg hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 text-white">
            <div className="absolute top-2 right-2 text-4xl opacity-20 group-hover:opacity-30 transition-opacity">👔</div>
            <p className="text-emerald-100 text-sm font-medium">기존직원</p>
            <p className="text-3xl font-black">{stats.veteran}<span className="text-sm font-normal text-emerald-100 ml-1">명</span></p>
            <p className="text-emerald-200 text-xs">({stats.total > 0 ? Math.round((stats.veteran / stats.total) * 100) : 0}%)</p>
          </div>
          
          <div className="group relative overflow-hidden rounded-2xl p-5 bg-gradient-to-br from-violet-400/80 to-violet-600/80 backdrop-blur-xl border border-white/30 shadow-lg hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 text-white">
            <div className="absolute top-2 right-2 text-4xl opacity-20 group-hover:opacity-30 transition-opacity">💳</div>
            <p className="text-violet-100 text-sm font-medium">유료 결제율</p>
            <p className="text-3xl font-black">{stats.paidRate전체}%</p>
            <p className="text-violet-200 text-xs">전체 응답자 기준</p>
          </div>
        </section>

        {/* 대화형 AI 차트 */}
        <section className="rounded-2xl p-6 bg-white/60 backdrop-blur-xl border border-white/60 shadow-xl">
          <h2 className="text-xl font-bold text-slate-800 mb-4">💬 대화형 AI 사용률 <span className="text-sm font-normal text-slate-400">누가 제일 핫해? 🔥</span></h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={대화형Data} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 12 }} />
              <YAxis tick={{ fill: "#64748b", fontSize: 12 }} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
              <Tooltip formatter={(value: number) => [`${value}%`, ""]} contentStyle={{ backgroundColor: "rgba(255,255,255,0.9)", borderRadius: "16px", border: "none", boxShadow: "0 10px 25px -5px rgba(0,0,0,0.1)" }} />
              <Legend />
              <Bar dataKey="신입" name={`신입 (n=${stats.rookie})`} fill={COLORS.rookie} radius={[8, 8, 0, 0]} />
              <Bar dataKey="기존" name={`기존 (n=${stats.veteran})`} fill={COLORS.veteran} radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </section>

        {/* 코딩 AI + 이미지 AI */}
        <div className="grid md:grid-cols-2 gap-6">
          <section className="rounded-2xl p-6 bg-white/60 backdrop-blur-xl border border-white/60 shadow-xl">
            <h2 className="text-lg font-bold text-slate-800 mb-4">💻 코딩·개발 AI 사용률</h2>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={코딩Data} layout="vertical" margin={{ top: 5, right: 30, left: 80, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fill: "#64748b", fontSize: 11 }} />
                <YAxis type="category" dataKey="name" tick={{ fill: "#64748b", fontSize: 11 }} width={75} />
                <Tooltip formatter={(value: number) => [`${value}%`, ""]} />
                <Bar dataKey="기존" name="기존" fill={COLORS.veteran} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </section>

          <section className="rounded-2xl p-6 bg-white/60 backdrop-blur-xl border border-white/60 shadow-xl">
            <h2 className="text-lg font-bold text-slate-800 mb-4">🎨 이미지·디자인 AI 사용률</h2>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={이미지Data} layout="vertical" margin={{ top: 5, right: 30, left: 80, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fill: "#64748b", fontSize: 11 }} />
                <YAxis type="category" dataKey="name" tick={{ fill: "#64748b", fontSize: 11 }} width={75} />
                <Tooltip formatter={(value: number) => [`${value}%`, ""]} />
                <Bar dataKey="기존" name="기존" fill="#ec4899" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </section>
        </div>

        {/* 년차별 AI 활용 분석 */}
        <section className="rounded-2xl p-6 bg-white/60 backdrop-blur-xl border border-white/60 shadow-xl">
          <h2 className="text-xl font-bold text-slate-800 mb-6">📅 년차별 AI 활용 분석 <span className="text-sm font-normal text-slate-400">년차가 높을수록?</span></h2>
          
          {/* 년차별 응답수 */}
          <div className="mb-6 flex flex-wrap gap-2">
            {tenureData.map((d, idx) => (
              <div key={idx} className={`px-3 py-2 rounded-lg text-sm ${d.tenure === "신입" ? "bg-indigo-100 border-2 border-indigo-300" : "bg-slate-100"}`}>
                <span className={`font-medium ${d.tenure === "신입" ? "text-indigo-700" : "text-slate-700"}`}>
                  {d.tenure === "신입" ? "🆕 신입" : d.tenure}
                </span>
                <span className={`ml-2 ${d.tenure === "신입" ? "text-indigo-600 font-bold" : "text-slate-500"}`}>{d.count}명</span>
              </div>
            ))}
          </div>
          
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-semibold text-slate-600 mb-3">💳 년차별 유료 결제율</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={tenureData} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="tenure" tick={{ fill: "#64748b", fontSize: 11 }} />
                  <YAxis tick={{ fill: "#64748b", fontSize: 11 }} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                  <Tooltip formatter={(value: number) => [`${value}%`, "유료 결제율"]} />
                  <Bar dataKey="paidRate" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            
            <div>
              <h3 className="text-sm font-semibold text-slate-600 mb-3">💰 년차별 평균 결제금액 (만원)</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={tenureData} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="tenure" tick={{ fill: "#64748b", fontSize: 11 }} />
                  <YAxis tick={{ fill: "#64748b", fontSize: 11 }} tickFormatter={(v) => `${v}만`} />
                  <Tooltip formatter={(value: number) => [`${value}만원`, "평균 결제금액"]} />
                  <Bar dataKey="avgPayment" fill="#ec4899" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          
          <div className="mt-4 p-4 bg-indigo-50/50 rounded-xl">
            <p className="text-sm text-indigo-700">
              💡 <strong>인사이트:</strong> 5-10년차가 평균 {tenureData.find(d => d.tenure === "5-10년")?.avgPayment || 0}만원으로 가장 많이 투자!
            </p>
          </div>
        </section>

        {/* 전공별 분포 + 결제 금액 분포 */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* 전공별 분포 */}
          {majorData.length > 0 && (
            <section className="rounded-2xl p-6 bg-white/60 backdrop-blur-xl border border-white/60 shadow-xl">
              <h2 className="text-lg font-bold text-slate-800 mb-4">🎓 응답자 전공 분포</h2>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={majorData} cx="50%" cy="50%" labelLine={true} label={({ name, percent }) => `${name.replace("계열", "").slice(0, 4)} ${(percent * 100).toFixed(0)}%`} outerRadius={80} fill="#8884d8" dataKey="value">
                    {majorData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS.pie[index % COLORS.pie.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </section>
          )}

          {/* 결제 금액 분포 */}
          {paymentData.length > 0 && (
            <section className="rounded-2xl p-6 bg-white/60 backdrop-blur-xl border border-white/60 shadow-xl">
              <h2 className="text-lg font-bold text-slate-800 mb-4">💳 월 평균 AI 결제 금액 분포</h2>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={paymentData} cx="50%" cy="50%" labelLine={true} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} outerRadius={80} fill="#8884d8" dataKey="value">
                    {paymentData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS.pie[index % COLORS.pie.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </section>
          )}
        </div>

        {/* AI 도구별 유료 전환율 */}
        {conversionData.length > 0 && (
          <section className="rounded-2xl p-6 bg-white/60 backdrop-blur-xl border border-white/60 shadow-xl">
            <h2 className="text-xl font-bold text-slate-800 mb-6">🔄 AI 도구별 유료 전환율 <span className="text-sm font-normal text-slate-400">써보면 결국 유료로?</span></h2>
            
            <div className="grid md:grid-cols-2 gap-6">
              {conversionData.map((cat, idx) => (
                <div key={idx} className="bg-white/40 rounded-xl p-4">
                  <h3 className="text-sm font-semibold text-slate-700 mb-3">{cat.category}</h3>
                  <div className="space-y-2">
                    {cat.data.map((tool, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <span className="text-sm text-slate-600 w-32 truncate">{tool.name}</span>
                        <div className="flex-1 h-6 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500" style={{ width: `${Math.max(tool.rate, 5)}%` }} />
                        </div>
                        <span className="text-sm font-bold text-slate-700 w-14 text-right">{tool.rate}%</span>
                        <span className="text-xs text-slate-400">({tool.paid}/{tool.users})</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            
            <div className="mt-4 p-4 bg-pink-50/50 rounded-xl">
              <p className="text-sm text-pink-700">🔥 <strong>인사이트:</strong> 유료 결제자 수 기반 전환율! 사용자가 많을수록 신뢰도 ↑</p>
            </div>
          </section>
        )}

        {/* AI가 대신 해줬으면 하는 업무 */}
        <section className="rounded-2xl p-6 bg-white/60 backdrop-blur-xl border border-white/60 shadow-xl">
          <h2 className="text-xl font-bold text-slate-800 mb-6">😫 AI가 대신 해줬으면 하는 업무 <span className="text-sm font-normal text-slate-400">TOP 5</span></h2>
          
          <div className="space-y-3 mb-4">
            {painPointData.top5.map((item, idx) => (
              <div key={idx} className="flex items-center gap-3">
                <span className="text-2xl">{idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : "🔸"}</span>
                <span className="text-sm text-slate-700 font-medium w-40">{item.category}</span>
                <div className="flex-1 h-8 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-orange-400 to-red-400 rounded-full flex items-center justify-end pr-3 transition-all duration-500" style={{ width: `${Math.min((item.count / (painPointData.top5[0]?.count || 1)) * 100, 100)}%` }}>
                    <span className="text-white text-sm font-bold">{item.count}건</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          <button onClick={() => setShowAllPainPoints(!showAllPainPoints)} className="text-sm text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1">
            {showAllPainPoints ? "접기 ▲" : `원문 전체 보기 (${painPointData.all.length}건) ▼`}
          </button>
          
          {showAllPainPoints && (
            <div className="mt-4 p-4 bg-slate-50 rounded-xl max-h-60 overflow-y-auto">
              <ul className="space-y-1">
                {painPointData.all.map((item, idx) => (
                  <li key={idx} className="text-sm text-slate-600 flex items-start gap-2">
                    <span className="text-slate-400">{idx + 1}.</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {/* AI 인사이트 (Gemini) */}
        <section className="rounded-2xl p-6 bg-white/60 backdrop-blur-xl border border-white/60 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-slate-800">
              🤖 AI 인사이트 <span className="text-sm font-normal text-slate-400">Gemini 2.5 Pro</span>
            </h2>
            <button
              onClick={generateInsights}
              disabled={insightsLoading}
              className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-xl hover:opacity-90 disabled:opacity-50 transition flex items-center gap-2"
            >
              {insightsLoading ? (
                <>
                  <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                  생성 중...
                </>
              ) : (
                <>✨ 인사이트 생성</>
              )}
            </button>
          </div>
          {insights ? (
            <div className="bg-slate-50/50 rounded-xl p-6 prose prose-slate max-w-none prose-headings:text-slate-800 prose-p:text-slate-600">
              <div dangerouslySetInnerHTML={{ __html: insights.replace(/\n/g, "<br/>").replace(/##/g, "<h3>").replace(/\*\*/g, "") }} />
            </div>
          ) : (
            <div className="bg-slate-50/50 rounded-xl p-6 text-center text-slate-500">
              <p>버튼을 클릭하여 AI 인사이트를 생성하세요 ✨</p>
              <p className="text-xs mt-2 text-slate-400">응답 데이터 기반으로 신입사원에게 전하는 메시지를 생성합니다</p>
            </div>
          )}
        </section>

        {/* 푸터 */}
        <footer className="text-center text-slate-400 text-sm py-8">
          <p>© 2026 KPC 한국생산성본부 AI전환센터</p>
          <p className="mt-1">신입사원 AI 교육 - 실시간 설문 분석 대시보드</p>
          <p className="mt-2 text-slate-300">Designed by Junsung Sohn | KPC AI전환센터</p>
        </footer>
      </div>
    </main>
  );
}
