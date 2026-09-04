/* =====================================================================
 * deals.js — 十家超市"最新特价"渲染模块
 * =====================================================================
 *
 * 【关于自动抓取的说明 / 请务必先读这段】
 * 浏览器端的 JS（也就是这个文件在网页里跑起来的部分）出于安全限制
 * （CORS，跨域资源共享），没办法直接 fetch() 十个不同域名的超市/华人
 * 超市聚合网站，再把网页正文抓下来解析——除非对方服务器主动允许跨域
 * 访问（绝大多数超市官网、聚合网站都不允许）。而且这些网站大多是 JS
 * 单页应用或图片/PDF 形式的 Flyer，就算换到服务器端跑抓取脚本，能拿
 * 到的结构化文字也非常有限，实测下来并不可靠。所以这个页面放弃了
 * "自动抓取"这条路，改用下面这套手动维护的结构：
 *
 *   数据只有一个来源：同目录下的 deals-data.json（每周手动整理/编辑，
 *   不是自动生成的），页面加载时异步 fetch 它。这个文件本身不带任何
 *   占位/兜底价格数据——如果 deals-data.json 缺失、还没写某家店的数据，
 *   或者部署方式不支持 fetch（比如本地用 file:// 双击打开），对应的
 *   卡片就只显示店名 + 底部"看完整 Flyer"按钮，特价区域留空，不会显示
 *   假数据或占位文字。
 *
 *   deals-data.json 格式：{
 *     "deals": { "tnt16": [ {item, price, featured?, discountPct?}, ... ], ... },
 *     "benchmarkPrices": { "tnt16": { "eggs": {value, display}, ... }, ... },
 *     "updatedAt": { "tnt16": "2026-09-04", ... }
 *   }
 *   三个字段都可选，只提供其中一个、或者只提供部分店铺也可以，缺的部分
 *   照样留空。updatedAt 是"这家店的数据是哪天更新的"，用来在卡片牌面
 *   角标后面显示新鲜度星标（例如"A*****"）：当天更新 5 星，之后每过一个
 *   自然日少一颗，5 天后不再显示；没填 updatedAt 的店不显示星标。
 *
 * 每周更新特价时，只需要改 deals-data.json 这一个文件，index.html /
 * style.css / deals.js 都不用碰。
 * =================================================================== */

