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
 *   1) FALLBACK_DEALS —— 内置的普通特价数据（每家 3-4 条），需要每周
 *      手动替换成真实内容（目前的数据来源主要是小红书/YouTube 等博主
 *      发的文字版特价）。保证页面任何时候打开都有内容可看，不会开天窗。
 *
 *   2) BENCHMARK_PRICES —— 六样"全场比价"基准商品（鸡蛋/三文鱼/西红柿/
 *      香蕉/葡萄/黑巧克力）在十家店的价格，同样手动维护。每样商品会
 *      自动算出十家店里最便宜的那一家，并在那家店卡片的第 5-6 条位置
 *      特别标注出来（例如"香蕉 ⬇️🆕"），不用手动指定哪家店该标注。
 *
 *   3) loadFromLocalJSON() —— 如果把页面部署到自己的网站/服务器上
 *      （而不是直接双击打开 index.html），会尝试 fetch 同目录下的
 *      deals-data.json；只要那个 json 存在且格式对（可以同时包含
 *      deals 和 benchmarkPrices 两部分），就会覆盖掉 FALLBACK_DEALS /
 *      BENCHMARK_PRICES，实现"数据与页面分离，每周只更新一个 json 文件"
 *      （这个 json 同样需要手动整理/编辑，不是自动生成的）。
 *
 * 换句话说：这个文件已经把"3-4条普通特价 + 自动算出的全场最低价标注
 * → 渲染到卡片"这条链路搭好了，只要每周手动把 FALLBACK_DEALS /
 * BENCHMARK_PRICES（或 deals-data.json）换成真数据，页面就会自动用
 * 上，不用再碰 index.html / style.css。
 * =================================================================== */

