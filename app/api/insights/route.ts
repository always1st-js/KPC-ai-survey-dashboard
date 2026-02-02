import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { stats, chartData } = await request.json();

    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { insights: "⚠️ GOOGLE_API_KEY 환경변수가 설정되지 않았습니다. Vercel 환경변수를 확인해주세요." },
        { status: 500 }
      );
    }

    // 데이터 검증
    if (!stats || stats.total === 0) {
      return NextResponse.json(
        { insights: "⚠️ 아직 응답 데이터가 없습니다. 설문 응답 후 다시 시도해주세요." },
        { status: 400 }
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    // 모델명: gemini-1.5-pro (안정적 + 고품질)
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

    const rookiePercent = stats.total > 0 ? Math.round((stats.rookie / stats.total) * 100) : 0;
    const veteranPercent = stats.total > 0 ? Math.round((stats.veteran / stats.total) * 100) : 0;

    const chartSummary = chartData && chartData.length > 0 
      ? chartData.map((d: { name: string; 신입: number; 기존: number }) => 
          `- ${d.name}: 신입 ${d.신입}% / 기존 ${d.기존}%`
        ).join('\n')
      : "- 데이터 수집 중";

    const prompt = `
    당신은 KPC(한국생산성본부) AI 전환센터의 데이터 분석가입니다.
    아래 설문 결과를 바탕으로 신입사원 교육 발표용 인사이트를 작성해주세요.
    
    [응답자 현황]
    - 총 응답자: ${stats.total}명
    - 신입사원: ${stats.rookie}명 (${rookiePercent}%)
    - 기존직원: ${stats.veteran}명 (${veteranPercent}%)
    
    [대화형 AI 사용률 - 그룹 내 비율]
    ${chartSummary}
    
    다음 형식으로 작성해주세요:
    
    ## 🎯 핵심 발견
    1. (신입 vs 기존 비교 인사이트 - 구체적 수치 포함)
    2. (가장 많이 사용하는 도구 분석)
    3. (주목할 만한 차이점)
    
    ## 💬 신입사원에게 한마디
    (환영 & 동기부여 메시지, 2-3문장. 따뜻하고 응원하는 톤으로!)
    
    ## 🚀 KPC AI전환센터의 제안
    (AI 활용 팁 1가지)
    
    톤: 친근하고 활기차게, 이모지 적절히 사용
    분량: 총 300단어 내외
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    return NextResponse.json({ insights: text });
  } catch (error) {
    console.error("Gemini API Error:", error);
    
    // 에러 타입에 따른 메시지
    const errorMessage = error instanceof Error ? error.message : "알 수 없는 오류";
    
    return NextResponse.json(
      { insights: `⚠️ AI 인사이트 생성 중 오류가 발생했습니다.\n\n에러: ${errorMessage}\n\n환경변수(GOOGLE_API_KEY)와 API 할당량을 확인해주세요.` },
      { status: 500 }
    );
  }
}
