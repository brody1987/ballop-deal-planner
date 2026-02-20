/**
 * reportBuilder.js
 * data + scenarios → 완전한 단일 HTML 보고서 생성
 * shadcn/ui 디자인 시스템 적용
 */
function build(reportData, scenarioData) {
  const dataStr = JSON.stringify(reportData);
  const scenarioStr = JSON.stringify(scenarioData);
  return generateFullHTML(dataStr, scenarioStr);
}

function generateFullHTML(dataStr, scenarioStr) {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>밸롭 자사몰 할인 행사 기획 보고서</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"><\/script>
<script src="https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js"><\/script>
<style>
:root {
  --background: #09090b;
  --foreground: #fafafa;
  --card: #0a0a0c;
  --card-foreground: #fafafa;
  --primary: #FF6B35;
  --primary-foreground: #fff;
  --secondary: #27272a;
  --secondary-foreground: #fafafa;
  --muted: #18181b;
  --muted-foreground: #a1a1aa;
  --accent: #27272a;
  --accent-foreground: #fafafa;
  --destructive: #ef4444;
  --border: #27272a;
  --input: #27272a;
  --ring: #FF6B35;
  --radius: 0.5rem;
  --success: #22c55e;
  --warning: #eab308;
  --chart-1: #FF6B35;
  --chart-2: #06b6d4;
  --chart-3: #8b5cf6;
  --chart-4: #f59e0b;
  --chart-5: #ec4899;
  --chart-6: #22c55e;
  --chart-7: #6b7280;
}
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  background: var(--background);
  color: var(--foreground);
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}
.container { max-width: 1280px; margin: 0 auto; padding: 0 24px; }

/* Nav */
.nav {
  position: sticky; top: 0; z-index: 100;
  background: rgba(9,9,11,0.8);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--border);
  padding: 0;
}
.nav-inner {
  display: flex; align-items: center; gap: 2px;
  overflow-x: auto; padding: 0 24px;
  max-width: 1280px; margin: 0 auto; height: 48px;
}
.nav-brand {
  font-weight: 800; font-size: 15px; color: var(--primary);
  flex-shrink: 0; margin-right: 16px; letter-spacing: -0.02em;
}
.nav-link {
  color: var(--muted-foreground); font-size: 13px; font-weight: 500;
  padding: 6px 12px; border-radius: var(--radius);
  cursor: pointer; transition: color 0.15s, background 0.15s;
  flex-shrink: 0; white-space: nowrap;
}
.nav-link:hover { color: var(--foreground); background: var(--accent); }
.nav-link.active { color: var(--foreground); background: var(--accent); }

/* Header */
.header {
  border-bottom: 1px solid var(--border);
  padding: 64px 24px; text-align: center;
}
.header h1 {
  font-size: clamp(28px, 5vw, 42px); font-weight: 800;
  letter-spacing: -0.03em; line-height: 1.1;
}
.header .subtitle {
  font-size: 16px; color: var(--muted-foreground); margin-top: 12px;
}
.header .meta {
  margin-top: 20px; font-size: 12px; color: #52525b;
}

