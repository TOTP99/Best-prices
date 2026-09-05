/* deals.js — 数据来源：deals-data.json（每周只改该文件） */
(function () {
  const STORE_CONFIG = [
    { id: 'tnt16', group: 'chinese', rank: '10', nameCN: 'T&T 16街', nameEN: 'T&T Supermarket', url: 'https://tntsupermarket.com/weekly-flyer' },
    { id: 'guanye', group: 'chinese', rank: 'J', nameCN: '冠业Kennedy', nameEN: 'First Choice Supermarket', url: 'https://goflyer.ca/store/first-choice-supermarket' },
    { id: 'dingtai', group: 'chinese', rank: 'Q', nameCN: '鼎泰Hwy7', nameEN: 'Foody Hwy7 Supermarket', url: 'https://goflyer.ca/store/tone-tai-supermarket' },
    { id: 'fuyao', group: 'chinese', rank: 'K', nameCN: '福耀Hwy7', nameEN: 'Winco Food Mart', url: 'https://goflyer.ca/store/winco-food-mart' },
    { id: 'dingxian', group: 'chinese', rank: 'A', nameCN: '鼎鲜Woodbine', nameEN: 'Full Fresh Supermarket', url: 'https://goflyer.ca/store/full-fresh-supermarket' },
    { id: 'walmart', group: 'western', rank: '10', nameCN: 'Walmart', nameEN: 'Walmart', url: 'https://www.walmart.ca/flyer' },
    { id: 'freshco', group: 'western', rank: 'J', nameCN: 'FreshCo', nameEN: 'FreshCo', url: 'https://www.freshco.com/weekly-flyer/' },
    { id: 'costco', group: 'western', rank: 'Q', nameCN: 'Costco', nameEN: 'Costco', url: 'https://www.costco.ca/warehouse-locations/1-yorktech-dr-markham-on.html' },
    { id: 'nofrills', group: 'western', rank: 'K', nameCN: 'No Frills', nameEN: 'No Frills', url: 'https://www.nofrills.ca/flyer.en.html' },
    { id: 'foodbasics', group: 'western', rank: 'A', nameCN: 'Food Basics', nameEN: 'Food Basics', url: 'https://www.foodbasics.ca/flyer.en.html' }
  ];

  const BENCHMARK_ITEMS = [
    { id: 'eggs', cn: '鸡蛋', en: 'Eggs' },
    { id: 'salmon', cn: '三文鱼柳', en: 'Salmon Fillet' },
    { id: 'tomato', cn: '西红柿', en: 'Tomatoes' },
    { id: 'banana', cn: '香蕉', en: 'Bananas' },
    { id: 'grape', cn: '葡萄', en: 'Grapes' },
    { id: 'chocolate', cn: '黑巧克力', en: 'Dark Chocolate' },
    { id: 'porkchop', cn: '猪排', en: 'Pork Chop' },
    { id: 'orange', cn: '橙子', en: 'Oranges' },
    { id: 'chickenwing', cn: '鸡翅', en: 'Chicken Wing' }
  ];

  // —— 商品名翻译记忆库 ——
  // 只要某个英文商品名在这里出现过一次，以后每周 deals-data.json 里再出现同样的英文名
  // （哪怕只写了英文、没配中文），都会自动带出中文翻译，不需要每次手动重新配对。
  // 以后遇到全新商品，翻译一次后顺手加进这张表，就"永久生效"了。
  const ITEM_GLOSSARY = {
    'live canada lobster 4–6lb': '加拿大活龙虾 4-6磅',
    'sea cucumber': '海参',
    'frozen saury fish': '冷冻秋刀鱼',
    'live tilapia': '活罗非鱼',
    '10lb potatoes': '土豆 10磅装',
    'chicken breast': '鸡胸肉',
    'fresh salmon fillet': '新鲜三文鱼柳',
    'juice (medium bottle)': '果汁（中瓶装）',
    'watermelon': '西瓜',
    'ocean’s tuna can': "Ocean's金枪鱼罐头",
    'ocean\'s tuna can': "Ocean's金枪鱼罐头",
    'sweet oranges 2lb': '甜橙 2磅装',
    'pork chop': '猪排',
    '30 eggs (member)': '30枚鸡蛋（会员价）',
    '8 chicken drumsticks': '鸡腿 8只装',
    'cantaloupe (large)': '哈密瓜（大）',
    'hotdog': '热狗',
    'lkk panda oyster sauce 907g': '李锦记熊猫蚝油 907g',
    'y&y premium thai jasmine rice 8kg': 'Y&Y特级泰国茉莉香米 8kg',
    'fu yang black tiger shrimp 31/40 400g': '富阳黑虎虾 31/40 400g',
    'pinwei handmade dumpling wonton series 350g': '品味手工水饺/馄饨系列 350g',
    'korean cabbage': '韩国白菜',
    'mama squash': '妈妈瓜（南瓜）',
    'south africa orange': '南非橙',
    'hami melon': '哈密瓜',
    'fresh pork chop': '新鲜猪排',
    'fresh chicken mid wing': '新鲜鸡中翅',
    'live striped bass (fri–sun only)': '活鲈鱼（仅限周五至周日）',
    'live blue crab (while quantities last)': '活蓝蟹（售完即止）',
    'wintermelon': '冬瓜',
    'yellow enoki mushroom': '黄金针菇',
    'carrots 2lb': '胡萝卜 2磅',
    'muscadine black grapes': '黑提子',
    'mini watermelon': '迷你西瓜',
    'chicken drumsticks': '鸡腿',
    'beef bone': '牛骨',
    'pork stomach': '猪肚',
    'beef honey comb tripe': '牛蜂窝肚',
    'free range chicken': '走地鸡',
    'angus chuck eye roll': '安格斯牛眼肉卷',
    'boneless lamb leg': '去骨羊腿',
    'black lamb belly': '黑山羊腩',
    'live vietnamese crab': '越南活蟹',
    'live turbot': '活多宝鱼',
    'previously frozen saury': '解冻秋刀鱼',
    'grade a jellyfish': '特级海蜇',
    'live blue crab': '活蓝蟹',
    'favor swallow kong moon rice stick 400g': '燕子江门排粉 400g',
    'sing bridge brand rock sugar 454g': '新桥牌冰糖 454g',
    'sing bridge brand rock sugar': '新桥牌冰糖',
    'favor swallow kong moon rice stick': '燕子江门排粉',
    'china maid preserved duck eggs 375g': '中华皮蛋 375g',
    'haday premium soy sauce 1.9l': '海天特级酱油 1.9L',
    'ounce honey 1000g': '蜂蜜 1000g',
    'fresh beef chuck short ribs': '新鲜牛小排',
    'fresh chicken drumstick': '新鲜鸡腿',
    'g&l frozen golden pompano': '冷冻金鲳鱼',
    'd.y. seafood whole abalone 200g': '整只鲍鱼 200g',
    'live blue crabs': '活蓝蟹',
    'fresh green beans': '新鲜四季豆',
    'fresh baby neo bok choy': '新鲜小白菜',
    'fresh green grape': '新鲜青提',
    'fresh avocado': '新鲜牛油果',
    'hami melon (usa)': '哈密瓜（美国）',
    'fuzzy squash (mexico)': '节瓜（墨西哥）',
    'norwegian salmon steak (fresh)': '挪威三文鱼扒（新鲜）',
    'broiled eel (frozen, 14oz)': '烤鳗鱼（冷冻，14oz）',
    'chicken leg (fresh, back attached)': '带背鸡腿（新鲜）',
    'chicken wing (value pack, fresh)': '鸡翅（超值装，新鲜）',
    'sekka premium medium grain rice (15lbs)': '雪花特级中粒米（15磅）',
    'nissin instant noodle (5 packs)': '日清方便面（5包装）',
    't&t mixed nuts / unsalted almond': 'T&T混合坚果/无盐杏仁',
    'dds jumbo shrimp wonton dumpling (300g)': '大虾云吞水饺（300g）',
    'fruit king frozen seedless durian': '果王冷冻无核榴莲',
    'kirkland signature organic roasted seaweed snack, 10-count': 'Kirkland Signature 有机烤海苔零食，10包装',
    'nongshim tonkotsu ramen, 6 x 101 g': '农心豚骨拉面，6x101g',
    'hi-chew candy': 'Hi-Chew 糖果',
    'kirkland signature 100% italian extra virgin olive oil, 2 l': 'Kirkland Signature 100%意大利特级初榨橄榄油，2L',
    'bulk jumbo carrots (canada)': '散装特大胡萝卜（加拿大）',
    'napa or flat cabbage (canada)': '大白菜或平卷心菜（加拿大）',
    'eddoes (ecuador)': '小芋头（厄瓜多尔）',
    'dragon fruit (ecuador)': '火龙果（厄瓜多尔）',
    'asian pears or fuji apples': '亚洲梨或富士苹果',
    'pomelo (china/vietnam)': '柚子（中国/越南）',
    'pocky strawberry or chocolate biscuit sticks (144-156g)': '百奇草莓/巧克力饼干棒（144-156g）',
    'golden happiness bun / specialty bun (100g)': '金喜饼/特色面包（100g）',
    'chacheer sunflower seeds (260g selected)': '洽洽瓜子（精选260g）',
    'h&h mango bites (454g)': 'H&H芒果干（454g）'
  };

  function normalizeKey(s) {
    return String(s || '').trim().toLowerCase();
  }

  function glossaryLookup(enText) {
    return ITEM_GLOSSARY[normalizeKey(enText)] || null;
  }

  // 卡片语言：只影响商品名称/权益标签/按钮文案；店名固定按 group 显示，不受此影响
  let cardLang = 'zh';
  let lastDataset = null;

  function itemText(item) {
    // 新格式 {en, cn}：cn 缺失时先查翻译记忆库，再退回英文本身
    if (item && typeof item === 'object') {
      const en = item.en || '';
      const cn = item.cn || glossaryLookup(en) || en;
      return cardLang === 'zh' ? cn : en;
    }
    // 兼容旧格式（纯字符串，视为英文）：同样查记忆库
    const en = item || '';
    const cn = glossaryLookup(en) || en;
    return cardLang === 'zh' ? cn : en;
  }

  function computeBenchmarkWinners(prices) {
    const winners = {};
    BENCHMARK_ITEMS.forEach(item => {
      let bestId = null, bestVal = Infinity, bestDisplay = null;
      Object.keys(prices).forEach(storeId => {
        const entry = prices[storeId]?.[item.id];
        if (entry && typeof entry.value === 'number' && entry.value < bestVal) {
          bestVal = entry.value;
          bestId = storeId;
          bestDisplay = entry.display;
        }
      });
      if (bestId) {
        if (!winners[bestId]) winners[bestId] = [];
        winners[bestId].push({ id: item.id, cn: item.cn, en: item.en, display: bestDisplay });
      }
    });
    return winners;
  }

  function freshnessStars(updatedAt) {
    if (!updatedAt) return 0;
    const d = new Date(updatedAt + 'T00:00:00');
    if (isNaN(d.getTime())) return 0;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    return Math.max(0, Math.min(5, 5 - Math.round((today - day) / 86400000)));
  }

  function pickBestFour(list) {
    if (!Array.isArray(list)) return [];
    return [...list].sort((a, b) => {
      if (a.featured !== b.featured) return a.featured ? -1 : 1;
      if (typeof a.discountPct === 'number' && typeof b.discountPct === 'number') {
        return b.discountPct - a.discountPct;
      }
      return 0;
    }).slice(0, 4);
  }

  async function loadData() {
    try {
      const res = await fetch('./deals-data.json', { cache: 'no-store' });
      if (!res.ok) return null;
      const data = await res.json();
      return data && typeof data === 'object' ? data : null;
    } catch {
      return null;
    }
  }

  function renderStore(store, deals, highlights, updatedAt) {
    const card = document.querySelector(`.card[data-store-id="${store.id}"]`);
    if (!card) return;

    const isCN = store.group === 'chinese';
    const suit = isCN ? '♥' : '♣';
    card.dataset.url = store.url;

    // 左上角：点数+花色连写，星标紧跟 → A♥★★★★★；右下角去掉（避免挡 Full Flyer）
    const stars = freshnessStars(updatedAt);
    const starsHTML = stars > 0 ? `<span class="freshness-stars">${'★'.repeat(stars)}</span>` : '';
    const topLeft = card.querySelector('.suit-corner.top-left');
    if (topLeft) {
      topLeft.innerHTML = `<span class="rank-suit">${store.rank}${suit}</span>${starsHTML}`;
    }
    const bottomRight = card.querySelector('.suit-corner.bottom-right');
    if (bottomRight) bottomRight.innerHTML = '';

    // 店名固定按华超/西超分组显示，不随语言切换变化
    const nameEl = card.querySelector('.supermarket-name');
    if (nameEl) nameEl.textContent = isCN ? store.nameCN : store.nameEN;

    const dealsEl = card.querySelector('.deals');
    if (!dealsEl) return;
    dealsEl.innerHTML = '';

    pickBestFour(deals).forEach((deal, i) => {
      const row = document.createElement('div');
      row.className = 'deal-row' + (i === 0 && deal.featured ? ' featured' : '');
      row.innerHTML = `<span class="deal-item">${itemText(deal.item)}</span><span class="deal-price">${deal.price}</span>`;
      dealsEl.appendChild(row);
    });

    (highlights || []).slice(0, 2).forEach(hl => {
      const row = document.createElement('div');
      row.className = 'deal-row benchmark';
      const hlText = cardLang === 'zh' ? hl.cn : hl.en;
      row.innerHTML = `<span class="deal-item">${hlText} ⬇️🆕</span><span class="deal-price">${hl.display}</span>`;
      dealsEl.appendChild(row);
    });

    // Full Flyer 按钮保留
    const content = card.querySelector('.content');
    if (!content) return;
    let btn = content.querySelector('.flyer-btn');
    if (!btn) {
      btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'flyer-btn';
      content.appendChild(btn);
    }
    btn.textContent = cardLang === 'zh' ? '看完整 Flyer' : 'Full Flyer';
    btn.onclick = e => {
      e.preventDefault();
      e.stopPropagation();
      const u = store.url || card.dataset.url;
      if (u) window.open(u, '_blank', 'noopener,noreferrer');
    };
  }

  function renderAll(dataset) {
    if (dataset) lastDataset = dataset;
    const src = dataset || lastDataset;
    const deals = src?.deals || {};
    const prices = src?.benchmarkPrices || {};
    const updated = src?.updatedAt || {};
    const winners = computeBenchmarkWinners(prices);
    STORE_CONFIG.forEach(s => {
      renderStore(s, deals[s.id] || [], winners[s.id], updated[s.id]);
    });
  }

  function setLang(lang) {
    if (lang !== 'zh' && lang !== 'en') return;
    cardLang = lang;
    renderAll(lastDataset);
  }

  function init() {
    renderAll(null);
    loadData().then(data => { if (data) renderAll(data); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.SupermarketDeals = {
    config: STORE_CONFIG,
    benchmarkItems: BENCHMARK_ITEMS,
    refresh: init,
    setLang,
    getLang: () => cardLang,
    glossary: ITEM_GLOSSARY,
    addToGlossary(en, cn) { ITEM_GLOSSARY[normalizeKey(en)] = cn; }
  };
})();
