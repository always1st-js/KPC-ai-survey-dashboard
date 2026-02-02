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

interface InvestmentStats {
  avgPayment: number;
  topRange: string;
  topRangePercent: number;
  heavyUsers: number;
  totalPaid: number;
}

// 색상 정의
const COLORS = {
  rookie: "#4285F4",
  veteran: "#34A853",
  pie: ["#4285F4", "#8B5CF6", "#EC4899", "#F59E0B", "#10B981", "#3B82F6"],
  years: ["#6366f1", "#4285F4", "#34A853", "#FBBC04", "#EA4335", "#7C3AED"],
};

// 도구 목록
const TOOLS_대화형 = ["ChatGPT", "Claude", "Gemini", "뤼튼", "Copilot", "Perplexity"];
const TOOLS_코딩 = ["GitHub Copilot", "Cursor", "Google Colab", "Replit", "Claude Code"];
const TOOLS_이미지 = ["Midjourney", "DALL-E", "Stable Diffusion", "Canva AI", "Adobe Firefly"];

// 년차 순서 정의
const TENURE_ORDER = ["1년 미만", "1년 이상 ~ 5년 미만", "5년 이상 ~ 10년 미만", "10년 이상 ~ 15년 미만", "15년 이상"];
const TENURE_SHORT = ["~1년", "1-5년", "5-10년", "10-15년", "15년+"];

// 애니메이션 숫자 카운터 컴포넌트
const AnimatedNumber = ({ value, suffix = "" }: { value: number; suffix?: string }) => {
  const [displayValue, setDisplayValue] = useState(0);
  
  useEffect(() => {
    const duration = 1000;
    const steps = 30;
    const increment = value / steps;
    let current = 0;
    
    const timer = setInterval(() => {
      current += increment;
      if (current >= value) {
        setDisplayValue(value);
        clearInterval(timer);
      } else {
        setDisplayValue(Math.floor(current));
      }
    }, duration / steps);
    
    return () => clearInterval(timer);
  }, [value]);
  
  return <>{displayValue}{suffix}</>;
};

