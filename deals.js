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

  // 卡片语言：只影响商品名称/权益标签/按钮文案；店名固定按 group 显示，不受此影响
  let cardLang = 'zh';
  let lastDataset = null;

  function itemText(item) {
    if (item && typeof item === 'object') {
      return (cardLang === 'zh' ? item.cn : item.en) || item.en || item.cn || '';
    }
    return item || '';
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

  window.SupermarketDeals = { config: STORE_CONFIG, benchmarkItems: BENCHMARK_ITEMS, refresh: init, setLang, getLang: () => cardLang };
})();
