// 종목별 전일 대비 수익률을 가져와 docs/stocks.json에 저장
// 기존 fetch-market.js와 동일한 패턴 (의존성 0, Yahoo Finance 직접 호출)

const fs = require("fs");

// ── stock_inform.csv에서 ticker 목록 로드 ────────────────────
function loadTickers() {
  const csv = fs.readFileSync("stock_inform.csv", "utf8");
  const lines = csv.trim().split(/\r?\n/);
  const header = lines[0].split(",").map((s) => s.trim());
  const tickerIdx = header.indexOf("ticker");
  if (tickerIdx === -1) throw new Error("'ticker' 컬럼을 찾을 수 없습니다");

  return lines
    .slice(1)
    .map((line) => line.split(",")[tickerIdx]?.trim())
    .filter(Boolean);
}

// ── 단일 종목 수익률 ─────────────────────────────────────────
async function fetchOne(symbol) {
  try {
    const r = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`,
      { headers: { "User-Agent": "Mozilla/5.0" } }
    );
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const j = await r.json();
    const meta = j.chart.result[0].meta;
    const price = meta.regularMarketPrice;
    const prev = meta.chartPreviousClose;
    if (price == null || prev == null) throw new Error("데이터 없음");

    const pct = ((price - prev) / prev) * 100;
    const up = pct >= 0;
    return {
      ticker: symbol,
      price: Math.round(price * 100) / 100,
      change: `${up ? "+" : ""}${pct.toFixed(1)}%`,
      change_pct: Math.round(pct * 100) / 100,
      up,
    };
  } catch (e) {
    return {
      ticker: symbol,
      price: 0,
      change: "-",
      change_pct: 0,
      up: true,
    };
  }
}

// ── 동시 요청 수 제한 (Yahoo 429 방지) ──────────────────────
async function pMap(items, mapper, concurrency = 10) {
  const results = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await mapper(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  return results;
}

// ── 메인 ─────────────────────────────────────────────────────
(async () => {
  const tickers = loadTickers();
  console.log(`📊 ${tickers.length}개 종목 수익률 수집 시작...`);

  const list = await pMap(
    tickers,
    async (t, i) => {
      const r = await fetchOne(t);
      if (r.change !== "-") {
        console.log(`  ✅ [${i + 1}/${tickers.length}] ${t}: ${r.change}`);
      }
      return r;
    },
    10
  );

  // ticker를 키로 하는 dict 형태로 변환
  const stocks = {};
  for (const r of list) stocks[r.ticker] = r;

  fs.mkdirSync("docs", { recursive: true });
  fs.writeFileSync(
    "docs/stocks.json",
    JSON.stringify(
      { stocks, updated_at: new Date().toISOString() },
      null,
      2
    )
  );

  const success = list.filter((r) => r.change !== "-").length;
  console.log(`\n✨ 완료: ${success}/${tickers.length} 성공 → docs/stocks.json`);
})();
