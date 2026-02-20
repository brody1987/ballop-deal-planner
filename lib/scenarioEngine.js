/**
 * scenarioEngine.js v2
 * 데이터 기반 행사 시나리오 생성 엔진
 *
 * v2 개선사항:
 *  1) 행사 간 상품 중복 제거 (동일 상품 다른 가격 방지)
 *  2) 게릴라 딜별 차별화된 카피
 *  3) 데이터 기반 KPI 산출 (일평균 매출, 객단가, 전환율 역산)
 *  4) 마진 안전장치 (BEP 이하 상품 제외 or 할인율 조정)
 *  5) 부진 재고 → 사은품/묶음 연계
 *  6) 카테고리 건강도 진단
 *  7) 행사별 마케팅 예산 배분
 *  8) 타겟 고객 정의
 */
const aiClient = require('./aiClient');

// ── 유틸리티 ──
function roundTo100(price) { return Math.round(price / 100) * 100; }

function effectiveTag(p) {
  if (p.tagPrice > 0) return p.tagPrice;
  if (p.avgSalePrice > 0) return roundTo100(p.avgSalePrice * 1.6);
  if (p.cost > 0) return roundTo100(p.cost * 3);
  return 0;
}

function calcEventPrice(tag, cost, discountRate, allowLoss) {
  let eventPrice = roundTo100(tag * (1 - discountRate));
  if (!allowLoss && cost > 0 && eventPrice < roundTo100(cost * 1.05)) {
    eventPrice = roundTo100(cost * 1.1);
  }
  return Math.max(eventPrice, 100);
}

function buildProduct(p, discountRate, allowLoss) {
  const tag = effectiveTag(p);
  const cost = p.cost || 0;
  const eventPrice = calcEventPrice(tag, cost, discountRate, allowLoss);
  const actualDisc = tag > 0 ? Math.round((1 - eventPrice / tag) * 10000) / 100 : 0;
  const markup = cost > 0 ? Math.round((eventPrice / cost) * 100) / 100 : 0;
  const margin = cost > 0 ? Math.round((1 - cost / eventPrice) * 10000) / 100 : 0;
  // BEP 플래그
  const belowBEP = cost > 0 && eventPrice < cost;
  const profitPerUnit = eventPrice - cost;
  return {
    code: p.code, name: p.name, category: p.category, tagPrice: tag,
    eventPrice, discountRate: actualDisc, cost: Math.round(cost),
    stock: p.stock || 0, salesQty: p.salesQty || 0,
    expectedMargin: margin, markup, dailySalesRate: p.dailySalesRate || 0,
    belowBEP, profitPerUnit: Math.round(profitPerUnit)
  };
}

function varyRate(baseMin, baseMax, marginRate) {
  const range = baseMax - baseMin;
  const offset = marginRate > 60 ? range * 0.6 : marginRate > 45 ? range * 0.3 : 0;
  return Math.round(Math.min(baseMax, baseMin + offset + Math.random() * range * 0.4) * 100) / 100;
}

function isSummerItem(p) {
  const name = p.name || '';
  return p.category === '아쿠아슈즈/샌들' ||
    ['래쉬가드', '수영', '스윔', '비치타올', '워터팬츠', '워터레깅스', '드라이백'].some(k => name.includes(k));
}

// ── [개선 #4] 마진 안전 필터: BEP 이하 상품 제외 (악성재고 제외) ──
function marginSafeFilter(products, minMarginPct = 5) {
  return products.filter(p => {
    if (p.cost <= 0) return true; // 원가 정보 없으면 통과
    return p.expectedMargin >= minMarginPct;
  });
}

// ── [개선 #3] 데이터 기반 KPI 산출 ──
function calcKPI(summary, products, eventDays, eventType) {
  const avgDailyRev = summary.avgDailyRevenue || 0;
  const totalSalesQty = summary.totalSalesQty || 1;
  const totalRevenue = summary.totalRevenue || 1;
  const avgOrderValue = Math.round(totalRevenue / totalSalesQty);

  // 행사 유형별 트래픽 부스트 배수 (과거 이커머스 벤치마크 기준)
  const boostMultiplier = {
    main: 2.5, sub: 1.4, season: 1.8, offSeason: 1.3,
    newProduct: 1.5, guerrilla: 3.0, deadStock: 1.2
  };
  const boost = boostMultiplier[eventType] || 1.5;

  // 행사별 전환율 벤치마크 (자사몰 기준, 업계 평균 참고)
  const cvrBenchmark = {
    main: 3.5, sub: 2.8, season: 3.0, offSeason: 2.5,
    newProduct: 2.2, guerrilla: 6.0, deadStock: 4.0
  };
  const cvr = cvrBenchmark[eventType] || 3.0;

  const expectedDailyRev = Math.round(avgDailyRev * boost);
  const expectedRevenue = expectedDailyRev * eventDays;
  const eventAvgPrice = products.length > 0
    ? Math.round(products.reduce((s, p) => s + p.eventPrice, 0) / products.length)
    : avgOrderValue;
  const expectedOrders = Math.round(expectedRevenue / Math.max(eventAvgPrice, 1));

  // 산출 근거 텍스트
  const basis = `일평균 매출 ${Math.round(avgDailyRev / 10000).toLocaleString()}만원 × 부스트 ${boost}배 × ${eventDays}일 = ${Math.round(expectedRevenue / 10000).toLocaleString()}만원 (CVR ${cvr}% 기준, 평균 객단가 ${eventAvgPrice.toLocaleString()}원)`;

  return {
    expectedRevenue: `${Math.round(expectedRevenue / 10000)}만원`,
    expectedOrders,
    conversionRate: `${cvr}%`,
    avgOrderValue: `${eventAvgPrice.toLocaleString()}원`,
    calculationBasis: basis
  };
}

