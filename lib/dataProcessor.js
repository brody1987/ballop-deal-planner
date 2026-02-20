/**
 * dataProcessor.js
 * Excel 파일(stock.xls, sales.xls)을 읽어 분석 데이터를 반환
 */
const XLSX = require('xlsx');

// Excel 시리얼 → 날짜 문자열
function excelDate(serial) {
  if (typeof serial !== 'number' || isNaN(serial)) return null;
  return new Date((serial - 25569) * 86400000).toISOString().slice(0, 10);
}

// 카테고리 분류
function classifyCategory(name) {
  const n = (name || '').toLowerCase();
  if (n.includes('슬리퍼') || n.includes('지압')) return '슬리퍼/지압';
  if (n.includes('아쿠아') || n.includes('샌들') || n.includes('물놀이')) return '아쿠아슈즈/샌들';
  if (n.includes('스니커즈') || n.includes('운동화') || n.includes('러닝') || n.includes('런 ')) return '스니커즈/운동화';
  if (n.includes('트레킹') || n.includes('등산') || n.includes('하이킹')) return '트레킹/등산';
  if (n.includes('티셔츠') || n.includes('상의') || n.includes('자켓') || n.includes('후드') ||
      n.includes('플리스') || n.includes('롱슬리브') || n.includes('반팔') || n.includes('래쉬가드') ||
      n.includes('집업') || n.includes('코튼')) return '의류/상의';
  if (n.includes('팬츠') || n.includes('레깅스') || n.includes('쇼츠') || n.includes('바지')) return '의류/하의';
  if (n.includes('양말') || n.includes('삭스') || n.includes('인솔') || n.includes('클리너')) return '양말/기타잡화';
  return '기타';
}

