/* app.js — 界面交互：分组切换、横屏叠牌、本店全清单、音效、语言、数据分析
   商品数据在 deals-data.json，中英文对照在 items.js，选品渲染在 deals.js */

(function () {
  'use strict';

  /* ═══════════ 语言 ═══════════ */
  var LANG_KEY = 'poker-deals-lang';
  var uiLang = 'zh';
  try {
    var savedLang = localStorage.getItem(LANG_KEY);
    if (savedLang === 'zh' || savedLang === 'en') uiLang = savedLang;
  } catch (e) {}
  function saveLang() {
    try { localStorage.setItem(LANG_KEY, uiLang); } catch (e) {}
  }

  var UI_TEXT = {
    zh: {
      analysisTitle: '数据分析',
      tabs: { allDeals: '全部特价', bestDeals: '精选特价', deepestDiscounts: '折扣力度', categoryWinners: '品类冠军', cheapestStoreSummary: '最低价店铺' },
      loading: '加载中…',
      empty: '暂无数据',
      failed: '数据加载失败',
      benchmarkHead: '基准价对比',
      switchLeft: '商店',
      switchRight: '商品',
      switchAria: '切换商店/商品',
      compareTag: '5店比价',
      validLabel: '有效期',
      updatedLabel: '更新',
      refreshAria: '重新选品',
      analysisAria: '数据分析',
      soundAria: '音效开关',
      closeAria: '关闭',
      langAria: '切换中英文',
      searchPh: '搜索商品…',
      sortDefault: '推荐',
      sortDiscount: '折扣',
      sortPrice: '价格',
      dealsCount: function (n) { return '共' + n + '档'; },
      dealsEmpty: '没有匹配的商品',
      dealsFlyer: '看完整 Flyer'
    },
    en: {
      analysisTitle: 'Analysis',
      tabs: { allDeals: 'All Deals', bestDeals: 'Best Deals', deepestDiscounts: 'Discounts', categoryWinners: 'Category Winners', cheapestStoreSummary: 'Cheapest Stores' },
      loading: 'Loading…',
      empty: 'No data',
      failed: 'Failed to load',
      benchmarkHead: 'Benchmark Comparison',
      switchLeft: 'Smkt',
      switchRight: 'ComN',
      switchAria: 'Switch stores/products view',
      compareTag: '5 stores',
      validLabel: 'Valid',
      updatedLabel: 'Updated',
      refreshAria: 'Reshuffle deals',
      analysisAria: 'Analysis',
      soundAria: 'Sound toggle',
      closeAria: 'Close',
      langAria: 'Switch language',
      searchPh: 'Search deals…',
      sortDefault: 'Top',
      sortDiscount: 'Discount',
      sortPrice: 'Price',
      dealsCount: function (n) { return n + ' deals'; },
      dealsEmpty: 'No matching deals',
      dealsFlyer: 'Full Flyer'
    }
  };

  /* ═══════════ 音效 ═══════════ */
  var SOUND_KEY = 'poker-deals-sound';
  var soundOn = true;
  try { soundOn = localStorage.getItem(SOUND_KEY) !== 'off'; } catch (e) {}
  var audioCtx = null;

  function ensureCtx() {
    if (!audioCtx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      audioCtx = new AC();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  }

  function blip(freqA, freqB, dur, type, vol, delay) {
    var ctx = ensureCtx();
    if (!ctx) return;
    var t = ctx.currentTime + (delay || 0);
    var o = ctx.createOscillator();
    var g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freqA, t);
    o.frequency.exponentialRampToValueAtTime(freqB, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.04);
    o.connect(g); g.connect(ctx.destination);
    o.start(t); o.stop(t + dur + 0.06);
  }

  function playTick() {
    if (!soundOn) return;
    blip(720, 980, 0.07, 'sine', 0.14, 0);
  }

  function playShuffle() {
    if (!soundOn) return;
    [560, 720, 900, 1080].forEach(function (f, i) {
      blip(f, f * 1.1, 0.045, 'square', 0.06, i * 0.045);
    });
  }

  function playCasinoShuffle() {
    if (!soundOn) return;
    var ctx = ensureCtx();
    if (!ctx) return;
    var nowT = ctx.currentTime;
    var duration = 0.22;
    var bufferSize = Math.max(1, Math.floor(ctx.sampleRate * duration));
    var buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    var data = buffer.getChannelData(0);
    for (var i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }
    var noise = ctx.createBufferSource();
    noise.buffer = buffer;
    var bandpass = ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.setValueAtTime(2600, nowT);
    bandpass.Q.value = 0.8;
    var noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.22, nowT);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, nowT + duration);
    noise.connect(bandpass); bandpass.connect(noiseGain); noiseGain.connect(ctx.destination);
    noise.start(nowT); noise.stop(nowT + duration);
    blip(180, 90, 0.09, 'triangle', 0.18, duration * 0.72);
  }

  var soundBtn = document.getElementById('soundBtn');
  function syncSoundBtn() {
    soundBtn.classList.toggle('off', !soundOn);
    soundBtn.setAttribute('aria-pressed', soundOn ? 'true' : 'false');
  }
  soundBtn.addEventListener('click', function () {
    soundOn = !soundOn;
    try { localStorage.setItem(SOUND_KEY, soundOn ? 'on' : 'off'); } catch (e) {}
    syncSoundBtn();
    if (soundOn) playTick();
  });
  syncSoundBtn();

  /* ═══════════ 模式切换：按商店 / 按商品 ═══════════ */
  var groupSwitch = document.getElementById('groupSwitch');
  var views = {
    store: document.getElementById('fan-store'),
    product: document.getElementById('productBoard')
  };
  var current = 'store';

  function setSwitchUI() {
    groupSwitch.dataset.active = current;
    groupSwitch.querySelectorAll('.seg-btn').forEach(function (btn) {
      var on = btn.dataset.m === current;
      btn.classList.toggle('on', on);
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    document.body.classList.toggle('mode-product', current === 'product');
  }

  function switchTo(target, silent) {
    if (target === current || !views[target]) return;
    if (!silent) playShuffle();
    var from = views[current];
    var to = views[target];
    from.classList.add('shuffling');
    to.classList.add('shuffling');
    closeDeals();
    setTimeout(function () {
      from.classList.remove('on');
      to.classList.add('on');
      void to.offsetWidth;
      from.classList.remove('shuffling');
      to.classList.remove('shuffling');
      current = target;
      setSwitchUI();
    }, 200);
  }

  groupSwitch.addEventListener('click', function (e) {
    var btn = e.target.closest('.seg-btn');
    if (btn) switchTo(btn.dataset.m);
  });
  setSwitchUI();

  window.addEventListener('load', function () {
    setTimeout(function () {
      views.store.classList.remove('shuffling');
      views.product.classList.remove('shuffling');
    }, 300);
  });

  /* 比价榜点击/键盘：打开该商品的五店比价弹窗 */
  views.product.addEventListener('click', function (e) {
    if (e.target.closest('.p-retry')) return;
    var block = e.target.closest('.product-block');
    if (block && block.dataset.productId) openDeals('product', block.dataset.productId);
  });
  views.product.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    var block = e.target.closest('.product-block');
    if (block && block.dataset.productId) {
      e.preventDefault();
      openDeals('product', block.dataset.productId);
    }
  });

  /* ═══════════ 本店全部特价：底部弹窗 ═══════════ */
  var dealsOverlay = document.getElementById('dealsOverlay');
  var dealsTitle = document.getElementById('dealsTitle');
  var dealsSuit = document.getElementById('dealsSuit');
  var dealsPeriod = document.getElementById('dealsPeriod');
  var dealsCount = document.getElementById('dealsCount');
  var dealsSearch = document.getElementById('dealsSearch');
  var dealsSort = document.getElementById('dealsSort');
  var dealsList = document.getElementById('dealsList');
  var dealsFlyerBtn = document.getElementById('dealsFlyerBtn');

  var dealsMode = 'store'; /* 'store' | 'product' */
  var dealsStoreId = null;
  var dealsProductId = null;
  var dealsSortMode = 'default';
  var SUIT_SYMBOL = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' };

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function getGlossary() {
    return (window.SupermarketDeals && window.SupermarketDeals.getGlossary && window.SupermarketDeals.getGlossary()) || {};
  }

  function dealName(item) {
    var gloss = getGlossary();
    var en = (item && typeof item === 'object') ? (item.en || '') : String(item || '');
    var cn = (item && typeof item === 'object' && item.cn) ? item.cn : (gloss[String(en).trim().toLowerCase()] || en);
    var text = uiLang === 'zh' ? (cn || en) : (en || cn);
    return { text: text, search: ((en || '') + ' ' + (cn || '')).toLowerCase() };
  }

  function storeCfg(id) {
    var cfg = ((window.SupermarketDeals && window.SupermarketDeals.config) || [])
      .filter(function (s) { return s.id === id; })[0];
    return cfg || null;
  }

  function parsePrice(p) {
    var m = /([\d.]+)\s*¢/.exec(String(p || ''));
    if (m) return parseFloat(m[1]) / 100;
    m = /([\d.]+)/.exec(String(p || ''));
    return m ? parseFloat(m[1]) : Infinity;
  }

  function productCfg(pid) {
    var list = (window.SupermarketDeals && window.SupermarketDeals.products) || [];
    return list.filter(function (p) { return p.id === pid; })[0] || null;
  }

  function renderDealsList() {
    var t = UI_TEXT[uiLang];
    var isProduct = dealsMode === 'product';
    var entries;
    if (isProduct) {
      entries = (window.SupermarketDeals && window.SupermarketDeals.getProductDeals)
        ? window.SupermarketDeals.getProductDeals(dealsProductId).map(function (e) {
            return { storeId: e.storeId, deal: e.deal };
          })
        : [];
    } else {
      entries = (window.SupermarketDeals && window.SupermarketDeals.getStoreDeals)
        ? window.SupermarketDeals.getStoreDeals(dealsStoreId).map(function (d) {
            return { storeId: dealsStoreId, deal: d };
          })
        : [];
    }
    var q = dealsSearch.value.trim().toLowerCase();
    var list = entries.filter(function (e) {
      if (!q) return true;
      return dealName(e.deal.item).search.indexOf(q) !== -1;
    });
    if (dealsSortMode === 'discount') {
      list = list.slice().sort(function (a, b) {
        return ((typeof b.deal.discountPct === 'number' ? b.deal.discountPct : -1)) -
               ((typeof a.deal.discountPct === 'number' ? a.deal.discountPct : -1));
      });
    } else if (dealsSortMode === 'price') {
      list = list.slice().sort(function (a, b) {
        return parsePrice(a.deal.price) - parsePrice(b.deal.price);
      });
    }
    if (!list.length) {
      dealsList.innerHTML = '<p class="deals-list-empty">' + esc(t.dealsEmpty) + '</p>';
      return;
    }
    dealsList.innerHTML = list.map(function (e) {
      var d = e.deal;
      var nm = dealName(d.item);
      var badge = (typeof d.discountPct === 'number' && d.discountPct > 0)
        ? '<span class="deal-badge">-' + d.discountPct + '%</span>' : '';
      var star = d.featured ? '★ ' : '';
      var storeTag = isProduct
        ? '<span class="deal-store">' + esc(storeName(e.storeId)) + '</span>' : '';
      return '<div class="deal-row" role="listitem">' + storeTag + '<span class="deal-item">' + esc(star + nm.text) +
        '</span>' + badge + '<span class="deal-price">' + esc(d.price || '') + '</span></div>';
    }).join('');
  }

  function syncSheetHeight() {
    try {
      var h = (window.visualViewport && window.visualViewport.height) || window.innerHeight;
      if (h) document.documentElement.style.setProperty('--sheet-h', Math.round(h * 0.86) + 'px');
    } catch (e) {}
  }
  if (window.visualViewport && window.visualViewport.addEventListener) {
    window.visualViewport.addEventListener('resize', syncSheetHeight);
  }

  function openDeals(kind, id, keepState) {
    var t = UI_TEXT[uiLang];
    dealsMode = kind;
    if (!keepState) dealsSortMode = (kind === 'product') ? 'price' : 'default';
    dealsSort.querySelectorAll('.deals-sort-btn').forEach(function (b) {
      var on = b.dataset.sort === dealsSortMode;
      b.classList.toggle('on', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
      if (b.dataset.sort === 'default') b.style.display = (kind === 'product') ? 'none' : '';
    });

    var title, suitKey, period, n, flyerUrl;
    if (kind === 'product') {
      var pcfg = productCfg(id);
      if (!pcfg) return;
      dealsProductId = id;
      dealsStoreId = null;
      title = uiLang === 'zh' ? pcfg.cn : pcfg.en;
      suitKey = pcfg.suit;
      period = t.compareTag;
      n = (window.SupermarketDeals.getProductDeals(id) || []).length;
      flyerUrl = null;
    } else {
      var cfg = storeCfg(id);
      if (!cfg) return;
      dealsStoreId = id;
      dealsProductId = null;
      var data = (window.SupermarketDeals && window.SupermarketDeals.getData && window.SupermarketDeals.getData()) || {};
      title = cfg.group === 'chinese' ? cfg.nameCN : cfg.nameEN;
      suitKey = cfg.suit;
      period = ((data.flyerPeriod || {})[id]) || '';
      n = (window.SupermarketDeals.getStoreDeals(id) || []).length;
      flyerUrl = cfg.url;
    }

    dealsTitle.textContent = title;
    dealsSuit.textContent = SUIT_SYMBOL[suitKey] || '♠';
    dealsSuit.className = 'deals-suit ' + ((suitKey === 'hearts' || suitKey === 'diamonds') ? 'red' : 'black');
    dealsPeriod.textContent = period ? ((dealsMode === 'store' ? t.validLabel + ' ' : '') + period) : '';
    dealsCount.textContent = n > 0 ? t.dealsCount(n) : '';
    if (!keepState) dealsSearch.value = '';
    dealsSearch.placeholder = t.searchPh;
    dealsSearch.setAttribute('aria-label', t.searchPh);
    if (flyerUrl) {
      dealsFlyerBtn.style.display = '';
      dealsFlyerBtn.textContent = t.dealsFlyer;
      dealsFlyerBtn.onclick = function () {
        window.open(flyerUrl, '_blank', 'noopener,noreferrer');
      };
    } else {
      dealsFlyerBtn.style.display = 'none';
      dealsFlyerBtn.onclick = null;
    }
    renderDealsList();
    syncSheetHeight();
    dealsOverlay.classList.add('open');
    if (!keepState) playTick();
  }

  function closeDeals() {
    dealsOverlay.classList.remove('open');
    dealsMode = 'store';
    dealsStoreId = null;
    dealsProductId = null;
  }

  document.getElementById('dealsClose').addEventListener('click', closeDeals);
  dealsOverlay.addEventListener('click', function (e) {
    if (e.target === dealsOverlay) closeDeals();
  });
  dealsSearch.addEventListener('input', renderDealsList);
  dealsSort.addEventListener('click', function (e) {
    var btn = e.target.closest('.deals-sort-btn');
    if (!btn) return;
    dealsSort.querySelectorAll('.deals-sort-btn').forEach(function (b) {
      b.classList.remove('on');
      b.setAttribute('aria-selected', 'false');
    });
    btn.classList.add('on');
    btn.setAttribute('aria-selected', 'true');
    dealsSortMode = btn.dataset.sort;
    renderDealsList();
    playTick();
  });

  /* ═══════════ 横屏叠牌 ═══════════ */
  var orientationMQ = window.matchMedia('(orientation: landscape)');

  function syncOrientationLayout() {
    closeDeals();
  }
  if (orientationMQ.addEventListener) orientationMQ.addEventListener('change', syncOrientationLayout);
  else if (orientationMQ.addListener) orientationMQ.addListener(syncOrientationLayout);
  syncOrientationLayout();

  /* ── 横屏画卷：樱花花瓣飘落（canvas，仅横屏运行时） ── */
  (function initPetals() {
    var canvas = document.getElementById('petalCanvas');
    if (!canvas || !canvas.getContext) return;
    var ctx = canvas.getContext('2d');
    var petals = [];
    var rafId = null;
    var running = false;

    function resize() {
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      var w = canvas.clientWidth, h = canvas.clientHeight;
      if (!w || !h) return;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function makePetal(w, h, randomY) {
      return {
        x: Math.random() * w,
        y: randomY ? Math.random() * h : -20 - Math.random() * h * 0.3,
        size: 5 + Math.random() * 9,
        speedY: 0.35 + Math.random() * 0.85,
        swayAmp: 18 + Math.random() * 42,
        swaySpd: 0.4 + Math.random() * 1.1,
        phase: Math.random() * Math.PI * 2,
        rot: Math.random() * Math.PI * 2,
        rotSpd: (Math.random() - 0.5) * 0.025,
        alpha: 0.45 + Math.random() * 0.4,
        hue: 332 + Math.random() * 16
      };
    }

    function drawPetal(p, w, h) {
      p.y += p.speedY;
      p.phase += 0.012 * p.swaySpd;
      p.rot += p.rotSpd;
      if (p.y > h + 24) {
        var np = makePetal(w, h, false);
        p.x = np.x; p.y = np.y; p.speedY = np.speedY;
      }
      var x = p.x + Math.sin(p.phase) * p.swayAmp * 0.35;
      ctx.save();
      ctx.translate(x, p.y);
      ctx.rotate(p.rot);
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = 'hsl(' + p.hue + ', 85%, 83%)';
      ctx.beginPath();
      ctx.ellipse(0, 0, p.size * 0.42, p.size * 0.68, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'hsl(' + p.hue + ', 78%, 70%)';
      ctx.beginPath();
      ctx.ellipse(0, p.size * 0.22, p.size * 0.26, p.size * 0.38, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    function tick() {
      if (!running) return;
      var w = canvas.clientWidth, h = canvas.clientHeight;
      ctx.clearRect(0, 0, w, h);
      for (var i = 0; i < petals.length; i++) drawPetal(petals[i], w, h);
      rafId = requestAnimationFrame(tick);
    }

    function start() {
      if (running) return;
      running = true;
      resize();
      var w = canvas.clientWidth || window.innerWidth;
      var h = canvas.clientHeight || window.innerHeight;
      var count = Math.max(12, Math.min(30, Math.floor(w * h / 28000)));
      petals = [];
      for (var i = 0; i < count; i++) petals.push(makePetal(w, h, true));
      rafId = requestAnimationFrame(tick);
    }

    function stop() {
      running = false;
      if (rafId) cancelAnimationFrame(rafId);
      rafId = null;
      petals = [];
    }

    function syncPetals() {
      var isLsc = false;
      try { isLsc = window.matchMedia('(orientation: landscape)').matches; } catch (e) {}
      if (isLsc) start(); else stop();
    }

    window.addEventListener('resize', function () { if (running) resize(); });
    try {
      var mq = window.matchMedia('(orientation: landscape)');
      if (mq.addEventListener) mq.addEventListener('change', syncPetals);
      else if (mq.addListener) mq.addListener(syncPetals);
    } catch (e) {}
    syncPetals();
  })();


  document.querySelectorAll('#fan-store .card').forEach(function (card) {
    card.addEventListener('click', function (e) {
      e.stopPropagation();
      /* 点牌开本店清单 */
      openDeals('store', card.dataset.storeId);
    });
    card.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        card.click();
      }
    });
  });

  /* ── 竖屏扇形：手指左右滑动换牌 ── */
  (function initFanSwipe() {
    var fan = document.getElementById('fan-store');
    if (!fan) return;
    var rotations = [-8, -4, 0, 4, 8];
    var order = Array.prototype.slice.call(fan.querySelectorAll('.card'));

    function layoutFan() {
      order.forEach(function (card, i) {
        card.style.setProperty('--r', rotations[i] + 'deg');
        card.style.zIndex = String(i + 1);
      });
    }

    function rotateFan(dir) {
      if (dir > 0) order.push(order.shift());   /* 左滑：头一张转到尾 */
      else order.unshift(order.pop());          /* 右滑：尾一张转到头 */
      layoutFan();
      try { playCasinoShuffle(); } catch (e) {}
    }

    var startX = 0, startY = 0, swiping = false, tracking = false;

    fan.addEventListener('touchstart', function (e) {
      if (e.touches.length !== 1) { tracking = false; return; }
      var t = e.touches[0];
      startX = t.clientX; startY = t.clientY;
      swiping = false; tracking = true;
    }, { passive: true });

    fan.addEventListener('touchmove', function (e) {
      if (!tracking) return;
      var t = e.touches[0];
      var dx = t.clientX - startX, dy = t.clientY - startY;
      if (Math.abs(dx) > 14 && Math.abs(dx) > Math.abs(dy) * 1.2) swiping = true;
    }, { passive: true });

    function endTouch(e) {
      if (!tracking) return;
      tracking = false;
      var dx = e.changedTouches[0].clientX - startX;
      if (swiping && Math.abs(dx) > 45) {
        rotateFan(dx < 0 ? 1 : -1);
        /* 保持 swiping=true，让接下来的 click 在 capture 阶段被吞掉 */
      } else {
        swiping = false;
      }
    }
    fan.addEventListener('touchend', endTouch);
    fan.addEventListener('touchcancel', function () { tracking = false; swiping = false; });

    /* 滑动后的 click 不开弹窗（capture 先行拦截） */
    fan.addEventListener('click', function (e) {
      if (swiping) {
        e.stopPropagation();
        e.preventDefault();
        swiping = false;
      }
    }, true);

    layoutFan();
  })();

  document.getElementById('refreshBtn').addEventListener('click', function (e) {
    e.stopPropagation();
    if (window.SupermarketDeals && typeof window.SupermarketDeals.refreshDisplay === 'function') {
      window.SupermarketDeals.refreshDisplay();
      playShuffle();
    }
  });

  /* ═══════════ 数据分析 ═══════════ */
  var overlay = document.getElementById('analysisOverlay');
  var tabsWrap = document.getElementById('analysisTabs');
  var body = document.getElementById('analysisBody');
  var analysisTitleEl = document.getElementById('analysisTitle');
  var analysisData = null;
  var allDealsData = null;
  var activeTab = 'allDeals';

  function storeName(id) {
    var cfg = storeCfg(id);
    if (!cfg) return id;
    return cfg.group === 'chinese' ? cfg.nameCN : cfg.nameEN;
  }

  function analysisText(val) {
    var gloss = getGlossary();
    if (val && typeof val === 'object') {
      var en = val.en || '';
      var cn = val.cn || gloss[String(en).trim().toLowerCase()] || en;
      return (uiLang === 'zh' ? cn : en) || en || cn || '';
    }
    if (val == null) return '';
    var enStr = String(val);
    var cnStr = gloss[enStr.trim().toLowerCase()] || enStr;
    return uiLang === 'zh' ? cnStr : enStr;
  }

  var CATEGORY_LABELS = {
    meat: { en: 'Meat', cn: '肉类' },
    seafood: { en: 'Seafood', cn: '海鲜' },
    produce: { en: 'Produce', cn: '蔬果' },
    staples: { en: 'Staples', cn: '干货调味' }
  };
  var SUMMARY_LABELS = {
    overallCheapestProduce: { en: 'Cheapest Produce', cn: '蔬果最低价' },
    overallCheapestMeat: { en: 'Cheapest Meat', cn: '肉类最低价' },
    overallCheapestSeafood: { en: 'Cheapest Seafood', cn: '海鲜最低价' },
    overallCheapestStaples: { en: 'Cheapest Staples', cn: '干货最低价' }
  };

  function labelText(map, key) {
    var m = map[key];
    if (!m) return key;
    return (uiLang === 'zh' ? m.cn : m.en) || m.en || m.cn || key;
  }

  function benchmarkLabel(id) {
    var items = (window.SupermarketDeals && window.SupermarketDeals.benchmarkItems) || [];
    var found = items.filter(function (i) { return i.id === id; })[0];
    if (!found) return id;
    return (uiLang === 'zh' ? found.cn : found.en) || found.en || found.cn || id;
  }

  function row(label, text) {
    return '<div class="analysis-row"><span class="analysis-row-store">' + esc(label) +
      '</span><span class="analysis-row-text">' + esc(text) + '</span></div>';
  }

  function dealItemText(item) {
    return dealName(item).text;
  }

  function renderAllDeals(dealsMap) {
    if (!dealsMap || typeof dealsMap !== 'object') return '';
    var cfg = (window.SupermarketDeals && window.SupermarketDeals.config) || [];
    var storeIds = cfg.map(function (s) { return s.id; }).filter(function (id) {
      return dealsMap[id] && dealsMap[id].length;
    });
    Object.keys(dealsMap).forEach(function (id) {
      if (storeIds.indexOf(id) === -1 && dealsMap[id] && dealsMap[id].length) storeIds.push(id);
    });
    if (!storeIds.length) return '';
    return storeIds.map(function (sid) {
      var list = dealsMap[sid] || [];
      var rows = list.map(function (d) {
        var name = dealItemText(d.item);
        var price = d.price || '';
        var pct = (typeof d.discountPct === 'number') ? ' <b class="analysis-pct">-' + d.discountPct + '%</b>' : '';
        var star = d.featured ? '★ ' : '';
        return '<div class="analysis-row"><span class="analysis-row-store">' + esc(star + name) +
          '</span><span class="analysis-row-text">' + esc(price) + pct + '</span></div>';
      }).join('');
      return '<div class="analysis-subhead">' + esc(storeName(sid)) + ' · ' + list.length + '</div>' + rows;
    }).join('');
  }

  function renderTab() {
    var t = UI_TEXT[uiLang];
    var html = '';
    if (activeTab === 'allDeals') {
      html = renderAllDeals(allDealsData);
    } else if (!analysisData) {
      body.innerHTML = '<p class="analysis-empty">' + esc(t.empty) + '</p>';
      return;
    } else if (activeTab === 'bestDeals') {
      html = Object.keys(analysisData.bestDeals || {}).map(function (sid) {
        return row(storeName(sid), analysisText(analysisData.bestDeals[sid]));
      }).join('');
    } else if (activeTab === 'deepestDiscounts') {
      html = (analysisData.deepestDiscounts || []).map(function (d) {
        return '<div class="analysis-row"><span class="analysis-row-store">' + esc(storeName(d.store)) +
          '</span><span class="analysis-row-text">' + esc(analysisText(d.item)) +
          ' <b class="analysis-pct">-' + d.discountPct + '%</b></span></div>';
      }).join('');
    } else if (activeTab === 'categoryWinners') {
      html = Object.keys(analysisData.categoryWinners || {}).map(function (cat) {
        return row(labelText(CATEGORY_LABELS, cat), analysisText(analysisData.categoryWinners[cat]));
      }).join('');
    } else if (activeTab === 'cheapestStoreSummary') {
      html = Object.keys(analysisData.cheapestStoreSummary || {}).map(function (k) {
        return row(labelText(SUMMARY_LABELS, k), analysisText(analysisData.cheapestStoreSummary[k]));
      }).join('');
      var b = Object.keys(analysisData.benchmarksComparison || {});
      if (b.length) {
        html += '<div class="analysis-subhead">' + esc(t.benchmarkHead) + '</div>';
        html += b.map(function (id) {
          return row(benchmarkLabel(id), analysisText(analysisData.benchmarksComparison[id]));
        }).join('');
      }
    }
    body.innerHTML = html || '<p class="analysis-empty">' + esc(t.empty) + '</p>';
  }

  tabsWrap.addEventListener('click', function (e) {
    var btn = e.target.closest('.analysis-tab');
    if (!btn) return;
    tabsWrap.querySelectorAll('.analysis-tab').forEach(function (b) {
      b.classList.remove('active');
      b.setAttribute('aria-selected', 'false');
    });
    btn.classList.add('active');
    btn.setAttribute('aria-selected', 'true');
    activeTab = btn.dataset.tab;
    renderTab();
  });

  function loadAnalysis() {
    var t = UI_TEXT[uiLang];
    body.innerHTML = '<p class="analysis-loading">' + esc(t.loading) + '</p>';
    var fromCache = (window.SupermarketDeals && typeof window.SupermarketDeals.getData === 'function')
      ? window.SupermarketDeals.getData() : null;
    var ready = (window.SupermarketDeals && window.SupermarketDeals.ready)
      ? window.SupermarketDeals.ready()
      : Promise.resolve(fromCache);

    function apply(json) {
      if (!json) throw new Error('no data');
      analysisData = json.analysis || {};
      allDealsData = json.deals || {};
      renderTab();
    }

    ready.then(function (data) {
      if (data && data.deals) {
        apply(data);
      } else {
        return fetch('./deals-data.json', { cache: 'no-store' })
          .then(function (r) { return r.json(); })
          .then(apply);
      }
    }).catch(function () {
      body.innerHTML = '<p class="analysis-empty">' + esc(t.failed) + '</p>';
    });
  }

  function openAnalysis(e) {
    if (e) e.stopPropagation();
    overlay.classList.add('open');
    if (!analysisData) loadAnalysis();
    else renderTab();
  }

  document.getElementById('analysisBtn').addEventListener('click', openAnalysis);
  document.getElementById('analysisClose').addEventListener('click', function () {
    overlay.classList.remove('open');
  });
  overlay.addEventListener('click', function (e) {
    if (e.target === overlay) overlay.classList.remove('open');
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      if (dealsOverlay.classList.contains('open')) closeDeals();
      else overlay.classList.remove('open');
    }
  });

  /* ═══════════ 语言应用 ═══════════ */
  var langBtn = document.getElementById('langBtn');

  function applyLang() {
    var t = UI_TEXT[uiLang];
    document.documentElement.lang = uiLang;
    langBtn.textContent = uiLang === 'zh' ? '中' : 'EN';
    langBtn.setAttribute('aria-label', t.langAria);
    groupSwitch.setAttribute('aria-label', t.switchAria);
    groupSwitch.querySelector('[data-m="store"]').textContent = t.switchLeft;
    groupSwitch.querySelector('[data-m="product"]').textContent = t.switchRight;
    document.getElementById('refreshBtn').setAttribute('aria-label', t.refreshAria);
    document.getElementById('analysisBtn').setAttribute('aria-label', t.analysisAria);
    soundBtn.setAttribute('aria-label', t.soundAria);
    document.getElementById('analysisClose').setAttribute('aria-label', t.closeAria);
    document.getElementById('dealsClose').setAttribute('aria-label', t.closeAria);
    document.getElementById('updatedLabel').textContent = t.updatedLabel;
    analysisTitleEl.textContent = t.analysisTitle;
    tabsWrap.querySelectorAll('.analysis-tab').forEach(function (btn) {
      var key = btn.dataset.tab;
      if (t.tabs[key]) btn.textContent = t.tabs[key];
    });
    dealsSort.querySelectorAll('.deals-sort-btn').forEach(function (btn) {
      var key = btn.dataset.sort;
      if (key === 'default') btn.textContent = t.sortDefault;
      else if (key === 'discount') btn.textContent = t.sortDiscount;
      else if (key === 'price') btn.textContent = t.sortPrice;
    });
    if (window.SupermarketDeals && typeof window.SupermarketDeals.setLang === 'function') {
      window.SupermarketDeals.setLang(uiLang);
    }
    if (overlay.classList.contains('open')) renderTab();
    if (dealsOverlay.classList.contains('open')) {
      openDeals(dealsMode, dealsMode === 'product' ? dealsProductId : dealsStoreId, true);
    }
  }

  langBtn.addEventListener('click', function () {
    uiLang = uiLang === 'zh' ? 'en' : 'zh';
    saveLang();
    applyLang();
  });

  /* ═══════════ 顶栏日期：数据真实生成时间 ═══════════ */
  var updateStampEl = document.getElementById('updateStamp');

  function fmtStamp(ymd) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd || ''));
    if (m) return parseInt(m[2], 10) + '/' + parseInt(m[3], 10);
    var now = new Date();
    return (now.getMonth() + 1) + '/' + now.getDate();
  }

  function setUpdateStamp(gen) {
    updateStampEl.textContent = fmtStamp(gen);
  }
  setUpdateStamp(null);
  document.addEventListener('poker-deals-data', function (e) {
    setUpdateStamp(e && e.detail && e.detail.generatedAt);
  });

  applyLang();
})();
