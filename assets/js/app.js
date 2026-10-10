/* ============================================================
   从 cosh 理解：二项分布的极限是正态分布 — 交互逻辑
   纯原生 JS + Canvas，无外部依赖（公式由 MathJax 渲染）。
   ============================================================ */
(function () {
  'use strict';

  /* ---------- 颜色 ---------- */
  const C = {
    accent: '#2563eb',
    accent2: '#f59e0b',
    accent3: '#16a34a',
    accent4: '#dc2626',
    accent5: '#7c3aed',
    grid: '#e8ecf4',
    axis: '#9aa3b2',
    text: '#1f2430',
    muted: '#5b6472'
  };

  /* ---------- 数学工具 ---------- */
  // Lanczos 近似的 log-gamma
  function lgamma(z) {
    const g = 7;
    const c = [
      0.99999999999980993, 676.5203681218851, -1259.1392167224028,
      771.32342877765313, -176.61502916214059, 12.507343278686905,
      -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7
    ];
    if (z < 0.5) {
      return Math.log(Math.PI / Math.sin(Math.PI * z)) - lgamma(1 - z);
    }
    z -= 1;
    let x = c[0];
    for (let i = 1; i < g + 2; i++) x += c[i] / (z + i);
    const t = z + g + 0.5;
    return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
  }

  // 二项分布概率质量 (对数域，避免溢出)
  function binomPMF(n, k, p) {
    if (k < 0 || k > n) return 0;
    const lp = Math.log(p), lq = Math.log(1 - p);
    return Math.exp(lgamma(n + 1) - lgamma(k + 1) - lgamma(n - k + 1) + k * lp + (n - k) * lq);
  }

  // 标准正态密度
  function phi(x) { return Math.exp(-x * x / 2) / Math.sqrt(2 * Math.PI); }

  // 一般 p 下，单次中心化试验的矩母函数 M_{B-p}(t)
  function mgfBernoulli(t, p) {
    return (1 - p) * Math.exp(-p * t) + p * Math.exp((1 - p) * t);
  }

  /* ---------- Canvas 基础：DPR 适配 + 坐标轴框架 ---------- */
  const renderers = []; // 所有 render 函数，resize 时重绘

  function setup(canvas) {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(1, rect.width), h = Math.max(1, rect.height);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    return { ctx, w, h };
  }

  // 在给定画布上画坐标框，返回坐标映射 sx/sy
  function frame(ctx, w, h, x0, x1, y0, y1, opts) {
    opts = opts || {};
    const pl = opts.padL != null ? opts.padL : 52;
    const pr = opts.padR != null ? opts.padR : 16;
    const pt = opts.padT != null ? opts.padT : 44;
    const pb = opts.padB != null ? opts.padB : 34;
    const pw = w - pl - pr, ph = h - pt - pb;
    const sx = v => pl + (v - x0) / (x1 - x0) * pw;
    const sy = v => pt + (1 - (v - y0) / (y1 - y0)) * ph;

    // 网格
    ctx.strokeStyle = C.grid;
    ctx.fillStyle = C.muted;
    ctx.lineWidth = 1;
    ctx.font = '11px sans-serif';
    const xStep = niceStep((x1 - x0) / 6);
    const yStep = niceStep((y1 - y0) / 5);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (let v = Math.ceil(x0 / xStep) * xStep; v <= x1 + 1e-9; v += xStep) {
      const X = sx(v);
      ctx.beginPath(); ctx.moveTo(X, pt); ctx.lineTo(X, pt + ph); ctx.stroke();
      ctx.fillText(fmt(v), X, pt + ph + 6);
    }
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let v = Math.ceil(y0 / yStep) * yStep; v <= y1 + 1e-9; v += yStep) {
      const Y = sy(v);
      ctx.beginPath(); ctx.moveTo(pl, Y); ctx.lineTo(pl + pw, Y); ctx.stroke();
      ctx.fillText(fmt(v), pl - 6, Y);
    }
    // 轴线
    ctx.strokeStyle = C.axis;
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(pl, pt); ctx.lineTo(pl, pt + ph); ctx.lineTo(pl + pw, pt + ph); ctx.stroke();

    if (opts.title) {
      ctx.fillStyle = C.text;
      ctx.font = '13px sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(opts.title, pl, 4);
    }
    return { sx, sy, pl, pr, pt, pb, pw, ph };
  }

  function niceStep(raw) {
    const p = Math.pow(10, Math.floor(Math.log10(raw)));
    const n = raw / p;
    let s;
    if (n < 1.5) s = 1; else if (n < 3) s = 2; else if (n < 7) s = 5; else s = 10;
    return s * p;
  }
  function fmt(v) {
    if (Math.abs(v) >= 1000) return v.toFixed(0);
    if (Math.abs(v) >= 1) return (Math.round(v * 100) / 100).toString();
    return (Math.round(v * 1000) / 1000).toString();
  }

  function line(ctx, sx, sy, fn, x0, x1, color, opts) {
    opts = opts || {};
    const N = opts.N || 240;
    ctx.strokeStyle = color;
    ctx.lineWidth = opts.width || 2.4;
    if (opts.dash) ctx.setLineDash(opts.dash); else ctx.setLineDash([]);
    ctx.beginPath();
    let started = false;
    for (let i = 0; i <= N; i++) {
      const x = x0 + (x1 - x0) * i / N;
      let y;
      try { y = fn(x); } catch (e) { y = NaN; }
      if (!isFinite(y)) { started = false; continue; }
      const X = sx(x), Y = sy(y);
      if (!started) { ctx.moveTo(X, Y); started = true; }
      else ctx.lineTo(X, Y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }

  /* ============================================================
     1. 硬币模拟：二项分布直方图 + 理论 PMF + 正态近似
     ============================================================ */
  const coin = (function () {
    const canvas = document.getElementById('coin-canvas');
    const nEl = document.getElementById('coin-n');
    const pEl = document.getElementById('coin-p');
    const nVal = document.getElementById('coin-n-val');
    const pVal = document.getElementById('coin-p-val');
    const countEl = document.getElementById('coin-count');
    let hist = [];   // 每个 k 的计数
    let total = 0;

    function reset() {
      const n = +nEl.value;
      hist = new Array(n + 1).fill(0);
      total = 0;
      draw();
    }
    function flip(m) {
      const n = +nEl.value, p = +pEl.value;
      if (hist.length !== n + 1) hist = new Array(n + 1).fill(0);
      for (let s = 0; s < m; s++) {
        let k = 0;
        for (let i = 0; i < n; i++) if (Math.random() < p) k++;
        hist[k]++;
      }
      total += m;
      draw();
    }

    function draw() {
      const n = +nEl.value, p = +pEl.value;
      if (hist.length !== n + 1) reset();
      const { ctx, w, h } = setup(canvas);
      const kMin = 0, kMax = n;
      // y 轴上界：取理论最大 PMF 与正态峰值的较大者
      let peak = 0;
      for (let k = 0; k <= n; k++) peak = Math.max(peak, binomPMF(n, k, p));
      const mean = n * p, sd = Math.sqrt(n * p * (1 - p));
      const normPeak = phi(0) / sd; // 连续密度在均值处的值
      const yMax = Math.max(peak, normPeak) * 1.25;
      const ax = frame(ctx, w, h, kMin - 0.5, kMax + 0.5, 0, yMax, {
        padL: 50, title: '正面次数分布'
      });

      // 直方图（密度）
      const binW = 1;
      const dens = total > 0 ? hist.map(c => c / total / binW) : hist.map(() => 0);
      ctx.fillStyle = 'rgba(37,99,235,0.55)';
      for (let k = 0; k <= n; k++) {
        const x0 = ax.sx(k - 0.5), x1 = ax.sx(k + 0.5);
        const y = ax.sy(dens[k]);
        ctx.fillRect(x0, y, Math.max(1, x1 - x0 - 1), ax.sy(0) - y);
      }

      // 理论二项 PMF（绿点线）
      ctx.strokeStyle = C.accent3; ctx.fillStyle = C.accent3; ctx.lineWidth = 2;
      ctx.setLineDash([]);
      ctx.beginPath();
      for (let k = 0; k <= n; k++) {
        const X = ax.sx(k), Y = ax.sy(binomPMF(n, k, p));
        if (k === 0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y);
      }
      ctx.stroke();
      for (let k = 0; k <= n; k++) {
        const X = ax.sx(k), Y = ax.sy(binomPMF(n, k, p));
        ctx.beginPath(); ctx.arc(X, Y, 2.2, 0, 2 * Math.PI); ctx.fill();
      }

      // 正态近似（红曲线）
      line(ctx, ax.sx, ax.sy, x => phi((x - mean) / sd) / sd, kMin, kMax, C.accent4, { width: 2.4 });

      // 图例
      legend(ctx, w, [
        ['模拟直方图', 'rgba(37,99,235,0.55)', 'box'],
        ['理论二项 PMF', C.accent3, 'line'],
        ['正态近似', C.accent4, 'line']
      ]);
    }

    function sync() {
      nVal.textContent = nEl.value;
      pVal.textContent = (+pEl.value).toFixed(2);
    }

    nEl.addEventListener('input', () => { sync(); reset(); });
    pEl.addEventListener('input', () => { sync(); draw(); });
    document.getElementById('coin-1').addEventListener('click', () => flip(1));
    document.getElementById('coin-100').addEventListener('click', () => flip(100));
    document.getElementById('coin-1000').addEventListener('click', () => flip(1000));
    document.getElementById('coin-reset').addEventListener('click', reset);

    sync();
    renderers.push(() => { countEl.textContent = total; draw(); });
    reset();
    return { draw };
  })();

  /* ============================================================
     2. 单个中心化试验的矩母函数 cosh(t/2)
     ============================================================ */
  (function () {
    const canvas = document.getElementById('single-canvas');
    function draw() {
      const { ctx, w, h } = setup(canvas);
      const t0 = -4, t1 = 4;
      const yMax = Math.cosh(t1 / 2) * 1.1;
      const ax = frame(ctx, w, h, t0, t1, 0, yMax, { title: '单次中心化试验：M(t) = cosh(t/2)' });
      line(ctx, ax.sx, ax.sy, t => Math.cosh(t / 2), t0, t1, C.accent2, { width: 2.6 });
      // 两支指数成分 (e^{±t/2})/2
      line(ctx, ax.sx, ax.sy, t => Math.exp(t / 2) / 2, t0, t1, C.accent4, { width: 1.6, dash: [5, 4] });
      line(ctx, ax.sx, ax.sy, t => Math.exp(-t / 2) / 2, t0, t1, C.accent3, { width: 1.6, dash: [5, 4] });
      legend(ctx, w, [
        ['cosh(t/2)', C.accent2, 'line'],
        ['e^(t/2)/2', C.accent4, 'line'],
        ['e^(−t/2)/2', C.accent3, 'line']
      ]);
    }
    renderers.push(draw);
    draw();
  })();

  /* ============================================================
     3. 标准化后 [cosh(t/√n)]^n → e^{t^2/2} （含动画）
     ============================================================ */
  (function () {
    const canvas = document.getElementById('mgf-canvas');
    const nEl = document.getElementById('mgf-n');
    const nVal = document.getElementById('mgf-n-val');
    const errEl = document.getElementById('mgf-err');
    const playBtn = document.getElementById('mgf-play');
    const resetBtn = document.getElementById('mgf-reset');
    let playing = false, raf = null, lastT = 0;

    const T = 3; // t ∈ [-3,3]
    function mgfZn(t, n) { return Math.pow(Math.cosh(t / Math.sqrt(n)), n); }
    function limit(t) { return Math.exp(t * t / 2); }

    function maxRelErr(n) {
      let m = 0;
      for (let i = 0; i <= 120; i++) {
        const t = -T + (2 * T) * i / 120;
        const a = mgfZn(t, n), b = limit(t);
        if (b > 1e-6) m = Math.max(m, Math.abs(a - b) / b);
      }
      return m;
    }

    function draw() {
      const n = +nEl.value;
      const { ctx, w, h } = setup(canvas);
      const yMax = Math.exp(T * T / 2) * 1.08;
      const ax = frame(ctx, w, h, -T, T, 0, yMax, { title: 'cosh(t/√n)ⁿ  与  e^(t²/2)' });
      line(ctx, ax.sx, ax.sy, t => mgfZn(t, n), -T, T, C.accent2, { width: 2.8 });
      line(ctx, ax.sx, ax.sy, limit, -T, T, C.accent4, { width: 2.2, dash: [6, 5] });
      legend(ctx, w, [
        ['cosh(t/√n)ⁿ（n=' + n + '）', C.accent2, 'line'],
        ['e^(t²/2)', C.accent4, 'line']
      ]);
      nVal.textContent = n;
      errEl.textContent = (maxRelErr(n) * 100).toFixed(2) + '%';
    }

    function tick(ts) {
      if (!playing) return;
      if (!lastT) lastT = ts;
      const dt = ts - lastT; lastT = ts;
      let n = +nEl.value;
      // 用非线性步进：小 n 快、大 n 慢，便于观察收敛
      n = Math.min(300, Math.round(n + Math.max(1, n * 0.06) * (dt / 60)));
      nEl.value = n;
      draw();
      if (n >= 300) { playing = false; playBtn.textContent = '▶ 播放收敛动画'; return; }
      raf = requestAnimationFrame(tick);
    }
    function play() {
      if (playing) { playing = false; playBtn.textContent = '▶ 播放收敛动画'; return; }
      if (+nEl.value >= 300) nEl.value = 1;
      playing = true; lastT = 0; playBtn.textContent = '⏸ 暂停';
      raf = requestAnimationFrame(tick);
    }

    nEl.addEventListener('input', () => { if (playing) { playing = false; playBtn.textContent = '▶ 播放收敛动画'; } draw(); });
    playBtn.addEventListener('click', play);
    resetBtn.addEventListener('click', () => { playing = false; playBtn.textContent = '▶ 播放收敛动画'; nEl.value = 1; draw(); });
    renderers.push(draw);
    draw();
  })();

  /* ============================================================
     4. 二次项特殊性：ln cosh 近似 + n·ln cosh(t/√n)
     ============================================================ */
  (function () {
    // 左图：ln cosh x 与其近似
    const c1 = document.getElementById('taylor-canvas');
    (function () {
      function draw() {
        const { ctx, w, h } = setup(c1);
        const x0 = -2.5, x1 = 2.5;
        const yMax = Math.log(Math.cosh(x1)) * 1.1;
        const ax = frame(ctx, w, h, x0, x1, 0, yMax, { title: 'ln cosh x 的近似' });
        line(ctx, ax.sx, ax.sy, x => Math.log(Math.cosh(x)), x0, x1, C.accent5, { width: 2.6 });
        line(ctx, ax.sx, ax.sy, x => x * x / 2, x0, x1, C.accent3, { width: 2, dash: [6, 5] });
        line(ctx, ax.sx, ax.sy, x => x * x / 2 - Math.pow(x, 4) / 12, x0, x1, C.accent2, { width: 1.8, dash: [3, 4] });
        legend(ctx, w, [
          ['ln cosh x', C.accent5, 'line'],
          ['x²/2', C.accent3, 'line'],
          ['x²/2 − x⁴/12', C.accent2, 'line']
        ]);
      }
      renderers.push(draw); draw();
    })();

    // 右图：n·ln cosh(t/√n) → t²/2
    const c2 = document.getElementById('taylor2-canvas');
    const nEl = document.getElementById('tay-n');
    const nVal = document.getElementById('tay-n-val');
    (function () {
      function draw() {
        const n = +nEl.value;
        const { ctx, w, h } = setup(c2);
        const t0 = -3, t1 = 3;
        const yMax = (t1 * t1 / 2) * 1.1;
        const ax = frame(ctx, w, h, t0, t1, 0, yMax, { title: 'n·ln cosh(t/√n)  (n=' + n + ')' });
        line(ctx, ax.sx, ax.sy, t => n * Math.log(Math.cosh(t / Math.sqrt(n))), t0, t1, C.accent2, { width: 2.6 });
        line(ctx, ax.sx, ax.sy, t => t * t / 2, t0, t1, C.accent4, { width: 2.2, dash: [6, 5] });
        legend(ctx, w, [
          ['n·ln cosh(t/√n)', C.accent2, 'line'],
          ['t²/2', C.accent4, 'line']
        ]);
        nVal.textContent = n;
      }
      nEl.addEventListener('input', () => { nVal.textContent = nEl.value; draw(); });
      renderers.push(draw); draw();
    })();
  })();

  /* ============================================================
     5. 悬链线：a·cosh(x/a) 与两支指数
     ============================================================ */
  (function () {
    const canvas = document.getElementById('cat-canvas');
    const aEl = document.getElementById('cat-a');
    const aVal = document.getElementById('cat-a-val');
    const splitEl = document.getElementById('cat-split');

    function draw() {
      const a = +aEl.value;
      aVal.textContent = a.toFixed(2);
      const { ctx, w, h } = setup(canvas);
      const x0 = -2.2, x1 = 2.2;
      const yMax = a * Math.cosh(x1 / a) * 1.12;
      const ax = frame(ctx, w, h, x0, x1, 0, yMax, { title: '悬链线 y = a·cosh(x/a)' });
      if (splitEl.checked) {
        line(ctx, ax.sx, ax.sy, x => a * Math.exp(x / a) / 2, x0, x1, C.accent4, { width: 1.5, dash: [5, 4] });
        line(ctx, ax.sx, ax.sy, x => a * Math.exp(-x / a) / 2, x0, x1, C.accent3, { width: 1.5, dash: [5, 4] });
      }
      line(ctx, ax.sx, ax.sy, x => a * Math.cosh(x / a), x0, x1, C.accent, { width: 2.8 });
      // 最低点标注
      ctx.fillStyle = C.muted; ctx.font = '12px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.fillText('最低点 (0, a)', ax.sx(0), ax.sy(a) - 4);
      const items = [['a·cosh(x/a)', C.accent, 'line']];
      if (splitEl.checked) {
        items.push(['a·e^(x/a)/2', C.accent4, 'line']);
        items.push(['a·e^(−x/a)/2', C.accent3, 'line']);
      }
      legend(ctx, w, items);
    }
    aEl.addEventListener('input', draw);
    splitEl.addEventListener('change', draw);
    renderers.push(draw);
    draw();
  })();

  /* ============================================================
     6. 一般 p：标准化矩母函数 → e^{t^2/2}
     ============================================================ */
  (function () {
    const canvas = document.getElementById('gen-canvas');
    const pEl = document.getElementById('gen-p');
    const nEl = document.getElementById('gen-n');
    const pVal = document.getElementById('gen-p-val');
    const nVal = document.getElementById('gen-n-val');
    const T = 3;
    function mgfZnGen(t, n, p) {
      const sd = Math.sqrt(n * p * (1 - p));
      return Math.pow(mgfBernoulli(t / sd, p), n);
    }
    function draw() {
      const p = +pEl.value, n = +nEl.value;
      pVal.textContent = p.toFixed(2);
      nVal.textContent = n;
      const { ctx, w, h } = setup(canvas);
      const yMax = Math.exp(T * T / 2) * 1.08;
      const ax = frame(ctx, w, h, -T, T, 0, yMax,
        { title: '一般 p 的标准化矩母函数 (p=' + p.toFixed(2) + ', n=' + n + ')' });
      line(ctx, ax.sx, ax.sy, t => mgfZnGen(t, n, p), -T, T, C.accent2, { width: 2.8 });
      line(ctx, ax.sx, ax.sy, t => Math.exp(t * t / 2), -T, T, C.accent4, { width: 2.2, dash: [6, 5] });
      legend(ctx, w, [
        ['M_Z⁽ᵖ⁾(t)，一般 p', C.accent2, 'line'],
        ['e^(t²/2)', C.accent4, 'line']
      ]);
    }
    pEl.addEventListener('input', () => { pVal.textContent = (+pEl.value).toFixed(2); draw(); });
    nEl.addEventListener('input', () => { nVal.textContent = nEl.value; draw(); });
    renderers.push(draw);
    draw();
  })();

  /* ---------- 通用图例 ---------- */
  function legend(ctx, w, items) {
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    let x = 60, y = 26;
    const gap = 18;
    for (const [label, color, type] of items) {
      const tw = ctx.measureText(label).width;
      if (type === 'box') {
        ctx.fillStyle = color;
        ctx.fillRect(x, y - 5, 12, 10);
      } else {
        ctx.strokeStyle = color; ctx.lineWidth = 2.4;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 14, y); ctx.stroke();
      }
      ctx.fillStyle = C.text;
      ctx.fillText(label, x + 18, y);
      x += 18 + tw + 16;
      if (x > w - 40) { x = 60; y += gap; }
    }
  }

  /* ---------- 全局 resize 重绘 ---------- */
  let rT = null;
  window.addEventListener('resize', () => {
    clearTimeout(rT);
    rT = setTimeout(() => renderers.forEach(fn => fn()), 120);
  });
})();