// ── [개선 #6] 카테고리 건강도 진단 ──
function diagnoseCategoryHealth(data) {
  const cats = Array.isArray(data.categories) ? data.categories : Object.values(data.categories || {});
  return cats.map(c => {
    const stockToSalesRatio = c.totalSalesQty > 0 ? (c.totalStock / c.totalSalesQty) : 999;
    let status, action;
    if (c.totalSalesQty === 0 && c.totalStock > 0) {
      status = 'critical'; action = '행사 제외 권고 — 악성재고 소진전 또는 사은품/묶음 전환';
    } else if (stockToSalesRatio > 50) {
      status = 'warning'; action = '재고 과잉 — 역시즌/악성재고 행사에 집중 배치, 묶음 할인 적용';
    } else if (stockToSalesRatio > 20) {
      status = 'caution'; action = '판매 대비 재고 높음 — 할인폭 확대 또는 서브 행사 배치';
    } else if (c.totalSalesQty > 0 && c.totalStock < c.totalSalesQty * 0.3) {
      status = 'low_stock'; action = '재고 부족 주의 — 할인폭 축소, 리오더 검토';
    } else {
      status = 'healthy'; action = '정상 — 메인/시즌 행사 적극 활용';
    }
    return {
      name: c.name, totalProducts: c.totalProducts, totalStock: c.totalStock,
      totalSalesQty: c.totalSalesQty || 0,
      totalSalesRevenue: c.totalSalesRevenue || 0,
      stockToSalesRatio: Math.round(stockToSalesRatio * 10) / 10,
      status, action
    };
  });
}

// ── [개선 #2] 게릴라 딜별 차별화된 카피 ──
const guerrillaCopyByTheme = {
  0: { // 슬리퍼
    copy: ['발이 편해야 하루가 편합니다.', '밸롭 건강 슬리퍼, 오늘 단 하루 파격가!', '지압 효과로 매일의 피로를 풀어보세요.', '1인 2개 한정, 자정까지만!'],
    slogan: '발바닥이 행복한 하루 — 슬리퍼 초특가',
    marketingIdeas: ['발 건강 인포그래픽', '오전 10시 알림톡 발송', '후기 사진 리그램 이벤트', '슬리퍼 착용 챌린지', 'ASMR 지압 영상']
  },
  1: { // 스니커즈
    copy: ['봄 데일리 슈즈, 이 가격 실화?', '밸롭 스니커즈 최대 80% OFF — 오늘 하루만!', '출퇴근부터 주말 나들이까지, 올봄 필수템.', '수량 한정, 선착순 마감!'],
    slogan: '봄 발걸음은 밸롭 스니커즈와 — 80% OFF',
    marketingIdeas: ['봄 코디 룩북 인스타 릴스', '사이즈별 실시간 잔여량 표시', '스니커즈 커스텀 이벤트', '직장인 출근룩 투표', '오후 2시 추가 물량 오픈']
  },
  2: { // 아쿠아
    copy: ['올 여름 준비, 지금이 제일 싸다!', '아쿠아슈즈 역시즌 초특가 — 정시즌의 절반 가격!', '물놀이 시즌 전에 미리 득템하세요.', '재입고 없는 한정 수량!'],
    slogan: '여름을 앞서가는 가격 — 아쿠아 플래시',
    marketingIdeas: ['역시즌 가격 비교 카드뉴스', '여름 여행 체크리스트 콘텐츠', '물놀이 필수템 3종 세트', '작년 정시즌 가격 대비 표시', '가족 세트 추가 할인']
  },
  3: { // 인솔&양말
    copy: ['신발 안의 숨은 영웅, 인솔 & 양말!', '1+1 가격으로 만나는 소모품 특가!', '교체만 해도 신발이 새것처럼!', '3세트 이상 구매 시 무료배송!'],
    slogan: '작은 투자, 큰 변화 — 인솔&양말 초특가',
    marketingIdeas: ['인솔 교체 전후 비교 영상', '양말 구독 서비스 맛보기', '묶음 구매 할인 강조', '출근러 필수 소모품 콘텐츠', '리뷰 인증 적립금 지급']
  },
  4: { // 러닝화
    copy: ['프리미엄 러닝화를 이 가격에?', '카본 플레이트 러닝화 파격 할인!', '기록을 갱신할 당신의 파트너.', '마라톤 시즌 대비 최저가!'],
    slogan: '기록의 시작 — 프리미엄 러닝화 특가',
    marketingIdeas: ['러닝 크루 콜라보 할인 코드', '기록 인증 챌린지', '러닝 코스 추천 콘텐츠', '유명 러너 협찬 리뷰', '봄 마라톤 대회 연계 프로모션']
  }
};

