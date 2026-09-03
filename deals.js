/* =====================================================================
 * deals.js — 十家超市"最新特价"抓取与渲染模块
 * =====================================================================
 *
 * 【关于"抓取"的重要说明 / 请务必先读这段】
 * 浏览器端的 JS（也就是这个文件在网页里跑起来的部分）出于安全限制
 * （CORS，跨域资源共享），没办法直接 fetch() 十个不同域名的超市/华人
 * 超市聚合网站，再把网页正文抓下来解析——除非对方服务器主动允许跨域
 * 访问（绝大多数超市官网、聚合网站都不允许）。这不是代码写得好不好
 * 的问题，是浏览器本身的安全机制，任何纯前端页面都绕不过去。
 *
 * 所以这个文件用的是"可插拔"的三层结构：
 *
 *   1) FALLBACK_DEALS —— 内置示例特价数据（占位数据，需要每周手动替换
 *      成真实内容，或用第 3 点的脚本生成）。保证页面任何时候打开都有
 *      内容可看，不会开天窗。
 *
 *   2) loadFromLocalJSON() —— 如果把页面部署到自己的网站/服务器上
 *      （而不是直接双击打开 index.html），会尝试 fetch 同目录下的
 *      deals-data.json；只要那个 json 存在且格式对，就会覆盖掉
 *      FALLBACK_DEALS，实现"数据与页面分离，每周只更新一个 json"。
 *      deals-data.json 由第 3 点的 Node 脚本生成。
 *
 *   3) scrape-flyers.js（单独文件，与本文件一起提供）—— 一份可在你自
 *      己电脑/服务器上用 Node 运行的抓取脚本，跑在服务器端就没有
 *      CORS 限制，可以真正访问各超市/聚合网站，解析出特价，生成
 *      deals-data.json。建议配合定时任务（如每天一次）自动更新。里面
 *      对每家店的抓取方式都写了具体说明和局限（比如有些 Flyer 是
 *      图片/PDF 形式，文字抓取抓不到内容，需要人工核对或接入 OCR）。
 *
 * 换句话说：这个文件已经把"抓取六条最佳特价 → 渲染到卡片"这条链路
 * 搭好了，只要把 FALLBACK_DEALS 换成真数据，或跑通 scrape-flyers.js
 * 生成 deals-data.json，页面会自动用上真实数据，不用再碰
 * index.html / style.css。
 * =================================================================== */

