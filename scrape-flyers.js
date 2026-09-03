/* =====================================================================
 * scrape-flyers.js — Markham 超市特价抓取（Node 18+，零依赖）
 * =====================================================================
 * 用法：node scrape-flyers.js
 * 输出：deals-data.json（deals.js 会自动读取覆盖 FALLBACK_DEALS）
 *
 * 策略：
 * 1. 有 GoFlyer slug 的店 → 直接打后端 API（结构化中文名+价格）
 * 2. 其余 HTML 页 → 启发式正则（多数 SPA/图片页会空，属正常）
 * 3. 西人 JS 互动页直接跳过（需 Puppeteer/Flipp，超出本脚本范围）
 * 4. 失败的店不写进 json → deals.js 回退占位数据，页面不空窗
 *
 * 数据补充主路径仍是：小红书 / Facebook / 人工更新 FALLBACK_DEALS
 * =================================================================== */

const fs = require('fs');
const path = require('path');

const STORES = [
  { id:'tnt16',      type:'html',      url:'https://www.tntsupermarket.com/store-flyer/' },
  { id:'guanye',     type:'goflyer',   goflyerSlug:null, url:'https://goflyer.ca/' },
  { id:'dingtai',    type:'goflyer',   goflyerSlug:'foodymart-hwy7-hwy-7',
    url:'https://goflyer.ca/storedetails/foodymart-hwy7-hwy-7' },
  { id:'fuyao',      type:'goflyer',   goflyerSlug:null, url:'https://www.facebook.com/100063747660975' },
  { id:'dingxian',   type:'goflyer',   goflyerSlug:null, url:'https://goflyer.ca/' },
  { id:'walmart',    type:'js-widget', url:'https://www.walmart.ca/en/flyer' },
  { id:'loblaws',    type:'js-widget', url:'https://www.loblaws.ca/flyer' },
  { id:'metro',      type:'js-widget', url:'https://www.metro.ca/en/flyer' },
  { id:'nofrills',   type:'js-widget', url:'https://www.nofrills.ca/flyer' },
  { id:'foodbasics', type:'js-widget', url:'https://www.foodbasics.ca/flyers' },
];

const GOFLYER_API = 'https://backend-prod.goflyer.ca';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';
const TIMEOUT_MS = 12000;
const MAX_DEALS = 6;
const CONCURRENCY = 3;

function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }

async function fetchWithTimeout(url, options = {}, retries = 1){
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try{
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'User-Agent': UA,
        'Accept': 'application/json, text/html, */*',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        ...(options.headers || {}),
      },
    });
    clearTimeout(timer);
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    return res;
  }catch(err){
    clearTimeout(timer);
    if(retries > 0){
      await sleep(400 + Math.random() * 400);
      return fetchWithTimeout(url, options, retries - 1);
    }
    throw err;
  }
}

function parseGoFlyerItems(items){
  if(!Array.isArray(items) || !items.length) return [];
  const sorted = [...items].sort((a, b) => (b.topSale?1:0) - (a.topSale?1:0));
  const results = [];
  for(const it of sorted){
    if(results.length >= MAX_DEALS) break;
    const name = (it.nameChinese || it.name || '').trim();
    if(name.length < 2) continue;
    let priceStr;
    if(typeof it.salePrice === 'number'){
      const unit = (it.unit || '').toLowerCase();
      const suffix = unit && unit !== 'ea' && unit !== 'each' ? `/${unit}` : '';
      priceStr = `$${Number(it.salePrice).toFixed(2)}${suffix}`;
    }else if(it.regularPriceString){
      priceStr = it.regularPriceString.startsWith('$') ? it.regularPriceString : `$${it.regularPriceString}`;
    }else continue;
    results.push({ item:name, price:priceStr, featured:!!it.topSale });
  }
  return results;
}

function parseGenericHtml(html){
  const results = [];
  const re = /([A-Za-z\u4e00-\u9fa5][^\$\n<>]{1,45}?)\s*[：:\s]*\$?\s*(\d+\.\d{2})\s*(\/lb|\/kg|\/100g|\/ea|\/磅)?/gi;
  let m;
  while((m = re.exec(html)) && results.length < 20){
    let item = m[1].replace(/\s+/g, ' ').trim().replace(/[：:\-\|]+$/, '').trim();
    if(item.length < 4 || item.length > 40) continue;
    if(/^(http|www|page|click|view|more|登录|注册)/i.test(item)) continue;
    if(/[\{\}\[\]<>]|\.[0-9]|c-|a\.|H[0-9]|s-|l-|m-|viewBox|transform/i.test(item)) continue;
    const hasCN = /[\u4e00-\u9fa5]/.test(item);
    const hasWord = /[A-Za-z]{4,}/.test(item);
    if(!hasCN && !hasWord) continue;
    results.push({ item, price:`$${m[2]}${m[3]||''}` });
  }
  return results;
}

async function scrapeGoFlyer(store){
  if(!store.goflyerSlug) return null;
  const res = await fetchWithTimeout(`${GOFLYER_API}/gf-flyer-item/findAllByStore/${store.goflyerSlug}`);
  const deals = parseGoFlyerItems(await res.json());
  if(!deals.length){
    console.warn(`[${store.id}] GoFlyer API 0 items`);
    return null;
  }
  console.log(`[${store.id}] GoFlyer → ${deals.length} deals`);
  return deals;
}

async function scrapeHtml(store){
  const res = await fetchWithTimeout(store.url);
  const found = parseGenericHtml(await res.text());
  if(!found.length){
    console.warn(`[${store.id}] HTML 无可用文字特价`);
    return null;
  }
  console.log(`[${store.id}] HTML → ${Math.min(MAX_DEALS, found.length)} deals`);
  return found.slice(0, MAX_DEALS).map((d, i) => ({ ...d, featured: i === 0 }));
}

async function scrapeStore(store){
  try{
    if(store.type === 'js-widget'){
      console.warn(`[${store.id}] js-widget 跳过（需 Puppeteer/Flipp）`);
      return null;
    }
    if(store.type === 'goflyer'){
      const api = await scrapeGoFlyer(store);
      if(api) return api;
      return await scrapeHtml(store);
    }
    return await scrapeHtml(store);
  }catch(err){
    console.warn(`[${store.id}] ${err.message}`);
    return null;
  }
}

async function mapPool(items, concurrency, fn){
  const results = new Array(items.length);
  let idx = 0;
  async function worker(){
    while(idx < items.length){
      const i = idx++;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return results;
}

async function main(){
  console.log('=== Markham Flyer Scraper ===\n');
  const raw = await mapPool(STORES, CONCURRENCY, async (store) => {
    const deals = await scrapeStore(store);
    await sleep(300 + Math.random() * 400);
    return { id: store.id, deals };
  });

  const output = {
    scrapedAt: new Date().toISOString(),
    note: 'Missing stores fall back to FALLBACK_DEALS in deals.js',
  };
  let ok = 0;
  for(const { id, deals } of raw){
    if(deals && deals.length){
      output[id] = deals;
      ok++;
    }
  }
  const outPath = path.join(__dirname, 'deals-data.json');
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2), 'utf-8');
  console.log(`\nDone: ${ok}/${STORES.length} → ${outPath}`);
}

main().catch(err => { console.error(err); process.exit(1); });
