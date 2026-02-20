/**
 * aiClient.js
 * Google Gemini 3 Pro Preview를 통한 마케팅 카피/전략 동적 생성
 */
const { GoogleGenAI } = require('@google/genai');

/**
 * 행사별 AI 마케팅 콘텐츠 생성
 */
async function generateEventContent(apiKey, eventType, eventContext, dataSummary) {
  const ai = new GoogleGenAI({ apiKey });

  const eventDescriptions = {
    main: '메인 행사 (봄맞이 빅 세일) - 베스트셀러 중심 최대 60% 할인',
    sub: '서브 행사 (숨은 인기 아이템) - 중위권 상품 30~45% 할인',
    season: '시즌 행사 (S/S 프리뷰) - 봄/여름 신시즌 상품 20~35% 할인',
    offSeason: '역시즌 행사 - 여름 아이템을 겨울에 50~70% 파격 할인',
    newProduct: '신상품 출시 런칭 - 기획 상품 10~20% 런칭 특가',
    guerrilla: '게릴라 원데이 딜 - 24시간 한정 60~80% 초특가',
    deadStock: '악성재고 소진전 - 장기 재고 70~90% 대폭 할인'
  };

  const topProductNames = (eventContext.products || []).slice(0, 5).map(p => p.name).join(', ');

  const prompt = `당신은 한국 스포츠/신발 브랜드 "밸롭(BALLOP)"의 자사몰 마케팅 전문가입니다.

## 브랜드 정보
- 브랜드: 밸롭 (BALLOP) - 한국 스포츠웨어/신발 브랜드
- 주요 상품: 스니커즈, 슬리퍼, 아쿠아슈즈, 샌들, 트레킹화, 스포츠 의류
- 현재 시점: 2026년 2월, 겨울 끝자락

## 판매 데이터 요약
- 분석 기간: ${dataSummary.dateRange?.start || '2026-02-01'} ~ ${dataSummary.dateRange?.end || '2026-02-20'}
- 총 매출: ${Math.round((dataSummary.totalRevenue || 0) / 100000000 * 10) / 10}억원
- 총 판매: ${(dataSummary.totalSalesQty || 0).toLocaleString()}개
- 일평균 매출: ${Math.round((dataSummary.avgDailyRevenue || 0) / 10000).toLocaleString()}만원
- 매출 트렌드: ${dataSummary.trend || '상승'}

## 행사 유형
${eventDescriptions[eventType] || eventType}

## 주요 상품
${topProductNames || '밸롭 스니커즈, 지압 슬리퍼, 아쿠아슈즈 등'}

## 할인 범위
${eventContext.discountRange || '40~60%'}

아래 항목들을 JSON 형식으로 생성해주세요. 반드시 유효한 JSON만 출력하세요. 마크다운 코드블록 없이 순수 JSON만 출력:

{
  "title": "행사 제목 (한글, 20자 이내)",
  "subtitle": "부제목 (한글, 30자 이내)",
  "copy": ["마케팅 카피 5줄 (각 줄은 배열 요소)"],
  "slogan": "원라이너 슬로건",
  "marketingIdeas": ["마케팅 아이디어 6개 이상 (구체적, 실행 가능한)"],
  "issueStrategy": {
    "description": "이슈화 핵심 전략 한 줄",
    "tactics": ["구체적 이슈화 전술 5개"]
  },
  "conversionProcess": {
    "steps": [
      {"step": 1, "name": "단계명", "action": "구체적 행동", "channel": "채널"}
    ]
  },
  "gifts": {
    "tiers": [
      {"condition": "구매 조건", "gift": "사은품 내용"}
    ],
    "note": "사은품 관련 추가 안내"
  },
  "rewards": {
    "rate": "적립률",
    "condition": "적립 조건",
    "bonus": "추가 혜택"
  },
  "externalMarketing": [
    {"channel": "채널명", "plan": "구체적 실행 계획", "budget": "예산(선택)"}
  ],
  "kpiTargets": {
    "expectedRevenue": "예상 매출",
    "expectedOrders": 0,
    "conversionRate": "목표 전환율",
    "avgOrderValue": "목표 객단가"
  }
}`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        maxOutputTokens: 2000,
        temperature: 0.8
      }
    });

    const text = response.text || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error('AI 응답에서 JSON을 추출할 수 없음');
  } catch (err) {
    console.error(`AI 생성 실패 (${eventType}):`, typeof err === 'object' ? JSON.stringify(err.message || err) : err);
    return null;
  }
}

/**
 * 게릴라 딜 테마별 AI 콘텐츠 생성
 */
async function generateGuerrillaContent(apiKey, theme, products, dataSummary) {
  const ai = new GoogleGenAI({ apiKey });
  const productNames = products.map(p => p.name).join(', ');

  const prompt = `한국 스포츠 브랜드 "밸롭(BALLOP)"의 게릴라 원데이 딜 마케팅 콘텐츠를 생성해주세요.

테마: ${theme}
상품: ${productNames}
할인율: 60~80%
시간: 24시간 한정

아래 JSON 형식으로 생성. 마크다운 코드블록 없이 순수 유효한 JSON만 출력:
{
  "title": "오늘만 이 가격! — [테마]",
  "subtitle": "한 줄 서브 타이틀",
  "copy": ["긴급 마케팅 카피 4줄"],
  "slogan": "슬로건",
  "marketingIdeas": ["마케팅 아이디어 5개"],
  "issueStrategy": {"description": "전략 설명", "tactics": ["전술 4개"]}
}`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        maxOutputTokens: 1000,
        temperature: 0.8
      }
    });

    const text = response.text || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
    throw new Error('JSON 추출 실패');
  } catch (err) {
    console.error(`게릴라 딜 AI 생성 실패:`, err.message);
    return null;
  }
}

module.exports = { generateEventContent, generateGuerrillaContent };
