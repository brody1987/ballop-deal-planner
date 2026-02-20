/**
 * server.js
 * 밸롭 자사몰 할인 행사 기획 보고서 생성기
 * Vercel 서버리스 + 로컬 개발 모두 지원
 */
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const os = require('os');

const dataProcessor = require('./lib/dataProcessor');
const scenarioEngine = require('./lib/scenarioEngine');
const reportBuilder = require('./lib/reportBuilder');

const app = express();
const PORT = process.env.PORT || 3000;
const IS_VERCEL = !!process.env.VERCEL;

// 업로드 디렉토리: Vercel은 /tmp, 로컬은 ./uploads
const uploadDir = IS_VERCEL ? os.tmpdir() : path.join(__dirname, 'uploads');
if (!IS_VERCEL) {
  try { fs.mkdirSync(uploadDir, { recursive: true }); } catch {}
}

const upload = multer({
  dest: uploadDir,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.xls', '.xlsx'].includes(ext)) cb(null, true);
    else cb(new Error('엑셀 파일(.xls, .xlsx)만 업로드 가능합니다.'));
  }
});

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// 인메모리 보고서 저장 (서버리스 warm 인스턴스 내에서 유효)
const reportCache = new Map();
const CACHE_TTL = 10 * 60 * 1000; // 10분

function cacheReport(id, html) {
  reportCache.set(id, { html, createdAt: Date.now() });
  // 오래된 캐시 정리
  for (const [key, val] of reportCache) {
    if (Date.now() - val.createdAt > CACHE_TTL) reportCache.delete(key);
  }
}

// SSE 진행 상황 (로컬에서만 완전 작동, Vercel에서는 별도 인스턴스 가능)
const clients = new Map();

app.get('/api/progress/:id', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  clients.set(req.params.id, res);
  req.on('close', () => clients.delete(req.params.id));
});

function sendProgress(id, step, total, message) {
  const client = clients.get(id);
  if (client) {
    client.write(`data: ${JSON.stringify({ step, total, message })}\n\n`);
  }
}

// 보고서 생성 API
app.post('/api/generate', upload.fields([
  { name: 'stock', maxCount: 1 },
  { name: 'sales', maxCount: 1 }
]), async (req, res) => {
  const progressId = req.body.progressId || Date.now().toString();
  const totalSteps = 5;

  try {
    if (!req.files?.stock?.[0] || !req.files?.sales?.[0]) {
      return res.status(400).json({ error: '재고(stock)와 판매(sales) 파일을 모두 업로드해주세요.' });
    }

    sendProgress(progressId, 1, totalSteps, '파일 읽는 중...');
    const stockBuffer = fs.readFileSync(req.files.stock[0].path);
    const salesBuffer = fs.readFileSync(req.files.sales[0].path);

    sendProgress(progressId, 2, totalSteps, '데이터 분석 중...');
    const data = dataProcessor.process(stockBuffer, salesBuffer);

    let selectedEvents = [];
    try {
      selectedEvents = JSON.parse(req.body.events || '[]');
    } catch { selectedEvents = ['main', 'sub', 'season', 'offSeason', 'newProduct', 'guerrilla', 'deadStock']; }
    if (selectedEvents.length === 0) {
      selectedEvents = ['main', 'sub', 'season', 'offSeason', 'newProduct', 'guerrilla', 'deadStock'];
    }

    const apiKey = (req.body.apiKey || '').trim();
    const useAI = req.body.useAI === 'true' && apiKey.length > 0;

    sendProgress(progressId, 3, totalSteps, useAI ? 'Gemini AI 시나리오 생성 중... (약 30초)' : '시나리오 생성 중...');
    const scenarios = await scenarioEngine.generate(data, selectedEvents, useAI, apiKey);

    sendProgress(progressId, 4, totalSteps, '보고서 생성 중...');
    const html = reportBuilder.build(data, scenarios);

    const reportId = Date.now().toString(36);

    // 인메모리 캐시 저장
    cacheReport(reportId, html);

    // 로컬 환경에서는 파일로도 저장
    if (!IS_VERCEL) {
      try {
        fs.writeFileSync(path.join(uploadDir, `report_${reportId}.html`), html, 'utf-8');
        fs.writeFileSync(path.join(uploadDir, `data_${reportId}.json`), JSON.stringify(data), 'utf-8');
        fs.writeFileSync(path.join(uploadDir, `scenarios_${reportId}.json`), JSON.stringify(scenarios), 'utf-8');
      } catch {}
    }

    sendProgress(progressId, 5, totalSteps, '완료!');

    // 업로드 임시파일 정리
    try { fs.unlinkSync(req.files.stock[0].path); } catch {}
    try { fs.unlinkSync(req.files.sales[0].path); } catch {}

    res.json({
      success: true,
      reportId,
      reportUrl: `/api/report/${reportId}`,
      reportHtml: html,
      summary: {
        totalProducts: data.summary.totalProducts,
        productsWithStock: data.summary.productsWithStock,
        totalRevenue: data.summary.totalRevenue,
        eventsGenerated: scenarios.events.length,
        aiUsed: useAI
      }
    });

  } catch (err) {
    console.error('Error:', err);
    sendProgress(progressId, -1, totalSteps, `오류: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// 보고서 열기 (캐시 → 파일 폴백)
app.get('/api/report/:id', (req, res) => {
  const id = req.params.id;

  // 1) 인메모리 캐시
  const cached = reportCache.get(id);
  if (cached) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(cached.html);
  }

  // 2) 파일 폴백 (로컬)
  const reportPath = path.join(uploadDir, `report_${id}.html`);
  if (fs.existsSync(reportPath)) {
    return res.sendFile(reportPath);
  }

  res.status(404).send('보고서를 찾을 수 없습니다. 보고서가 만료되었을 수 있습니다.');
});

// 보고서 다운로드
app.get('/api/download/:id/:type', (req, res) => {
  const { id, type } = req.params;
  const filePath = path.join(uploadDir, `${type}_${id}.${type === 'report' ? 'html' : 'json'}`);
  if (fs.existsSync(filePath)) {
    res.download(filePath);
  } else {
    res.status(404).send('파일을 찾을 수 없습니다.');
  }
});

// 상태 확인
app.get('/api/status', (req, res) => {
  res.json({ version: '1.0.0', platform: IS_VERCEL ? 'vercel' : 'local' });
});

// 로컬 실행 시에만 listen
if (!IS_VERCEL) {
  app.listen(PORT, () => {
    console.log(`\n  밸롭 행사 기획 보고서 생성기`);
    console.log(`  http://localhost:${PORT}`);
    console.log(`  AI 모드: Gemini (사용자가 API 키 직접 입력)\n`);
  });
}

// Vercel 서버리스 함수로 export
module.exports = app;
