/* deals.js — 纯逻辑文件，不包含任何商品数据 */

(function () {
  /* 花色信息 */
  const SUIT_INFO = {
    hearts:   { symbol: '♥', color: 'red' },
    diamonds: { symbol: '♦', color: 'red' },
    clubs:    { symbol: '♣', color: 'black' },
    spades:   { symbol: '♠', color: 'black' }
  };

  /* 店铺配置（固定不变） */
  const STORE_CONFIG = [
    { id: 'guanye', group: 'chinese', rank: 'A', suit: 'hearts', nameCN: '冠业Kennedy', nameEN: 'First Choice Supermarket', url: 'https://goflyer.ca/store/first-choice-supermarket' },
    { id: 'baifu', group: 'chinese', rank: 'A', suit: 'spades', nameCN: '百福超市Denison', nameEN: 'Sunfood Supermarket', url: 'https://goflyer.ca/storedetails/sunfood-supermarket-markham?lang=en' },
    { id: 'freshco', group: 'western', rank: 'K', suit: 'clubs', nameCN: 'FreshCo McCowan', nameEN: 'FreshCo McCowan', url: 'https://www.freshco.com/weekly-flyer/' },
    { id: 'foodbasics', group: 'western', rank: 'K', suit: 'diamonds', nameCN: 'Food Basics', nameEN: 'Food Basics', url: 'https://www.foodbasics.ca/flyer.en.html' },
    { id: 'nofrills', group: 'western', rank: 'K', suit: 'spades', nameCN: 'No Frills Markham Road', nameEN: 'No Frills Markham Road', url: 'https://www.nofrills.ca/flyer.en.html' }
  ];

  /* 商品配置（固定不变）：按商品模式的五张牌 */
  const PRODUCT_CONFIG = [
    { id: 'salmon', cn: '三文鱼', en: 'Salmon', re: /\bsalmon\b/i, rank: 'A', suit: 'hearts' },
    { id: 'egg', cn: '鸡蛋', en: 'Eggs', re: /\beggs?\b/i, rank: 'K', suit: 'diamonds' },
    { id: 'chocolate', cn: '黑巧克力', en: 'Dark Chocolate', re: /chocolate/i, rank: 'Q', suit: 'clubs' },
    { id: 'bokchoy', cn: '白菜', en: 'Bok Choy', re: /bok choy|cabbage/i, rank: 'J', suit: 'spades' },
    { id: 'lobster', cn: '龙虾', en: 'Lobster', re: /\blobster\b/i, rank: '10', suit: 'hearts' }
  ];

  /* 价格数值化：99¢/ea → 0.99，$2.49/lb → 2.49（跨店比价排序用） */
  function priceValue(p) {
    const m = /([\d.]+)\s*¢/.exec(String(p || ''));
    if (m) return parseFloat(m[1]) / 100;
    const m2 = /([\d.]+)/.exec(String(p || ''));
    return m2 ? parseFloat(m2[1]) : Infinity;
  }

  /* 基准商品（固定不变） */
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

  /* 优先商品关键词（固定不变） */
  const PRIORITY_KEYWORDS = [
    ['egg', 'eggs', '鸡蛋'],
    ['tomato', 'tomatoes', '西红柿', '番茄'],
    ['salmon', '三文鱼'],
    ['peach', 'peaches', '桃'],
    ['chicken breast', '鸡胸'],
    ['chocolate', '巧克力', '黑巧克力'],
    ['onion', 'onions', '圆葱', '洋葱'],
    ['apple', 'apples', '苹果'],
    ['cucumber', 'cucumbers', '黄瓜']
  ];

  /* 显示条数：至少 6，最多 8（在保证呼吸感前提下尽量多） */
  const MIN_DISPLAY = 6;
  const MAX_DISPLAY = 8;

  /* 外部商品库（items.js） */
  function getGlossary() {
    return (window.SupermarketItems && window.SupermarketItems.glossary) || {};
  }

  /* HTML 转义：商品名/价格来自外部数据，拼 innerHTML 前必须转义 */
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function normalizeKey(s) {    return String(s || '').trim().toLowerCase();
  }

  function glossaryLookup(enText) {
    return getGlossary()[normalizeKey(enText)] || null;
  }

  function itemEnCn(item) {
    if (item && typeof item === 'object') {
      const en = item.en || '';
      const cn = item.cn || glossaryLookup(en) || en;
      return { en, cn };
    }
    const en = String(item || '');
    return { en, cn: glossaryLookup(en) || en };
  }

  function dealSearchText(deal) {
    const { en, cn } = itemEnCn(deal.item);
    return (en + ' ' + cn).toLowerCase();
  }

  function matchesKeyword(text, key) {
    const k = key.toLowerCase();
    if (/[\u4e00-\u9fff]/.test(k)) return text.includes(k);
    if (k === 'cucumber' || k === 'cucumbers') {
      return /(?:^|[^a-z0-9])cucumber(?:s)?(?:[^a-z0-9]|$)/i.test(text) && !/sea\s+cucumber/i.test(text);
    }
    if (k === 'egg' || k === 'eggs') {
      return /(?:^|[^a-z0-9])eggs?(?:[^a-z0-9]|$)/i.test(text);
    }
    const escaped = k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp('(?:^|[^a-z0-9])' + escaped + '(?:[^a-z0-9]|$)', 'i').test(text);
  }

  function isPriorityDeal(deal) {
    const text = dealSearchText(deal);
    return PRIORITY_KEYWORDS.some(keys => keys.some(k => matchesKeyword(text, k)));
  }

  function shuffleArr(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function itemKey(deal) {
    const { en, cn } = itemEnCn(deal.item);
    return normalizeKey(en || cn || '');
  }

  /* 严格去重；优先项先占位；有数据时至少 6 条，最多 8 条 */
  function pickDisplayItems(list) {
    if (!Array.isArray(list) || !list.length) return [];

    const seen = new Set();
    const unique = [];
    list.forEach(d => {
      const k = itemKey(d);
      if (!k || seen.has(k)) return;
      seen.add(k);
      unique.push(d);
    });

    const priority = [];
    const rest = [];
    unique.forEach(d => (isPriorityDeal(d) ? priority : rest).push(d));

    priority.sort((a, b) => {
      if (a.featured !== b.featured) return a.featured ? -1 : 1;
      return (b.discountPct || 0) - (a.discountPct || 0);
    });

    const fillTo = unique.length >= MIN_DISPLAY
      ? Math.min(unique.length, MAX_DISPLAY)
      : unique.length;

    const chosen = priority.slice(0, fillTo);
    if (chosen.length < fillTo) {
      const fillers = shuffleArr(rest);
      fillers.sort((a, b) => {
        if (a.featured !== b.featured) return a.featured ? -1 : 1;
        return 0;
      });
      for (const d of fillers) {
        if (chosen.length >= fillTo) break;
        chosen.push(d);
      }
    }
    return chosen;
  }

  function computeBenchmarkWinners(prices) {
    const winners = {};
    BENCHMARK_ITEMS.forEach(item => {
      let bestId = null, bestVal = Infinity, bestDisplay = null;
      Object.keys(prices).forEach(storeId => {
        const entry = prices[storeId] && prices[storeId][item.id];
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

  function uiLangNow() {
    try {
      return (window.SupermarketDeals && window.SupermarketDeals.getLang() === 'en') ? 'en' : 'zh';
    } catch (e) { return 'zh'; }
  }

  function renderStore(store, deals, highlights, flyerPeriod) {
    const card = document.querySelector('.card[data-store-id="' + store.id + '"]');
    if (!card) return;

    const suitInfo = SUIT_INFO[store.suit] || SUIT_INFO.spades;
    const suit = suitInfo.symbol;
    card.classList.toggle('suit-red', suitInfo.color === 'red');
    card.classList.toggle('suit-black', suitInfo.color === 'black');
    card.dataset.url = store.url;

    /* 真牌角标：左上 + 右下（旋转 180°）；店名小字写在左上 A/K 右边，最多两行 */
    const storeName = store.group === 'chinese' ? store.nameCN : store.nameEN;
    const indexHTML = '<span class="rank">' + store.rank + '</span><span class="suit">' + suit + '</span>';
    card.querySelectorAll('.corner').forEach(function (c) {
      if (c.classList.contains('tl')) {
        c.innerHTML = '<span class="corner-index">' + indexHTML + '</span><span class="store-tag">' + esc(storeName) + '</span>';
      } else {
        c.innerHTML = indexHTML;
      }
    });

    const pip = card.querySelector('.pip');
    if (pip) pip.textContent = suit;

    const periodEl = card.querySelector('.flyer-period');
    if (periodEl) periodEl.textContent = flyerPeriod ? ((uiLangNow() === 'zh' ? '有效期 ' : 'Valid ') + flyerPeriod) : '';

    /* 本店特价总数：给用户"还有更多"的预期 */
    const countEl = card.querySelector('.deal-count');
    if (countEl) {
      const n = Array.isArray(deals) ? deals.length : 0;
      const lang = uiLangNow();
      countEl.textContent = n > 0 ? (lang === 'zh' ? '共' + n + '档' : n + ' deals') : '';
    }

    const dealsEl = card.querySelector('.deals');
    if (!dealsEl) return;
    dealsEl.innerHTML = '';

    /* 空态：有结构但没商品 */
    if (!Array.isArray(deals) || !deals.length) {
      const emptyDiv = document.createElement('div');
      emptyDiv.className = 'deals-empty';
      emptyDiv.textContent = uiLangNow() === 'zh' ? '本周暂无特价' : 'No deals this week';
      dealsEl.appendChild(emptyDiv);
    }

    const displayed = pickDisplayItems(deals);
    const displayedKeys = new Set(displayed.map(itemKey));

    displayed.forEach((deal, i) => {
      const row = document.createElement('div');
      const classes = ['deal-row'];
      if (isPriorityDeal(deal)) classes.push('priority');
      if (i === 0 && deal.featured) classes.push('featured');
      row.className = classes.join(' ');
      const { cn, en } = itemEnCn(deal.item);
      const text = uiLangNow() === 'zh' ? cn : en;
      const badge = (typeof deal.discountPct === 'number' && deal.discountPct > 0)
        ? '<span class="deal-badge">-' + deal.discountPct + '%</span>' : '';
      row.innerHTML = '<span class="deal-item">' + esc(text) + '</span>' + badge +
        '<span class="deal-price">' + esc(deal.price || '') + '</span>';
      dealsEl.appendChild(row);
    });

    /* 基准高亮：蓝线；已是优先项则跳过 */
    (highlights || []).slice(0, 1).forEach(hl => {
      const hlKey = normalizeKey(hl.en || hl.cn || '');
      if (displayedKeys.has(hlKey)) return;
      const fakeDeal = { item: { en: hl.en, cn: hl.cn } };
      if (isPriorityDeal(fakeDeal)) return;

      const row = document.createElement('div');
      row.className = 'deal-row benchmark';
      const hlText = uiLangNow() === 'zh' ? hl.cn : hl.en;
      row.innerHTML = '<span class="deal-item">' + esc(hlText) + '</span><span class="deal-price">' + esc(hl.display || '') + '</span>';
      dealsEl.appendChild(row);
    });

    const cardBody = card.querySelector('.card-body');
    if (!cardBody) return;
    let btn = cardBody.querySelector('.flyer-btn');
    if (!btn) {
      btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'flyer-btn';
      cardBody.appendChild(btn);
    }
    btn.textContent = uiLangNow() === 'zh' ? '看完整 Flyer' : 'Full Flyer';
    btn.onclick = function (e) {
      e.preventDefault();
      e.stopPropagation();
      const u = store.url || card.dataset.url;
      if (u) window.open(u, '_blank', 'noopener,noreferrer');
    };
  }

  /* 跨店取某商品的全部特价：[{storeId, deal}]，按价格从低到高 */
  function getProductDeals(pid) {
    const p = PRODUCT_CONFIG.filter(function (x) { return x.id === pid; })[0];
    if (!p) return [];
    const d = (lastDataset && lastDataset.deals) || {};
    const out = [];
    STORE_CONFIG.forEach(function (s) {
      (d[s.id] || []).forEach(function (deal) {
        const item = deal.item;
        const en = (item && typeof item === 'object' && item.en) ? item.en : String(item || '');
        if (p.re.test(en)) out.push({ storeId: s.id, deal: deal });
      });
    });
    out.sort(function (a, b) { return priceValue(a.deal.price) - priceValue(b.deal.price); });
    return out;
  }

  function productStoreName(storeId) {
    const s = STORE_CONFIG.filter(function (x) { return x.id === storeId; })[0];
    if (!s) return storeId;
    return uiLangNow() === 'zh' ? s.nameCN : s.nameEN;
  }

  function renderProductBlock(p, matches, state) {
    /* state: 'loading' | 'ready' | 'error' */
    const board = document.getElementById('productBoard');
    if (!board) return;
    const lang = uiLangNow();

    let block = board.querySelector('.product-block[data-product-id="' + p.id + '"]');
    if (!block) {
      block = document.createElement('article');
      block.className = 'product-block';
      block.dataset.productId = p.id;
      block.tabIndex = 0;
      block.setAttribute('role', 'button');
      board.appendChild(block);
    }

    const suitInfo = SUIT_INFO[p.suit] || SUIT_INFO.spades;
    block.classList.toggle('suit-red', suitInfo.color === 'red');
    block.classList.toggle('suit-black', suitInfo.color === 'black');

    const name = lang === 'zh' ? p.cn : p.en;
    block.setAttribute('aria-label', name);

    const tag = lang === 'zh' ? '5店比价' : '5 stores';
    const count = (state === 'ready' && matches.length > 0)
      ? (lang === 'zh' ? '共' + matches.length + '档' : matches.length + ' deals') : '';

    /* 头部最低价总览：matches 已按价格升序，第一条即最低 */
    let lowestHTML = '';
    if (state === 'ready' && matches.length > 0) {
      const m0 = matches[0];
      const label = lang === 'zh' ? '最低' : 'Lowest';
      lowestHTML = '<div class="product-lowest"><span class="lowest-label">' + esc(label) +
        '</span><span class="lowest-price">' + esc(m0.deal.price || '') +
        '</span><span class="lowest-store">' + esc(productStoreName(m0.storeId)) + '</span></div>';
    }

    let rowsHTML = '';
    if (state === 'loading') {
      rowsHTML = '<div class="p-empty">' + (lang === 'zh' ? '加载中…' : 'Loading…') + '</div>';
    } else if (state === 'error') {
      rowsHTML = '<div class="p-empty">' + (lang === 'zh' ? '数据没拿到' : 'Could not load data') + '</div>' +
        '<button type="button" class="p-retry">' + (lang === 'zh' ? '点我重试' : 'Tap to retry') + '</button>';
    } else if (!matches.length) {
      /* 没货就空着，不凑数 */
      rowsHTML = '<div class="p-empty">' + (lang === 'zh' ? '本周暂无特价' : 'No deals this week') + '</div>';
    } else {
      const minV = priceValue(matches[0].deal.price);
      rowsHTML = matches.map(function (m) {
        const ne = itemEnCn(m.deal.item);
        const itemText = lang === 'zh' ? (ne.cn || ne.en) : (ne.en || ne.cn);
        const isMin = priceValue(m.deal.price) === minV;
        const lowBadge = isMin
          ? '<span class="cheapest-badge">' + (lang === 'zh' ? '最低价' : 'Lowest') + '</span>' : '';
        const disc = (typeof m.deal.discountPct === 'number' && m.deal.discountPct > 0)
          ? '<span class="deal-badge">-' + m.deal.discountPct + '%</span>' : '';
        return '<div class="p-row' + (isMin ? ' cheapest' : '') + '">' +
          '<div class="p-left"><div class="p-store-line"><span class="p-store">' +
          esc(productStoreName(m.storeId)) + '</span>' + lowBadge + '</div>' +
          '<div class="p-item">' + esc(itemText) + '</div></div>' +
          '<div class="p-right">' + disc + '<span class="p-price">' + esc(m.deal.price || '') + '</span></div>' +
          '</div>';
      }).join('');
    }

    block.innerHTML =
      '<div class="product-block-head">' +
        '<div class="product-block-titles"><h3 class="product-name">' + esc(name) + '</h3>' +
        '<div class="product-sub"><span class="compare-tag">' + esc(tag) + '</span>' +
        (count ? '<span class="deal-count">' + esc(count) + '</span>' : '') + '</div>' +
        lowestHTML + '</div>' +
        '<div class="product-suit" aria-hidden="true">' + suitInfo.symbol + '</div>' +
        '<span class="product-chev" aria-hidden="true">›</span>' +
      '</div>' +
      '<div class="product-rows">' + rowsHTML + '</div>';

    if (state === 'error') {
      const btn = block.querySelector('.p-retry');
      if (btn) btn.addEventListener('click', function (e) {
        e.stopPropagation();
        init();
      });
    }
  }

  let cardLang = 'zh';
  let lastDataset = null;

  function renderAll(dataset) {
    if (dataset) lastDataset = dataset;
    const src = dataset || lastDataset;
    const deals = (src && src.deals) || {};
    const prices = (src && src.benchmarkPrices) || {};
    const flyerPeriods = (src && src.flyerPeriod) || {};
    const winners = computeBenchmarkWinners(prices);
    STORE_CONFIG.forEach(function (s) {
      renderStore(s, deals[s.id] || [], winners[s.id], flyerPeriods[s.id]);
    });
    const pState = lastDataset ? 'ready' : 'loading';
    PRODUCT_CONFIG.forEach(function (p) {
      renderProductBlock(p, getProductDeals(p.id), pState);
    });
  }

  function setLang(lang) {
    if (lang !== 'zh' && lang !== 'en') return;
    cardLang = lang;
    renderAll(lastDataset);
  }

  function refreshDisplay() {
    renderAll(lastDataset);
  }

  function renderError() {
    const lang = uiLangNow();
    function paintError(card, nameSel, failText) {
      if (!card) return;
      const nameEl = card.querySelector(nameSel);
      if (nameEl) nameEl.textContent = failText;
      const dealsEl = card.querySelector('.deals');
      if (dealsEl) {
        dealsEl.innerHTML = '';
        const errDiv = document.createElement('div');
        errDiv.className = 'deals-error';
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = lang === 'zh' ? '点我重试' : 'Tap to retry';
        btn.addEventListener('click', function (e) {
          e.stopPropagation();
          init();
        });
        errDiv.appendChild(document.createTextNode(lang === 'zh' ? '数据没拿到' : 'Could not load data'));
        errDiv.appendChild(btn);
        dealsEl.appendChild(errDiv);
      }
    }
    STORE_CONFIG.forEach(function (s) {
      paintError(
        document.querySelector('.card[data-store-id="' + s.id + '"]'),
        '.corner.tl .store-tag',
        lang === 'zh' ? '加载失败' : 'Failed to load'
      );
    });
    PRODUCT_CONFIG.forEach(function (p) {
      renderProductBlock(p, [], 'error');
    });
  }

  function init() {
    renderAll(null);
    loadData().then(function (data) {
      if (data) {
        renderAll(data);
        try {
          document.dispatchEvent(new CustomEvent('poker-deals-data', { detail: data }));
        } catch (e) {}
      } else {
        renderError();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.SupermarketDeals = {
    config: STORE_CONFIG,
    products: PRODUCT_CONFIG,
    benchmarkItems: BENCHMARK_ITEMS,
    refresh: init,
    refreshDisplay: refreshDisplay,
    setLang: setLang,
    getLang: function () { return cardLang; },
    getData: function () { return lastDataset; },
    getGlossary: function () { return getGlossary(); },
    getStoreDeals: function (storeId) {
      const d = (lastDataset && lastDataset.deals) || {};
      return d[storeId] || [];
    },
    getProductDeals: getProductDeals
  };
})();