function process(stockBuffer, salesBuffer) {
  // ── 재고 파싱 ──
  const wb1 = XLSX.read(stockBuffer, { type: 'buffer' });
  const stockRaw = XLSX.utils.sheet_to_json(wb1.Sheets[wb1.SheetNames[0]], { header: 1 }).slice(2);

  const stockMap = {};
  stockRaw.forEach(r => {
    const code = r[1];
    if (!code) return;
    stockMap[code] = {
      code, name: r[2], tagPrice: r[3] || 0, planType: r[4] || '정상',
      preCost: r[6] || 0, cost: r[7] || 0, stock: r[8] || 0
    };
  });

  // ── 판매 파싱 ──
  const wb2 = XLSX.read(salesBuffer, { type: 'buffer' });
  const salesRaw = XLSX.utils.sheet_to_json(wb2.Sheets[wb2.SheetNames[0]], { header: 1 }).slice(2);

  const salesByProduct = {};
  const dailySalesMap = {};
  let totalSalesQty = 0, totalRevenue = 0, returnCount = 0;

  salesRaw.forEach(r => {
    const code = r[1];
    const dateStr = excelDate(r[0]);
    const qty = r[7] || 0;
    const amount = r[9] || 0;

    if (qty < 0) returnCount += Math.abs(qty);
    totalSalesQty += qty;
    totalRevenue += amount;

    if (dateStr) {
      if (!dailySalesMap[dateStr]) dailySalesMap[dateStr] = { date: dateStr, qty: 0, amount: 0 };
      dailySalesMap[dateStr].qty += qty;
      dailySalesMap[dateStr].amount += amount;
    }

    if (!code) return;
    if (!salesByProduct[code]) {
      salesByProduct[code] = {
        qty: 0, revenue: 0, totalCost: 0, tagPrice: r[6] || 0,
        colors: {}, sizes: {}
      };
    }
    const sp = salesByProduct[code];
    sp.qty += qty;
    sp.revenue += amount;
    sp.totalCost += (r[8] || 0) * qty;
    if (r[4]) sp.colors[r[4]] = (sp.colors[r[4]] || 0) + qty;
    if (r[5]) sp.sizes[r[5]] = (sp.sizes[r[5]] || 0) + qty;
  });

  const dailySales = Object.values(dailySalesMap).sort((a, b) => a.date.localeCompare(b.date));
  const salesDays = dailySales.length || 1;

  // ── 상품 통합 ──
  const products = Object.values(stockMap).map(s => {
    const sp = salesByProduct[s.code] || { qty: 0, revenue: 0, totalCost: 0, colors: {}, sizes: {} };
    const avgSalePrice = sp.qty > 0 ? sp.revenue / sp.qty : 0;
    const discountRate = s.tagPrice > 0 && avgSalePrice > 0 ? (1 - avgSalePrice / s.tagPrice) * 100 : 0;
    const marginRate = sp.revenue > 0 ? (1 - sp.totalCost / sp.revenue) * 100 : 0;
    const dailySalesRate = sp.qty / salesDays;
    const daysOfStock = dailySalesRate > 0 ? s.stock / dailySalesRate : (s.stock > 0 ? 99999 : 0);
    const category = classifyCategory(s.name);

    return {
      code: s.code, name: s.name, tagPrice: s.tagPrice, planType: s.planType,
      cost: s.cost, stock: s.stock, salesQty: sp.qty, salesRevenue: sp.revenue,
      avgSalePrice: Math.round(avgSalePrice * 100) / 100,
      discountRate: Math.round(discountRate * 100) / 100,
      marginRate: Math.round(marginRate * 100) / 100,
      dailySalesRate: Math.round(dailySalesRate * 100) / 100,
      daysOfStock: Math.round(daysOfStock * 100) / 100,
      category,
      colorBreakdown: Object.entries(sp.colors).map(([name, qty]) => ({ name, qty })),
      sizeBreakdown: Object.entries(sp.sizes).map(([name, qty]) => ({ name, qty }))
    };
  });

  // ── 카테고리 집계 ──
  const catNames = ['스니커즈/운동화', '슬리퍼/지압', '아쿠아슈즈/샌들', '트레킹/등산', '의류/상의', '의류/하의', '양말/기타잡화', '기타'];
  const categories = catNames.map(name => {
    const items = products.filter(p => p.category === name);
    const withStock = items.filter(p => p.stock > 0);
    return {
      name,
      totalProducts: items.length,
      productsWithStock: withStock.length,
      totalStock: withStock.reduce((s, p) => s + p.stock, 0),
      totalSalesQty: items.reduce((s, p) => s + p.salesQty, 0),
      totalSalesRevenue: items.reduce((s, p) => s + p.salesRevenue, 0)
    };
  });

  // ── 분류 ──
  const topSellers = [...products].sort((a, b) => b.salesQty - a.salesQty).slice(0, 30).map(p => ({
    code: p.code, name: p.name, salesQty: p.salesQty, salesRevenue: p.salesRevenue,
    avgSalePrice: p.avgSalePrice, stock: p.stock, tagPrice: p.tagPrice,
    discountRate: p.discountRate, marginRate: p.marginRate, category: p.category
  }));

  const deadStock = products.filter(p => p.stock > 100 && (p.salesQty === 0 || p.daysOfStock > 180)).map(p => ({
    code: p.code, name: p.name, stock: p.stock, salesQty: p.salesQty,
    daysOfStock: p.daysOfStock, cost: p.cost, tagPrice: p.tagPrice,
    category: p.category, planType: p.planType,
    inventoryValue: p.stock * p.cost, dailySalesRate: p.dailySalesRate,
    marginRate: p.marginRate
  }));

  const highMargin = products.filter(p => p.marginRate > 50 && p.salesQty > 50).map(p => ({
    code: p.code, name: p.name, marginRate: p.marginRate, salesQty: p.salesQty,
    salesRevenue: p.salesRevenue, avgSalePrice: p.avgSalePrice,
    cost: p.cost, stock: p.stock, tagPrice: p.tagPrice, category: p.category
  }));

  const seasonalProducts = products.filter(p => {
    const n = (p.name || '').toLowerCase();
    return n.includes('아쿠아') || n.includes('샌들') || n.includes('래쉬') ||
           n.includes('슬리퍼') || n.includes('수영') || n.includes('쇼츠') ||
           n.includes('스윔') || n.includes('물놀이') || n.includes('비치') || n.includes('워터');
  }).map(p => ({
    code: p.code, name: p.name, stock: p.stock, salesQty: p.salesQty,
    salesRevenue: p.salesRevenue, dailySalesRate: p.dailySalesRate,
    daysOfStock: p.daysOfStock, tagPrice: p.tagPrice, cost: p.cost,
    category: p.category, inventoryValue: p.stock * p.cost, marginRate: p.marginRate
  }));

  const newArrivals = products.filter(p => p.planType === '기획' && p.stock > 0).map(p => ({
    code: p.code, name: p.name, planType: p.planType, stock: p.stock,
    salesQty: p.salesQty, salesRevenue: p.salesRevenue, avgSalePrice: p.avgSalePrice,
    tagPrice: p.tagPrice, cost: p.cost, discountRate: p.discountRate,
    marginRate: p.marginRate, category: p.category
  }));

  // ── 주차별 트렌드 ──
  const weeks = [];
  for (let i = 0; i < dailySales.length; i += 7) {
    const chunk = dailySales.slice(i, i + 7);
    const qty = chunk.reduce((s, d) => s + d.qty, 0);
    const amount = chunk.reduce((s, d) => s + d.amount, 0);
    weeks.push({
      week: 'W' + (weeks.length + 1), days: chunk.length,
      qty, amount,
      avgDailyQty: Math.round(qty / chunk.length * 100) / 100,
      avgDailyAmount: Math.round(amount / chunk.length)
    });
  }
  weeks.forEach((w, i) => {
    w.qtyGrowth = i > 0 ? Math.round((w.avgDailyQty / weeks[i - 1].avgDailyQty - 1) * 10000) / 100 : 0;
    w.amountGrowth = i > 0 ? Math.round((w.avgDailyAmount / weeks[i - 1].avgDailyAmount - 1) * 10000) / 100 : 0;
  });

  const trend = weeks.length >= 2 && weeks[weeks.length - 1].avgDailyAmount > weeks[0].avgDailyAmount ? '상승' : '하락';

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      totalProducts: products.length,
      productsWithStock: products.filter(p => p.stock > 0).length,
      totalStockQty: products.filter(p => p.stock > 0).reduce((s, p) => s + p.stock, 0),
      totalSalesQty, totalRevenue,
      avgDailySalesQty: Math.round(totalSalesQty / salesDays * 100) / 100,
      avgDailyRevenue: Math.round(totalRevenue / salesDays),
      dateRange: { start: dailySales[0]?.date, end: dailySales[dailySales.length - 1]?.date },
      salesDays, returnCount
    },
    dailySales, categories, products, topSellers, deadStock, highMargin,
    seasonalProducts, newArrivals,
    salesTrends: { weekly: weeks, overallTrend: trend }
  };
}

module.exports = { process };
