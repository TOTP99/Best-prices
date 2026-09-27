/* app.js — 界面交互：分组切换、横屏叠牌、点开放大、音效、语言、数据分析
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
      switchLeft: '华超',
      switchRight: '西超',
      switchAria: '切换华超/西超',
      updatedLabel: '更新',
      refreshAria: '重新选品',
      analysisAria: '数据分析',
      soundAria: '音效开关',
      closeAria: '关闭',
      langAria: '切换中英文',
      prevAria: '上一张牌'
    },
    en: {
      analysisTitle: 'Analysis',
      tabs: { allDeals: 'All Deals', bestDeals: 'Best Deals', deepestDiscounts: 'Discounts', categoryWinners: 'Category Winners', cheapestStoreSummary: 'Cheapest Stores' },
      loading: 'Loading…',
      empty: 'No data',
      failed: 'Failed to load',
      benchmarkHead: 'Benchmark Comparison',
      switchLeft: 'CN',
      switchRight: 'West',
      switchAria: 'Switch Chinese/Western stores',
      updatedLabel: 'Updated',
      refreshAria: 'Reshuffle deals',
      analysisAria: 'Analysis',
      soundAria: 'Sound toggle',
      closeAria: 'Close',
      langAria: 'Switch language',
      prevAria: 'Previous card'
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

  /* ═══════════ 分组切换 ═══════════ */
  var groupSwitch = document.getElementById('groupSwitch');
  var fans = {
    chinese: document.getElementById('fan-chinese'),
    western: document.getElementById('fan-western')
  };
  var current = 'western';

  function setSwitchUI() {
    groupSwitch.dataset.active = current;
    groupSwitch.querySelectorAll('.seg-btn').forEach(function (btn) {
      var on = btn.dataset.g === current;
      btn.classList.toggle('on', on);
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
    });
  }

  function switchTo(target, silent) {
    if (target === current || !fans[target]) return;
    if (!silent) playShuffle();
    var from = fans[current];
    var to = fans[target];
    from.classList.add('shuffling');
    to.classList.add('shuffling');
    closePopped();
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
    if (btn) switchTo(btn.dataset.g);
  });
  setSwitchUI();

  window.addEventListener('load', function () {
    setTimeout(function () {
      fans.chinese.classList.remove('shuffling');
      fans.western.classList.remove('shuffling');
    }, 300);
  });

  /* ═══════════ 点开放大（竖屏） ═══════════ */
  var backdrop = document.getElementById('stageBackdrop');

  function closePopped() {
    document.querySelectorAll('.card.popped').forEach(function (c) { c.classList.remove('popped'); });
    if (backdrop) backdrop.classList.remove('show');
  }

  function popCard(card) {
    var was = card.classList.contains('popped');
    closePopped();
    if (!was) {
      card.classList.add('popped');
      if (backdrop) backdrop.classList.add('show');
      playTick();
    }
  }

  if (backdrop) backdrop.addEventListener('click', closePopped);

  /* ═══════════ 横屏叠牌 ═══════════ */
  var orientationMQ = window.matchMedia('(orientation: landscape)');

  function shuffleArr(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }

  var landscapeOrder = [];

  function initLandscapeOrder() {
    var all = Array.prototype.slice.call(document.querySelectorAll('.card'));
    var front = all.filter(function (c) { return c.dataset.storeId === 'foodbasics'; })[0] || all[0];
    var rest = shuffleArr(all.filter(function (c) { return c !== front; }));
    landscapeOrder = [front].concat(rest);
  }

  function layoutLandscapeCards(animate) {
    var n = landscapeOrder.length;
    var centerSlot = (n - 1) / 2;
    landscapeOrder.forEach(function (card, k) {
      card.style.transitionDelay = animate ? (k * 0.028) + 's' : '0s';
      card.style.setProperty('--r', '0deg');
      card.style.setProperty('--slot-offset', String(centerSlot - k));
      card.style.setProperty('--stack-tx', 'calc(var(--slot-offset) * var(--card-w) * 0.22)');
      card.style.setProperty('--stack-ty', '0px');
      card.style.setProperty('--stack-scale', k === 0 ? '1.05' : '1');
      card.style.zIndex = String(n - k + 10);
      card.classList.toggle('landscape-front', k === 0);
    });
    if (animate) {
      clearTimeout(layoutLandscapeCards._t);
      layoutLandscapeCards._t = setTimeout(function () {
        landscapeOrder.forEach(function (card) { card.style.transitionDelay = '0s'; });
      }, 450);
    }
  }

  function clearLandscapeCards() {
    document.querySelectorAll('.card').forEach(function (card) {
      ['--r', '--slot-offset', '--stack-tx', '--stack-ty', '--stack-scale'].forEach(function (p) {
        card.style.removeProperty(p);
      });
      card.style.removeProperty('z-index');
      card.style.transitionDelay = '0s';
      card.classList.remove('landscape-front');
    });
  }

  function cycleLandscape(direction) {
    if (landscapeOrder.length < 2) return;
    if (direction > 0) landscapeOrder.push(landscapeOrder.shift());
    else landscapeOrder.unshift(landscapeOrder.pop());
    layoutLandscapeCards(true);
    playCasinoShuffle();
  }

  function bringCardToFrontLandscape(card) {
    var idx = landscapeOrder.indexOf(card);
    if (idx <= 0) return;
    landscapeOrder.splice(idx, 1);
    landscapeOrder.unshift(card);
    layoutLandscapeCards(true);
    playCasinoShuffle();
  }

  function syncOrientationLayout() {
    closePopped();
    if (orientationMQ.matches) {
      initLandscapeOrder();
      layoutLandscapeCards(false);
    } else {
      clearLandscapeCards();
    }
  }
  if (orientationMQ.addEventListener) orientationMQ.addEventListener('change', syncOrientationLayout);
  else if (orientationMQ.addListener) orientationMQ.addListener(syncOrientationLayout);
  syncOrientationLayout();

  document.getElementById('prevBtn').addEventListener('click', function (e) {
    e.stopPropagation();
    cycleLandscape(-1);
  });

  document.querySelectorAll('.card').forEach(function (card) {
    card.addEventListener('click', function (e) {
      e.stopPropagation();
      if (orientationMQ.matches) {
        if (landscapeOrder[0] !== card) bringCardToFrontLandscape(card);
      } else {
        popCard(card);
      }
    });
    card.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        card.click();
      }
    });
  });

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

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function storeName(id) {
    var cfg = ((window.SupermarketDeals && window.SupermarketDeals.config) || []).filter(function (s) { return s.id === id; })[0];
    if (!cfg) return id;
    return cfg.group === 'chinese' ? cfg.nameCN : cfg.nameEN;
  }

  function getGlossary() {
    return (window.SupermarketDeals && window.SupermarketDeals.getGlossary && window.SupermarketDeals.getGlossary()) || {};
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
    if (item && typeof item === 'object') {
      var en = item.en || '';
      var cn = item.cn || en;
      return uiLang === 'zh' ? (cn || en) : (en || cn);
    }
    return String(item || '');
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
      overlay.classList.remove('open');
      closePopped();
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
    groupSwitch.querySelector('[data-g="chinese"]').textContent = t.switchLeft;
    groupSwitch.querySelector('[data-g="western"]').textContent = t.switchRight;
    document.getElementById('refreshBtn').setAttribute('aria-label', t.refreshAria);
    document.getElementById('analysisBtn').setAttribute('aria-label', t.analysisAria);
    soundBtn.setAttribute('aria-label', t.soundAria);
    document.getElementById('analysisClose').setAttribute('aria-label', t.closeAria);
    document.getElementById('prevBtn').setAttribute('aria-label', t.prevAria);
    document.getElementById('updatedLabel').textContent = t.updatedLabel;
    analysisTitleEl.textContent = t.analysisTitle;
    tabsWrap.querySelectorAll('.analysis-tab').forEach(function (btn) {
      var key = btn.dataset.tab;
      if (t.tabs[key]) btn.textContent = t.tabs[key];
    });
    if (window.SupermarketDeals && typeof window.SupermarketDeals.setLang === 'function') {
      window.SupermarketDeals.setLang(uiLang);
    }
    if (overlay.classList.contains('open')) renderTab();
  }

  langBtn.addEventListener('click', function () {
    uiLang = uiLang === 'zh' ? 'en' : 'zh';
    saveLang();
    applyLang();
  });

  /* ═══════════ 顶栏日期 ═══════════ */
  var now = new Date();
  document.getElementById('updateStamp').textContent = (now.getMonth() + 1) + '/' + now.getDate();

  applyLang();
})();
