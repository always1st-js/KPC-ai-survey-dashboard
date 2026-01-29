import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { stats, chartData } = await request.json();

    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { insights: "⚠️ GOOGLE_API_KEY 환경변수가 설정되지 않았습니다." },
        { status: 500 }
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });

    const prompt = `
    당신은 KPC(한국생산성본부) AI 전환센터의 데이터 분석가입니다.
    아래 설문 결과를 바탕으로 신입사원 교육 발표용 인사이트를 작성해주세요.
    
    [응답자 현황]
    - 총 응답자: ${stats.total}명
    - 신입사원: ${stats.rookie}명 (${Math.round((stats.rookie / stats.total) * 100)}%)
    - 기존직원: ${stats.veteran}명 (${Math.round((stats.veteran / stats.total) * 100)}%)
    
    [대화형 AI 사용률 - 그룹 내 비율]
    ${chartData.map((d: { name: string; 신입: number; 기존: number }) => 
      `- ${d.name}: 신입 ${d.신입}% / 기존 ${d.기존}%`
    ).join('\n')}
    
    다음 형식으로 작성해주세요:
    
    ## 🎯 핵심 발견
    1. (신입 vs 기존 비교 인사이트 - 구체적 수치 포함)
    2. (가장 많이 사용하는 도구 분석)
    3. (주목할 만한 차이점)
    
    ## 💬 신입사원에게 한마디
    (환영 & 동기부여 메시지, 2-3문장)
    
    ## 🚀 KPC AI전환센터의 제안
    (AI 활용 팁 1가지)
    
    톤: 친근하고 활기차게, 이모지 적절히 사용
    분량: 총 200단어 내외
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
