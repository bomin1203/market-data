const TICKERS = [
  { key: "kospi",  label: "코스피",       symbol: "^KS11" },
  { key: "kosdaq", label: "코스닥",       symbol: "^KQ11" },
  { key: "usdkrw", label: "원/달러 환율", symbol: "KRW=X" },
  { key: "nasdaq", label: "나스닥",       symbol: "^IXIC" },
  { key: "btc",    label: "비트코인",     symbol: "BTC-USD" },
];

async function fetchOne(t) {
  const r = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(t.symbol)}`,
    { headers: { "User-Agent": "Mozilla/5.0" } }
  );
  if (!r.ok) throw new Error(`${t.symbol} HTTP ${r.status}`);
  const j = await r.json();
  const meta = j.chart.result[0].meta;
  const price = meta.regularMarketPrice;
  const prev = meta.chartPreviousClose;
  const diff = price - prev;
  const pct = (diff / prev) * 100;
  const up = diff >= 0;
  return {
    key: t.key,
    label: t.label,
    value: price.toLocaleString("ko-KR", { maximumFractionDigits: 2 }),
    change: `${up ? "+" : ""}${diff.toFixed(2)} (${up ? "+" : ""}${pct.toFixed(2)}%)`,
    up,
  };
}

(async () => {
  const markets = [];
  for (const t of TICKERS) {
    try {
      markets.push(await fetchOne(t));
    } catch (e) {
      console.error(`Failed: ${t.symbol}`, e.message);
      markets.push({
        key: t.key, label: t.label, value: "-", change: "-", up: true,
      });
    }
  }

  const fs = require("fs");
  fs.mkdirSync("docs", { recursive: true });
  fs.writeFileSync(
    "docs/market.json",
    JSON.stringify({ markets, updated_at: new Date().toISOString() }, null, 2)
  );
  console.log("✓ docs/market.json updated");
})();