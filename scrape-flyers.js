/* =====================================================================
 * scrape-flyers.js — Markham 超市特价抓取（Node 18+，零依赖）
 * 用法：node scrape-flyers.js  → 生成 deals-data.json
 * 主数据源仍建议：小红书 / Facebook / 人工更新 deals.js 的 FALLBACK_DEALS
 * =================================================================== */
const fs = require('fs');
const path = require('path');

/* STORES 里的 type 决定 scrapeStore() 走哪条抓取路径：
 *   'goflyer'   —— 先尝试 GoFlyer 的结构化 API（需要 goflyerSlug；没有
 *                   slug 时会退化成下面的 'html' 通用抓取）
 *   'html'      —— 直接 fetch 页面 HTML，用正则粗略抓"名称 + 价格"
 *   'js-widget' —— 已知是纯 JS 渲染/SPA，抓了也是空的，直接跳过
 * fuyao 的特价发在 Facebook 帖子里，不走 GoFlyer，所以标 'html'。
 * guanye / dingxian 暂时没有确认到的 GoFlyer 门店 slug，先留
 * goflyerSlug:null（回退到通用 HTML 抓取，抓自家首页基本抓不到东西，
 * 是已知限制），等确认到具体 slug 后把 goflyerSlug 填上即可生效。 */
const STORES = [
  { id:'tnt16', type:'html', url:'https://www.tntsupermarket.com/store-flyer/' },
  { id:'guanye', type:'goflyer', goflyerSlug:null, url:'https://goflyer.ca/' },
  { id:'dingtai', type:'goflyer', goflyerSlug:'foodymart-hwy7-hwy-7',
    url:'https://goflyer.ca/storedetails/foodymart-hwy7-hwy-7' },
  { id:'fuyao', type:'html', url:'https://www.facebook.com/100063747660975' },
  { id:'dingxian', type:'goflyer', goflyerSlug:null, url:'https://goflyer.ca/' },
  { id:'walmart', type:'js-widget', url:'https://www.walmart.ca/en/flyer' },
  { id:'loblaws', type:'js-widget', url:'https://www.loblaws.ca/flyer' },
  { id:'metro', type:'js-widget', url:'https://www.metro.ca/en/flyer' },
  { id:'nofrills', type:'js-widget', url:'https://www.nofrills.ca/flyer' },
  { id:'foodbasics', type:'js-widget', url:'https://www.foodbasics.ca/flyers' },
];

const GOFLYER_API = 'https://backend-prod.goflyer.ca';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';
const TIMEOUT_MS = 12000;
const MAX_DEALS = 6;
const CONCURRENCY = 3;

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function fetchWithTimeout(url, options = {}, retries = 1) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'User-Agent': UA,
        Accept: 'application/json, text/html, */*',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        ...(options.headers || {}),
      },
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res;
  } catch (err) {
    clearTimeout(timer);
    if (retries > 0) {
      await sleep(400 + Math.random() * 400);
      return fetchWithTimeout(url, options, retries - 1);
    }
    throw err;
  }
}

function parseGoFlyerItems(items) {
  if (!Array.isArray(items) || !items.length) return [];
  const sorted = [...items].sort((a, b) => (b.topSale ? 1 : 0) - (a.topSale ? 1 : 0));
  const results = [];
  for (const it of sorted) {
    if (results.length >= MAX_DEALS) break;
    const name = (it.nameChinese || it.name || '').trim();
    if (name.length < 2) continue;
    let priceStr;
    if (typeof it.salePrice === 'number') {
      const unit = (it.unit || '').toLowerCase();
      const suffix = unit && unit !== 'ea' && unit !== 'each' ? `/${unit}` : '';
      priceStr = `$${Number(it.salePrice).toFixed(2)}${suffix}`;
    } else if (it.regularPriceString) {
      priceStr = it.regularPriceString.startsWith('$')
        ? it.regularPriceString
        : `$${it.regularPriceString}`;
    } else continue;
    results.push({ item: name, price: priceStr, featured: !!it.topSale });
  }
  return results;
}

function parseGenericHtml(html) {
  const results = [];
  const re =
    /([A-Za-z\u4e00-\u9fa5][^\$\n<>]{1,45}?)\s*[：:\s]*\$?\s*(\d+\.\d{2})\s*(\/lb|\/kg|\/100g|\/ea|\/磅)?/gi;
  let m;
  while ((m = re.exec(html)) && results.length < 20) {
    let item = m[1].replace(/\s+/g, ' ').trim().replace(/[：:\-\|]+$/, '').trim();
    if (item.length < 4 || item.length > 40) continue;
    if (/^(http|www|page|click|view|more|登录|注册)/i.test(item)) continue;
    if (/[\{\}\[\]<>]|\.[0-9]|viewBox|transform/i.test(item)) continue;
    if (!/[\u4e00-\u9fa5]/.test(item) && !/[A-Za-z]{4,}/.test(item)) continue;
    results.push({ item, price: `$${m[2]}${m[3] || ''}` });
  }
  return results;
}

async function scrapeStore(store) {
  try {
    if (store.type === 'js-widget') {
      console.warn(`[${store.id}] js-widget 跳过`);
      return null;
    }
    if (store.type === 'goflyer' && store.goflyerSlug) {
      const res = await fetchWithTimeout(
        `${GOFLYER_API}/gf-flyer-item/findAllByStore/${store.goflyerSlug}`
      );
      const deals = parseGoFlyerItems(await res.json());
      if (deals.length) {
        console.log(`[${store.id}] GoFlyer → ${deals.length}`);
        return deals;
      }
    }
    // 'html'，或没有 goflyerSlug 的 'goflyer' 店，都走这条通用 HTML 抓取兜底
    const res = await fetchWithTimeout(store.url);
    const found = parseGenericHtml(await res.text());
    if (!found.length) {
      console.warn(`[${store.id}] 无文字特价`);
      return null;
    }
    console.log(`[${store.id}] HTML → ${Math.min(MAX_DEALS, found.length)}`);
    return found.slice(0, MAX_DEALS).map((d, i) => ({ ...d, featured: i === 0 }));
  } catch (err) {
    console.warn(`[${store.id}] ${err.message}`);
    return null;
  }
}

async function mapPool(items, n, fn) {
  const out = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]);
    }
  }
  await Promise.all(Array.from({ length: n }, () => worker()));
  return out;
}

async function main() {
  console.log('=== Markham Flyer Scraper ===\n');
  const raw = await mapPool(STORES, CONCURRENCY, async store => {
    const deals = await scrapeStore(store);
    await sleep(300 + Math.random() * 400);
    return { id: store.id, deals };
  });
  const output = {
    scrapedAt: new Date().toISOString(),
    note: 'Missing stores use FALLBACK_DEALS in deals.js',
  };
  let ok = 0;
  for (const { id, deals } of raw) {
    if (deals && deals.length) {
      output[id] = deals;
      ok++;
    }
  }
  const outPath = path.join(__dirname, 'deals-data.json');
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2), 'utf-8');
  console.log(`\nDone: ${ok}/${STORES.length} → ${outPath}`);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