(function(){

  // ---------------------------------------------------------------
  // 1. 十家超市配置：与 index.html 里 data-store-id 一一对应
  //    url = 点击卡片后跳出的目标页面（该店完整特价 / Flyer 页）
  // ---------------------------------------------------------------
  const STORE_CONFIG = [
    { id:'tnt16',      group:'chinese', nameCN:'T&T 16街',      nameEN:'T&T Supermarket',
      url:'https://tntsupermarket.com/weekly-flyer' },
    { id:'guanye',     group:'chinese', nameCN:'冠业Kennedy',   nameEN:'First Choice Supermarket',
      url:'https://goflyer.ca/store/first-choice-supermarket' },
    { id:'dingtai',    group:'chinese', nameCN:'鼎泰Hwy7',      nameEN:'Foody Hwy7 Supermarket',
      url:'https://goflyer.ca/store/tone-tai-supermarket' },
    { id:'fuyao',      group:'chinese', nameCN:'福耀Hwy7',      nameEN:'Winco Food Mart',
      url:'https://goflyer.ca/store/winco-food-mart' },
    { id:'dingxian',   group:'chinese', nameCN:'鼎鲜Woodbine',  nameEN:'Full Fresh Supermarket',
      url:'https://goflyer.ca/store/full-fresh-supermarket' },

    { id:'walmart',    group:'western', nameCN:'Walmart',     nameEN:'Walmart',
      url:'https://www.walmart.ca/flyer' },
    { id:'freshco',    group:'western', nameCN:'FreshCo',     nameEN:'FreshCo',
      url:'https://www.freshco.com/weekly-flyer/' },
    { id:'costco',     group:'western', nameCN:'Costco',      nameEN:'Costco',
      url:'https://www.costco.ca/warehouse-locations/1-yorktech-dr-markham-on.html' },
    { id:'nofrills',   group:'western', nameCN:'No Frills',   nameEN:'No Frills',
      url:'https://www.nofrills.ca/flyer.en.html' },
    { id:'foodbasics', group:'western', nameCN:'Food Basics', nameEN:'Food Basics',
      url:'https://www.foodbasics.ca/flyer.en.html' },
  ];
  // Flyer 链接：华超5家均为官方/GoFlyer单店页；西超里 Costco 目前存的是
  // 万锦 Yorktech Dr 店的门店信息页（Costco 没有对外公开的传统 flyer 页面）

  // ---------------------------------------------------------------
  // 2. 占位特价数据：每家店 3-4 条普通特价，第 1 条 featured=true 会
  //    高亮显示。请每周手动替换为真实特价，或改用 deals-data.json。
  // ---------------------------------------------------------------
  const FALLBACK_DEALS = {
    tnt16: [
      { item:'冷冻虾仁 1kg',  price:'$9.99',  featured:true },
      { item:'日本和牛切片',  price:'$14.99/lb' },
      { item:'新鲜带子',      price:'$11.99/lb' },
      { item:'韩式泡菜 900g', price:'$5.99' },
    ],
    guanye: [
      { item:'新鲜排骨',   price:'$4.99/lb', featured:true },
      { item:'老豆腐 3件', price:'$2.00' },
      { item:'广式腊肠',   price:'$6.99' },
      { item:'娃娃菜 3包', price:'$3.00' },
    ],
    dingtai: [
      { item:'红富士苹果', price:'$1.29/lb', featured:true },
      { item:'活鲜龙虾',   price:'$8.99/lb' },
      { item:'大闸蟹 6只', price:'$18.99' },
      { item:'鲜活基围虾', price:'$7.99/lb' },
    ],
    fuyao: [
      { item:'特选肥牛片', price:'$6.99', featured:true },
      { item:'日式拉面 3包', price:'$5.00' },
      { item:'台湾高丽菜', price:'$2.49' },
      { item:'冷冻虾滑',   price:'$7.49' },
    ],
    dingxian: [
      { item:'鲜活扇贝',     price:'$9.99/lb', featured:true },
      { item:'越南米粉',     price:'$1.99' },
      { item:'新鲜芒果',     price:'$1.49/lb' },
      { item:'冰鲜黄花鱼',   price:'$6.99/lb' },
    ],
    walmart: [
      { item:'Milk 4L',            price:'$5.47', featured:true },
      { item:'White Bread',        price:'$2.47' },
      { item:'Ground Beef 1lb',    price:'$4.97' },
      { item:'Orange Juice 2.63L', price:'$4.97' },
    ],
    freshco: [
      { item:'Chicken Drumsticks',    price:'$1.99/lb', featured:true },
      { item:'Frozen Vegetables 1kg', price:'$2.49' },
      { item:'Canned Beans 540ml',    price:'$0.99' },
      { item:'Pasta Sauce 650ml',     price:'$1.99' },
    ],
    costco: [
      { item:'Rotisserie Chicken',        price:'$8.99', featured:true },
      { item:'Kirkland Olive Oil 2L',     price:'$19.99' },
      { item:'Kirkland Paper Towel 12pk', price:'$24.99' },
      { item:'Mixed Berries 1.36kg',      price:'$9.99' },
    ],
    nofrills: [
      { item:'Boneless Chicken Breast', price:'$3.99/lb', featured:true },
      { item:'Onions 3lb Bag',          price:'$2.99' },
      { item:'Frozen Pizza',            price:'$3.99' },
      { item:'Potatoes 10lb Bag',       price:'$4.99' },
    ],
    foodbasics: [
      { item:'Avocados 3pk',     price:'$2.00', featured:true },
      { item:'Yogurt 4L',        price:'$4.99' },
      { item:'Bell Peppers 3pk', price:'$2.99' },
      { item:'Sliced Deli Ham',  price:'$1.99/100g' },
    ],
  };

  // ---------------------------------------------------------------
  // 3. 六样"全场比价"基准商品：鸡蛋/三文鱼/西红柿/香蕉/葡萄/黑巧克力。
  //    每样商品自动比出十家店里最便宜的那家，标注到该店卡片第 5-6 条
  //    位置，格式类似"香蕉 ⬇️🆕"。cn/en 是显示名字，跟 group 对应。
  // ---------------------------------------------------------------
  const BENCHMARK_ITEMS = [
    { id:'eggs',      cn:'鸡蛋',    en:'Eggs' },
    { id:'salmon',    cn:'三文鱼柳', en:'Salmon Fillet' },
    { id:'tomato',    cn:'西红柿',  en:'Tomatoes' },
    { id:'banana',    cn:'香蕉',    en:'Bananas' },
    { id:'grape',     cn:'葡萄',    en:'Grapes' },
    { id:'chocolate', cn:'黑巧克力', en:'Dark Chocolate' },
  ];

  // value 用于比价（数字，单位统一到"每样商品自己的单位"，见 display
  // 里的文字；display 是卡片上实际显示的价格文本）。
  const BENCHMARK_PRICES = {
    tnt16:      { eggs:{value:4.99, display:'$4.99/dozen'}, salmon:{value:8.99,  display:'$8.99/lb'},  tomato:{value:1.49, display:'$1.49/lb'}, banana:{value:0.69, display:'$0.69/lb'}, grape:{value:2.99, display:'$2.99/lb'}, chocolate:{value:5.99, display:'$5.99'} },
    guanye:     { eggs:{value:4.49, display:'$4.49/dozen'}, salmon:{value:9.99,  display:'$9.99/lb'},  tomato:{value:1.29, display:'$1.29/lb'}, banana:{value:0.65, display:'$0.65/lb'}, grape:{value:2.79, display:'$2.79/lb'}, chocolate:{value:6.49, display:'$6.49'} },
    dingtai:    { eggs:{value:4.79, display:'$4.79/dozen'}, salmon:{value:10.99, display:'$10.99/lb'}, tomato:{value:0.99, display:'$0.99/lb'}, banana:{value:0.75, display:'$0.75/lb'}, grape:{value:2.49, display:'$2.49/lb'}, chocolate:{value:6.99, display:'$6.99'} },
    fuyao:      { eggs:{value:4.59, display:'$4.59/dozen'}, salmon:{value:9.49,  display:'$9.49/lb'},  tomato:{value:1.39, display:'$1.39/lb'}, banana:{value:0.70, display:'$0.70/lb'}, grape:{value:2.69, display:'$2.69/lb'}, chocolate:{value:6.29, display:'$6.29'} },
    dingxian:   { eggs:{value:4.89, display:'$4.89/dozen'}, salmon:{value:9.79,  display:'$9.79/lb'},  tomato:{value:1.19, display:'$1.19/lb'}, banana:{value:0.72, display:'$0.72/lb'}, grape:{value:2.59, display:'$2.59/lb'}, chocolate:{value:6.79, display:'$6.79'} },
    walmart:    { eggs:{value:3.97, display:'$3.97/dozen'}, salmon:{value:11.97, display:'$11.97/lb'}, tomato:{value:1.97, display:'$1.97/lb'}, banana:{value:0.57, display:'$0.57/lb'}, grape:{value:3.47, display:'$3.47/lb'}, chocolate:{value:4.97, display:'$4.97'} },
    freshco:    { eggs:{value:3.79, display:'$3.79/dozen'}, salmon:{value:12.49, display:'$12.49/lb'}, tomato:{value:1.79, display:'$1.79/lb'}, banana:{value:0.55, display:'$0.55/lb'}, grape:{value:2.99, display:'$2.99/lb'}, chocolate:{value:4.49, display:'$4.49'} },
    costco:     { eggs:{value:3.50, display:'$3.50/dozen equiv.'}, salmon:{value:13.99, display:'$13.99/lb'}, tomato:{value:2.29, display:'$2.29/lb'}, banana:{value:0.59, display:'$0.59/lb'}, grape:{value:3.99, display:'$3.99/lb'}, chocolate:{value:2.99, display:'$2.99'} },
    nofrills:   { eggs:{value:3.69, display:'$3.69/dozen'}, salmon:{value:11.49, display:'$11.49/lb'}, tomato:{value:1.69, display:'$1.69/lb'}, banana:{value:0.49, display:'$0.49/lb'}, grape:{value:2.89, display:'$2.89/lb'}, chocolate:{value:4.29, display:'$4.29'} },
    foodbasics: { eggs:{value:3.89, display:'$3.89/dozen'}, salmon:{value:11.99, display:'$11.99/lb'}, tomato:{value:1.59, display:'$1.59/lb'}, banana:{value:0.59, display:'$0.59/lb'}, grape:{value:1.49, display:'$1.49/lb'}, chocolate:{value:4.59, display:'$4.59'} },
  };

  // 根据 BENCHMARK_PRICES 自动算出每样基准商品全场最便宜的店，
  // 返回 { storeId: [ {id, cn, en, display}, ... ] }（一家店可能中 0/1/2 样）
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
  // 4. "取最佳几条"的排序规则：featured 优先，其次按折扣力度
  //    （discountPct，若数据里有）从高到低，其余保持原始顺序。
  //    普通特价固定截取前 4 条（如果数据本身只有 3 条就显示 3 条）。
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
  // 5. 可选：尝试从同目录的 deals-data.json 拉取真实数据（这个 json
  //    需要手动整理/编辑，本页面不做任何自动抓取）。
  //    只有把页面部署在 http(s):// 服务器上时才会成功；本地双击打开
  //    的 file:// 页面会被浏览器拦截 fetch 本地文件，属于正常现象，
  //    会静默回退到 FALLBACK_DEALS / BENCHMARK_PRICES，不影响页面
  //    正常显示。
  //    格式：{
  //      "deals": { "tnt16": [ {item, price, featured?, discountPct?}, ... ], ... },
  //      "benchmarkPrices": { "tnt16": { "eggs": {value, display}, ... }, ... }
  //    }
  //    两个字段都是可选的，只提供其中一个也可以。
  // ---------------------------------------------------------------
  async function loadFromLocalJSON(){
    try{
      const res = await fetch('./deals-data.json', { cache:'no-store' });
      if(!res.ok) return null;
      const data = await res.json();
      return (data && typeof data === 'object') ? data : null;
    }catch(err){
      return null; // file:// 协议下会在这里被拦截，是预期行为
    }
  }

  // ---------------------------------------------------------------
  // 6. 渲染：把某家店最佳的 3-4 条普通特价 + 0-2 条全场最低价标注
  //    写进对应卡片，并在卡片底部固定一个"看完整 Flyer"按钮
  //    （对应 style.css 里的 .flyer-btn）
  // ---------------------------------------------------------------
  function renderStore(store, dealsSource, benchmarkHighlights){
    const card = document.querySelector(`.card[data-store-id="${store.id}"]`);
    if(!card) return;

    const isChinese = store.group === 'chinese';
    card.dataset.url = store.url;

    const nameEl = card.querySelector('.supermarket-name');
    if(nameEl) nameEl.textContent = isChinese ? store.nameCN : store.nameEN;

    const contentEl = card.querySelector('.content');
    const dealsEl = card.querySelector('.deals');
    if(!dealsEl) return;
    dealsEl.innerHTML = '';

    const bestFour = pickBestFour(dealsSource);
    if(bestFour.length === 0){
      const empty = document.createElement('div');
      empty.className = 'deal-row';
      empty.innerHTML = `<span class="deal-item">${isChinese ? '暂无特价数据' : 'No deals available'}</span>`;
      dealsEl.appendChild(empty);
    } else {
      bestFour.forEach((deal, i) => {
        const row = document.createElement('div');
        row.className = 'deal-row' + (i === 0 && deal.featured ? ' featured' : '');
        row.innerHTML = `<span class="deal-item">${deal.item}</span><span class="deal-price">${deal.price}</span>`;
        dealsEl.appendChild(row);
      });
    }

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
    const deals = (dataset && dataset.deals) || FALLBACK_DEALS;
    const prices = (dataset && dataset.benchmarkPrices) || BENCHMARK_PRICES;
    const winners = computeBenchmarkWinners(prices);
    STORE_CONFIG.forEach(store => {
      renderStore(store, deals[store.id] || [], winners[store.id]);
    });
  }

  // ---------------------------------------------------------------
  // 7. 入口：先用占位数据立刻渲染（避免卡片长时间显示"加载中…"），
  //    再尝试异步拉取 deals-data.json，拉到就覆盖重渲染一次。
  // ---------------------------------------------------------------
  function init(){
    renderAll(null); // 先用 FALLBACK_DEALS / BENCHMARK_PRICES 渲染，保证页面立刻可用
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
    fallback: FALLBACK_DEALS,
    benchmarkItems: BENCHMARK_ITEMS,
    benchmarkPrices: BENCHMARK_PRICES,
    refresh: init,
  };

})();
