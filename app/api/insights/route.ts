import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

interface YearlyPaidItem {
  name: string;
  유료결제율: number;
  인원: number;
}

interface ChartDataItem {
  name: string;
  신입: number;
  기존: number;
}

export async function POST(request: Request) {
  try {
    const { stats, chartData, paidRatio, yearlyPaid } = await request.json();

    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { insights: "⚠️ GOOGLE_API_KEY 환경변수가 설정되지 않았습니다." },
        { status: 500 }
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });

    // 년차별 데이터 포맷팅
    const yearlyPaidText = yearlyPaid && yearlyPaid.length > 0
      ? yearlyPaid.map((d: YearlyPaidItem) => 
          `${d.name}: ${d.유료결제율}% (${d.인원}명)`
        ).join(', ')
      : '데이터 없음';

    const prompt = `
    당신은 KPC(한국생산성본부) AI 전환센터의 데이터 분석가입니다.
    아래 설문 결과를 바탕으로 신입사원 교육 발표용 인사이트를 작성해주세요.
    
    [응답자 현황]
    - 총 응답자: ${stats.total}명
    - 신입사원: ${stats.rookie}명 (${Math.round((stats.rookie / stats.total) * 100)}%)
    - 기존직원: ${stats.veteran}명 (${Math.round((stats.veteran / stats.total) * 100)}%)
    
    [유료 결제율]
    - 신입사원: ${paidRatio.rookie}%
    - 기존직원: ${paidRatio.veteran}%
    
    [년차별 유료 결제율 - 기존직원만]
    ${yearlyPaidText}
    
    [대화형 AI 사용률 - 그룹 내 비율]
    ${chartData.map((d: ChartDataItem) => 
      `- ${d.name}: 신입 ${d.신입}% / 기존 ${d.기존}%`
    ).join('\n')}
    
    다음 형식으로 작성해주세요:
    
    ## 🎯 핵심 발견
    1. (신입 vs 기존 비교 인사이트 - 구체적 수치 포함)
    2. (년차별 트렌드 분석 - 경력이 길수록? 짧을수록?)
    3. (가장 주목할 만한 도구 분석)
    
    ## 💡 재미있는 발견
    (데이터에서 발견한 의외의 사실 1가지)
    
    ## 💬 신입사원에게 한마디
    (환영 & 동기부여 메시지, 2-3문장)
    
    ## 🚀 KPC AI전환센터의 제안
    (AI 활용 팁 1가지)
    
    톤: 친근하고 활기차게, 이모지 적절히 사용
    분량: 총 250단어 내외
    숫자는 반드시 포함해서 구체적으로 작성
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    return NextResponse.json({ insights: text });
  } catch (error) {
    console.error("Gemini API Error:", error);
    return NextResponse.json(
      { insights: "⚠️ AI 인사이트 생성 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
