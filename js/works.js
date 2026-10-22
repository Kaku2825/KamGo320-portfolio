/* works.js — L2 卡片阵列 + L3 满屏横向长卷
   · 竖向长卡（h≈30vh，ar 1/3.7 窄条，默认压暗，悬停点亮）
   · 展开/退出 = transform FLIP（GPU 合成，丝滑缩放感）
   · 长卷 = 无极滑动：滚轮/拖拽连续位移 + 惯性 + 松手软吸附
   · 详情页自由缩放：Ctrl+滚轮 / 双击 / 双指捏合，放大后可拖拽平移
   ================================================================ */

import { clamp, Glide } from './utils.js?v=18';

const FLIP_DUR = 950;
const FLIP_EASE = 'cubic-bezier(.85, 0, .15, 1)';

/* 两档图：LO = 1.5× 速览图（先出画面，约 220KB/页），
   HI = 3× 高清图（只在放大/停留后换入，约 1.3MB/页） */
const LO = page => `assets/pages/lo/${page}.webp?v=1`;
const HI = page => `assets/pages/${page}.webp?v=7`;

export class WorksSection {
  constructor(el, app) {
    this.el = el;
    this.app = app;
    this.works = app.data.works;

    /* 全部长页 → 扁平面板表 */
    this.panels = [];
    for (const w of this.works) for (const pg of w.pages)
      this.panels.push({ work: w, page: pg });
    this.pageOf = new Map();
    this.panels.forEach((pn, i) => this.pageOf.set(pn.work.id + '|' + pn.page, i));

    this.mode = 'index';               // index | detail
    this.transitioning = false;
    this.zooms = new Map();            // panelIndex → {z, x, y}

    this.#renderIndex();
    this.#renderDetail();
    this.#renderAxis();
    this.#bindWheel();
    this.#bindPointer();
    this.#bindRailDrag();
    this.#bindKeys();
    this.#bindFrame();
  }

  /* ================= L2 阵列（窄条长卡） ================= */
  #renderIndex() {
    const cards = this.works.map((w, i) => `
      <button class="idx-card" data-work="${i}" aria-label="打开作品 ${w.title}">
        <img src="assets/cards/${w.id}.webp?v=6" alt="${w.title}" draggable="false">
        <span class="card-meta">
          <span class="row-top"><span class="pno">P.${w.tocPage}</span></span>
          <span class="card-bottom">
            <span class="card-title-cn">${w.title}</span>
            <span class="card-open" style="--card-hl:${w.hl}">展开 ⟶</span>
          </span>
        </span>
      </button>`).join('');

    this.el.innerHTML = `
      <div class="section-inner works-idx">
        <div class="idx-rail-wrap"><div class="idx-rail">${cards}</div></div>
        <p class="idx-footnote">拖拽横移 ⟷ · 点击卡片展开 ⟶</p>
      </div>`;

    this.rail = this.el.querySelector('.idx-rail');
    this.cards = [...this.el.querySelectorAll('.idx-card')];
    this.cards.forEach((c, i) => c.addEventListener('click', () => {
      if (this._suppressClick) return;      // 刚才是拖拽，不是点击
      this.open(i);
    }));

