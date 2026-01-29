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

interface YearUsage {
  name: string;
  [key: string]: string | number;
}

interface GroupStats {
  total: number;
  rookie: number;
  veteran: number;
}

// 색상 정의
const COLORS = {
  rookie: "#4285F4",
  veteran: "#34A853",
  pie: ["#4285F4", "#34A853", "#FBBC04", "#EA4335", "#9AA0A6", "#7C3AED", "#F97316"],
  gradient: ["#3B82F6", "#8B5CF6", "#EC4899", "#F97316", "#10B981"],
  years: ["#4285F4", "#34A853", "#FBBC04", "#EA4335", "#7C3AED"],
};

// 년차 순서 정의 (새로운 기준)
const YEAR_ORDER = [
  "1년 미만",
  "1년 이상 ~ 5년 미만", 
  "5년 이상 ~ 10년 미만",
  "10년 이상 ~ 15년 미만",
  "15년 이상"
];

const YEAR_SHORT = ["~1년", "1~5년", "5~10년", "10~15년", "15년+"];

// 도구 목록 (실제 스프레드시트 데이터와 일치)
const TOOLS = {
  대화형: ["ChatGPT", "Claude", "Gemini", "뤼튼", "Copilot", "Perplexity"],
  코딩: ["GitHub Copilot", "Cursor", "Google Colab", "Replit", "Claude Code", "Windsurf"],
  이미지: ["Midjourney", "DALL-E", "Stable Diffusion", "Canva AI", "Adobe Firefly"],
  영상: ["Runway", "Suno", "ElevenLabs", "Vrew", "HeyGen"],
  문서: ["Notion AI", "Gamma", "한글 AI", "MS Copilot", "Google Workspace AI"],
  자동화: ["Google Opal", "n8n", "Make", "Zapier", "Google Apps Script", "Power Automate"],
  협업: ["Notion", "Slack", "MS Teams", "Google Workspace", "Figma", "Miro", "Jira", "카카오워크"],
};

// 섹션 컴포넌트
const SectionTitle = ({ emoji, title, subtitle }: { emoji: string; title: string; subtitle?: string }) => (
  <div className="flex items-center justify-between mb-4">
    <h2 className="text-xl font-bold text-slate-800">
      {emoji} {title}
    </h2>
    {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
  </div>
);

// 비교 차트 컴포넌트
const ComparisonChart = ({ 
  data, 
  title, 
  emoji,
  rookieCount, 
  veteranCount 
}: { 
  data: ToolUsage[]; 
  title: string;
  emoji: string;
  rookieCount: number; 
  veteranCount: number;
}) => (
  <section className="chart-container mb-6 animate-fade-in">
    <SectionTitle emoji={emoji} title={title} subtitle="최근 3개월 기준 (그룹 내 %)" />
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 11 }} interval={0} />
        <YAxis
          tick={{ fill: "#64748b", fontSize: 12 }}
          domain={[0, 100]}
          tickFormatter={(v) => `${v}%`}
        />
        <Tooltip
          formatter={(value: number) => [`${value}%`, ""]}
          contentStyle={{
            backgroundColor: "white",
            borderRadius: "12px",
            border: "none",
            boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
          }}
        />
        <Legend />
        <Bar
          dataKey="신입"
          name={`신입 (n=${rookieCount})`}
          fill={COLORS.rookie}
          radius={[4, 4, 0, 0]}
        />
        <Bar
          dataKey="기존"
          name={`기존 (n=${veteranCount})`}
          fill={COLORS.veteran}
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  </section>
);

