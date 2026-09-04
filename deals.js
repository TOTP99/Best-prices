/* deals.js — 十家超市特价渲染
 * 数据唯一来源：同目录 deals-data.json（每周只改这个文件）
 * 无数据时特价区域留空，不显示任何兜底/假数据。
 * updatedAt 控制牌面绿色星标：当天 5 星，每过一天减 1，5 天后消失。
 */
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
    { id: 'chocolate', cn: '黑巧克力', en: 'Dark Chocolate' }
  ];

  function computeBenchmarkWinners(prices) {
    const winners = {};
    BENCHMARK_ITEMS.forEach(item => {
      let bestStoreId = null, bestValue = Infinity, bestDisplay = null;
      Object.keys(prices).forEach(storeId => {
        const entry = prices[storeId]?.[item.id];
        if (entry && typeof entry.value === 'number' && entry.value < bestValue) {
          bestValue = entry.value;
          bestStoreId = storeId;
          bestDisplay = entry.display;
        }
      });
      if (bestStoreId) {
        if (!winners[bestStoreId]) winners[bestStoreId] = [];
        winners[bestStoreId].push({ id: item.id, cn: item.cn, en: item.en, display: bestDisplay });
      }
    });
    return winners;
  }

  function freshnessStars(updatedAt) {
    if (!updatedAt) return 0;
    const updated = new Date(updatedAt + 'T00:00:00');
    if (isNaN(updated.getTime())) return 0;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const updatedDay = new Date(updated.getFullYear(), updated.getMonth(), updated.getDate());
    const daysSince = Math.round((today - updatedDay) / 86400000);
    return Math.max(0, Math.min(5, 5 - daysSince));
  }

  function pickBestFour(list) {
    if (!Array.isArray(list)) return [];
    return [...list].sort((a, b) => {
      if (a.featured && !b.featured) return -1;
      if (!a.featured && b.featured) return 1;
      if (typeof a.discountPct === 'number' && typeof b.discountPct === 'number') {
        return b.discountPct - a.discountPct;
      }
      return 0;
    }).slice(0, 4);
  }

  async function loadFromLocalJSON() {
    try {
      const res = await fetch('./deals-data.json', { cache: 'no-store' });
      if (!res.ok) return null;
      const data = await res.json();
      return data && typeof data === 'object' ? data : null;
    } catch {
      return null; // file:// 或缺失时正常留空
    }
  }

  function renderStore(store, dealsSource, benchmarkHighlights, updatedAt) {
    const card = document.querySelector(`.card[data-store-id="${store.id}"]`);
    if (!card) return;

    const isChinese = store.group === 'chinese';
    card.dataset.url = store.url;

    const starCount = freshnessStars(updatedAt);
    const starsHTML = starCount > 0 ? `<span class="freshness-stars">${'*'.repeat(starCount)}</span>` : '';
    card.querySelectorAll('.suit-corner span:first-child').forEach(el => {
      el.innerHTML = store.rank + starsHTML;
    });

    const nameEl = card.querySelector('.supermarket-name');
    if (nameEl) nameEl.textContent = isChinese ? store.nameCN : store.nameEN;

    const dealsEl = card.querySelector('.deals');
    if (!dealsEl) return;
    dealsEl.innerHTML = '';

    pickBestFour(dealsSource).forEach((deal, i) => {
      const row = document.createElement('div');
      row.className = 'deal-row' + (i === 0 && deal.featured ? ' featured' : '');
      row.innerHTML = `<span class="deal-item">${deal.item}</span><span class="deal-price">${deal.price}</span>`;
      dealsEl.appendChild(row);
    });

    (benchmarkHighlights || []).slice(0, 2).forEach(hl => {
      const name = isChinese ? hl.cn : hl.en;
      const row = document.createElement('div');
      row.className = 'deal-row benchmark';
      row.innerHTML = `<span class="deal-item">${name} ⬇️🆕</span><span class="deal-price">${hl.display}</span>`;
      dealsEl.appendChild(row);
    });

    const contentEl = card.querySelector('.content');
    if (contentEl) {
      let btn = contentEl.querySelector('.flyer-btn');
      if (!btn) {
        btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'flyer-btn';
        contentEl.appendChild(btn);
      }
      btn.textContent = isChinese ? '看完整 Flyer' : 'Full Flyer';
      btn.dataset.url = store.url;
      btn.onclick = e => {
        e.preventDefault();
        e.stopPropagation();
        const u = btn.dataset.url || card.dataset.url;
        if (u) window.open(u, '_blank', 'noopener,noreferrer');
      };
    }
  }

  function renderAll(dataset) {
    const deals = dataset?.deals || {};
    const prices = dataset?.benchmarkPrices || {};
    const updatedAtMap = dataset?.updatedAt || {};
    const winners = computeBenchmarkWinners(prices);
    STORE_CONFIG.forEach(store => {
      renderStore(store, deals[store.id] || [], winners[store.id], updatedAtMap[store.id]);
    });
  }

  function init() {
    renderAll(null); // 先显示店名 + Flyer 按钮，特价区空着
    loadFromLocalJSON().then(data => {
      if (data) renderAll(data);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.SupermarketDeals = { config: STORE_CONFIG, benchmarkItems: BENCHMARK_ITEMS, refresh: init };
})();