    /* 悬停 / 聚焦即预热该作品首页的低清图：点开时第一屏基本已在缓存里 */
    this.cards.forEach((c, i) => {
      const warm = () => { const im = new Image(); im.decoding = 'async'; im.src = LO(this.works[i].pages[0]); };
      c.addEventListener('pointerenter', warm, { once: true });
      c.addEventListener('focus', warm, { once: true });
    });
  }

  /* 卡片阵列：长按拖拽 = 拖动/横滑（有溢出就真滚，没溢出就带阻尼跟随再回弹） */
  #bindRailDrag() {
    const wrap = this.el.querySelector('.idx-rail-wrap');
    const rail = this.el.querySelector('.idx-rail');
    let on = false, cap = false, id = null, moved = 0;
    let sx = 0, s0 = 0, lx = 0, lt = 0, v = 0, raf = 0;
    const stop = () => { cancelAnimationFrame(raf); raf = 0; };
    const overflow = () => wrap.scrollWidth - wrap.clientWidth > 2;

    wrap.addEventListener('pointerdown', e => {
      if (this.mode !== 'index' || e.button !== 0) return;
      if (e.pointerType === 'touch') return;        // 触屏交给原生滚动，不抢
      e.preventDefault();                    // 按下即掐断原生选区 / 图片拖影
      on = true; cap = false; id = e.pointerId; moved = 0;
      sx = lx = e.clientX; lt = performance.now(); v = 0;
      s0 = wrap.scrollLeft;
      stop();
      rail.style.transition = 'none';
      wrap.classList.add('dragging');
    });

    wrap.addEventListener('pointermove', e => {
      if (!on || e.pointerId !== id) return;
      const dx = e.clientX - lx, now = performance.now();
      v = v * .7 + (dx / Math.max(now - lt, 1)) * .3;   // px/ms
      lx = e.clientX; lt = now;
      const total = e.clientX - sx;
      moved = Math.max(moved, Math.abs(total));
      /* 越过阈值才抓指针：在此之前不抢事件，卡片点击照常生效 */
      if (moved > 4 && !cap) { cap = true; wrap.setPointerCapture(id); }
      if (moved <= 4) return;
      if (overflow()) {
        wrap.scrollLeft = s0 - total;                   // 真滚动
      } else {
        /* 阵列比视口窄：给一段阻尼跟随，拖多少跟多少（最多 ±110px） */
        rail.style.transform = `translateX(${clamp(total * .55, -110, 110)}px)`;
      }
    });

    const up = e => {
      if (!on || e.pointerId !== id) return;
      on = false; cap = false; id = null;
      wrap.classList.remove('dragging');
      if (moved > 4) {                       // 拖过的手势不算点击
        this._suppressClick = true;
        setTimeout(() => { this._suppressClick = false; }, 0);
        if (overflow()) {
          let vel = v * 16;                  // 惯性：松手后按速度再滑一段
          const glide = () => {
            if (Math.abs(vel) < .2) { raf = 0; return; }
            wrap.scrollLeft -= vel;
            vel *= .92;
            raf = requestAnimationFrame(glide);
          };
          if (Math.abs(vel) > .5) raf = requestAnimationFrame(glide);
        }
      }
      /* 无溢出 / 松手：回弹归位 */
      rail.style.transition = 'transform .62s cubic-bezier(.22, 1, .36, 1)';
      rail.style.transform = 'translateX(0)';
    };
    wrap.addEventListener('pointerup', up);
    wrap.addEventListener('pointercancel', up);
    wrap.addEventListener('dragstart', e => e.preventDefault());
  }

  /* ================= L3 长卷 ================= */
  #renderDetail() {
    const d = document.createElement('div');
    d.className = 'detail';
    d.innerHTML = `
      <button class="detail-back"><span class="back-arrow"></span><span>返回索引</span></button>
      <div class="detail-strip">
        ${this.panels.map((pn, k) => `
          <figure class="page-panel" style="--work-field:${pn.work.field};--work-ink:${pn.work.ink};--work-hl:${pn.work.hl}">
            <img data-src="${LO(pn.page)}"
                 data-hi="${HI(pn.page)}"
                 alt="${pn.work.title} · ${pn.page}" decoding="async" draggable="false">
          </figure>`).join('')}
      </div>
      <div class="detail-pageinfo"></div>
      <p class="detail-hint">CTRL+滚轮 缩放 · 双击 放大 · 拖拽 平移</p>`;
    this.el.appendChild(d);

    this.detail = d;
    this.strip = d.querySelector('.detail-strip');
    this.pageinfo = d.querySelector('.detail-pageinfo');
    this.pageImgs = [...this.strip.querySelectorAll('img')];
    this.panelsEls = [...this.strip.children];
    d.querySelector('.detail-back').addEventListener('click', () => this.close());
  }

  #loadImg(k, prio) {
    const img = this.pageImgs[k];
    if (!img || img.getAttribute('src') || !img.dataset.src) return false;
    if (prio) img.fetchPriority = prio;
    img.src = img.dataset.src;
    img.removeAttribute('data-src');
    return true;
  }

  /* 高清图换入：先离屏加载，完成后再替换 src ——
     旧的低清图会一直显示到高清解码完成，不会闪白 */
  #loadHi(k) {
    const img = this.pageImgs[k];
    if (!img || img.dataset.hiDone === '1') return;
    const url = img.dataset.hi;
    if (!url) return;
    img.dataset.hiDone = '1';
    const pre = new Image();
    pre.decoding = 'async';
    pre.onload = () => { if (this.mode === 'detail') img.src = url; };
    pre.onerror = () => { img.dataset.hiDone = ''; };
    pre.src = url;
  }

  /* 邻近预载：基础 ±2 窗口，再按当前滑动速度向运动方向额外展开——
     快速惯性抛掷时能提前好几页起载，避免滑过去还是空白 */
  #preloadAround(idx, vel = 0) {
    const n = this.panels.length;
    const speed = Math.abs(vel) / Math.max(innerWidth, 1);        // 页/帧
    const extra = clamp(Math.round(speed * 6), 0, 8);             // 快滑最多多预载 8 页
    const back  = vel >= 0 ? 2 : 2 + extra;
    const fwd   = vel >= 0 ? 2 + extra : 2;
    for (let k = Math.max(0, idx - back); k <= Math.min(n - 1, idx + fwd); k++) {
      this.#loadImg(k, Math.abs(k - idx) <= 1 ? 'high' : 'low');
    }
  }

  /* 空闲后按低优先级把剩余页的低清图逐张补齐（错峰，不抢当前页带宽）。
     省流量模式下完全不补——只在滑到附近时才取 */
  #preloadRest() {
    clearTimeout(this._restT);
    if (navigator.connection?.saveData) return;
    let k = 0;
    const pump = () => {
      if (this.mode !== 'detail') return;
      let done = true;
      while (k < this.panels.length) {
        const i = k++;
        if (!this.pageImgs[i].getAttribute('src')) { this.#loadImg(i, 'low'); done = false; break; }
      }
      if (!done) this._restT = setTimeout(pump, 150);
    };
    this._restT = setTimeout(pump, 1500);
  }

  /* ================= 底部轴 ================= */
  #renderAxis() {
    const a = document.createElement('div');
    a.className = 'axis';
    const total = this.panels.length;
    a.innerHTML = `
      <div class="axis-track">
        ${this.works.map(w => `
          <div class="axis-seg" data-work="${w.id}" style="flex:${w.pages.length} 0">
            <span class="seg-line"></span>
            ${w.pages.map(pg => `<span class="axis-tick" data-page="${w.id}|${pg}"></span>`).join('')}
          </div>`).join('')}
      </div>
      <div class="axis-labels">
        ${this.works.map(w => `
          <span class="axis-label" data-label="${w.id}"><span class="no">${w.no}</span>${w.title}</span>`).join('')}
      </div>`;
    /* 轴放在 detail 层内部：由扩张中的 clip-path 遮罩自然揭示，
       而不是自己淡入——看起来"本来就在那，图框扩到那才露出来" */
    this.detail.appendChild(a);
    this.axis = a;
    this.axisTrack = a.querySelector('.axis-track');
    this.ticks = [...a.querySelectorAll('.axis-tick')];
    this.labels = [...a.querySelectorAll('.axis-label')];
    this.segs = [...a.querySelectorAll('.axis-seg')];

    const positionLabels = () => {
      const tw = this.axisTrack.getBoundingClientRect().width;
      let acc = 0;
      const gapTotal = (this.works.length - 1) * 3;
      this.labels.forEach((lb, i) => {
        lb.style.left = `${(acc / tw * 100).toFixed(3)}%`;
        acc += (tw - gapTotal) * (this.works[i].pages.length / total) + (i < this.works.length - 1 ? 3 : 0);
      });
    };
    positionLabels();
    addEventListener('resize', positionLabels);

    this.ticks.forEach(t => t.addEventListener('click', e => {
      e.stopPropagation();
      this.jump(this.pageOf.get(t.dataset.page));
    }));
    this.segs.forEach(s => s.addEventListener('click', () => {
      const w = this.works.find(w => w.id === s.dataset.work);
      this.jump(this.pageOf.get(w.id + '|' + w.pages[0]));
    }));
  }

  /* ================================================================
     遮罩扩张（对齐参考站的"图框"逻辑）：
     卡片本身就是完整页面上开的一个窗口——点开时 detail 层（真实页面）
     以 clip-path 从卡片矩形扩张到全屏，内容从头到尾不缩放；
     收起时反向缩回卡片矩形。卡图即页面切片，窗口起始处无缝衔接。
     ================================================================ */
  open(workIndex) {
    if (this.transitioning || this.mode === 'detail') return;
    this.transitioning = true;
    const card = this.cards[workIndex];
    const rect = card.getBoundingClientRect();
    this.#showDetail(this.pageOf.get(this.works[workIndex].id + '|' + this.works[workIndex].pages[0]), rect);
  }

  close() {
    if (this.mode !== 'detail' || this.transitioning) return;
    this.transitioning = true;
    clearTimeout(this._restT);
    clearTimeout(this._hiT);
    const wi = this.works.indexOf(this._curWork ?? this.works[0]);
    const card = this.cards[wi] ?? this.cards[0];
    const rect = card.getBoundingClientRect();
    const inset = `inset(${rect.top}px ${innerWidth - rect.right}px ${innerHeight - rect.bottom}px ${rect.left}px)`;

    const anim = this.detail.animate(
      [{ clipPath: 'inset(0px 0px 0px 0px)' }, { clipPath: inset }],
      { duration: FLIP_DUR, easing: FLIP_EASE }
    );
    anim.onfinish = () => {
      anim.cancel();
      this.detail.classList.remove('is-open');
      document.body.classList.remove('in-detail');
      this.app.setTicks(1);
      this.app.setWorkTheme(null);
      this.mode = 'index';
      this.zooms.clear();
      this.#applyZooms();
      /* 修复：退出后清除卡片焦点，避免残留"被选中"状态 */
      this.cards.forEach(c => c.blur());
      history.replaceState(null, '', '#works');
      this.transitioning = false;
    };
  }

  #showDetail(pageIndex, fromRect) {
    this.mode = 'detail';
    this.current = pageIndex;
    this._over = 0;
    document.body.classList.add('in-detail');
    this.detail.classList.add('is-open');

    this.glide?.destroy();
    this.glide = new Glide(pageIndex * innerWidth, .1);
    this._lastV = undefined;
    this.#apply(this.glide.value);
    this.#syncUI(true);
    this.#preloadRest();
    history.replaceState(null, '', '#' + this.panels[pageIndex].work.id);
    this.app.setTicks(pageIndex + 2);

    if (fromRect) {
      /* 遮罩窗口：从卡片矩形扩张到全屏（真实页面在窗口里已就位） */
      const r = fromRect;
      const inset = `inset(${r.top}px ${innerWidth - r.right}px ${innerHeight - r.bottom}px ${r.left}px)`;
      const anim = this.detail.animate(
        [{ clipPath: inset }, { clipPath: 'inset(0px 0px 0px 0px)' }],
        { duration: FLIP_DUR, easing: FLIP_EASE }
      );
      anim.onfinish = () => {
        anim.cancel();
        this.transitioning = false;
      };
    } else {
      this.transitioning = false;
    }
  }

  jump(pageIndex) {
    if (this.mode !== 'detail') return;
    this.glide.target = clamp(pageIndex * innerWidth, 0, this.max());
  }

  max() { return (this.panels.length - 1) * innerWidth; }

  /* ================= 每帧 ================= */
  #bindFrame() {
    this.app.onFrame(() => {
      if (this.mode !== 'detail' || !this.glide) return;
      this.glide.step();
      const v = this.glide.value;
      if (v !== this._lastV) {
        const vel = this._lastV === undefined ? 0 : v - this._lastV;   // px/帧
        this.#apply(v);
        this.#syncUI(false, vel);
        this._lastV = v;
      }
    });
  }

  #apply(v) {
    this.strip.style.transform = `translate3d(${-v}px,0,0)`;
  }

  /* 当前页 → 换场色 / 轴游标 / 页码信息 / hash */
  #syncUI(force, vel = 0) {
    const idx = clamp(Math.round(this.glide.value / innerWidth), 0, this.panels.length - 1);
    const pn = this.panels[idx];
    this.#preloadAround(idx, vel);

    if (force || pn.work !== this._curWork) {
      this._curWork = pn.work;
      this.app.setWorkTheme(pn.work);
      this.segs.forEach(s => s.classList.toggle('current', s.dataset.work === pn.work.id));
    }
    if (idx !== this._curPage || force) {
      /* 翻页离开时平滑复位该页缩放（回到显示中心） */
      if (this._curPage !== undefined && this.zooms.get(this._curPage)) {
        this.zooms.delete(this._curPage);
        this.#applyZoom(this._curPage, true);
      }
      this._curPage = idx;
      this.ticks.forEach(t => t.classList.toggle('cursor', this.pageOf.get(t.dataset.page) === idx));
      const w = pn.work;
      this.pageinfo.innerHTML =
        `<span class="pg-no">${w.no}</span> / ${w.title}<br>` +
        `${pn.page.toUpperCase()} — ${idx + 1} / ${this.panels.length}`;
      this.app.setTicks(idx + 2);
      history.replaceState(null, '', '#' + w.id);

      /* 停在这一页 1.1s 后才换高清：滑动途中不抢带宽。
         只在桌面、且非省流量 / 非 2G 时自动换；手机等用户主动放大再换 */
      clearTimeout(this._hiT);
      const c = navigator.connection;
      if (innerWidth > 900 && !c?.saveData && !/2g/.test(c?.effectiveType ?? '')) {
        this._hiT = setTimeout(() => {
          if (this.mode === 'detail' && this._curPage === idx) this.#loadHi(idx);
        }, 1100);
      }
    }
  }

  /* ================================================================
     无极滑动：滚轮/拖拽连续位移 + 惯性——滑到哪停到哪，不吸附回整页
     ================================================================ */

  #bindWheel() {
    this.el.addEventListener('wheel', e => {
      if (this.mode === 'index') {
        if (e.deltaY < -50 && this.app.current === 'works') this.app.goto('cover');
        return;
      }
      e.preventDefault();
      if (this.transitioning) return;

      /* Ctrl/Cmd + 滚轮 = 缩放当前页（中心锚定） */
      if (e.ctrlKey || e.metaKey) {
        this.#zoomAt(this._curPage ?? 0, -e.deltaY * 0.0022);
        return;
      }

      const k = e.deltaMode === 1 ? 16 : 1;
      const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      const t = this.glide.target + d * k * 1.1;

      /* 滑到长卷尽头仍继续滚 → 累积过冲，超过阈值即无极退出详情 */
      if (t > this.max() + 2) {
        this._over = (this._over || 0) + d * k;
        this.glide.target = this.max();
        if (this._over > 260) { this._over = 0; this.close(); }
        return;
      }
      this._over = 0;
      this.glide.target = clamp(t, 0, this.max());
    }, { passive: false });
  }

  /* ================================================================
     指针：拖拽横滑（带惯性）/ 放大后平移 / 双指捏合缩放 / 双击缩放
     ================================================================ */
  #bindPointer() {
    const pts = new Map();
    let mode = null;             // 'slide' | 'pan' | 'pinch'
    let startX = 0, startV = 0, lastX = 0, lastT = 0, v = 0;
    let pinchD0 = 0, pinchZ0 = 1, pinchCX = 0, pinchCY = 0;

    const currentZoom = () => {
      const i = this._curPage ?? 0;
      return this.zooms.get(i) ?? { z: 1, x: 0, y: 0 };
    };

    this.detail.addEventListener('pointerdown', e => {
      if (this.mode !== 'detail' || this.transitioning || e.target.closest('button, .axis')) return;
      /* 一律掐断默认行为：拖拽翻页 / 平移时不会起选区、也不会拖出图片 */
      e.preventDefault();
      pts.set(e.pointerId, e);
      this.detail.setPointerCapture(e.pointerId);

      if (pts.size === 2) {
        /* 双指 → 捏合 */
        mode = 'pinch';
        const [a, b] = [...pts.values()];
        pinchD0 = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
        pinchZ0 = currentZoom().z;
        pinchCX = (a.clientX + b.clientX) / 2;
        pinchCY = (a.clientY + b.clientY) / 2;
        return;
      }
      if (pts.size > 2) return;

      const z = currentZoom().z;
      mode = z > 1 ? 'pan' : 'slide';
      startX = lastX = e.clientX; lastT = performance.now(); v = 0;
      startV = this.glide?.target ?? 0;
      if (mode === 'pan') this._panStart = { z: currentZoom(), px: e.clientX, py: e.clientY };
      this._dragging = true;
    });

    this.detail.addEventListener('pointermove', e => {
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, e);

      if (mode === 'pinch' && pts.size >= 2) {
        const [a, b] = [...pts.values()];
        const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
        const target = clamp(pinchZ0 * (dist / (pinchD0 || 1)), 1, 2.6);
        this.#zoomTo(this._curPage ?? 0, target);
        return;
      }
      if (mode === 'pan') {
        const { z } = currentZoom();
        const s = this._panStart;
        const img = this.panelsEls[this._curPage ?? 0]?.querySelector('img');
        img?.classList.add('panning');
        const nx = clamp(s.z.x + (e.clientX - s.px) * 1.4, -(z - 1) * innerWidth / 2, (z - 1) * innerWidth / 2);
        const ny = clamp(s.z.y + (e.clientY - s.py) * 1.4, -(z - 1) * innerHeight / 2, (z - 1) * innerHeight / 2);
        this.zooms.set(this._curPage ?? 0, { z, x: nx, y: ny });
        this.#applyZoom(this._curPage ?? 0);
        return;
      }
      if (mode === 'slide') {
        const dx = e.clientX - lastX;
        const now = performance.now();
        v = v * .7 + (dx / Math.max(now - lastT, 1)) * .3;   // px/ms
        lastX = e.clientX; lastT = now;
        const raw = startV - (e.clientX - startX) * 1.4;
        /* 拖到长卷尽头仍继续拖 → 累积过冲，超过阈值即无极退出 */
        if (raw > this.max() + 2) {
          this._over = (this._over || 0) + Math.max(-dx, 0);
          this.glide.target = this.max();
          if (this._over > 260) { this._over = 0; this.close(); return; }
        } else {
          this._over = 0;
          this.glide.target = clamp(raw, 0, this.max());
        }
      }
    });

    const up = e => {
      if (!pts.has(e.pointerId)) return;
      pts.delete(e.pointerId);
      if (pts.size === 1 && mode === 'pinch') { mode = null; return; }
      if (pts.size) return;
      this._dragging = false;
      this._over = 0;
      this.detail.querySelectorAll('img.panning').forEach(im => im.classList.remove('panning'));

      if (mode === 'slide' && this.glide) {
        /* 惯性：以松手速度抛掷，自由滑行到哪停到哪 */
        this.glide.target = clamp(this.glide.target - v * 220, 0, this.max());
      }
      mode = null;
    };
    this.detail.addEventListener('pointerup', up);
    this.detail.addEventListener('pointercancel', up);
    this.detail.addEventListener('dragstart', e => e.preventDefault());
    this.detail.addEventListener('selectstart', e => e.preventDefault());

    /* 双击缩放（中心锚定） */
    this.detail.addEventListener('dblclick', e => {
      if (this.mode !== 'detail' || e.target.closest('button, .axis')) return;
      e.preventDefault();                       // 避免双击选中整张图
      const i = this._curPage ?? 0;
      const cur = this.zooms.get(i)?.z ?? 1;
      if (cur > 1) { this.zooms.delete(i); this.#applyZoom(i, true); }
      else this.#zoomTo(i, 1.8);
    });
  }

  /* ---------- 缩放（始终以屏幕中心为锚：放大后图片中心 = 屏幕中心） ---------- */
  #zoomTo(i, z) {
    z = clamp(z, 1, 2.6);
    if (z === 1) { this.zooms.delete(i); this.#applyZoom(i, true); return; }
    /* 一放大就换高清图：低清图先顶着，高清解码完无缝替换 */
    if (z > 1.12) this.#loadHi(i);
    /* 无极滑动可能停在页间——首次放大时先把该页平滑对齐到整页位置，
       使图框中心正好落在屏幕中心（随后长卷停在整页上） */
    const prev = this.zooms.get(i)?.z ?? 1;
    if (prev === 1 && this.glide && this.mode === 'detail')
      this.glide.target = clamp(i * innerWidth, 0, this.max());
    this.zooms.set(i, { z, x: 0, y: 0 });
    this.#applyZoom(i);
  }

  #zoomAt(i, dz) {
    const cur = this.zooms.get(i)?.z ?? 1;
    this.#zoomTo(i, cur * (1 + dz));
  }

  #applyZoom(i, smooth = false) {
    const img = this.panelsEls[i]?.querySelector('img');
    if (!img) return;
    const s = this.zooms.get(i);
    if (smooth) {
      /* 复位过渡：放大/平移过的页面平滑滑回显示中心 */
      img.style.transition = 'transform .75s cubic-bezier(.22, .8, .3, 1)';
      clearTimeout(img._zt);
      img._zt = setTimeout(() => { img.style.transition = ''; }, 780);
    }
    img.style.transform = s ? `translate(${s.x}px, ${s.y}px) scale(${s.z})` : '';
    img.style.zIndex = s ? 2 : '';
  }

  #applyZooms() { this.panelsEls.forEach((_, i) => this.#applyZoom(i)); }

  /* ================= 键盘 ================= */
  #bindKeys() {
    this.app.onKey(h => {
      if (this.mode !== 'detail') return;
      const cur = Math.round((this.glide?.target ?? 0) / innerWidth);
      if (h === 'ArrowRight' || h === 'PageDown') this.jump(clamp(cur + 1, 0, this.panels.length - 1));
      if (h === 'ArrowLeft'  || h === 'PageUp')   this.jump(clamp(cur - 1, 0, this.panels.length - 1));
      if (h === 'Escape') this.close();
      if (h === 'Home') this.jump(0);
      if (h === 'End')  this.jump(this.panels.length - 1);
      if (h === 'Shift+ArrowRight') this.#jumpWork(1);
      if (h === 'Shift+ArrowLeft')  this.#jumpWork(-1);
    });
  }

  #jumpWork(dir) {
    const i = clamp(this._curWork ? this.works.indexOf(this._curWork) + dir : 0, 0, this.works.length - 1);
    const w = this.works[i];
    this.jump(this.pageOf.get(w.id + '|' + w.pages[0]));
  }

  /* hash 深链 #w03 */
  openFromHash(hash) {
    if (this.mode === 'detail') return false;
    const w = this.works.find(w => w.id === hash);
    if (!w) return false;
    this.open(this.works.indexOf(w));
    return true;
  }
}