(function(){

  // ---------------------------------------------------------------
  // 1. 十家超市配置：与 index.html 里 data-store-id 一一对应
  //    url = 点击卡片后跳出的目标页面（该店完整特价 / Flyer 页）
  // ---------------------------------------------------------------
  const STORE_CONFIG = [
    { id:'tnt16',      group:'chinese', rank:'10', nameCN:'T&T 16街',      nameEN:'T&T Supermarket',
      url:'https://tntsupermarket.com/weekly-flyer' },
    { id:'guanye',     group:'chinese', rank:'J',  nameCN:'冠业Kennedy',   nameEN:'First Choice Supermarket',
      url:'https://goflyer.ca/store/first-choice-supermarket' },
    { id:'dingtai',    group:'chinese', rank:'Q',  nameCN:'鼎泰Hwy7',      nameEN:'Foody Hwy7 Supermarket',
      url:'https://goflyer.ca/store/tone-tai-supermarket' },
    { id:'fuyao',      group:'chinese', rank:'K',  nameCN:'福耀Hwy7',      nameEN:'Winco Food Mart',
      url:'https://goflyer.ca/store/winco-food-mart' },
    { id:'dingxian',   group:'chinese', rank:'A',  nameCN:'鼎鲜Woodbine',  nameEN:'Full Fresh Supermarket',
      url:'https://goflyer.ca/store/full-fresh-supermarket' },

    { id:'walmart',    group:'western', rank:'10', nameCN:'Walmart',     nameEN:'Walmart',
      url:'https://www.walmart.ca/flyer' },
    { id:'freshco',    group:'western', rank:'J',  nameCN:'FreshCo',     nameEN:'FreshCo',
      url:'https://www.freshco.com/weekly-flyer/' },
    { id:'costco',     group:'western', rank:'Q',  nameCN:'Costco',      nameEN:'Costco',
      url:'https://www.costco.ca/warehouse-locations/1-yorktech-dr-markham-on.html' },
    { id:'nofrills',   group:'western', rank:'K',  nameCN:'No Frills',   nameEN:'No Frills',
      url:'https://www.nofrills.ca/flyer.en.html' },
    { id:'foodbasics', group:'western', rank:'A',  nameCN:'Food Basics', nameEN:'Food Basics',
      url:'https://www.foodbasics.ca/flyer.en.html' },
  ];
  // Flyer 链接：华超5家均为官方/GoFlyer单店页；西超里 Costco 目前存的是
  // 万锦 Yorktech Dr 店的门店信息页（Costco 没有对外公开的传统 flyer 页面）

  // ---------------------------------------------------------------
  // 2. 六样"全场比价"基准商品的定义：鸡蛋/三文鱼/西红柿/香蕉/葡萄/黑巧
  //    克力。这里只存 id 和显示名字（cn/en），不存价格——价格来自
  //    deals-data.json 的 benchmarkPrices。每样商品会自动比出十家店里
  //    最便宜的那一家，标注到该店卡片第 5-6 条位置，格式类似
  //    "香蕉 ⬇️🆕"，不用手动指定哪家店该标注。
  // ---------------------------------------------------------------
  const BENCHMARK_ITEMS = [
    { id:'eggs',      cn:'鸡蛋',    en:'Eggs' },
    { id:'salmon',    cn:'三文鱼柳', en:'Salmon Fillet' },
    { id:'tomato',    cn:'西红柿',  en:'Tomatoes' },
    { id:'banana',    cn:'香蕉',    en:'Bananas' },
    { id:'grape',     cn:'葡萄',    en:'Grapes' },
    { id:'chocolate', cn:'黑巧克力', en:'Dark Chocolate' },
  ];

  // 根据 benchmarkPrices（来自 deals-data.json）自动算出每样基准商品
  // 全场最便宜的店，返回 { storeId: [ {id, cn, en, display}, ... ] }
  // （一家店可能中 0/1/2 样；没有数据时返回空对象，不标注任何店）
  function computeBenchmarkWinners(prices){
    const winners = {};
    BENCHMARK_ITEMS.forEach(item => {
      let bestStoreId = null, bestValue = Infinity, bestDisplay = null;
      Object.keys(prices).forEach(storeId => {
        const entry = prices[storeId] && prices[storeId][item.id];
        if(entry && typeof entry.value === 'number' && entry.value < bestValue){
          bestValue = entry.value;
          bestStoreId = storeId;
          bestDisplay = entry.display;
        }
      });
      if(bestStoreId){
        if(!winners[bestStoreId]) winners[bestStoreId] = [];
        winners[bestStoreId].push({ id:item.id, cn:item.cn, en:item.en, display:bestDisplay });
      }
    });
    return winners;
  }

  // ---------------------------------------------------------------
  // 3.5 "最新更新"星标：deals-data.json 里每家店可以带一个 updatedAt
  //     日期（"YYYY-MM-DD"，按更新那天填），卡片左上/右下角的牌面
  //     字母后面会跟着显示 1-5 个 "*"：当天更新 5 个，每过一个自然日
  //     （本地时间凌晨 00:00）少一个，5 天后（含）不再显示。没有
  //     updatedAt 的店不显示任何星标。
  // ---------------------------------------------------------------
  function freshnessStars(updatedAt){
    if(!updatedAt) return 0;
    const updated = new Date(updatedAt + 'T00:00:00');
    if(isNaN(updated.getTime())) return 0;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const updatedDay = new Date(updated.getFullYear(), updated.getMonth(), updated.getDate());
    const daysSince = Math.round((today - updatedDay) / 86400000);
    return Math.max(0, Math.min(5, 5 - daysSince));
  }

  // ---------------------------------------------------------------
  // 3. "取最佳几条"的排序规则：featured 优先，其次按折扣力度
  //    （discountPct，若数据里有）从高到低，其余保持原始顺序。
  //    普通特价固定截取前 4 条（数据不够 4 条就有几条显示几条，
  //    完全没有就留空）。
  // ---------------------------------------------------------------
  function pickBestFour(list){
    if(!Array.isArray(list)) return [];
    const sorted = [...list].sort((a, b) => {
      if(a.featured && !b.featured) return -1;
      if(!a.featured && b.featured) return 1;
      if(typeof a.discountPct === 'number' && typeof b.discountPct === 'number'){
        return b.discountPct - a.discountPct;
      }
      return 0;
    });
    return sorted.slice(0, 4);
  }

  // ---------------------------------------------------------------
  // 4. 从同目录的 deals-data.json 拉取特价数据（需要手动整理/编辑，
  //    本页面不做任何自动抓取）。只有把页面部署在 http(s):// 服务器
  //    上（比如 GitHub Pages）时才会成功；本地双击打开的 file:// 页面
  //    会被浏览器拦截 fetch 本地文件——这种情况下、以及 json 缺失某家
  //    店数据时，对应卡片就只显示店名 + Flyer 按钮，特价区域留空。
  // ---------------------------------------------------------------
  async function loadFromLocalJSON(){
    try{
      const res = await fetch('./deals-data.json', { cache:'no-store' });
      if(!res.ok) return null;
      const data = await res.json();
      return (data && typeof data === 'object') ? data : null;
    }catch(err){
      return null; // file:// 协议下、或 json 不存在时会在这里被拦截，是预期行为
    }
  }

  // ---------------------------------------------------------------
  // 5. 渲染：把某家店最佳的 0-4 条普通特价 + 0-2 条全场最低价标注
  //    写进对应卡片，并在卡片底部固定一个"看完整 Flyer"按钮
  //    （对应 style.css 里的 .flyer-btn）。没有特价数据时，deals
  //    区域完全留空——店名和 Flyer 按钮始终会显示，跟有没有数据无关。
  // ---------------------------------------------------------------
  function renderStore(store, dealsSource, benchmarkHighlights, updatedAt){
    const card = document.querySelector(`.card[data-store-id="${store.id}"]`);
    if(!card) return;

    const isChinese = store.group === 'chinese';
    card.dataset.url = store.url;

    // 牌面角标：rank + 新鲜度星标（例如 "A*****"），星标单独用绿色，
    // 两个角都要同步更新
    const starCount = freshnessStars(updatedAt);
    const starsHTML = starCount > 0
      ? `<span class="freshness-stars">${'*'.repeat(starCount)}</span>`
      : '';
    card.querySelectorAll('.suit-corner span:first-child').forEach(el => {
      el.innerHTML = store.rank + starsHTML;
    });

    const nameEl = card.querySelector('.supermarket-name');
    if(nameEl) nameEl.textContent = isChinese ? store.nameCN : store.nameEN;

    const contentEl = card.querySelector('.content');
    const dealsEl = card.querySelector('.deals');
    if(!dealsEl) return;
    dealsEl.innerHTML = '';

    pickBestFour(dealsSource).forEach((deal, i) => {
      const row = document.createElement('div');
      row.className = 'deal-row' + (i === 0 && deal.featured ? ' featured' : '');
      row.innerHTML = `<span class="deal-item">${deal.item}</span><span class="deal-price">${deal.price}</span>`;
      dealsEl.appendChild(row);
    });

    // 第 5-6 条位置：全场最低价标注（该店在六样基准商品里拿下的"最便宜"名次）
    (benchmarkHighlights || []).slice(0, 2).forEach(hl => {
      const name = isChinese ? hl.cn : hl.en;
      const row = document.createElement('div');
      row.className = 'deal-row benchmark';
      row.innerHTML = `<span class="deal-item">${name} ⬇️🆕</span><span class="deal-price">${hl.display}</span>`;
      dealsEl.appendChild(row);
    });

    if(contentEl){
      let btn = contentEl.querySelector('.flyer-btn');
      if(!btn){
        btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'flyer-btn';
        contentEl.appendChild(btn);
      }
      btn.textContent = isChinese ? '看完整 Flyer' : 'Full Flyer';
      btn.dataset.url = store.url;
      btn.onclick = function(e){
        e.preventDefault();
        e.stopPropagation();
        const u = btn.dataset.url || card.dataset.url;
        if(u) window.open(u, '_blank', 'noopener,noreferrer');
      };
    }
  }

  function renderAll(dataset){
    const deals = (dataset && dataset.deals) || {};
    const prices = (dataset && dataset.benchmarkPrices) || {};
    const updatedAtMap = (dataset && dataset.updatedAt) || {};
    const winners = computeBenchmarkWinners(prices);
    STORE_CONFIG.forEach(store => {
      renderStore(store, deals[store.id] || [], winners[store.id], updatedAtMap[store.id]);
    });
  }

  // ---------------------------------------------------------------
  // 6. 入口：先渲染一次（此时还没有数据，卡片只显示店名 + Flyer
  //    按钮，特价区域留空），再异步拉取 deals-data.json，拉到就
  //    用真实数据重渲染一次。
  // ---------------------------------------------------------------
  function init(){
    renderAll(null); // 立刻显示店名 + Flyer 按钮，特价区域先留空
    loadFromLocalJSON().then(liveData => {
      if(liveData) renderAll(liveData);
    });
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  }else{
    init();
  }

  // 暴露到全局，方便调试或未来扩展（比如手动触发刷新）
  window.SupermarketDeals = {
    config: STORE_CONFIG,
    benchmarkItems: BENCHMARK_ITEMS,
    refresh: init,
  };

})();
