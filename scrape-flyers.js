/* =====================================================================
 * scrape-flyers.js — 服务器端 / Node 抓取脚本（参考实现，非浏览器代码）
 * =====================================================================
 * 用法：
 *   node scrape-flyers.js
 * 需要 Node.js 18+（自带 fetch，不用额外装包）。
 * 运行后会在当前目录生成 deals-data.json，deals.js 会自动读取它。
 *
 * 建议配合定时任务每天跑一次，例如 Linux/Mac 的 crontab，或者放到
 * GitHub Actions 的 schedule 里，跑完把 deals-data.json 和 index.html/
 * style.css/deals.js 一起部署到你的网站空间。
 *
 * ⚠️ 诚实的技术说明（务必读完再用）：
 * 1. 这十家店里，不少"Flyer"本质上是图片或翻页 PDF（尤其是华人超市，
 *    包括 T&T 在内很多都是这种形式），网页 HTML 里根本没有商品名和
 *    价格的文字，纯文本抓取抓不到任何东西——想自动化就得接 OCR
 *    （比如 Tesseract 或云端图像识别 API），这已经超出"写一份 js
 *    抓取"的范畴，是另一个独立的工程量，这份脚本没有包含 OCR。
 * 2. 冠业 / 福耀 / 鼎鲜 这几家小型连锁，我没能确认它们有结构化、可
 *    直接文字抓取的官方页面；目前多是在 goflyer.ca / superlife.ca
 *    这类第三方聚合站上出现，但这些聚合站前端是 JS 单页应用（SPA），
 *    数据是页面加载后再异步请求接口填进去的，直接 fetch 页面 HTML
 *    只会拿到一个空壳，需要先用浏览器开发者工具的网络面板，找到它
 *    实际调用的数据接口（API），再针对那个接口写抓取逻辑——这一步
 *    需要你（或后续开发）用真实浏览器实际操作一次去确认，我在这个
 *    沙盒环境里没有可视化浏览器，没法帮你抓包确认。
 * 3. 下面 parseGenericHtml() 是一个"尽力而为"的通用启发式解析器：
 *    在纯文字型网页里，用正则找"商品名 + 紧跟着的 $价格"这种模式。
 *    对文字型的 Flyer 页面可能有效，对图片型/SPA型的页面基本抓不到
 *    东西，会自动跳过并保留 deals.js 里的占位数据。
 * 4. Walmart / Loblaws / Metro / No Frills / Food Basics 这五家官网的
 *    Flyer 页面也大多是 JS 渲染的互动翻页组件，同样不是简单的静态
 *    HTML 文本，直接 fetch 大概率也抓不到结构化商品数据。真正稳定
 *    的做法通常是：
 *      a) 走 Flipp 这类聚合平台的官方/合作 API（多数收费，如 Apify
 *         上的 Flipp Scraper），或
 *      b) 用 Puppeteer/Playwright 起一个无头浏览器，等页面渲染完
 *         再读 DOM——这个脚本没有引入这类重依赖，保持"零安装即可跑"，
 *         但也因此拿不到这些站点的真实结构化数据。
 *
 * 结论：这份脚本是一个诚实、可运行、可扩展的起点，而不是"开箱即用
 * 保证抓到十家店最新特价"的成品。真正做到稳定可靠，大概率需要：
 * 浏览器抓包找接口 + （如需要）OCR + 定期检查页面结构是否变化。
 * =================================================================== */

const fs = require('fs');
const path = require('path');

// 与 deals.js 里的 STORE_CONFIG 保持一致（id 必须对应）
const STORES = [
  { id:'tnt16',      label:'T&T 16街',      url:'https://www.tntsupermarket.com/eng/weekly-special-er.html', type:'unknown' },
  { id:'guanye',     label:'冠业Kennedy',   url:'https://goflyer.ca/',                                         type:'spa' },
  { id:'dingtai',    label:'鼎泰Hwy7',      url:'https://goflyer.ca/storedetails/foodymart-hwy7-hwy-7',       type:'spa' },
  { id:'fuyao',      label:'福耀Hwy7',      url:'https://goflyer.ca/',                                         type:'spa' },
  { id:'dingxian',   label:'鼎鲜Woodbine',  url:'https://goflyer.ca/',                                         type:'spa' },
  { id:'walmart',    label:'Walmart',       url:'https://www.walmart.ca/en/flyer',                             type:'js-widget' },
  { id:'loblaws',    label:'Loblaws',       url:'https://www.loblaws.ca/flyer',                                type:'js-widget' },
  { id:'metro',      label:'Metro',         url:'https://www.metro.ca/en/flyer',                               type:'js-widget' },
  { id:'nofrills',   label:'No Frills',     url:'https://www.nofrills.ca/flyer',                               type:'js-widget' },
  { id:'foodbasics', label:'Food Basics',   url:'https://www.foodbasics.ca/flyers',                            type:'js-widget' },
];

// 通用启发式解析：在纯文本 HTML 里找"商品名紧跟着 $价格"的片段。
// 只对少数仍然是服务端渲染纯文本的页面有效，type 为 'spa' 或
// 'js-widget' 的站点基本会返回空数组（正常现象，见文件头说明）。
function parseGenericHtml(html){
  const results = [];
  const priceRegex = /([A-Za-z\u4e00-\u9fa5][^\$\n<>]{2,40}?)\s*\$(\d+\.\d{2})(\/lb|\/kg|\/100g)?/g;
  let match;
  while((match = priceRegex.exec(html)) && results.length < 20){
    const item = match[1].replace(/\s+/g, ' ').trim();
    if(item.length < 2) continue;
    results.push({
      item,
      price: `$${match[2]}${match[3] || ''}`,
    });
  }
  return results;
}

async function scrapeStore(store){
  try{
    const res = await fetch(store.url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DealsBot/1.0)' },
    });
    if(!res.ok){
      console.warn(`[${store.id}] HTTP ${res.status}，跳过`);
      return null;
    }
    const html = await res.text();
    const found = parseGenericHtml(html);
    if(found.length === 0){
      console.warn(`[${store.id}] 没有解析出结构化特价（大概率是图片/SPA 页面，见文件头说明），跳过`);
      return null;
    }
    console.log(`[${store.id}] 解析到 ${found.length} 条候选，取前 6 条`);
    return found.slice(0, 6);
  }catch(err){
    console.warn(`[${store.id}] 抓取失败：${err.message}`);
    return null;
  }
}

async function main(){
  const output = {};
  for(const store of STORES){
    const deals = await scrapeStore(store);
    if(deals) output[store.id] = deals;
    // 简单限速，别对同一个域名连续高频请求
    await new Promise(r => setTimeout(r, 500));
  }

  const outPath = path.join(__dirname, 'deals-data.json');
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2), 'utf-8');

  const okCount = Object.keys(output).length;
  console.log(`\n完成：成功抓到 ${okCount}/${STORES.length} 家店的数据 → ${outPath}`);
  if(okCount < STORES.length){
    console.log('没抓到的店，deals.js 会自动回退用内置占位数据，不影响页面正常显示。');
  }
}

main();
