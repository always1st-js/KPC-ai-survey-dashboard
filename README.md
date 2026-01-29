# 🎯 AI, 어디까지 써봤니?

**KPC 직원 AI 활용 현황 실시간 대시보드**

신입사원 AI 교육에서 사용하는 설문 분석 대시보드입니다.

## ✨ 기능

- 📊 Google Forms 응답 실시간 시각화
- 👥 신입 vs 기존직원 비교 (그룹 내 % 기준)
- 💬 대화형 AI, 코딩 AI 사용률 차트
- 💳 유료 결제 금액 분포
- 🤖 Gemini 2.5 Pro 기반 AI 인사이트 생성

## 🚀 배포 방법 (Vercel)

### 1. GitHub에 푸시

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/kpc-ai-survey-dashboard.git
git push -u origin main
```

### 2. Vercel 연결

1. [vercel.com](https://vercel.com) 접속
2. "Import Project" → GitHub 저장소 선택
3. 환경변수 설정:
   - `GOOGLE_API_KEY`: Gemini API 키

### 3. 스프레드시트 공개 설정

Google Sheets에서:
1. 공유 버튼 클릭
2. "링크가 있는 모든 사용자" → "뷰어" 권한 부여

## 🔧 로컬 개발

```bash
# 의존성 설치
npm install

# 환경변수 설정
cp .env.example .env.local
# .env.local 파일에 GOOGLE_API_KEY 입력

# 개발 서버 실행
npm run dev
```

[http://localhost:3000](http://localhost:3000) 접속

## 📁 프로젝트 구조

```
├── app/
│   ├── page.tsx          # 메인 대시보드
│   ├── layout.tsx        # 레이아웃
│   ├── globals.css       # 전역 스타일
│   └── api/
│       └── insights/
│           └── route.ts  # Gemini API
├── package.json
├── tailwind.config.ts
└── README.md
```

## 🎨 기술 스택

- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS
- **Charts**: Recharts
- **AI**: Google Gemini 2.5 Pro
- **Deploy**: Vercel

## 📝 환경변수

| 변수명 | 설명 | 필수 |
|--------|------|------|
| `GOOGLE_API_KEY` | Gemini API 키 | ✅ |

## 👨‍💻 개발

KPC 한국생산성본부 AI전환센터

---

© 2026 KPC 한국생산성본부