// ── [개선 #8] 행사별 타겟 고객 정의 ──
const targetCustomers = {
  main: {
    primary: '25~44세 남녀, 자사몰 기존 구매 고객 + 가격 민감형 신규',
    behavior: '할인 알림 반응률 높은 기존 고객 재구매 유도',
    newVsReturn: '기존 60% / 신규 40%',
    keyChannel: '카카오톡 플친 + Instagram 리타게팅'
  },
  sub: {
    primary: '30~49세, 메인 행사 유입 후 추가 탐색 고객',
    behavior: '메인 행사 페이지 이탈 고객 중 장바구니 미완료자',
    newVsReturn: '기존 70% / 신규 30%',
    keyChannel: '장바구니 이탈 리타게팅 + 카테고리 추천 메일'
  },
  season: {
    primary: '20~35세 트렌드 민감층, 봄 아웃도어 활동 관심층',
    behavior: '시즌 초 신상 탐색 및 얼리어답터 성향',
    newVsReturn: '기존 40% / 신규 60%',
    keyChannel: 'Instagram 룩북 광고 + 네이버 봄 시즌 검색 광고'
  },
  offSeason: {
    primary: '30~50대 가격 합리적 소비층, 대가족',
    behavior: '역시즌 할인에 반응하는 계획적 구매자',
    newVsReturn: '기존 50% / 신규 50%',
    keyChannel: '네이버 카페/블로그 리뷰 + 카카오톡 알림'
  },
  newProduct: {
    primary: '20~30대, 밸롭 팬층 + 스포츠 관심 신규',
    behavior: '신상 런칭에 반응, SNS 공유 활발',
    newVsReturn: '기존 35% / 신규 65%',
    keyChannel: 'Instagram/TikTok 인플루언서 + YouTube 쇼츠'
  },
  guerrilla: {
    primary: '전연령, 자사몰 앱/알림 수신 동의 고객',
    behavior: '즉각적 구매 결정, FOMO 반응형',
    newVsReturn: '기존 80% / 신규 20%',
    keyChannel: '앱 푸시 + 카카오 알림톡 + SMS'
  },
  deadStock: {
    primary: '가격 최우선 고객, 중고 거래 플랫폼 이용자',
    behavior: '극저가에 반응, 대량 구매 성향',
    newVsReturn: '기존 30% / 신규 70%',
    keyChannel: '당근마켓 광고 + 네이버 최저가 검색'
  }
};

// ── [개선 #7] 행사별 마케팅 예산 배분 ──
const eventBudgetShare = {
  main: 0.30, sub: 0.08, season: 0.18, offSeason: 0.10,
  newProduct: 0.15, guerrilla: 0.12, deadStock: 0.07
};

function calcEventBudget(eventType, totalBudget) {
  const share = eventBudgetShare[eventType] || 0.10;
  const amount = Math.round(totalBudget * share / 10000);
  return {
    amount: `${amount}만원`,
    share: `${Math.round(share * 100)}%`,
    channels: [
      { channel: 'Instagram/Facebook', share: '45%', amount: `${Math.round(amount * 0.45)}만원` },
      { channel: '카카오톡', share: '25%', amount: `${Math.round(amount * 0.25)}만원` },
      { channel: '네이버', share: '20%', amount: `${Math.round(amount * 0.20)}만원` },
      { channel: '기타(YouTube/TikTok)', share: '10%', amount: `${Math.round(amount * 0.10)}만원` }
    ],
    roasTarget: eventType === 'guerrilla' ? 'ROAS 800%+' :
                eventType === 'deadStock' ? 'ROAS 300%+ (재고 소진 우선)' :
                eventType === 'main' ? 'ROAS 500%+' : 'ROAS 400%+'
  };
}

