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

  /* 外部商品库（items.js） */
  function getGlossary() {
    return (window.SupermarketItems && window.SupermarketItems.glossary) || {};
  }

  function normalizeKey(s) {
    return String(s || '').trim().toLowerCase();
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

  function pickDisplayFive(list) {
    if (!Array.isArray(list) || !list.length) return [];
    const priority = [];
    const rest = [];
    list.forEach(d => (isPriorityDeal(d) ? priority : rest).push(d));
    priority.sort((a, b) => {
      if (a.featured !== b.featured) return a.featured ? -1 : 1;
      return (b.discountPct || 0) - (a.discountPct || 0);
    });
    const chosen = priority.slice(0, 5);
    if (chosen.length < 5) {
      const fillers = shuffleArr(rest);
      fillers.sort((a, b) => {
        if (a.featured !== b.featured) return a.featured ? -1 : 1;
        return 0;
      });
      for (const d of fillers) {
        if (chosen.length >= 5) break;
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

  function freshnessStars(updatedAt) {
    if (!updatedAt) return 0;
    const d = new Date(updatedAt + 'T00:00:00');
    if (isNaN(d.getTime())) return 0;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    return Math.max(0, Math.min(5, 5 - Math.round((today - day) / 86400000)));
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
    const card = document.querySelector('.card[data-store-id="' + store.id + '"]');
    if (!card) return;

    const suitInfo = SUIT_INFO[store.suit] || SUIT_INFO.spades;
    const suit = suitInfo.symbol;
    card.classList.toggle('suit-red', suitInfo.color === 'red');
    card.classList.toggle('suit-black', suitInfo.color === 'black');
    card.dataset.url = store.url;

    const stars = freshnessStars(updatedAt);
    const starsHTML = stars > 0 ? '<span class="freshness-stars">' + '★'.repeat(stars) + '</span>' : '';
    const topLeft = card.querySelector('.suit-corner.top-left');
    if (topLeft) {
      topLeft.innerHTML = '<span class="rank-suit">' + store.rank + suit + '</span>' + starsHTML;
    }

    const centerLogo = card.querySelector('.center-logo');
    if (centerLogo) centerLogo.textContent = suit;

    const nameEl = card.querySelector('.supermarket-name');
    if (nameEl) nameEl.textContent = store.group === 'chinese' ? store.nameCN : store.nameEN;

    const dealsEl = card.querySelector('.deals');
    if (!dealsEl) return;
    dealsEl.innerHTML = '';

    pickDisplayFive(deals).forEach((deal, i) => {
      const row = document.createElement('div');
      row.className = 'deal-row' + (i === 0 && deal.featured ? ' featured' : '');
      const { cn, en } = itemEnCn(deal.item);
      const text = window.SupermarketDeals.getLang() === 'zh' ? cn : en;
      row.innerHTML = '<span class="deal-item">' + text + '</span><span class="deal-price">' + deal.price + '</span>';
      dealsEl.appendChild(row);
    });

    (highlights || []).slice(0, 1).forEach(hl => {
      const row = document.createElement('div');
      row.className = 'deal-row benchmark';
      const hlText = window.SupermarketDeals.getLang() === 'zh' ? hl.cn : hl.en;
      row.innerHTML = '<span class="deal-item">' + hlText + ' ⬇️🆕</span><span class="deal-price">' + hl.display + '</span>';
      dealsEl.appendChild(row);
    });

    const content = card.querySelector('.content');
    if (!content) return;
    let btn = content.querySelector('.flyer-btn');
    if (!btn) {
      btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'flyer-btn';
      content.appendChild(btn);
    }
    btn.textContent = window.SupermarketDeals.getLang() === 'zh' ? '看完整 Flyer' : 'Full Flyer';
    btn.onclick = function (e) {
      e.preventDefault();
      e.stopPropagation();
      const u = store.url || card.dataset.url;
      if (u) window.open(u, '_blank', 'noopener,noreferrer');
    };
  }

  let cardLang = 'zh';
  let lastDataset = null;

  function renderAll(dataset) {
    if (dataset) lastDataset = dataset;
    const src = dataset || lastDataset;
    const deals = (src && src.deals) || {};
    const prices = (src && src.benchmarkPrices) || {};
    const updated = (src && src.updatedAt) || {};
    const winners = computeBenchmarkWinners(prices);
    STORE_CONFIG.forEach(function (s) {
      renderStore(s, deals[s.id] || [], winners[s.id], updated[s.id]);
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

  function init() {
    renderAll(null);
    loadData().then(function (data) { if (data) renderAll(data); });
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
    refreshDisplay: refreshDisplay,
    setLang: setLang,
    getLang: function () { return cardLang; },
    getData: function () { return lastDataset; },
    getGlossary: function () { return getGlossary(); }
  };
})();
