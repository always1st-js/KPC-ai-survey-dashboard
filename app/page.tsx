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

// 스프레드시트 ID (환경변수 또는 직접 입력)
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
}

// 색상 정의
const COLORS = {
  rookie: "#4285F4",
  veteran: "#34A853",
  pie: ["#4285F4", "#34A853", "#FBBC04", "#EA4335", "#9AA0A6"],
};

// 도구 목록
const TOOLS_대화형 = ["ChatGPT", "Claude", "Gemini", "뤼튼", "Copilot", "Perplexity"];
const TOOLS_코딩 = ["GitHub Copilot", "Cursor", "Google Colab", "Replit", "Claude Code"];
const TOOLS_이미지 = ["Midjourney", "DALL-E", "Stable Diffusion", "Canva AI", "Adobe Firefly"];

export default function Dashboard() {
  const [data, setData] = useState<SurveyData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<string>("");
  const [insights, setInsights] = useState<string>("");
  const [insightsLoading, setInsightsLoading] = useState(false);

  // 컬럼 찾기 함수
  const findColumn = useCallback((columns: string[], keywords: string[]) => {
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
        // 부분 매칭
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
      // Google Sheets를 CSV로 export
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

  // 차트 데이터 생성
  const getChartData = useCallback(
    (tools: string[], columnKeywords: string[]): ToolUsage[] => {
      if (data.length === 0) return [];

      const columns = Object.keys(data[0] || {});
      const col소속 = findColumn(columns, ["소속"]);
      const colTarget = findColumn(columns, columnKeywords);

      if (!col소속 || !colTarget) return [];

      const rookieData = data.filter((d) => d[col소속]?.includes("신입"));
      const veteranData = data.filter((d) => !d[col소속]?.includes("신입"));

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

  // 결제 금액 분포 데이터
  const getPaymentData = useCallback(() => {
    if (data.length === 0) return [];

    const columns = Object.keys(data[0] || {});
    const col결제 = findColumn(columns, ["결제", "금액"]);

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
    }));
  }, [data, findColumn]);

  // Gemini 인사이트 생성
  const generateInsights = async () => {
    setInsightsLoading(true);
    const stats = getStats();
    const chartData = getChartData(TOOLS_대화형, ["대화형", "사용한"]);

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
  const 대화형Data = getChartData(TOOLS_대화형, ["대화형", "사용한"]);
  const 코딩Data = getChartData(TOOLS_코딩, ["코딩", "개발", "사용한"]);
  const paymentData = getPaymentData();

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
          <div className="mt-4 flex items-center gap-4">
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
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="stat-card bg-white rounded-2xl shadow-md p-6 text-center">
            <p className="text-slate-500 text-sm mb-1">총 응답자</p>
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
        </section>

        {/* 대화형 AI 차트 */}
        <section className="chart-container mb-8 animate-fade-in">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-slate-800">
              💬 대화형 AI 사용률 비교
            </h2>
            <p className="text-sm text-slate-500">최근 3개월 기준 (그룹 내 %)</p>
          </div>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={대화형Data} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 12 }} />
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
                name={`신입 (n=${stats.rookie})`}
                fill={COLORS.rookie}
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="기존"
                name={`기존 (n=${stats.veteran})`}
                fill={COLORS.veteran}
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </section>

        {/* 코딩 AI 차트 */}
        <section className="chart-container mb-8 animate-fade-in">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-slate-800">
              💻 코딩·개발 AI 사용률 비교
            </h2>
            <p className="text-sm text-slate-500">최근 3개월 기준 (그룹 내 %)</p>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={코딩Data} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 11 }} />
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
                name={`신입 (n=${stats.rookie})`}
                fill={COLORS.rookie}
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="기존"
                name={`기존 (n=${stats.veteran})`}
                fill={COLORS.veteran}
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </section>

        {/* 결제 금액 분포 */}
        {paymentData.length > 0 && (
          <section className="chart-container mb-8 animate-fade-in">
            <h2 className="text-xl font-bold text-slate-800 mb-4">
              💳 월 평균 AI 유료 결제 금액 분포
            </h2>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={paymentData}
                  cx="50%"
                  cy="50%"
                  labelLine={true}
                  label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                  outerRadius={100}
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
            <div className="bg-slate-50 rounded-xl p-6 prose prose-slate max-w-none">
              <div dangerouslySetInnerHTML={{ __html: insights.replace(/\n/g, "<br/>") }} />
            </div>
          ) : (
            <div className="bg-slate-50 rounded-xl p-6 text-center text-slate-500">
              <p>버튼을 클릭하여 AI 인사이트를 생성하세요</p>
            </div>
          )}
        </section>

        {/* 푸터 */}
        <footer className="text-center text-slate-400 text-sm py-8">
          <p>© 2026 KPC 한국생산성본부 AI전환센터</p>
          <p className="mt-1">신입사원 AI 교육 - 실시간 설문 분석 대시보드</p>
        </footer>
      </div>
    </main>
  );
}