// ── 기본 템플릿 (AI 실패 시 폴백) ──
const defaultContent = {
  main: {
    title: '밸롭 봄맞이 빅 세일', subtitle: '겨울 끝! 새 시즌을 여는 최대 60% 할인 축제',
    copy: ['긴 겨울이 끝나고, 새로운 계절이 시작됩니다.', '밸롭이 준비한 봄맞이 빅 세일로', '올 시즌 필수 아이템을 최대 60% 할인된 가격에 만나보세요.', '베스트셀러를 지금이 가장 좋은 타이밍에!', '놓치면 후회할 가격, 확인하세요.'],
    slogan: '봄을 걷다, 밸롭과 함께 — 최대 60% OFF',
    marketingIdeas: ['인스타그램 릴스 챌린지', '카카오톡 플친 알림 3단계 발송', '네이버 블로그 체험단', '유튜브 쇼츠 리뷰', '틱톡 인플루언서 콜라보', '네이버 쇼핑라이브'],
    issueStrategy: { description: '사회적 증거 + 긴급성 결합', tactics: ['실시간 판매 카운터', '품절 임박 뱃지', '일별 타임딜', '카운트다운 타이머', '리뷰 하이라이트'] },
  },
  sub: {
    title: '이런 상품은 어때요?', subtitle: '놓치기 아까운 숨은 인기 아이템 모음',
    copy: ['베스트셀러만 좋은 게 아닙니다.', '숨은 보석같은 아이템들을 최대 45% 할인으로!', '취향에 딱 맞는 나만의 아이템을 찾아보세요.', '3개 이상 구매 시 사은품을 드립니다.'],
    slogan: '내 취향, 내 스타일 — 밸롭 추천', marketingIdeas: ['개인화 추천', '장바구니 이탈 리타게팅', '카테고리 큐레이션', '묶음 구매 인센티브', '스타일링 가이드'],
    issueStrategy: { description: '교차 판매 전략', tactics: ['메인 행사 하단 노출', '함께 구매한 상품 연동', '미니 랭킹', '묶음 카운트 뱃지'] },
  },
  season: {
    title: '봄 신상 미리보기 — 2026 S/S', subtitle: '봄바람 타고 온 밸롭 S/S 라인업',
    copy: ['올 봄, 밸롭이 준비한 S/S 라인업.', '가볍고 스타일리시한 스니커즈부터', '아웃도어 트레킹화까지.', '시즌 프리뷰 특별가 최대 35% 할인!'],
    slogan: '새 계절의 첫 걸음, 밸롭 S/S', marketingIdeas: ['시즌 룩북', '러닝 크루 이벤트', '봄 스타일 투표', '라이브 커머스', '날씨 연동 광고'],
    issueStrategy: { description: '트렌드 선점 전략', tactics: ['룩북 화보', '얼리어답터 뱃지', 'SNS 챌린지', '날씨 맥락 광고', '첫 구매 적립금'] },
  },
  offSeason: {
    title: '여름 미리 준비! 최대 70% OFF', subtitle: '역시즌 얼리버드 세일',
    copy: ['여름이 오기 전에 미리 준비하면?', '역시즌 최대 70% 할인!', '아쿠아슈즈, 샌들을 지금 사면 여름에 두 배로 아낍니다.', '선제적 구매가 곧 현명한 소비입니다.'],
    slogan: '먼저 사면 더 싸다! 밸롭 역시즌 특가', marketingIdeas: ['가격 비교 인포그래픽', '얼리버드 후기 이벤트', '역시즌 알림 서비스', '세트 할인', '가격 비교 슬라이드'],
    issueStrategy: { description: '가격 앵커링 전략', tactics: ['정시즌 vs 역시즌 가격 비교', '품절 상품 뱃지', '재입고 없음 강조', '세트 추가 할인', '만족 후기 공유'] },
  },
  newProduct: {
    title: 'NEW ARRIVAL — 밸롭 신상품', subtitle: '가장 먼저 만나는 밸롭의 새 라인업',
    copy: ['밸롭의 새로운 라인업을 가장 먼저 만나보세요.', '신상품 런칭 기념 최대 20% 할인!', '첫 구매 고객에게는 10% 적립금까지.', '밸롭 NEW ARRIVAL에서 시작됩니다.'],
    slogan: 'BE FIRST — 밸롭 신상, 누구보다 먼저', marketingIdeas: ['티저 영상 D-5', '인플루언서 체험단', '런칭 라이브', '퀴즈 이벤트', 'SNS 공유 할인'],
    issueStrategy: { description: '희소성 + 얼리어답터 전략', tactics: ['단계적 티저 공개', '첫 100명 한정 혜택', '개발 스토리 콘텐츠', '런칭 라이브', '언박싱 리뷰 바이럴'] },
  },
  deadStock: {
    title: '라스트 찬스! 한정 수량 소진전', subtitle: '마지막 재고, 마지막 가격 — 최대 90% OFF',
    copy: ['이 가격은 다시 없습니다.', '창고 정리를 위한 초특가 대방출!', '1+1, 묶음 특가까지 준비했습니다.', '한정 수량 소진 시 종료!', '지금 바로 확인하세요!'],
    slogan: '이 가격, 마지막입니다!', marketingIdeas: ['레드 프라이스 태그', '실시간 재고 카운터', '1+1 묶음 딜', '주차별 추가 할인', '당근마켓 광고', '플리마켓 연계'],
    issueStrategy: { description: '최저가 충격 전략', tactics: ['3단 가격 취소선', '마지막 XX개 카운트', '1+1 묶음 가성비', '희소성 강조', '주차별 추가 할인'] },
  }
};