export default function Dashboard() {
  const [data, setData] = useState<SurveyData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<string>("");
  const [insights, setInsights] = useState<string>("");
  const [insightsLoading, setInsightsLoading] = useState(false);

  // 컬럼 찾기 함수 (모든 키워드가 포함된 컬럼 찾기)
  const findColumn = useCallback((columns: string[], keywords: string[]) => {
    for (const col of columns) {
      // 모든 키워드가 컬럼명에 포함되어야 함
      const allMatch = keywords.every(keyword => col.includes(keyword));
      if (allMatch) return col;
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
              count = counter[key];
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
        throw new Error("스프레드시트를 불러올 수 없습니다. 공개 설정을 확인해주세요.");
      }

      const csvText = await response.text();

      Papa.parse(csvText, {
        header: true,
        complete: (results) => {
          setData(results.data as SurveyData[]);
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
    if (data.length === 0) return { total: 0, rookie: 0, veteran: 0 };

    const columns = Object.keys(data[0] || {});
    const col소속 = findColumn(columns, ["소속"]);

    if (!col소속) return { total: data.length, rookie: 0, veteran: 0 };

    const rookie = data.filter((d) => d[col소속]?.includes("신입")).length;
    const veteran = data.length - rookie;

    return { total: data.length, rookie, veteran };
  }, [data, findColumn]);

  // 그룹 데이터 분리
  const getGroupData = useCallback(() => {
    if (data.length === 0) return { rookie: [], veteran: [] };

    const columns = Object.keys(data[0] || {});
    const col소속 = findColumn(columns, ["소속"]);

    if (!col소속) return { rookie: [], veteran: [] };

    return {
      rookie: data.filter((d) => d[col소속]?.includes("신입")),
      veteran: data.filter((d) => !d[col소속]?.includes("신입")),
    };
  }, [data, findColumn]);

  // 년차별 데이터 분리
  const getYearGroups = useCallback(() => {
    if (data.length === 0) return {};

    const columns = Object.keys(data[0] || {});
    const col년차 = findColumn(columns, ["근속", "연수", "년차"]);
    const col소속 = findColumn(columns, ["소속"]);

    if (!col년차) return {};

    const groups: { [key: string]: SurveyData[] } = {};
    
    data.forEach((d) => {
      if (col소속 && d[col소속]?.includes("신입")) return;
      
      const year = d[col년차];
      if (year) {
        if (!groups[year]) groups[year] = [];
        groups[year].push(d);
      }
    });

    return groups;
  }, [data, findColumn]);

  // 년차별 도구 사용률 계산
  const getYearlyToolUsage = useCallback((tools: string[], columnKeywords: string[]): YearUsage[] => {
    const yearGroups = getYearGroups();
    const columns = Object.keys(data[0] || {});
    const colTarget = findColumn(columns, columnKeywords);
    
    if (!colTarget || Object.keys(yearGroups).length === 0) return [];

    return tools.map((tool) => {
      const result: YearUsage = { name: tool };
      
      YEAR_ORDER.forEach((year, idx) => {
        const group = yearGroups[year] || [];
        if (group.length === 0) {
          result[YEAR_SHORT[idx]] = 0;
          return;
        }
        
        const responses = group.map((d) => d[colTarget] || "");
        const counter = parseCheckbox(responses);
        
        let count = counter[tool] || 0;
        if (count === 0) {
          Object.keys(counter).forEach((key) => {
            if (key.toLowerCase().includes(tool.toLowerCase()) || 
                tool.toLowerCase().includes(key.toLowerCase())) {
              count = counter[key];
            }
          });
        }
        
        result[YEAR_SHORT[idx]] = Math.round((count / group.length) * 100);
      });
      
      return result;
    });
  }, [data, findColumn, getYearGroups, parseCheckbox]);

  // 년차별 유료 결제율
  const getYearlyPaidRate = useCallback(() => {
    const yearGroups = getYearGroups();
    const columns = Object.keys(data[0] || {});
    const col결제 = findColumn(columns, ["월 평균", "총액", "결제 금액은"]);
    
    if (!col결제 || Object.keys(yearGroups).length === 0) return [];

    return YEAR_ORDER.map((year, idx) => {
      const group = yearGroups[year] || [];
      if (group.length === 0) return { name: YEAR_SHORT[idx], 유료결제율: 0, 인원: 0 };
      
      const paidCount = group.filter((d) => d[col결제] && !d[col결제].includes("0원")).length;
      
      return {
        name: YEAR_SHORT[idx],
        유료결제율: Math.round((paidCount / group.length) * 100),
        인원: group.length,
      };
    }).filter(d => d.인원 > 0);
  }, [data, findColumn, getYearGroups]);

  // 년차별 인원 분포
  const getYearDistribution = useCallback(() => {
    const yearGroups = getYearGroups();
    
    return YEAR_ORDER.map((year, idx) => ({
      name: YEAR_SHORT[idx],
      fullName: year,
      value: (yearGroups[year] || []).length,
    })).filter(d => d.value > 0);
  }, [getYearGroups]);

  // 차트 데이터 생성
  const getChartData = useCallback(
    (tools: string[], columnKeywords: string[]): ToolUsage[] => {
      if (data.length === 0) return [];

      const columns = Object.keys(data[0] || {});
      const colTarget = findColumn(columns, columnKeywords);

      if (!colTarget) return [];

      const { rookie, veteran } = getGroupData();
      const rookieRates = calcGroupPercentage(rookie, colTarget, tools);
      const veteranRates = calcGroupPercentage(veteran, colTarget, tools);

      return tools.map((tool, i) => ({
        name: tool,
        신입: rookieRates[i],
        기존: veteranRates[i],
      }));
    },
    [data, findColumn, getGroupData, calcGroupPercentage]
  );

  // AI 활용 상황 데이터
  const getUsageData = useCallback(() => {
    if (data.length === 0) return [];

    const columns = Object.keys(data[0] || {});
    const col활용 = findColumn(columns, ["활용", "상황", "어떤"]);

    if (!col활용) return [];

    const counter: { [key: string]: number } = {};
    data.forEach((d) => {
      const val = d[col활용];
      if (val) {
        val.split(", ").forEach((item) => {
          const trimmed = item.trim();
          if (trimmed && !trimmed.includes("사용 안") && !trimmed.includes("기타")) {
            counter[trimmed] = (counter[trimmed] || 0) + 1;
          }
        });
      }
    });

    return Object.entries(counter)
      .map(([name, value]) => ({
        name: name.length > 12 ? name.slice(0, 12) + "..." : name,
        value: Math.round((value / data.length) * 100),
        fullName: name,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [data, findColumn]);

  // 결제 금액 분포 데이터
  const getPaymentData = useCallback(() => {
    if (data.length === 0) return [];

    const columns = Object.keys(data[0] || {});
    const col결제 = findColumn(columns, ["월 평균", "총액", "결제 금액은"]);

    if (!col결제) return [];

    const counter: { [key: string]: number } = {};
    data.forEach((d) => {
      const val = d[col결제];
      if (val) counter[val] = (counter[val] || 0) + 1;
    });

    return Object.entries(counter).map(([name, value]) => ({
      name: name.length > 15 ? name.slice(0, 15) + "..." : name,
      value,
      fullName: name,
      percent: Math.round((value / data.length) * 100),
    }));
  }, [data, findColumn]);

  // 그룹별 유료 결제 비율
  const getPaidRatio = useCallback(() => {
    if (data.length === 0) return { rookie: 0, veteran: 0 };

    const columns = Object.keys(data[0] || {});
    const col결제 = findColumn(columns, ["월 평균", "총액", "결제 금액은"]);
    const { rookie, veteran } = getGroupData();

    if (!col결제) return { rookie: 0, veteran: 0 };

    const rookiePaid = rookie.filter((d) => d[col결제] && !d[col결제].includes("0원")).length;
    const veteranPaid = veteran.filter((d) => d[col결제] && !d[col결제].includes("0원")).length;

    return {
      rookie: rookie.length > 0 ? Math.round((rookiePaid / rookie.length) * 100) : 0,
      veteran: veteran.length > 0 ? Math.round((veteranPaid / veteran.length) * 100) : 0,
    };
  }, [data, findColumn, getGroupData]);

  // Gemini 인사이트 생성
  const generateInsights = async () => {
    setInsightsLoading(true);
    const stats = getStats();
    const chartData = getChartData(TOOLS.대화형, ["대화형", "사용한"]);
    const paidRatio = getPaidRatio();
    const yearlyPaid = getYearlyPaidRate();

    try {
      const response = await fetch("/api/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stats, chartData, paidRatio, yearlyPaid }),
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
  const 대화형Data = getChartData(TOOLS.대화형, ["대화형", "사용한"]);
  const 코딩Data = getChartData(TOOLS.코딩, ["코딩", "사용한"]);
  const 이미지Data = getChartData(TOOLS.이미지, ["이미지", "사용한"]);
  const 영상Data = getChartData(TOOLS.영상, ["영상", "사용한"]);
  const 문서Data = getChartData(TOOLS.문서, ["문서", "사용한"]);
  const 자동화Data = getChartData(TOOLS.자동화, ["자동화", "사용한"]);
  const 협업Data = getChartData(TOOLS.협업, ["협업 도구", "사용한"]);
  const usageData = getUsageData();
  const paymentData = getPaymentData();
  
  // 년차별 데이터
  const yearDistribution = getYearDistribution();
  const yearlyPaidRate = getYearlyPaidRate();
  const yearly대화형 = getYearlyToolUsage(["ChatGPT", "Claude", "Gemini"], ["대화형", "사용한"]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="loading-spinner mx-auto mb-4"></div>
          <p className="text-slate-600">데이터를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center bg-white p-8 rounded-2xl shadow-lg">
          <p className="text-red-500 text-xl mb-4">⚠️ {error}</p>
          <button
            onClick={loadData}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      {/* 헤더 */}
      <header className="gradient-header text-white py-8 px-4">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-bold mb-2">
            🎯 AI, 어디까지 써봤니?
          </h1>
          <p className="text-blue-100 text-lg">
            KPC 직원 AI 활용 현황 실시간 대시보드
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
        {/* 응답자 현황 카드 */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="stat-card bg-white rounded-2xl shadow-md p-6 text-center">
            <p className="text-slate-500 text-sm mb-1">📊 총 응답자</p>
            <p className="text-4xl font-bold text-slate-800">{stats.total}</p>
            <p className="text-slate-400 text-sm">명</p>
          </div>
          <div className="stat-card bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl shadow-md p-6 text-center text-white">
            <p className="text-blue-100 text-sm mb-1">🆕 신입사원</p>
            <p className="text-4xl font-bold">{stats.rookie}</p>
            <p className="text-blue-100 text-sm">
              명 ({stats.total > 0 ? Math.round((stats.rookie / stats.total) * 100) : 0}%)
            </p>
          </div>
          <div className="stat-card bg-gradient-to-br from-green-500 to-green-600 rounded-2xl shadow-md p-6 text-center text-white">
            <p className="text-green-100 text-sm mb-1">👔 기존직원</p>
            <p className="text-4xl font-bold">{stats.veteran}</p>
            <p className="text-green-100 text-sm">
              명 ({stats.total > 0 ? Math.round((stats.veteran / stats.total) * 100) : 0}%)
            </p>
          </div>
          <div className="stat-card bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl shadow-md p-6 text-center text-white">
            <p className="text-purple-100 text-sm mb-1">💳 유료 결제율</p>
            <div className="flex justify-center gap-3 mt-2">
              <div>
                <p className="text-2xl font-bold">{paidRatio.rookie}%</p>
                <p className="text-purple-200 text-xs">신입</p>
              </div>
              <div className="text-purple-300 self-center">vs</div>
              <div>
                <p className="text-2xl font-bold">{paidRatio.veteran}%</p>
                <p className="text-purple-200 text-xs">기존</p>
              </div>
            </div>
          </div>
        </section>

        {/* ========== 년차별 분석 섹션 ========== */}
        {yearDistribution.length > 0 && (
          <section className="mb-8">
            <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-2xl p-4 mb-6">
              <h2 className="text-xl font-bold">📅 년차별 AI 활용 분석</h2>
              <p className="text-amber-100 text-sm">기존직원을 근속연수별로 분석합니다</p>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* 년차별 인원 분포 */}
              <div className="chart-container animate-fade-in">
                <SectionTitle emoji="👥" title="기존직원 년차별 분포" />
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={yearDistribution}
                      cx="50%"
                      cy="50%"
                      labelLine={true}
                      label={({ name, value }) => `${name}: ${value}명`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {yearDistribution.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS.years[index % COLORS.years.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* 년차별 유료 결제율 */}
              <div className="chart-container animate-fade-in">
                <SectionTitle emoji="💳" title="년차별 유료 결제율" subtitle="년차가 높을수록?" />
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={yearlyPaidRate} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 12 }} />
                    <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fill: "#64748b", fontSize: 12 }} />
                    <Tooltip 
                      formatter={(value: number) => [`${value}%`, "유료 결제율"]}
                      contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
                    />
                    <Bar dataKey="유료결제율" fill="#F59E0B" radius={[4, 4, 0, 0]}>
                      {yearlyPaidRate.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS.years[index % COLORS.years.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 년차별 주요 AI 도구 사용률 */}
            {yearly대화형.length > 0 && (
              <div className="chart-container animate-fade-in mb-6">
                <SectionTitle emoji="📊" title="년차별 주요 AI 도구 사용률" subtitle="ChatGPT vs Claude vs Gemini" />
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={yearly대화형} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 12 }} />
                    <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fill: "#64748b", fontSize: 12 }} />
                    <Tooltip 
                      formatter={(value: number) => [`${value}%`, ""]}
                      contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
                    />
                    <Legend />
                    {YEAR_SHORT.map((year, idx) => (
                      <Bar key={year} dataKey={year} fill={COLORS.years[idx]} radius={[4, 4, 0, 0]} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
                <p className="text-center text-slate-500 text-sm mt-2">
                  ※ 기존직원만 대상 (신입사원 제외)
                </p>
              </div>
            )}
          </section>
        )}

        {/* ========== 신입 vs 기존 비교 섹션 ========== */}
        <section className="mb-8">
          <div className="bg-gradient-to-r from-blue-500 to-green-500 text-white rounded-2xl p-4 mb-6">
            <h2 className="text-xl font-bold">👥 신입 vs 기존직원 AI 활용 비교</h2>
            <p className="text-blue-100 text-sm">모든 수치는 각 그룹 내 비율(%)입니다</p>
          </div>

          {/* 대화형 AI */}
          {대화형Data.length > 0 && (
            <ComparisonChart
              data={대화형Data}
              title="대화형 AI 사용률"
              emoji="💬"
              rookieCount={stats.rookie}
              veteranCount={stats.veteran}
            />
          )}

          {/* 코딩·개발 AI */}
          {코딩Data.length > 0 && (
            <ComparisonChart
              data={코딩Data}
              title="코딩·개발 AI 사용률"
              emoji="💻"
              rookieCount={stats.rookie}
              veteranCount={stats.veteran}
            />
          )}

          {/* 2열 그리드 - 이미지 & 영상 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {이미지Data.length > 0 && (
              <section className="chart-container animate-fade-in">
                <SectionTitle emoji="🎨" title="이미지·디자인 AI" subtitle="그룹 내 %" />
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={이미지Data} layout="vertical" margin={{ top: 5, right: 30, left: 80, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={80} />
                    <Tooltip formatter={(value: number) => [`${value}%`, ""]} />
                    <Legend />
                    <Bar dataKey="신입" fill={COLORS.rookie} radius={[0, 4, 4, 0]} />
                    <Bar dataKey="기존" fill={COLORS.veteran} radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </section>
            )}

            {영상Data.length > 0 && (
              <section className="chart-container animate-fade-in">
                <SectionTitle emoji="🎬" title="영상·음성 AI" subtitle="그룹 내 %" />
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={영상Data} layout="vertical" margin={{ top: 5, right: 30, left: 80, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={80} />
                    <Tooltip formatter={(value: number) => [`${value}%`, ""]} />
                    <Legend />
                    <Bar dataKey="신입" fill={COLORS.rookie} radius={[0, 4, 4, 0]} />
                    <Bar dataKey="기존" fill={COLORS.veteran} radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </section>
            )}
          </div>

          {/* 문서·생산성 AI */}
          {문서Data.length > 0 && (
            <ComparisonChart
              data={문서Data}
              title="문서·생산성 AI 사용률"
              emoji="📝"
              rookieCount={stats.rookie}
              veteranCount={stats.veteran}
            />
          )}

          {/* 2열 그리드 - 자동화 & 협업 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {자동화Data.length > 0 && (
              <section className="chart-container animate-fade-in">
                <SectionTitle emoji="🔄" title="자동화 도구" subtitle="그룹 내 %" />
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={자동화Data} layout="vertical" margin={{ top: 5, right: 30, left: 90, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={85} />
                    <Tooltip formatter={(value: number) => [`${value}%`, ""]} />
                    <Legend />
                    <Bar dataKey="신입" fill={COLORS.rookie} radius={[0, 4, 4, 0]} />
                    <Bar dataKey="기존" fill={COLORS.veteran} radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </section>
            )}

            {협업Data.length > 0 && (
              <section className="chart-container animate-fade-in">
                <SectionTitle emoji="🤝" title="협업 도구" subtitle="그룹 내 %" />
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={협업Data} layout="vertical" margin={{ top: 5, right: 30, left: 90, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={85} />
                    <Tooltip formatter={(value: number) => [`${value}%`, ""]} />
                    <Legend />
                    <Bar dataKey="신입" fill={COLORS.rookie} radius={[0, 4, 4, 0]} />
                    <Bar dataKey="기존" fill={COLORS.veteran} radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </section>
            )}
          </div>
        </section>

        {/* ========== 종합 분석 섹션 ========== */}
        <section className="mb-8">
          <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-2xl p-4 mb-6">
            <h2 className="text-xl font-bold">📈 종합 분석</h2>
            <p className="text-purple-100 text-sm">전체 응답자 기준 분석입니다</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {usageData.length > 0 && (
              <section className="chart-container animate-fade-in">
                <SectionTitle emoji="🎯" title="AI 활용 상황 TOP 8" subtitle="전체 응답자 기준" />
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={usageData} layout="vertical" margin={{ top: 5, right: 30, left: 90, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={85} />
                    <Tooltip formatter={(value: number) => [`${value}%`, "응답률"]} />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                      {usageData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS.gradient[index % COLORS.gradient.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </section>
            )}

            {paymentData.length > 0 && (
              <section className="chart-container animate-fade-in">
                <SectionTitle emoji="💳" title="월 평균 AI 결제 금액" />
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={paymentData}
                      cx="50%"
                      cy="50%"
                      labelLine={true}
                      label={({ name, percent }) => `${name} (${percent}%)`}
                      outerRadius={90}
                      fill="#8884d8"
                      dataKey="value"
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
        </section>

        {/* AI 인사이트 섹션 */}
        <section className="chart-container mb-8 animate-fade-in">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-slate-800">
              🤖 AI 인사이트 (Gemini 2.5 Pro)
            </h2>
            <button
              onClick={generateInsights}
              disabled={insightsLoading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-400 transition flex items-center gap-2"
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
            <div className="bg-gradient-to-br from-slate-50 to-blue-50 rounded-xl p-6 prose prose-slate max-w-none whitespace-pre-wrap">
              {insights}
            </div>
          ) : (
            <div className="bg-slate-50 rounded-xl p-8 text-center text-slate-500">
              <p className="text-lg">✨ 버튼을 클릭하여 AI 인사이트를 생성하세요</p>
              <p className="text-sm mt-2">Gemini 2.5 Pro가 설문 결과를 분석합니다</p>
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
    </main>
  );
}