// 섹션 배너 컴포넌트
const SectionBanner = ({ 
  emoji, 
  title, 
  subtitle, 
  gradient 
}: { 
  emoji: string; 
  title: string; 
  subtitle: string; 
  gradient: string;
}) => (
  <div className={`rounded-2xl p-5 bg-gradient-to-r ${gradient} mb-6`}>
    <h2 className="text-xl font-bold text-white flex items-center gap-2">
      {emoji} {title}
    </h2>
    <p className="text-white/80 text-sm mt-1">{subtitle}</p>
  </div>
);

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

  // 컬럼 찾기 함수
  const findColumn = useCallback((columns: string[], keywords: string[]) => {
    for (const col of columns) {
      let matchCount = 0;
      for (const keyword of keywords) {
        if (col.includes(keyword)) matchCount++;
      }
      if (matchCount === keywords.length) return col;
    }
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

  // 그룹별 유료 결제율
  const getPaidRatio = useCallback(() => {
    if (data.length === 0) return { rookie: 0, veteran: 0 };

    const columns = Object.keys(data[0] || {});
    const col결제 = findColumn(columns, ["Q16", "금액"]);
    const col소속 = findColumn(columns, ["소속"]);

    if (!col결제 || !col소속) return { rookie: 0, veteran: 0 };

    const rookieData = data.filter((d) => d[col소속]?.includes("신입"));
    const veteranData = data.filter((d) => !d[col소속]?.includes("신입") && d[col소속]);

    const rookiePaid = rookieData.filter(d => {
      const val = d[col결제] || "";
      return val && !val.includes("0원 (유료 결제 없음)");
    }).length;

    const veteranPaid = veteranData.filter(d => {
      const val = d[col결제] || "";
      return val && !val.includes("0원 (유료 결제 없음)");
    }).length;

    return {
      rookie: rookieData.length > 0 ? Math.round((rookiePaid / rookieData.length) * 100) : 0,
      veteran: veteranData.length > 0 ? Math.round((veteranPaid / veteranData.length) * 100) : 0,
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

  // 년차별 데이터 (신입 포함)
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

  // 년차별 분포 (파이차트용 - 기존직원만)
  const getTenureDistribution = useCallback(() => {
    if (data.length === 0) return [];

    const columns = Object.keys(data[0] || {});
    const col년차 = findColumn(columns, ["Q2", "근속"]);

    if (!col년차) return [];

    const counter: { [key: string]: number } = {};
    data.forEach(d => {
      const tenure = d[col년차];
      if (tenure) counter[tenure] = (counter[tenure] || 0) + 1;
    });

    return TENURE_ORDER
      .filter(t => counter[t])
      .map((tenure, idx) => ({
        name: TENURE_SHORT[idx],
        fullName: tenure,
        value: counter[tenure] || 0,
      }));
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
      .map(([name, value]) => ({ name: name.replace("계열", ""), value }));
  }, [data, findColumn]);

  // AI 투자 현황 통계
  const getInvestmentStats = useCallback((): InvestmentStats => {
    if (data.length === 0) return { avgPayment: 0, topRange: "-", topRangePercent: 0, heavyUsers: 0, totalPaid: 0 };

    const columns = Object.keys(data[0] || {});
    const col결제 = findColumn(columns, ["Q16", "금액"]);

    if (!col결제) return { avgPayment: 0, topRange: "-", topRangePercent: 0, heavyUsers: 0, totalPaid: 0 };

    const parsePayment = (text: string): number => {
      if (!text || text.includes("0원 (유료 결제 없음)")) return 0;
      if (text.includes("0원 초과 ~ 5만원 미만")) return 2.5;
      if (text.includes("5만원 이상 ~ 10만원 미만")) return 7.5;
      if (text.includes("10만원 이상 ~ 20만원 미만")) return 15;
      if (text.includes("20만원 이상")) return 25;
      return 0;
    };

    const payments = data.map(d => parsePayment(d[col결제] || ""));
    const avgPayment = payments.reduce((a, b) => a + b, 0) / payments.length;
    
    // 구간별 카운트
    const ranges: { [key: string]: number } = {};
    data.forEach(d => {
      const val = d[col결제] || "";
      if (val) ranges[val] = (ranges[val] || 0) + 1;
    });

    // 최다 구간 찾기
    let topRange = "-";
    let topCount = 0;
    Object.entries(ranges).forEach(([range, count]) => {
      if (count > topCount) {
        topCount = count;
        if (range.includes("0원 초과 ~ 5만원 미만")) topRange = "~5만원";
        else if (range.includes("5만원 이상 ~ 10만원 미만")) topRange = "5~10만원";
        else if (range.includes("10만원 이상 ~ 20만원 미만")) topRange = "10~20만원";
        else if (range.includes("20만원 이상")) topRange = "20만원+";
        else if (range.includes("0원 (유료 결제 없음)")) topRange = "0원";
        else topRange = range;
      }
    });

    // 헤비유저 (20만원 이상)
    const heavyUsers = data.filter(d => (d[col결제] || "").includes("20만원 이상")).length;
    
    // 유료 결제자 수
    const totalPaid = data.filter(d => {
      const val = d[col결제] || "";
      return val && !val.includes("0원 (유료 결제 없음)");
    }).length;

    return {
      avgPayment: Math.round(avgPayment * 10) / 10,
      topRange,
      topRangePercent: data.length > 0 ? Math.round((topCount / data.length) * 100) : 0,
      heavyUsers,
      totalPaid,
    };
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
  const paidRatio = getPaidRatio();
  const 대화형Data = getChartData(TOOLS_대화형, ["Q4", "대화형", "사용한"]);
  const 코딩Data = getChartData(TOOLS_코딩, ["Q6", "코딩", "사용한"]);
  const 이미지Data = getChartData(TOOLS_이미지, ["Q8", "이미지", "사용한"]);
  const tenureData = getTenureData();
  const tenureDistribution = getTenureDistribution();
  const majorData = getMajorData();
  const investmentStats = getInvestmentStats();
  const conversionData = getConversionData();
  const painPointData = getPainPointData();
  const paymentData = getPaymentData();

  if (!mounted || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-slate-600">{loading ? "데이터를 불러오는 중..." : "로딩중..."}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center bg-white p-8 rounded-2xl shadow-lg">
          <p className="text-red-500 text-xl mb-4">⚠️ {error}</p>
          <button onClick={loadData} className="px-6 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition">
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      {/* ========== 헤더 (파란 그라디언트) ========== */}
      <header className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white py-8 px-4">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-bold mb-2">
            🎯 AI, 어디까지 써봤니?
          </h1>
          <p className="text-blue-100 text-lg">
            KPC 직원 AI 활용 현황 실시간 대시보드 📊
          </p>
          <div className="mt-4 flex items-center gap-4 flex-wrap">
            <button
              onClick={loadData}
              className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition flex items-center gap-2"
            >
              🔄 새로고침
            </button>
            <span className="text-blue-100 text-sm">
              마지막 업데이트: {lastUpdate}
            </span>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* ========== 요약 카드 (쑈잉 애니메이션) ========== */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-2xl shadow-md p-6 text-center transform hover:-translate-y-1 transition-all duration-300 animate-[slideUp_0.5s_ease-out]">
            <p className="text-slate-500 text-sm mb-1">📊 총 응답자</p>
            <p className="text-4xl font-bold text-slate-800">
              <AnimatedNumber value={stats.total} />
            </p>
            <p className="text-slate-400 text-sm">명</p>
          </div>
          
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl shadow-md p-6 text-center text-white transform hover:-translate-y-1 transition-all duration-300 animate-[slideUp_0.6s_ease-out]">
            <p className="text-blue-100 text-sm mb-1">🆕 신입사원</p>
            <p className="text-4xl font-bold">
              <AnimatedNumber value={stats.rookie} />
            </p>
            <p className="text-blue-100 text-sm">
              명 ({stats.total > 0 ? Math.round((stats.rookie / stats.total) * 100) : 0}%)
            </p>
          </div>
          
          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl shadow-md p-6 text-center text-white transform hover:-translate-y-1 transition-all duration-300 animate-[slideUp_0.7s_ease-out]">
            <p className="text-green-100 text-sm mb-1">👔 기존직원</p>
            <p className="text-4xl font-bold">
              <AnimatedNumber value={stats.veteran} />
            </p>
            <p className="text-green-100 text-sm">
              명 ({stats.total > 0 ? Math.round((stats.veteran / stats.total) * 100) : 0}%)
            </p>
          </div>
          
          <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl shadow-md p-6 text-center text-white transform hover:-translate-y-1 transition-all duration-300 animate-[slideUp_0.8s_ease-out]">
            <p className="text-purple-100 text-sm mb-1">💳 유료 결제율</p>
            <div className="flex justify-center gap-3 mt-2">
              <div>
                <p className="text-2xl font-bold"><AnimatedNumber value={paidRatio.rookie} suffix="%" /></p>
                <p className="text-purple-200 text-xs">신입</p>
              </div>
              <div className="text-purple-300 self-center">vs</div>
              <div>
                <p className="text-2xl font-bold"><AnimatedNumber value={paidRatio.veteran} suffix="%" /></p>
                <p className="text-purple-200 text-xs">기존</p>
              </div>
            </div>
          </div>
        </section>

        {/* ========== 파이차트 2개: 년차별 분포 + 전공 분포 ========== */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {tenureDistribution.length > 0 && (
            <section className="bg-white rounded-2xl shadow-md p-6">
              <h3 className="text-lg font-bold text-slate-800 mb-4">👥 기존직원 년차별 분포</h3>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={tenureDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={true}
                    label={({ name, value }) => `${name}: ${value}명`}
                    outerRadius={90}
                    fill="#8884d8"
                    dataKey="value"
                    animationBegin={0}
                    animationDuration={1200}
                  >
                    {tenureDistribution.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS.years[index % COLORS.years.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </section>
          )}

          {majorData.length > 0 && (
            <section className="bg-white rounded-2xl shadow-md p-6">
              <h3 className="text-lg font-bold text-slate-800 mb-4">🎓 응답자 전공 분포</h3>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={majorData}
                    cx="50%"
                    cy="50%"
                    labelLine={true}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={90}
                    fill="#8884d8"
                    dataKey="value"
                    animationBegin={200}
                    animationDuration={1200}
                  >
                    {majorData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS.pie[index % COLORS.pie.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </section>
          )}
        </div>

        {/* ========== 섹션 1: 신입 vs 기존직원 AI 활용 비교 ========== */}
        <SectionBanner
          emoji="👥"
          title="신입 vs 기존직원 AI 활용 비교"
          subtitle="모든 수치는 각 그룹 내 비율(%)입니다"
          gradient="from-cyan-400 to-emerald-500"
        />

        {/* 대화형 AI 차트 */}
        <section className="bg-white rounded-2xl shadow-md p-6 mb-6">
          <h3 className="text-lg font-bold text-slate-800 mb-4">💬 대화형 AI 사용률 <span className="text-sm font-normal text-slate-400">누가 제일 핫해? 🔥</span></h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={대화형Data} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 12 }} />
              <YAxis tick={{ fill: "#64748b", fontSize: 12 }} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
              <Tooltip formatter={(value: number) => [`${value}%`, ""]} contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }} />
              <Legend />
              <Bar dataKey="신입" name={`신입 (n=${stats.rookie})`} fill={COLORS.rookie} radius={[8, 8, 0, 0]} />
              <Bar dataKey="기존" name={`기존 (n=${stats.veteran})`} fill={COLORS.veteran} radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </section>

        {/* 코딩 AI + 이미지 AI (2열) */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <section className="bg-white rounded-2xl shadow-md p-6">
            <h3 className="text-lg font-bold text-slate-800 mb-4">💻 코딩·개발 AI 사용률</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={코딩Data} layout="vertical" margin={{ top: 5, right: 30, left: 80, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fill: "#64748b", fontSize: 11 }} />
                <YAxis type="category" dataKey="name" tick={{ fill: "#64748b", fontSize: 11 }} width={75} />
                <Tooltip formatter={(value: number) => [`${value}%`, ""]} />
                <Legend />
                <Bar dataKey="신입" fill={COLORS.rookie} radius={[0, 4, 4, 0]} />
                <Bar dataKey="기존" fill={COLORS.veteran} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </section>

          <section className="bg-white rounded-2xl shadow-md p-6">
            <h3 className="text-lg font-bold text-slate-800 mb-4">🎨 이미지·디자인 AI 사용률</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={이미지Data} layout="vertical" margin={{ top: 5, right: 30, left: 80, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fill: "#64748b", fontSize: 11 }} />
                <YAxis type="category" dataKey="name" tick={{ fill: "#64748b", fontSize: 11 }} width={75} />
                <Tooltip formatter={(value: number) => [`${value}%`, ""]} />
                <Legend />
                <Bar dataKey="신입" fill={COLORS.rookie} radius={[0, 4, 4, 0]} />
                <Bar dataKey="기존" fill="#ec4899" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </section>
        </div>

        {/* ========== 섹션 2: 년차별 AI 활용 분석 ========== */}
        <SectionBanner
          emoji="📅"
          title="년차별 AI 활용 분석"
          subtitle="기존직원을 근속연수별로 분석합니다"
          gradient="from-orange-400 to-orange-600"
        />

        {/* 년차별 응답수 태그 */}
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

        {/* 년차별 결제율 + 평균 결제금액 (2열) */}
        <div className="grid md:grid-cols-2 gap-6 mb-6">
          <section className="bg-white rounded-2xl shadow-md p-6">
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
          </section>
          
          <section className="bg-white rounded-2xl shadow-md p-6">
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
          </section>
        </div>

        {/* 년차별 인사이트 */}
        <div className="mb-8 p-4 bg-orange-50 rounded-xl border border-orange-100">
          <p className="text-sm text-orange-700">
            💡 <strong>인사이트:</strong> 5-10년차가 평균 {tenureData.find(d => d.tenure === "5-10년")?.avgPayment || 0}만원으로 가장 많이 투자!
          </p>
        </div>

        {/* ========== 섹션 3: 종합 분석 ========== */}
        <SectionBanner
          emoji="📊"
          title="종합 분석"
          subtitle="전체 응답자 기준 분석입니다"
          gradient="from-purple-500 to-pink-500"
        />

        {/* AI 투자 현황 카드 + 결제금액 분포 (2열) */}
        <div className="grid md:grid-cols-2 gap-6 mb-6">
          {/* NEW: AI 투자 현황 카드 */}
          <section className="bg-white rounded-2xl shadow-md p-6">
            <h3 className="text-lg font-bold text-slate-800 mb-4">💰 KPC 전체 AI 투자 현황</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">📈</span>
                  <span className="text-slate-600">월 평균 결제</span>
                </div>
                <span className="text-2xl font-bold text-blue-600">{investmentStats.avgPayment}만원</span>
              </div>
              
              <div className="flex items-center justify-between p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🏆</span>
                  <span className="text-slate-600">최다 구간</span>
                </div>
                <span className="text-xl font-bold text-green-600">{investmentStats.topRange} ({investmentStats.topRangePercent}%)</span>
              </div>
              
              <div className="flex items-center justify-between p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">💎</span>
                  <span className="text-slate-600">헤비유저 (20만+)</span>
                </div>
                <span className="text-2xl font-bold text-purple-600">{investmentStats.heavyUsers}명</span>
              </div>
              
              <div className="flex items-center justify-between p-4 bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">✅</span>
                  <span className="text-slate-600">유료 결제자</span>
                </div>
                <span className="text-2xl font-bold text-orange-600">{investmentStats.totalPaid}명 / {stats.total}명</span>
              </div>
            </div>
          </section>

          {/* 결제 금액 분포 파이차트 */}
          {paymentData.length > 0 && (
            <section className="bg-white rounded-2xl shadow-md p-6">
              <h3 className="text-lg font-bold text-slate-800 mb-4">💳 월 평균 AI 결제 금액 분포</h3>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={paymentData}
                    cx="50%"
                    cy="50%"
                    labelLine={true}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={90}
                    fill="#8884d8"
                    dataKey="value"
                    animationBegin={400}
                    animationDuration={1200}
                  >
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
          <section className="bg-white rounded-2xl shadow-md p-6 mb-6">
            <h3 className="text-xl font-bold text-slate-800 mb-6">🔄 AI 도구별 유료 전환율 <span className="text-sm font-normal text-slate-400">써보면 결국 유료로?</span></h3>
            
            <div className="grid md:grid-cols-2 gap-6">
              {conversionData.map((cat, idx) => (
                <div key={idx} className="bg-slate-50 rounded-xl p-4">
                  <h4 className="text-sm font-semibold text-slate-700 mb-3">{cat.category}</h4>
                  <div className="space-y-2">
                    {cat.data.map((tool, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <span className="text-sm text-slate-600 w-32 truncate">{tool.name}</span>
                        <div className="flex-1 h-6 bg-slate-200 rounded-full overflow-hidden">
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
            
            <div className="mt-4 p-4 bg-pink-50 rounded-xl border border-pink-100">
              <p className="text-sm text-pink-700">🔥 <strong>인사이트:</strong> 유료 결제자 수 기반 전환율! 사용자가 많을수록 신뢰도 ↑</p>
            </div>
          </section>
        )}

        {/* AI가 대신 해줬으면 하는 업무 */}
        <section className="bg-white rounded-2xl shadow-md p-6 mb-6">
          <h3 className="text-xl font-bold text-slate-800 mb-6">😫 AI가 대신 해줬으면 하는 업무 <span className="text-sm font-normal text-slate-400">TOP 5</span></h3>
          
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
        <section className="bg-white rounded-2xl shadow-md p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-slate-800">
              🤖 AI 인사이트 <span className="text-sm font-normal text-slate-400">Gemini 2.5 Pro</span>
            </h3>
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
            <div className="bg-gradient-to-br from-slate-50 to-blue-50 rounded-xl p-6 prose prose-slate max-w-none">
              <div dangerouslySetInnerHTML={{ __html: insights.replace(/\n/g, "<br/>").replace(/##/g, "<h3>").replace(/\*\*/g, "") }} />
            </div>
          ) : (
            <div className="bg-slate-50 rounded-xl p-6 text-center text-slate-500">
              <p>버튼을 클릭하여 AI 인사이트를 생성하세요 ✨</p>
              <p className="text-xs mt-2 text-slate-400">응답 데이터 기반으로 신입사원에게 전하는 메시지를 생성합니다</p>
            </div>
          )}
        </section>

        {/* 푸터 */}
        <footer className="text-center text-slate-400 text-sm py-8 border-t border-slate-200">
          <p className="font-medium">© 2026 KPC 한국생산성본부 AI전환센터</p>
          <p className="mt-1">신입사원 AI 교육 - 실시간 설문 분석 대시보드</p>
          <p className="mt-3 text-xs text-slate-300">
            Designed by <span className="font-semibold text-slate-400">Junsung Sohn</span> | KPC AI전환센터
          </p>
        </footer>
      </div>

      {/* 글로벌 스타일 (애니메이션) */}
      <style jsx global>{`
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </main>
  );
}