// ── 행사별 고정 구조 ──
const eventStructures = {
  main: {
    discountStructure: { type: '정률 할인', range: '40~60%', basis: 'TAG가 기준', tiers: [
      { condition: '마진율 60% 이상', discount: '55~60%' }, { condition: '마진율 45~60%', discount: '45~55%' },
      { condition: '마진율 45% 미만', discount: '40~45%' }, { condition: '2개 이상 구매', discount: '추가 5%' },
      { condition: '5만원 이상 구매', discount: '무료배송+사은품' }
    ]},
    sections: [
      { type: 'hero', title: '히어로 배너', description: '풀스크린 메인 비주얼 + 카운트다운' },
      { type: 'bestSeller', title: 'BEST TOP 10', description: '베스트셀러 대형 카드 그리드' },
      { type: 'reviews', title: '고객 리뷰', description: '포토 리뷰 캐러셀' },
      { type: 'benefits', title: '혜택 안내', description: '사은품/적립금 인포그래픽' },
      { type: 'timeDeal', title: '타임딜', description: '시간 한정 특가 (매일 교체)' }
    ],
    duration: { start: '2026-03-01', end: '2026-03-10', days: 10 }
  },
  sub: {
    discountStructure: { type: '정률 할인', range: '30~45%', basis: 'TAG가 기준', tiers: [
      { condition: '마진율 60% 이상', discount: '40~45%' }, { condition: '마진율 45~60%', discount: '35~40%' },
      { condition: '마진율 45% 미만', discount: '30~35%' }, { condition: '3개 이상 구매', discount: '사은품 증정' }
    ]},
    sections: [
      { type: 'recommendation', title: '추천 상품', description: '카테고리별 추천 그리드' },
      { type: 'styling', title: '스타일링 팁', description: '착용 이미지 코디 제안' },
      { type: 'bundle', title: '묶음 혜택', description: '3개 구매 시 사은품 안내' }
    ],
    duration: { start: '2026-03-01', end: '2026-03-15', days: 15 }
  },
  season: {
    discountStructure: { type: '시즌 프리뷰 특별가', range: '20~35%', basis: 'TAG가 기준', tiers: [
      { condition: '마진율 55% 이상', discount: '30~35%' }, { condition: '마진율 40~55%', discount: '25~30%' },
      { condition: '마진율 40% 미만', discount: '20~25%' }
    ]},
    sections: [
      { type: 'lookbook', title: 'S/S LOOKBOOK', description: '시즌 화보 비주얼' },
      { type: 'sneakers', title: '봄 스니커즈', description: '스니커즈/운동화 그리드' },
      { type: 'apparel', title: '경량 의류', description: '봄 의류 추천' }
    ],
    duration: { start: '2026-03-10', end: '2026-03-22', days: 13 }
  },
  offSeason: {
    discountStructure: { type: '역시즌 특별 할인', range: '50~70%', basis: 'TAG가 기준', tiers: [
      { condition: '마진율 60% 이상', discount: '60~70%' }, { condition: '마진율 45~60%', discount: '55~65%' },
      { condition: '마진율 45% 미만', discount: '50~55%' }
    ], note: '여름 시즌 대비 선구매 최저가 보장' },
    sections: [
      { type: 'hero', title: '역시즌 히어로', description: '여름 무드 + 가격 비교 배너' },
      { type: 'priceDiff', title: '가격 비교', description: '정시즌 vs 역시즌 비교표' },
      { type: 'categories', title: '카테고리별', description: '아쿠아/샌들/슬리퍼 탭' }
    ],
    duration: { start: '2026-03-12', end: '2026-03-25', days: 14 }
  },
  newProduct: {
    discountStructure: { type: '런칭 프로모션', range: '10~20%', basis: 'TAG가 기준', tiers: [
      { condition: '마진율 55% 이상', discount: '18~20%' }, { condition: '마진율 40~55%', discount: '15~18%' },
      { condition: '마진율 40% 미만', discount: '10~15%' }
    ]},
    sections: [
      { type: 'hero', title: 'NEW ARRIVAL', description: '신상품 비주얼 + 카운트다운' },
      { type: 'showcase', title: '라인업', description: '각 제품 상세 카드' },
      { type: 'earlyBird', title: '얼리버드 혜택', description: '첫 구매 전용 혜택' }
    ],
    duration: { start: '2026-03-20', end: '2026-03-31', days: 12 }
  },
  deadStock: {
    discountStructure: { type: '재고 소진 초대폭 할인 (원가 이하 허용)', range: '70~90%', basis: 'TAG가 기준',
      weeklyEscalation: [
        { week: 1, discount: '70~80%' }, { week: 2, discount: '80~85%' },
        { week: 3, discount: '85~90%' }, { week: 4, discount: '85~90% + 1+1' }
      ],
      bundleTypes: [
        { type: '1+1', condition: '동일 상품 2개 구매 시 1개 가격' },
        { type: '3개 묶음', condition: '3개 묶음 구매 시 추가 10% 할인' }
      ], note: '원가 이하 판매 허용' },
    sections: [
      { type: 'hero', title: '라스트 찬스!', description: '최종 세일 비주얼' },
      { type: 'clearance', title: '초특가', description: '가격순 + 재고 게이지' },
      { type: 'bundle', title: '묶음 특가', description: '1+1 / 3개 묶음' }
    ],
    duration: { start: '2026-03-01', end: '2026-03-31', days: 31 }
  }
};