(function(){

  // ---------------------------------------------------------------
  // 1. 十家超市配置：与 index.html 里 data-store-id 一一对应
  //    url = 点击卡片后跳出的目标页面（该店完整特价 / Flyer 页）
  // ---------------------------------------------------------------
  const STORE_CONFIG = [
    { id:'tnt16',      group:'chinese', nameCN:'T&T 16街',      nameEN:'T&T Supermarket',
      url:'https://www.tntsupermarket.com/eng/weekly-special-er.html' },
    { id:'guanye',     group:'chinese', nameCN:'冠业Kennedy',   nameEN:'First Choice Supermarket',
      url:'https://goflyer.ca/' },
    { id:'dingtai',    group:'chinese', nameCN:'鼎泰Hwy7',      nameEN:'Foody Hwy7 Supermarket',
      url:'https://goflyer.ca/storedetails/foodymart-hwy7-hwy-7' },
    { id:'fuyao',      group:'chinese', nameCN:'福耀Hwy7',      nameEN:'Fuyao Supermarket',
      url:'https://goflyer.ca/' },
    { id:'dingxian',   group:'chinese', nameCN:'鼎鲜Woodbine',  nameEN:'Full Fresh Supermarket',
      url:'https://goflyer.ca/' },

    { id:'walmart',    group:'western', nameCN:'Walmart',     nameEN:'Walmart',
      url:'https://www.walmart.ca/en/flyer' },
    { id:'loblaws',    group:'western', nameCN:'Loblaws',     nameEN:'Loblaws',
      url:'https://www.loblaws.ca/flyer' },
    { id:'metro',      group:'western', nameCN:'Metro',       nameEN:'Metro',
      url:'https://www.metro.ca/en/flyer' },
    { id:'nofrills',   group:'western', nameCN:'No Frills',   nameEN:'No Frills',
      url:'https://www.nofrills.ca/flyer' },
    { id:'foodbasics', group:'western', nameCN:'Food Basics', nameEN:'Food Basics',
      url:'https://www.foodbasics.ca/flyers' },
  ];
  // 注：冠业 / 福耀 / 鼎鲜 三家暂时指向聚合站首页 goflyer.ca ——没能
  // 确认它们各自在聚合站上的独立详情页链接，建议核实后替换成精确链接
  // （格式参考"鼎泰Hwy7"那一行）。西人超市的官方 Flyer 链接也建议
  // 定期核实，超市偶尔会改版换路径。

  // ---------------------------------------------------------------
  // 2. 占位特价数据（每家 6 条，第 1 条标记为 featured 精选）
  //    请每周手动替换为真实特价，或改用 deals-data.json 自动覆盖
  // ---------------------------------------------------------------
  const FALLBACK_DEALS = {
    tnt16: [
      { item:'冷冻虾仁 1kg',  price:'$9.99',  featured:true },
      { item:'日本和牛切片',  price:'$14.99/lb' },
      { item:'新鲜带子',      price:'$11.99/lb' },
      { item:'韩式泡菜 900g', price:'$5.99' },
      { item:'珍珠奶茶粉圆',  price:'$3.49' },
      { item:'寿司米 8kg',    price:'$16.99' },
    ],
    guanye: [
      { item:'新鲜排骨',   price:'$4.99/lb', featured:true },
      { item:'老豆腐 3件', price:'$2.00' },
      { item:'广式腊肠',   price:'$6.99' },
      { item:'娃娃菜 3包', price:'$3.00' },
      { item:'冰鲜带鱼',   price:'$5.99/lb' },
      { item:'速冻水饺',   price:'$4.49' },
    ],
    dingtai: [
      { item:'红富士苹果', price:'$1.29/lb', featured:true },
      { item:'活鲜龙虾',   price:'$8.99/lb' },
      { item:'大闸蟹 6只', price:'$18.99' },
      { item:'鲜活基围虾', price:'$7.99/lb' },
      { item:'特级大米 5kg', price:'$12.99' },
      { item:'新鲜生菜 2把', price:'$1.99' },
    ],
    fuyao: [
      { item:'特选肥牛片', price:'$6.99', featured:true },
      { item:'日式拉面 3包', price:'$5.00' },
      { item:'三文鱼刺身', price:'$12.99/lb' },
      { item:'冷冻虾滑',   price:'$7.49' },
      { item:'台湾高丽菜', price:'$2.49' },
      { item:'速冻小笼包', price:'$5.99' },
    ],
    dingxian: [
      { item:'鲜活扇贝',     price:'$9.99/lb', featured:true },
      { item:'越南米粉',     price:'$1.99' },
      { item:'新鲜芒果',     price:'$1.49/lb' },
      { item:'冰鲜黄花鱼',   price:'$6.99/lb' },
      { item:'港式烧腊拼盘', price:'$13.99' },
      { item:'椰青',         price:'$2.29' },
    ],
    walmart: [
      { item:'Milk 4L',            price:'$5.47', featured:true },
      { item:'Eggs 12ct',          price:'$3.97' },
      { item:'White Bread',        price:'$2.47' },
      { item:'Ground Beef 1lb',    price:'$4.97' },
      { item:'Bananas',            price:'$0.57/lb' },
      { item:'Orange Juice 2.63L', price:'$4.97' },
    ],
    loblaws: [
      { item:'Organic Eggs',      price:'$4.99', featured:true },
      { item:'Whole Wheat Bread', price:'$3.49' },
      { item:'Fresh Blueberries', price:'$4.99' },
      { item:'Chicken Thighs',    price:'$3.49/lb' },
      { item:'Greek Yogurt 750g', price:'$4.49' },
      { item:'Avocados 4pk',      price:'$3.99' },
    ],
    metro: [
      { item:'Fresh Atlantic Salmon', price:'$9.99/lb', featured:true },
      { item:'Striploin Steak',       price:'$8.99/lb' },
      { item:'Pasta 2pk',             price:'$4.00' },
      { item:'Cherry Tomatoes',       price:'$2.99' },
      { item:'Sparkling Water 8pk',   price:'$4.99' },
      { item:'Cheddar Cheese Block',  price:'$5.99' },
    ],
    nofrills: [
      { item:'Boneless Chicken Breast', price:'$3.99/lb', featured:true },
      { item:'Onions 3lb Bag',          price:'$2.99' },
      { item:'Canned Tomatoes',         price:'$1.49' },
      { item:'Frozen Pizza',            price:'$3.99' },
      { item:'Potatoes 10lb Bag',       price:'$4.99' },
      { item:'Peanut Butter 1kg',       price:'$5.49' },
    ],
    foodbasics: [
      { item:'Avocados 3pk',       price:'$2.00', featured:true },
      { item:'Bananas',            price:'$0.59/lb' },
      { item:'Yogurt 4L',          price:'$4.99' },
      { item:'Bell Peppers 3pk',   price:'$2.99' },
      { item:'Sliced Deli Ham',    price:'$1.99/100g' },
      { item:'Orange Bell Pepper', price:'$1.49' },
    ],
  };

  // ---------------------------------------------------------------
  // 3. "取最佳 6 条"的排序规则：featured 优先，其次按折扣力度
  //    （discountPct，若数据里有）从高到低，其余保持原始/抓取顺序。
  // ---------------------------------------------------------------
  function pickBestSix(list){
    if(!Array.isArray(list)) return [];
    const sorted = [...list].sort((a, b) => {
      if(a.featured && !b.featured) return -1;
      if(!a.featured && b.featured) return 1;
      if(typeof a.discountPct === 'number' && typeof b.discountPct === 'number'){
        return b.discountPct - a.discountPct;
      }
      return 0;
    });
    return sorted.slice(0, 6);
  }

  // ---------------------------------------------------------------
  // 4. 可选：尝试从同目录的 deals-data.json 拉取真实数据。
  //    只有把页面部署在 http(s):// 服务器上时才会成功；本地双击打开
  //    的 file:// 页面会被浏览器拦截 fetch 本地文件，属于正常现象，
  //    会静默回退到 FALLBACK_DEALS，不影响页面正常显示。
  //    deals-data.json 由 scrape-flyers.js 生成，格式：
  //    { "tnt16": [ {item, price, featured?, discountPct?}, ... ], ... }
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
  // 5. 渲染：把某家店最佳的 6 条特价写进对应卡片
  // ---------------------------------------------------------------
  function renderStore(store, dealsSource){
    const card = document.querySelector(`.card[data-store-id="${store.id}"]`);
    if(!card) return;

    const isChinese = store.group === 'chinese';
    card.dataset.url = store.url;

    const nameEl = card.querySelector('.supermarket-name');
    if(nameEl) nameEl.textContent = isChinese ? store.nameCN : store.nameEN;

    const dealsEl = card.querySelector('.deals');
    if(!dealsEl) return;
    dealsEl.innerHTML = '';

    const bestSix = pickBestSix(dealsSource);
    if(bestSix.length === 0){
      const empty = document.createElement('div');
      empty.className = 'deal-row';
      empty.innerHTML = `<span class="deal-item">${isChinese ? '暂无特价数据' : 'No deals available'}</span>`;
      dealsEl.appendChild(empty);
      return;
    }

    bestSix.forEach((deal, i) => {
      const row = document.createElement('div');
      row.className = 'deal-row' + (i === 0 && deal.featured ? ' featured' : '');
      row.innerHTML = `<span class="deal-item">${deal.item}</span><span class="deal-price">${deal.price}</span>`;
      dealsEl.appendChild(row);
    });
  }

  function renderAll(dataset){
    STORE_CONFIG.forEach(store => {
      const deals = (dataset && dataset[store.id]) || FALLBACK_DEALS[store.id] || [];
      renderStore(store, deals);
    });
  }

  // ---------------------------------------------------------------
  // 6. 入口：先用占位数据立刻渲染（避免卡片长时间显示"加载中…"），
  //    再尝试异步拉取 deals-data.json，拉到就覆盖重渲染一次。
  // ---------------------------------------------------------------
  function init(){
    renderAll(null); // 先用 FALLBACK_DEALS 渲染，保证页面立刻可用
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
    refresh: init,
  };

})();