/* KPI */
.kpi-grid {
  display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px; padding: 32px 0;
}
.kpi-card {
  background: var(--card); border: 1px solid var(--border);
  border-radius: var(--radius); padding: 20px; text-align: center;
  transition: border-color 0.15s;
}
.kpi-card:hover { border-color: #3f3f46; }
.kpi-card .label {
  font-size: 11px; color: var(--muted-foreground); font-weight: 500;
  text-transform: uppercase; letter-spacing: 0.05em;
}
.kpi-card .value {
  font-size: clamp(24px, 3vw, 32px); font-weight: 800;
  color: var(--foreground); margin: 6px 0; letter-spacing: -0.02em;
}
.kpi-card .sub { font-size: 12px; color: var(--muted-foreground); }

/* Section */
.section { padding: 48px 0; border-bottom: 1px solid var(--border); }
.section-title {
  font-size: clamp(18px, 3vw, 24px); font-weight: 700;
  letter-spacing: -0.02em; display: flex; align-items: center; gap: 10px;
}
.badge {
  font-size: 11px; font-weight: 500; background: var(--secondary);
  color: var(--muted-foreground); padding: 2px 8px; border-radius: 9999px;
  border: 1px solid var(--border);
}
.section-desc { color: var(--muted-foreground); margin-top: 4px; margin-bottom: 24px; font-size: 14px; }

/* Chart */
.chart-grid {
  display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 16px; margin: 24px 0;
}
.chart-card {
  background: var(--card); border: 1px solid var(--border);
  border-radius: var(--radius); padding: 20px;
}
.chart-card h3 { font-size: 14px; font-weight: 600; margin-bottom: 16px; }

/* Table */
.table-wrap {
  overflow-x: auto; margin: 16px 0; border-radius: var(--radius);
  border: 1px solid var(--border);
}
table { width: 100%; border-collapse: collapse; font-size: 13px; }
th {
  background: var(--muted); padding: 10px 12px; text-align: left;
  font-weight: 500; font-size: 12px; color: var(--muted-foreground);
  position: sticky; top: 0; white-space: nowrap;
}
td {
  padding: 10px 12px; border-top: 1px solid var(--border);
  white-space: nowrap;
}
tr:hover td { background: rgba(255,255,255,0.02); }
.text-right { text-align: right; }

/* Event Tabs */
.event-tabs { display: flex; gap: 4px; flex-wrap: wrap; margin-bottom: 24px; }
.event-tab {
  padding: 8px 16px; border-radius: var(--radius);
  cursor: pointer; font-size: 13px; font-weight: 500;
  border: 1px solid var(--border); transition: all 0.15s;
  color: var(--muted-foreground); background: transparent;
}
.event-tab:hover { background: var(--accent); color: var(--foreground); }
.event-tab.active { background: var(--primary); color: #fff; border-color: var(--primary); }
.event-content { display: none; }
.event-content.active { display: block; }

/* Event Header */
.event-header {
  background: var(--card); border: 1px solid var(--border);
  border-radius: var(--radius); padding: 28px; margin-bottom: 20px;
  border-left: 3px solid var(--primary);
}
.event-header h2 {
  font-size: clamp(18px, 3vw, 24px); font-weight: 700;
  letter-spacing: -0.02em; margin-top: 8px;
}
.event-header .copy {
  background: var(--muted); border: 1px solid var(--border);
  border-radius: var(--radius); padding: 16px; font-size: 14px;
  line-height: 1.8; white-space: pre-line; margin: 16px 0;
}
.event-header .slogan {
  font-size: 18px; font-weight: 700; color: var(--primary);
  margin-top: 12px;
}

/* Info Grid */
.info-grid {
  display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 12px; margin: 16px 0;
}
.info-card {
  background: var(--card); border: 1px solid var(--border);
  border-radius: var(--radius); padding: 20px;
}
.info-card h4 {
  font-size: 13px; font-weight: 600; color: var(--foreground);
  margin-bottom: 12px; display: flex; align-items: center; gap: 6px;
}
.info-card h4::before {
  content: ''; width: 3px; height: 14px;
  background: var(--primary); border-radius: 2px;
}
.info-card ul { list-style: none; padding: 0; }
.info-card li {
  padding: 3px 0; font-size: 13px; color: var(--muted-foreground);
}
.info-card li::before {
  content: ''; display: inline-block; width: 4px; height: 4px;
  background: #52525b; border-radius: 50%; margin-right: 8px;
  vertical-align: middle;
}

/* Steps */
.steps { display: flex; gap: 8px; flex-wrap: wrap; margin: 16px 0; }
.step {
  background: var(--card); border: 1px solid var(--border);
  border-radius: var(--radius); padding: 16px; flex: 1; min-width: 140px;
  text-align: center;
}
.step .num {
  width: 28px; height: 28px; background: var(--primary); color: #fff;
  border-radius: var(--radius); display: inline-flex; align-items: center;
  justify-content: center; font-weight: 700; font-size: 12px; margin-bottom: 8px;
}
.step .step-name { font-weight: 600; font-size: 12px; }
.step .step-action { font-size: 11px; color: var(--muted-foreground); margin-top: 2px; }

/* Buttons */
.btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 8px 16px; border-radius: var(--radius); border: none;
  cursor: pointer; font-size: 13px; font-weight: 500;
  font-family: inherit; transition: opacity 0.15s;
}
.btn-primary { background: var(--primary); color: #fff; }
.btn-primary:hover { opacity: 0.9; }
.btn-sm { padding: 5px 12px; font-size: 12px; }

/* Badges inline */
.disc-badge {
  display: inline-block; background: rgba(239,68,71,0.15); color: var(--destructive);
  padding: 1px 6px; border-radius: 4px; font-size: 11px; font-weight: 600;
}
.tag {
  display: inline-block; padding: 2px 8px; border-radius: 9999px;
  font-size: 11px; font-weight: 500;
}

/* Filter */
.filter-row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-bottom: 16px; }
.filter-row select, .filter-row input {
  background: var(--card); border: 1px solid var(--border);
  color: var(--foreground); padding: 7px 12px; border-radius: var(--radius);
  font-size: 13px; font-family: inherit; outline: none;
}
.filter-row select:focus, .filter-row input:focus {
  border-color: var(--ring); box-shadow: 0 0 0 2px rgba(255,107,53,0.15);
}
.filter-row input { width: 200px; }
.filter-row input::placeholder { color: #52525b; }

/* Gantt */
.gantt-row { display: flex; align-items: center; gap: 12px; margin-bottom: 6px; }
.gantt-label { width: 180px; font-size: 12px; font-weight: 500; flex-shrink: 0; }
.gantt-bar-container {
  flex: 1; height: 32px; background: var(--muted);
  border-radius: var(--radius); position: relative; overflow: hidden;
}
.gantt-bar {
  position: absolute; height: 100%; border-radius: var(--radius);
  display: flex; align-items: center; justify-content: center;
  font-size: 10px; font-weight: 600; color: #fff;
}

/* Back top */
.back-top {
  position: fixed; bottom: 24px; right: 24px;
  width: 40px; height: 40px; background: var(--secondary);
  border: 1px solid var(--border); color: var(--foreground);
  border-radius: var(--radius); cursor: pointer; font-size: 16px;
  display: none; align-items: center; justify-content: center; z-index: 99;
  transition: background 0.15s;
}
.back-top:hover { background: var(--accent); }
.back-top.show { display: flex; }

/* Print */
@media print {
  body { background: #fff; color: #000; }
  .nav, .back-top, .btn, .filter-row { display: none !important; }
  .event-content { display: block !important; }
  th { background: #f4f4f5; }
  td { border-color: #e4e4e7; }
  .card, .chart-card, .info-card, .kpi-card, .event-header, .step { border-color: #e4e4e7; background: #fff; }
}
@media (max-width: 768px) {
  .chart-grid { grid-template-columns: 1fr; }
  .info-grid { grid-template-columns: 1fr; }
  .steps { flex-direction: column; }
}
</style>
</head>
<body>
<nav class="nav"><div class="nav-inner">
  <div class="nav-brand">BALLOP</div>
  <div class="nav-link active" onclick="scrollTo_('header')">개요</div>
  <div class="nav-link" onclick="scrollTo_('dashboard')">대시보드</div>
  <div class="nav-link" onclick="scrollTo_('analysis')">데이터 분석</div>
  <div class="nav-link" onclick="scrollTo_('events')">행사 시나리오</div>
  <div class="nav-link" onclick="scrollTo_('products')">통합 상품</div>
  <div class="nav-link" onclick="scrollTo_('calendar')">캘린더</div>
  <div class="nav-link" onclick="scrollTo_('marketing')">마케팅</div>
</div></nav>

<div class="header" id="header"><div class="container">
  <h1>밸롭 자사몰 할인 행사 기획 보고서</h1>
  <div class="subtitle">판매 데이터 기반 AI 생성 행사 시나리오</div>
  <div class="meta">BALLOP · AI Generated Report</div>
</div></div>

<div class="section" id="dashboard"><div class="container">
  <div class="section-title">Executive Summary <span class="badge">DASHBOARD</span></div>
  <div class="section-desc">판매 데이터 기반 핵심 지표 요약</div>
  <div class="kpi-grid" id="kpi-grid"></div>
  <div class="chart-grid">
    <div class="chart-card"><h3>일별 매출 추이</h3><canvas id="chart-daily"></canvas></div>
    <div class="chart-card"><h3>카테고리별 매출 비중</h3><canvas id="chart-category"></canvas></div>
    <div class="chart-card"><h3>판매 TOP 10 상품</h3><canvas id="chart-top10"></canvas></div>
    <div class="chart-card"><h3>주차별 매출 성장률</h3><canvas id="chart-weekly"></canvas></div>
  </div>
</div></div>

<div class="section" id="analysis"><div class="container">
  <div class="section-title">데이터 분석 <span class="badge">ANALYSIS</span></div>
  <h3 style="margin:24px 0 12px;font-size:15px;font-weight:600">카테고리별 성과</h3>
  <div class="table-wrap"><table id="table-categories"></table></div>
  <h3 style="margin:24px 0 12px;font-size:15px;font-weight:600">판매 TOP 20</h3>
  <div class="table-wrap"><table id="table-top20"></table></div>
  <h3 style="margin:24px 0 12px;font-size:15px;font-weight:600">재고 건강도</h3>
  <div class="kpi-grid" id="stock-health"></div>
</div></div>

<div class="section" id="events"><div class="container">
  <div class="section-title">행사 시나리오 <span class="badge">AI GENERATED</span></div>
  <div class="section-desc">데이터 기반 + AI 생성 행사 시나리오</div>
  <div class="event-tabs" id="event-tabs"></div>
  <div id="event-contents"></div>
</div></div>

<div class="section" id="products"><div class="container">
  <div class="section-title">통합 상품 리스트 <span class="badge">ALL</span></div>
  <div class="filter-row">
    <select id="filter-event" onchange="filterProducts()"><option value="">전체 행사</option></select>
    <select id="filter-cat" onchange="filterProducts()"><option value="">전체 카테고리</option></select>
    <input type="text" id="filter-search" placeholder="상품명 검색..." oninput="filterProducts()">
    <button class="btn btn-primary" onclick="downloadAllExcel()">엑셀 다운로드</button>
  </div>
  <div class="table-wrap"><table id="table-all-products"></table></div>
</div></div>

<div class="section" id="calendar"><div class="container">
  <div class="section-title">행사 캘린더 <span class="badge">TIMELINE</span></div>
  <div id="gantt-chart" style="margin-top:24px"></div>
</div></div>

<div class="section" id="marketing"><div class="container">
  <div class="section-title">마케팅 실행 계획 <span class="badge">MARKETING</span></div>
  <div class="chart-grid">
    <div class="chart-card"><h3>채널별 예산 배분</h3><canvas id="chart-budget"></canvas></div>
    <div class="chart-card"><h3>행사별 예상 매출</h3><canvas id="chart-revenue"></canvas></div>
  </div>
  <div id="marketing-plan"></div>
</div></div>

<button class="back-top" id="backTop" onclick="window.scrollTo({top:0,behavior:'smooth'})">↑</button>
<div style="text-align:center;padding:40px 24px;font-size:12px;color:#52525b;border-top:1px solid var(--border)">
  밸롭 자사몰 할인 행사 기획 보고서 · AI Generated
</div>

<script>
const reportData=${dataStr};
const scenarioData=${scenarioStr};
const eventColors={main:'#FF6B35',sub:'#8B5CF6',season:'#06B6D4',offSeason:'#F59E0B',newProduct:'#EC4899',guerrilla:'#EF4444',deadStock:'#6B7280'};
const eventLabels={main:'메인 행사',sub:'서브 행사',season:'시즌 행사',offSeason:'역시즌 행사',newProduct:'신상품 출시',guerrilla:'게릴라 딜',deadStock:'악성재고'};
const chartColors=['#FF6B35','#06b6d4','#8b5cf6','#f59e0b','#ec4899','#22c55e','#6b7280','#a78bfa'];
const chartTextColor='#a1a1aa';
const chartGridColor='rgba(255,255,255,0.04)';

function fmt(n){return(n||0).toLocaleString('ko-KR')}
function fmtW(n){return Math.round((n||0)/10000).toLocaleString('ko-KR')+'만원'}
function fmtP(n){return(n||0).toFixed(1)+'%'}
function scrollTo_(id){document.getElementById(id)?.scrollIntoView({behavior:'smooth'})}

Chart.defaults.color=chartTextColor;
Chart.defaults.borderColor=chartGridColor;
Chart.defaults.font.family="'Inter',-apple-system,sans-serif";
Chart.defaults.font.size=12;

function renderKPIs(){
  const s=reportData.summary;
  const kpis=[
    {label:'총 상품 수',value:fmt(s.totalProducts),sub:'등록 상품'},
    {label:'재고 보유',value:fmt(s.productsWithStock),sub:fmtP(s.productsWithStock/s.totalProducts*100)},
    {label:'총 재고',value:fmt(s.totalStockQty),sub:'출고 가능'},
    {label:'총 매출',value:fmtW(s.totalRevenue),sub:fmt(s.totalSalesQty)+'개'},
    {label:'일평균',value:fmtW(s.avgDailyRevenue),sub:fmt(Math.round(s.avgDailySalesQty))+'개/일'},
    {label:'반품',value:fmt(s.returnCount),sub:fmtP(s.returnCount/s.totalSalesQty*100)}
  ];
  document.getElementById('kpi-grid').innerHTML=kpis.map(k=>
    '<div class="kpi-card"><div class="label">'+k.label+'</div><div class="value">'+k.value+'</div><div class="sub">'+k.sub+'</div></div>'
  ).join('');
}

function renderCharts(){
  const d=reportData.dailySales;
  new Chart(document.getElementById('chart-daily'),{type:'line',data:{labels:d.map(x=>x.date.slice(5)),datasets:[
    {label:'매출(만원)',data:d.map(x=>Math.round(x.amount/10000)),borderColor:'#FF6B35',fill:true,backgroundColor:'rgba(255,107,53,0.08)',tension:.4,pointRadius:3,borderWidth:2},
    {label:'수량',data:d.map(x=>x.qty),borderColor:'#06b6d4',yAxisID:'y1',tension:.4,pointRadius:2,borderWidth:1.5}
  ]},options:{responsive:true,plugins:{legend:{labels:{usePointStyle:true,pointStyle:'circle',padding:16}}},scales:{x:{ticks:{maxRotation:0},grid:{display:false}},y:{ticks:{callback:v=>v+'만'},grid:{color:chartGridColor}},y1:{position:'right',grid:{display:false}}}}});

  const cats=Array.isArray(reportData.categories)?reportData.categories:Object.values(reportData.categories);
  new Chart(document.getElementById('chart-category'),{type:'doughnut',data:{labels:cats.map(c=>c.name),datasets:[{data:cats.map(c=>c.totalSalesRevenue||0),backgroundColor:chartColors,borderWidth:0}]},options:{responsive:true,cutout:'65%',plugins:{legend:{position:'bottom',labels:{usePointStyle:true,pointStyle:'circle',padding:12}}}}});

  const t10=reportData.topSellers.slice(0,10);
  new Chart(document.getElementById('chart-top10'),{type:'bar',data:{labels:t10.map(p=>p.name.length>12?p.name.slice(0,12)+'...':p.name),datasets:[{label:'판매수량',data:t10.map(p=>p.salesQty),backgroundColor:'#FF6B35',borderRadius:4,barThickness:18}]},options:{responsive:true,indexAxis:'y',plugins:{legend:{display:false}},scales:{x:{grid:{color:chartGridColor}},y:{ticks:{font:{size:10}}}}}});

  const w=reportData.salesTrends.weekly;
  new Chart(document.getElementById('chart-weekly'),{type:'bar',data:{labels:w.map(x=>x.week),datasets:[
    {label:'매출(만원)',data:w.map(x=>Math.round(x.amount/10000)),backgroundColor:'#FF6B35',borderRadius:4},
    {label:'수량',data:w.map(x=>x.qty),backgroundColor:'#06b6d4',borderRadius:4}
  ]},options:{responsive:true,plugins:{legend:{labels:{usePointStyle:true,pointStyle:'circle',padding:16}}},scales:{x:{grid:{display:false}},y:{grid:{color:chartGridColor}}}}});
}

function renderCategoryTable(){
  const cats=Array.isArray(reportData.categories)?reportData.categories:Object.values(reportData.categories);
  let h='<thead><tr><th>카테고리</th><th class="text-right">상품수</th><th class="text-right">재고</th><th class="text-right">판매수량</th><th class="text-right">매출</th></tr></thead><tbody>';
  cats.forEach(c=>{h+='<tr><td>'+c.name+'</td><td class="text-right">'+fmt(c.totalProducts)+'</td><td class="text-right">'+fmt(c.totalStock)+'</td><td class="text-right">'+fmt(c.totalSalesQty||0)+'</td><td class="text-right">'+fmtW(c.totalSalesRevenue||0)+'</td></tr>'});
  document.getElementById('table-categories').innerHTML=h+'</tbody>';

  var diag=scenarioData.categoryDiagnosis;
  if(diag&&diag.length){
    var statusColors={critical:'var(--destructive)',warning:'var(--warning)',caution:'#fb923c',low_stock:'#a78bfa',healthy:'var(--success)'};
    var statusLabels={critical:'위험',warning:'주의',caution:'관찰',low_stock:'부족',healthy:'정상'};
    var dh='<h3 style="margin:24px 0 12px;font-size:15px;font-weight:600">카테고리 건강도 진단</h3><div class="table-wrap"><table><thead><tr><th>카테고리</th><th class="text-right">재고</th><th class="text-right">판매</th><th class="text-right">재고/판매 비율</th><th>상태</th><th>액션</th></tr></thead><tbody>';
    diag.forEach(function(d){dh+='<tr><td>'+d.name+'</td><td class="text-right">'+fmt(d.totalStock)+'</td><td class="text-right">'+fmt(d.totalSalesQty)+'</td><td class="text-right">'+d.stockToSalesRatio+'x</td><td><span style="color:'+(statusColors[d.status]||'#999')+';font-weight:600;font-size:12px">'+(statusLabels[d.status]||d.status)+'</span></td><td style="font-size:12px;color:var(--muted-foreground)">'+d.action+'</td></tr>'});
    dh+='</tbody></table></div>';
    document.getElementById('table-categories').insertAdjacentHTML("afterend",dh);
  }
}

function renderTop20Table(){
  const t=reportData.topSellers.slice(0,20);
  let h='<thead><tr><th>#</th><th>상품코드</th><th>상품명</th><th class="text-right">TAG가</th><th class="text-right">원가</th><th class="text-right">평균판매가</th><th class="text-right">할인율</th><th class="text-right">수량</th><th class="text-right">매출</th><th class="text-right">마진</th><th class="text-right">재고</th></tr></thead><tbody>';
  t.forEach((p,i)=>{h+='<tr><td>'+(i+1)+'</td><td>'+p.code+'</td><td>'+p.name+'</td><td class="text-right">'+fmt(p.tagPrice)+'</td><td class="text-right">'+fmt(p.cost||0)+'</td><td class="text-right">'+fmt(Math.round(p.avgSalePrice))+'</td><td class="text-right"><span class="disc-badge">'+(p.discountRate||0).toFixed(0)+'%</span></td><td class="text-right">'+fmt(p.salesQty)+'</td><td class="text-right">'+fmtW(p.salesRevenue)+'</td><td class="text-right">'+fmtP(p.marginRate)+'</td><td class="text-right">'+fmt(p.stock)+'</td></tr>'});
  document.getElementById('table-top20').innerHTML=h+'</tbody>';
}

function renderStockHealth(){
  const p=reportData.products;
  const a=p.filter(x=>x.stock>0&&x.daysOfStock>0&&x.daysOfStock<=90).length;
  const l=p.filter(x=>x.stock>0&&x.stock<50&&x.salesQty>0).length;
  const e=p.filter(x=>x.stock>500&&(x.daysOfStock>180||x.salesQty===0)).length;
  const d=reportData.deadStock.length;
  document.getElementById('stock-health').innerHTML=[
    {l:'적정 재고',v:a,s:'30~90일',c:'var(--success)'},
    {l:'재고 부족',v:l,s:'50개 미만',c:'var(--warning)'},
    {l:'과잉',v:e,s:'500개+',c:'var(--destructive)'},
    {l:'악성',v:d,s:'판매 부진',c:'var(--muted-foreground)'}
  ].map(i=>'<div class="kpi-card"><div class="label">'+i.l+'</div><div class="value" style="color:'+i.c+'">'+i.v+'</div><div class="sub">'+i.s+'</div></div>').join('');
}

function renderEvents(){
  const evts=scenarioData.events;
  let tabs='',conts='';
  evts.forEach((ev,i)=>{
    const c=eventColors[ev.eventType]||'#FF6B35';
    tabs+='<div class="event-tab'+(i===0?' active':'')+'" onclick="switchEvent('+i+')">'+ev.title+'</div>';
    conts+='<div class="event-content'+(i===0?' active':'')+'" id="ev-'+i+'">';
    conts+='<div class="event-header" style="border-left-color:'+c+'"><span class="tag" style="background:'+c+'1a;color:'+c+';border:1px solid '+c+'33">'+(eventLabels[ev.eventType]||ev.eventType)+(ev.dealNumber?' #'+ev.dealNumber:'')+'</span>';
    conts+='<h2>'+ev.title+'</h2><div style="color:var(--muted-foreground);font-size:14px">'+ev.subtitle+'</div>';
    conts+='<div class="copy">'+(Array.isArray(ev.copy)?ev.copy.join('\\n'):ev.copy||'')+'</div>';
    conts+='<div class="slogan">"'+ev.slogan+'"</div>';
    conts+='<div style="margin-top:12px;font-size:12px;color:var(--muted-foreground)">기간: '+(ev.duration?.start||'')+' ~ '+(ev.duration?.end||'')+' ('+(ev.duration?.days||'')+'일)</div></div>';

    conts+='<div class="info-grid">';
    conts+='<div class="info-card"><h4>마케팅 아이디어</h4><ul>'+(ev.marketingIdeas||[]).map(m=>'<li>'+m+'</li>').join('')+'</ul></div>';
    conts+='<div class="info-card"><h4>이슈화 전략</h4><ul>';
    if(ev.issueStrategy){if(ev.issueStrategy.description)conts+='<li><strong>'+ev.issueStrategy.description+'</strong></li>';(ev.issueStrategy.tactics||[]).forEach(t=>{conts+='<li>'+t+'</li>'})}
    conts+='</ul></div>';
    conts+='<div class="info-card"><h4>할인 구조</h4><ul><li>유형: '+(ev.discountStructure?.type||'')+'</li><li>범위: '+(ev.discountStructure?.range||'')+'</li>';
    (ev.discountStructure?.tiers||[]).forEach(t=>{conts+='<li>'+t.condition+': '+t.discount+'</li>'});
    conts+='</ul></div>';
    conts+='<div class="info-card"><h4>사은품/적립금</h4><ul>';
    if(ev.gifts?.tiers)(ev.gifts.tiers).forEach(t=>{conts+='<li>'+t.condition+': '+t.gift+'</li>'});
    if(ev.rewards)Object.entries(ev.rewards).forEach(([k,v])=>{if(typeof v==='string')conts+='<li>'+v+'</li>'});
    conts+='</ul></div>';
    conts+='<div class="info-card"><h4>외부 마케팅</h4><ul>';
    (ev.externalMarketing||[]).forEach(m=>{conts+='<li><strong>'+m.channel+':</strong> '+m.plan+(m.budget?' ('+m.budget+')':'')+(m.roasTarget?' — 목표 '+m.roasTarget:'')+'</li>'});
    if(ev.marketingBudget)conts+='<li style="margin-top:6px;color:var(--primary)"><strong>총 예산: '+ev.marketingBudget.amount+' ('+ev.marketingBudget.share+')</strong></li>';
    conts+='</ul></div>';
    conts+='<div class="info-card"><h4>KPI 목표</h4><ul>';
    if(ev.kpiTargets){
      conts+='<li>예상 매출: <strong style="color:var(--foreground)">'+ev.kpiTargets.expectedRevenue+'</strong></li>';
      conts+='<li>예상 주문: '+fmt(ev.kpiTargets.expectedOrders)+'건</li>';
      conts+='<li>전환율: '+ev.kpiTargets.conversionRate+'</li>';
      if(ev.kpiTargets.avgOrderValue)conts+='<li>평균 객단가: '+ev.kpiTargets.avgOrderValue+'</li>';
      if(ev.kpiTargets.calculationBasis)conts+='<li style="font-size:11px;color:#52525b;margin-top:6px;font-style:italic">산출근거: '+ev.kpiTargets.calculationBasis+'</li>';
    }
    conts+='</ul></div>';
    if(ev.targetCustomer){
      conts+='<div class="info-card"><h4>타겟 고객</h4><ul>';
      conts+='<li><strong>주요 타겟:</strong> '+ev.targetCustomer.primary+'</li>';
      conts+='<li><strong>구매 행동:</strong> '+ev.targetCustomer.behavior+'</li>';
      conts+='<li><strong>신규/기존:</strong> '+ev.targetCustomer.newVsReturn+'</li>';
      conts+='<li><strong>핵심 채널:</strong> '+ev.targetCustomer.keyChannel+'</li>';
      conts+='</ul></div>';
    }
    conts+='</div>';

    if(ev.conversionProcess?.steps){
      conts+='<h3 style="margin:24px 0 12px;font-size:14px;font-weight:600">구매 전환 프로세스</h3><div class="steps">';
      ev.conversionProcess.steps.forEach(s=>{conts+='<div class="step"><div class="num">'+s.step+'</div><div class="step-name">'+s.name+'</div><div class="step-action">'+s.action+'</div></div>'});
      conts+='</div>';
    }

    if(ev.products?.length){
      conts+='<h3 style="margin:24px 0 12px;font-size:14px;font-weight:600;display:flex;align-items:center;gap:12px">상품 리스트 ('+ev.products.length+'개) <button class="btn btn-primary btn-sm" onclick="dlEvXl('+i+')">엑셀 다운로드</button></h3>';
      conts+='<div class="table-wrap"><table><thead><tr><th>코드</th><th>상품명</th><th class="text-right">TAG가</th><th class="text-right">행사가</th><th class="text-right">할인율</th><th class="text-right">배수</th><th class="text-right">재고</th><th class="text-right">원가</th><th class="text-right">마진</th></tr></thead><tbody>';
      ev.products.forEach(p=>{conts+='<tr><td>'+p.code+'</td><td>'+p.name+'</td><td class="text-right">'+fmt(p.tagPrice)+'</td><td class="text-right" style="color:'+c+';font-weight:600">'+fmt(p.eventPrice)+'</td><td class="text-right"><span class="disc-badge">'+(p.discountRate||0).toFixed(0)+'%</span></td><td class="text-right">'+(p.markup||'-')+'</td><td class="text-right">'+fmt(p.stock)+'</td><td class="text-right">'+fmt(p.cost)+'</td><td class="text-right">'+fmtP(p.expectedMargin)+'</td></tr>'});
      conts+='</tbody></table></div>';
    }
    conts+='</div>';
  });
  document.getElementById('event-tabs').innerHTML=tabs;
  document.getElementById('event-contents').innerHTML=conts;
}

function switchEvent(i){
  document.querySelectorAll('.event-tab').forEach((t,j)=>{t.classList.toggle('active',j===i)});
  document.querySelectorAll('.event-content').forEach((c,j)=>c.classList.toggle('active',j===i));
}

let allEP=[];
function buildAllProducts(){
  scenarioData.events.forEach(ev=>{(ev.products||[]).forEach(p=>{allEP.push({...p,eventType:ev.eventType,eventTitle:ev.title})})});
  const ef=document.getElementById('filter-event'),cf=document.getElementById('filter-cat');
  [...new Set(allEP.map(p=>p.eventType))].forEach(t=>{ef.innerHTML+='<option value="'+t+'">'+(eventLabels[t]||t)+'</option>'});
  [...new Set(allEP.map(p=>p.category).filter(Boolean))].forEach(c=>{cf.innerHTML+='<option value="'+c+'">'+c+'</option>'});
  filterProducts();
}

function filterProducts(){
  const et=document.getElementById('filter-event').value,cat=document.getElementById('filter-cat').value,q=document.getElementById('filter-search').value.toLowerCase();
  let f=allEP;
  if(et)f=f.filter(p=>p.eventType===et);
  if(cat)f=f.filter(p=>p.category===cat);
  if(q)f=f.filter(p=>(p.name||'').toLowerCase().includes(q)||(p.code||'').toLowerCase().includes(q));
  let h='<thead><tr><th>행사</th><th>코드</th><th>상품명</th><th class="text-right">TAG가</th><th class="text-right">행사가</th><th class="text-right">할인율</th><th class="text-right">배수</th><th class="text-right">재고</th><th class="text-right">원가</th><th class="text-right">마진</th><th>카테고리</th></tr></thead><tbody>';
  f.forEach(p=>{h+='<tr><td><span class="tag" style="background:'+(eventColors[p.eventType]||'#666')+'1a;color:'+(eventColors[p.eventType]||'#999')+';border:1px solid '+(eventColors[p.eventType]||'#666')+'33">'+(eventLabels[p.eventType]||p.eventType)+'</span></td><td>'+p.code+'</td><td>'+p.name+'</td><td class="text-right">'+fmt(p.tagPrice)+'</td><td class="text-right" style="font-weight:600;color:var(--primary)">'+fmt(p.eventPrice)+'</td><td class="text-right"><span class="disc-badge">'+(p.discountRate||0).toFixed(0)+'%</span></td><td class="text-right">'+(p.markup||'-')+'</td><td class="text-right">'+fmt(p.stock)+'</td><td class="text-right">'+fmt(p.cost)+'</td><td class="text-right">'+fmtP(p.expectedMargin)+'</td><td>'+(p.category||'-')+'</td></tr>'});
  document.getElementById('table-all-products').innerHTML=h+'</tbody>';
}

function dlEvXl(i){
  const ev=scenarioData.events[i];
  const r=(ev.products||[]).map(p=>({'상품코드':p.code,'상품명':p.name,'TAG가':p.tagPrice,'행사가':p.eventPrice,'할인율(%)':p.discountRate,'배수':p.markup,'재고':p.stock,'원가':p.cost,'마진(%)':p.expectedMargin,'카테고리':p.category||''}));
  const ws=XLSX.utils.json_to_sheet(r);const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,'상품');
  XLSX.writeFile(wb,(ev.title||'event').replace(/[^가-힣a-zA-Z0-9]/g,'_')+'.xlsx');
}

function downloadAllExcel(){
  const r=allEP.map(p=>({'행사':eventLabels[p.eventType]||p.eventType,'상품코드':p.code,'상품명':p.name,'TAG가':p.tagPrice,'행사가':p.eventPrice,'할인율(%)':p.discountRate,'배수':p.markup,'재고':p.stock,'원가':p.cost,'마진(%)':p.expectedMargin,'카테고리':p.category||''}));
  const ws=XLSX.utils.json_to_sheet(r);const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,'전체');
  XLSX.writeFile(wb,'밸롭_전체_행사_상품.xlsx');
}

function renderCalendar(){
  const evts=scenarioData.events;
  let h='<div style="overflow-x:auto"><div style="min-width:800px">';
  h+='<div class="gantt-row"><div class="gantt-label"></div><div class="gantt-bar-container" style="background:transparent;display:flex">';
  for(let d=1;d<=31;d++)h+='<div style="flex:1;text-align:center;font-size:10px;color:#52525b">'+d+'</div>';
  h+='</div></div>';
  const seen=new Set();
  evts.forEach(ev=>{
    const key=ev.eventType+(ev.dealNumber||'');
    if(seen.has(key)&&ev.eventType==='guerrilla')return;
    seen.add(key);
    const c=eventColors[ev.eventType]||'#FF6B35';
    const s=new Date(ev.duration?.start||'2026-03-01');
    const e=new Date(ev.duration?.end||'2026-03-31');
    const base=new Date('2026-03-01');
    const sd=Math.max(1,(s-base)/86400000+1);
    const ed=Math.min(31,(e-base)/86400000+1);
    const left=((sd-1)/31*100).toFixed(1)+'%';
    const width=((ed-sd+1)/31*100).toFixed(1)+'%';
    h+='<div class="gantt-row"><div class="gantt-label" style="color:'+c+'">'+ev.title.slice(0,18)+'</div><div class="gantt-bar-container"><div class="gantt-bar" style="left:'+left+';width:'+width+';background:'+c+'">'+(ev.duration?.start||'').slice(5)+' ~ '+(ev.duration?.end||'').slice(5)+'</div></div></div>';
  });
  h+='</div></div>';
  document.getElementById('gantt-chart').innerHTML=h;
}

function renderMarketing(){
  const b=scenarioData.overallStrategy?.budgetAllocation;
  if(b)new Chart(document.getElementById('chart-budget'),{type:'doughnut',data:{labels:b.breakdown.map(x=>x.channel),datasets:[{data:b.breakdown.map(x=>parseInt(x.amount)),backgroundColor:chartColors,borderWidth:0}]},options:{responsive:true,cutout:'65%',plugins:{legend:{position:'bottom',labels:{usePointStyle:true,pointStyle:'circle',padding:12}}}}});

  function parseRevenue(s){if(!s)return 0;s=String(s).replace(/,/g,'');var m=s.match(/([\\.\\d]+)\\s*억/);if(m)return Math.round(parseFloat(m[1])*10000);m=s.match(/([\\.\\d]+)\\s*만/);if(m)return Math.round(parseFloat(m[1]));return parseInt(s.replace(/[^0-9]/g,''))||0}

  const evts=scenarioData.events.filter((e,i,a)=>i===a.findIndex(x=>x.eventType===e.eventType));
  new Chart(document.getElementById('chart-revenue'),{type:'bar',data:{labels:evts.map(e=>e.title.slice(0,10)),datasets:[{label:'예상매출(만원)',data:evts.map(e=>parseRevenue(e.kpiTargets?.expectedRevenue)),backgroundColor:evts.map(e=>eventColors[e.eventType]||'#FF6B35'),borderRadius:4}]},options:{responsive:true,plugins:{legend:{display:false}},scales:{x:{ticks:{font:{size:10}},grid:{display:false}},y:{ticks:{callback:v=>v+'만'},grid:{color:chartGridColor}}}}});

  let p='<h3 style="margin:32px 0 12px;font-size:15px;font-weight:600">3월 실행 타임라인</h3><div class="info-grid">';
  (scenarioData.overallStrategy?.timeline||[]).forEach(t=>{
    p+='<div class="info-card"><h4>'+(t.phase||t.period)+'</h4><p style="font-size:12px;color:var(--primary);margin-bottom:8px">'+t.period+'</p><ul>';
    t.events.forEach(e=>{p+='<li>'+e+'</li>'});
    if(t.focus)p+='<li style="color:#52525b;font-style:italic;margin-top:6px">'+t.focus+'</li>';
    p+='</ul></div>';
  });
  p+='</div>';

  const ap=scenarioData.overallStrategy?.aprilPlan;
  if(ap){
    p+='<h3 style="margin:32px 0 12px;font-size:15px;font-weight:600;display:flex;align-items:center;gap:8px">'+ap.title+' <span class="badge">DRAFT</span></h3><div class="info-grid">';
    (ap.phases||[]).forEach(ph=>{
      p+='<div class="info-card"><h4>'+ph.name+'</h4><p style="font-size:12px;color:var(--primary);margin-bottom:8px">'+ph.period+'</p><ul>';
      ph.ideas.forEach(id=>{p+='<li>'+id+'</li>'});
      p+='</ul></div>';
    });
    p+='</div>';
    if(ap.keyMetrics){
      p+='<div class="info-card" style="margin-top:12px"><h4>4월 핵심 KPI 목표</h4><ul>';
      ap.keyMetrics.forEach(m=>{p+='<li>'+m+'</li>'});
      p+='</ul>';
      if(ap.budgetNote)p+='<p style="font-size:12px;color:#52525b;margin-top:8px;font-style:italic">'+ap.budgetNote+'</p>';
      p+='</div>';
    }
  }
  document.getElementById('marketing-plan').innerHTML=p;
}

window.addEventListener('scroll',()=>{document.getElementById('backTop').classList.toggle('show',window.scrollY>500)});

document.addEventListener('DOMContentLoaded',()=>{
  renderKPIs();renderCharts();renderCategoryTable();renderTop20Table();renderStockHealth();renderEvents();buildAllProducts();renderCalendar();renderMarketing();
  if(scenarioData.deduplication){
    var dd=document.createElement('div');
    dd.style.cssText='background:rgba(34,197,94,0.06);border:1px solid rgba(34,197,94,0.2);border-radius:0.5rem;padding:14px 16px;margin:16px 0;font-size:13px;color:var(--success)';
    dd.innerHTML='<strong>상품 중복 방지:</strong> '+scenarioData.deduplication.note+' (총 '+scenarioData.deduplication.totalAssigned+'개 상품 배정)';
    document.getElementById('events')?.querySelector('.container')?.insertBefore(dd,document.getElementById('event-tabs'));
  }
});
<\/script>
</body>
</html>`;
}

module.exports = { build, generateFullHTML };