// ══════════════════════════════════════
// 메인 생성 함수
// ══════════════════════════════════════
async function generate(data, selectedEvents, useAI = true, apiKey = null) {
  const { summary, products: allProducts, topSellers, deadStock, highMargin, seasonalProducts, newArrivals } = data;
  const withStock = allProducts.filter(p => (p.stock || 0) > 0);
  const events = [];

  const winterKeywords = ['플리스', '패딩', '윈터', '기모'];
  const totalMarketingBudget = 7000000; // 700만원

  // ── [개선 #1] 상품 중복 방지: 이미 배정된 상품 코드 추적 ──
  const assignedCodes = new Set();

  // ── [개선 #5] 부진 재고 → 사은품 후보 목록 ──
  const giftCandidates = (deadStock || [])
    .filter(p => (p.stock || 0) > 200 && (p.cost || 0) < 5000 && (p.cost || 0) > 0)
    .sort((a, b) => a.cost - b.cost)
    .slice(0, 10)
    .map(p => ({ code: p.code, name: p.name, cost: p.cost, stock: p.stock, category: p.category }));

  function buildGifts(eventType) {
    const gifts = [];
    const lowCost = giftCandidates.filter(g => g.cost < 3000);
    const midCost = giftCandidates.filter(g => g.cost >= 3000);
    if (lowCost.length > 0) {
      gifts.push({ condition: '3만원 이상 구매', gift: `${lowCost[0].name} 증정 (부진재고 소진 연계)` });
    }
    if (midCost.length > 0) {
      gifts.push({ condition: '7만원 이상 구매', gift: `${midCost[0].name} 증정 (부진재고 소진 연계)` });
    }
    if (eventType === 'main') {
      gifts.push({ condition: '10만원 이상 구매', gift: '밸롭 클리너 세트 + 양말 2족' });
    }
    if (gifts.length === 0) {
      gifts.push({ condition: '5만원 이상', gift: '밸롭 인솔 증정' });
    }
    return { tiers: gifts, note: giftCandidates.length > 0 ? `※ 사은품은 부진재고(${giftCandidates.length}종) 소진 연계 상품으로 구성` : '' };
  }

  // ── [개선 #6] 카테고리 진단 ──
  const categoryDiagnosis = diagnoseCategoryHealth(data);

  // 선택된 이벤트 순서대로 생성
  for (const eventType of selectedEvents) {
    let event = null;

    switch (eventType) {
      case 'main': {
        const top10 = topSellers.slice(0, 10);
        const extraHigh = topSellers.slice(10).filter(p => (p.marginRate || 0) > 55).slice(0, 5);
        let prods = [...top10, ...extraHigh]
          .filter(p => !assignedCodes.has(p.code))
          .map(p => {
            const full = allProducts.find(a => a.code === p.code) || p;
            const merged = { ...full, ...p, cost: full.cost || p.cost || 0, stock: full.stock || p.stock || 0 };
            return buildProduct(merged, varyRate(0.40, 0.60, merged.marginRate || 0), false);
          }).filter(p => p.stock > 0 || p.salesQty > 100);
        prods = marginSafeFilter(prods, 5);
        prods.forEach(p => assignedCodes.add(p.code));
        event = { eventType: 'main', products: prods, ...eventStructures.main };
        break;
      }
      case 'sub': {
        let prods = topSellers.slice(10, 30)
          .filter(p => !assignedCodes.has(p.code))
          .map(p => {
            const full = allProducts.find(a => a.code === p.code) || p;
            const merged = { ...full, ...p, cost: full.cost || p.cost || 0, stock: full.stock || p.stock || 0 };
            return buildProduct(merged, varyRate(0.30, 0.45, merged.marginRate || 0), false);
          }).filter(p => p.stock > 0);
        prods = marginSafeFilter(prods, 8);
        prods.forEach(p => assignedCodes.add(p.code));
        event = { eventType: 'sub', products: prods, ...eventStructures.sub };
        break;
      }
      case 'season': {
        const springItems = withStock.filter(p => {
          if (assignedCodes.has(p.code)) return false;
          const name = p.name || '';
          if (winterKeywords.some(k => name.includes(k))) return false;
          return p.category === '스니커즈/운동화' || p.category === '트레킹/등산' ||
            (p.category.includes('의류') && !isSummerItem(p));
        }).sort((a, b) => (b.salesQty || 0) - (a.salesQty || 0)).slice(0, 20);
        let prods = springItems.map(p => buildProduct(p, varyRate(0.20, 0.35, p.marginRate || 0), false));
        prods = marginSafeFilter(prods, 10);
        prods.forEach(p => assignedCodes.add(p.code));
        event = { eventType: 'season', products: prods, ...eventStructures.season };
        break;
      }
      case 'offSeason': {
        const summerItems = withStock.filter(p => !assignedCodes.has(p.code) && isSummerItem(p))
          .sort((a, b) => (b.stock || 0) - (a.stock || 0)).slice(0, 25);
        let prods = summerItems.map(p => buildProduct(p, varyRate(0.50, 0.70, p.marginRate || 0), false));
        prods = marginSafeFilter(prods, 3);
        prods.forEach(p => assignedCodes.add(p.code));
        event = { eventType: 'offSeason', products: prods, ...eventStructures.offSeason };
        break;
      }
      case 'newProduct': {
        const candidates = (newArrivals || [])
          .filter(p => (p.stock || 0) > 50 && !assignedCodes.has(p.code))
          .sort((a, b) => (b.stock || 0) - (a.stock || 0)).slice(0, 15);
        let prods = candidates.map(p => {
          const full = allProducts.find(a => a.code === p.code) || p;
          return buildProduct({ ...full, ...p, cost: full.cost || p.cost || 0 }, varyRate(0.10, 0.20, p.marginRate || 0), false);
        });
        prods = marginSafeFilter(prods, 10);
        prods.forEach(p => assignedCodes.add(p.code));
        event = { eventType: 'newProduct', products: prods, ...eventStructures.newProduct };
        break;
      }
      case 'guerrilla': {
        const pool = (highMargin || [])
          .filter(p => (p.stock || 0) > 30 && (p.tagPrice || 0) > 0 && !assignedCodes.has(p.code))
          .sort((a, b) => (b.marginRate || 0) - (a.marginRate || 0));
        const themes = ['건강 슬리퍼 특가', '스니커즈 폭탄 세일', '아쿠아 플래시 세일', '인솔&양말 초특가', '프리미엄 러닝화 특가'];
        const themeKeywords = [['슬리퍼', '지압'], ['스니커즈', '봄버', '운동화'], ['아쿠아', '샌들'], ['인솔', '양말'], ['카본', '러닝', '브리즈']];
        const guerrillaDates = ['05', '12', '19', '26', '30'];

        const deals = [];
        for (let i = 0; i < 5; i++) {
          let items = pool.filter(p => !assignedCodes.has(p.code) && themeKeywords[i].some(k => (p.name || '').includes(k)));
          if (items.length < 1) items = pool.filter(p => !assignedCodes.has(p.code)).slice(0, 3);
          items = items.slice(0, 3);

          // [개선 #4] 게릴라 할인도 마진 보호: 마진율 50% 이상만 60~80% 할인, 그 외 조정
          let prods = items.map(p => {
            const full = allProducts.find(a => a.code === p.code) || p;
            const mRate = p.marginRate || 0;
            const discRate = mRate > 60 ? 0.65 + Math.random() * 0.15 :
                             mRate > 45 ? 0.55 + Math.random() * 0.10 :
                             0.45 + Math.random() * 0.10;
            const prod = buildProduct({ ...full, ...p, cost: full.cost || p.cost || 0 }, discRate, false);
            prod.limitPerPerson = 2;
            prod.dealStock = Math.min(prod.stock, 100);
            return prod;
          });
          prods = marginSafeFilter(prods, 3);
          prods.forEach(p => assignedCodes.add(p.code));

          const dealDate = `2026-03-${guerrillaDates[i]}`;

          // [개선 #3] 데이터 기반 KPI
          const guerrillaKpi = calcKPI(summary, prods, 1, 'guerrilla');

          // AI 콘텐츠 or [개선 #2] 테마별 차별화된 폴백
          let aiContent = null;
          if (useAI) {
            aiContent = await aiClient.generateGuerrillaContent(apiKey, themes[i], prods, summary);
          }
          const themeCopy = guerrillaCopyByTheme[i] || guerrillaCopyByTheme[0];

          deals.push({
            eventType: 'guerrilla', dealNumber: i + 1,
            title: aiContent?.title || `오늘만 이 가격! — ${themes[i]}`,
            subtitle: aiContent?.subtitle || themes[i],
            copy: aiContent?.copy || themeCopy.copy,
            slogan: aiContent?.slogan || themeCopy.slogan,
            marketingIdeas: aiContent?.marketingIdeas || themeCopy.marketingIdeas,
            issueStrategy: aiContent?.issueStrategy || { description: 'FOMO 극대화', tactics: ['24시간 카운트다운', '수량 제한 ' + prods.reduce((s,p) => s + (p.dealStock||0), 0) + '개', '실시간 구매 카운터', '재고 소진 게이지', '사전 알림 신청'] },
            conversionProcess: { steps: [
              { step: 1, name: '알림', action: '카카오톡/푸시 알림' },
              { step: 2, name: '확인', action: '파격 할인가 확인' },
              { step: 3, name: '구매', action: '간편결제 30초 내 완료' },
              { step: 4, name: '공유', action: 'SNS 공유 → 바이럴' }
            ]},
            discountStructure: { type: '플래시 세일', range: prods.length > 0 ? `${Math.min(...prods.map(p=>p.discountRate)).toFixed(0)}~${Math.max(...prods.map(p=>p.discountRate)).toFixed(0)}%` : '60~80%', quantityLimit: 2 },
            products: prods,
            sections: [{ type: 'flashDeal', title: '오늘의 딜', description: '카운트다운 + 즉시 구매' }],
            gifts: { tiers: [{ condition: '구매', gift: '밸롭 스티커' }] },
            rewards: { rate: '2%', condition: '구매 고객' },
            externalMarketing: [
              { channel: '카카오톡', plan: '긴급 딜 알림톡 (D-1, 당일 오전 10시)', budget: `${Math.round(totalMarketingBudget * 0.024 / 10000)}만원` },
              { channel: 'Instagram', plan: '스토리 카운트다운 + 릴스 예고', budget: `${Math.round(totalMarketingBudget * 0.024 / 10000)}만원` }
            ],
            targetCustomer: targetCustomers.guerrilla,
            marketingBudget: calcEventBudget('guerrilla', totalMarketingBudget),
            kpiTargets: guerrillaKpi,
            duration: { start: dealDate, end: dealDate, days: 1 }
          });
        }
        events.push(...deals);
        continue;
      }
      case 'deadStock': {
        const deadItems = (deadStock || [])
          .filter(p => (p.stock || 0) > 50 && !assignedCodes.has(p.code))
          .sort((a, b) => (b.stock * b.cost) - (a.stock * a.cost)).slice(0, 30);
        const prods = deadItems.map(p => {
          const full = allProducts.find(a => a.code === p.code) || p;
          const merged = { ...full, ...p, cost: full.cost || p.cost || 0 };
          const rate = merged.dailySalesRate === 0 ? 0.85 : merged.dailySalesRate < 0.5 ? 0.80 : 0.70;
          const prod = buildProduct(merged, rate + Math.random() * 0.05, true);
          prod.inventoryValue = (merged.stock || 0) * (merged.cost || 0);
          prod.daysOfStock = merged.daysOfStock || -1;
          return prod;
        });
        prods.forEach(p => assignedCodes.add(p.code));
        event = { eventType: 'deadStock', products: prods, ...eventStructures.deadStock,
          totalInventoryValue: prods.reduce((s, p) => s + (p.inventoryValue || 0), 0)
        };
        break;
      }
    }

    if (event) {
      const fallback = defaultContent[eventType] || defaultContent.main;
      let aiContent = null;

      if (useAI) {
        aiContent = await aiClient.generateEventContent(apiKey, eventType, {
          products: event.products,
          discountRange: event.discountStructure?.range
        }, summary);
      }

      event.title = aiContent?.title || fallback.title;
      event.subtitle = aiContent?.subtitle || fallback.subtitle;
      event.copy = aiContent?.copy || fallback.copy;
      event.slogan = aiContent?.slogan || fallback.slogan;
      event.marketingIdeas = aiContent?.marketingIdeas || fallback.marketingIdeas;
      event.issueStrategy = aiContent?.issueStrategy || fallback.issueStrategy;
      event.conversionProcess = aiContent?.conversionProcess || { steps: fallback.issueStrategy?.tactics?.map((t, i) => ({ step: i + 1, name: `Step ${i + 1}`, action: t })) || [] };

      // [개선 #5] 사은품 = 부진재고 연계
      event.gifts = aiContent?.gifts || buildGifts(eventType);
      event.rewards = aiContent?.rewards || { rate: '5%', condition: '구매 고객', bonus: '첫 구매 고객 추가 3% 적립' };

      // [개선 #7] 행사별 예산
      event.marketingBudget = calcEventBudget(eventType, totalMarketingBudget);
      event.externalMarketing = aiContent?.externalMarketing || event.marketingBudget.channels.map(c => ({
        channel: c.channel, plan: '광고 집행', budget: c.amount, roasTarget: event.marketingBudget.roasTarget
      }));

      // [개선 #3] 데이터 기반 KPI
      const days = event.duration?.days || 7;
      event.kpiTargets = aiContent?.kpiTargets || calcKPI(summary, event.products, days, eventType);

      // [개선 #8] 타겟 고객
      event.targetCustomer = targetCustomers[eventType] || targetCustomers.main;

      events.push(event);
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    brand: '밸롭 (BALLOP)',
    reportPeriod: `${summary.dateRange?.start} ~ ${summary.dateRange?.end} (${summary.salesDays}일간 판매 데이터)`,
    eventPeriod: '2026년 3월 행사 기획',
    dataSummary: {
      totalProducts: summary.totalProducts, productsWithStock: summary.productsWithStock,
      totalStockQty: summary.totalStockQty, totalSalesQty: summary.totalSalesQty,
      totalRevenue: summary.totalRevenue, avgDailyRevenue: summary.avgDailyRevenue
    },
    // [개선 #6] 카테고리 건강도
    categoryDiagnosis,
    // [개선 #5] 사은품 후보 (부진재고 연계)
    giftCandidates,
    // [개선 #1] 중복 방지 요약
    deduplication: {
      totalAssigned: assignedCodes.size,
      note: '각 상품은 하나의 행사에만 배정되어 가격 충돌이 없습니다. 행사 기간이 겹치더라도 동일 상품이 다른 가격으로 노출되지 않습니다.'
    },
    events,
    overallStrategy: {
      keyMessage: '밸롭 2026년 S/S 시즌 종합 프로모션 전략 — 3월 풀 플랜 + 4월 러프 플랜',
      timeline: [
        {
          period: '3/1~3/10', phase: 'Phase 1: 오프닝 빅세일',
          events: selectedEvents.filter(e => ['main', 'sub'].includes(e)).map(e => defaultContent[e]?.title || e),
          focus: '베스트셀러 중심 트래픽 유입, 봄 시즌 첫 인상 구축'
        },
        {
          period: '3/10~3/22', phase: 'Phase 2: 시즌 전환기',
          events: selectedEvents.filter(e => ['season', 'offSeason'].includes(e)).map(e => defaultContent[e]?.title || e),
          focus: 'S/S 신시즌 프리뷰 + 역시즌 재고 소진 병행'
        },
        {
          period: '3/20~3/31', phase: 'Phase 3: 신상품 & 월말 마감',
          events: selectedEvents.filter(e => ['newProduct'].includes(e)).map(e => defaultContent[e]?.title || e),
          focus: '신상품 런칭으로 브랜드 신선함 유지, 월말 마감 프로모션'
        },
        {
          period: '3/1~3/31', phase: '상시 운영',
          events: [
            ...(selectedEvents.includes('deadStock') ? ['악성재고 소진전 (주차별 할인율 상승)'] : []),
            ...(selectedEvents.includes('guerrilla') ? ['게릴라 원데이 딜 (3/5, 3/12, 3/19, 3/26, 3/30)'] : [])
          ],
          focus: '악성재고 점진적 소진 + 매주 이벤트로 재방문 유도'
        }
      ].filter(t => t.events.length > 0),
      aprilPlan: {
        title: '4월 러프 플랜 — 밸롭 2026 S/S 본격 시즌',
        phases: [
          { period: '4/1~4/10', name: 'S/S 본격 오픈', ideas: ['봄 신상품 풀 라인업 공개 + 룩북 캠페인', '아웃도어/트레킹 카테고리 강화 (등산 시즌 시작)', '3월 베스트셀러 리오더 + 컬러 추가 출시', '봄맞이 러닝/워킹 챌린지 SNS 캠페인'] },
          { period: '4/11~4/20', name: '멤버십 위크 / 고객 감사', ideas: ['자사몰 회원 등급별 전용 할인 (VIP 추가 10%)', '리뷰 적립금 2배 이벤트', '친구 초대 프로모션 (초대 1건당 3,000원 적립)', '장바구니 쿠폰 리마인드 캠페인'] },
          { period: '4/21~4/30', name: '어린이날/가정의달 프리 시즌', ideas: ['가족 세트 구성 할인 (키즈+성인 묶음)', '어린이날 선물 기획전 (키즈 라인 집중)', '아쿠아슈즈/샌들 얼리 시즌 티저 (5월 대비)', '3월 악성재고 잔여분 파이널 클리어런스'] }
        ],
        budgetNote: '3월 성과 기반 채널별 ROAS 분석 후 4월 예산 재배분 예정',
        keyMetrics: ['3월 대비 매출 +20% 성장 목표', '신규 고객 비율 30% 이상 유지', '재구매율 15% → 20% 개선', '아쿠아/샌들 카테고리 5월 시즌 대비 사전 수요 확보']
      },
      budgetAllocation: {
        total: '700만원 (3월) / 800만원 (4월 예정)',
        breakdown: [
          { channel: 'Instagram/Facebook', amount: '300만원', share: '43%' },
          { channel: 'YouTube', amount: '150만원', share: '21%' },
          { channel: '카카오톡', amount: '100만원', share: '14%' },
          { channel: '네이버', amount: '100만원', share: '14%' },
          { channel: '기타', amount: '50만원', share: '7%' }
        ]
      }
    }
  };
}

module.exports = { generate };
