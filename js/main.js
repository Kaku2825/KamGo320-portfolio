/* main.js — 应用入口：板块推进 / 导航 / 刻度 / hash 路由 */

import { SITE } from './data.js?v=17';
import { onFrame } from './utils.js?v=17';
import { renderCover } from './cover.js?v=17';
import { WorksSection } from './works.js?v=17';
import { renderAbout } from './about.js?v=17';

class App {
  constructor() {
    this.data = SITE;
    this.current = null;
    this.transitioning = false;
    this.keyHandlers = new Set();

    this.#buildNav();
    this.#buildTicks();
    this.#buildSections();
    this.#bindGlobal();

    /* 初始板块：hash > cover；#w03 之类的深链 → works + 自动展开 */
    const hash = location.hash.replace('#', '');
    const isDeepWork = this.data.works.some(w => w.id === hash);
    const want = isDeepWork ? 'works' : hash;
    const startId = (want === 'works' || want === 'about') && this.#ready(want) ? want : 'cover';
    this.goto(startId, true);
    if (isDeepWork) setTimeout(() => this.works.openFromHash(hash), 1100);

    /* 同文档 hash 变化（如 #works → #w03）也走深链 */
    addEventListener('hashchange', () => {
      const h = location.hash.replace('#', '');
      if (h === 'about') {
        if (!this.#ready('about')) {
          /* 板块未开放：hash 回写为当前实际所在板块，视图不动 */
          history.replaceState(null, '', '#' + (this.current || 'cover'));
          return;
        }
        if (this.current !== 'about') this.goto('about');
        return;
      }
      if (!this.data.works.some(w => w.id === h)) return;
      if (this.current !== 'works') { this.goto('works'); setTimeout(() => this.works.openFromHash(h), 1100); }
      else if (this.works.mode === 'index') this.works.openFromHash(h);
    });
  }

  /* 板块是否开放（about 等未 ready 的板块不可进入、不占刻度） */
  #ready(id) {
    if (id === 'cover') return true;
    const b = this.data.blocks.find(x => x.id === id);
    return !!b && b.ready;
  }

  /* ---------- 导航 ---------- */
  #buildNav() {
    const nav = document.querySelector('.frame-nav');
    nav.innerHTML = this.data.blocks.map(b => `
      <a class="nav-item ${b.ready ? '' : 'locked'}" data-nav="${b.id}" href="#${b.id}">
        ${b.nav}${b.ready ? '' : '<span class="soon">SOON</span>'}
      </a>`).join('');
    nav.addEventListener('click', e => {
      const a = e.target.closest('.nav-item');
      if (!a) return;
      e.preventDefault();
      if (a.classList.contains('locked')) {
        const label = a.childNodes[0].textContent.trim();
        this.toast('「' + label + '」板块开发中 — COMING SOON');
        return;
      }
      this.goto(a.dataset.nav);
    });
  }

  #buildTicks() {
    const pages = this.data.works.reduce((n, w) => n + w.pages.length, 0);
    const total = pages + 2 + (this.#ready('about') ? 1 : 0);   // 封面 + 作品集入口（+ 关于我）
    document.getElementById('ticks').innerHTML =
      Array.from({ length: total }, (_, i) => `<span class="tick" style="--i:${i}"></span>`).join('');
    this.tickEls = [...document.querySelectorAll('#ticks .tick')];

    /* 左下角作品索引计数 */
    const cnt = document.getElementById('index-count');
    if (cnt) cnt.textContent = 'INDEX — ' + String(this.data.works.length).padStart(2, '0') + ' PROJECTS';
  }

  setTicks(i) {
    this.tickEls.forEach((t, k) => t.classList.toggle('on', k === i));
  }

  /* ---------- 板块 ---------- */
  #buildSections() {
    this.sections = {
      cover: document.getElementById('sec-cover'),
      works: document.getElementById('sec-works'),
      about: document.getElementById('sec-about'),
    };
    renderCover(this.sections.cover, this);
    this.works = new WorksSection(this.sections.works, this);
    /* 关于我暂时关闭：section 保留但不渲染内容，导航也置灰不可进 */
    if (this.#ready('about')) renderAbout(this.sections.about, this);
    else this.sections.about.innerHTML = '';
  }

  goto(id, instant = false) {
    if (this.current === id || this.transitioning || !this.sections[id] || !this.#ready(id)) return;

    this.transitioning = instant;
    const from = this.current;
    this.current = id;

    if (from) {
      this.sections[from].classList.remove('is-active', 'is-left');
      if (from === 'works') this.works.close?.();
    }
    /* 目标从哪一侧进入：回封面 → 左侧；去作品集 → 右侧 */
    const el = this.sections[id];
    if (id === 'cover') el.classList.add('is-left');
    void el.offsetWidth;                       // 强制回流，保证过渡生效
    if (instant) {                             // 首屏直达：跳过推进动画
      el.style.transition = 'none';
      el.classList.add('is-active');
      void el.offsetWidth;
      el.style.transition = '';
    } else {
      el.classList.add('is-active');
    }

    /* 详情开着时退回作品集入口 → 先关详情 */
    if (id === 'works') {
      document.body.classList.remove('in-detail');
      this.works.detail?.classList.remove('is-open');
      this.works.mode = 'index';
      this.setWorkTheme(null);
    }

    /* 封面是板块的上一级：不显示四角外框，封面自成海报 */
    document.body.classList.toggle('on-cover', id === 'cover');

    this.#syncNav();
    this.setTicks(id === 'cover' ? 0 : id === 'about' ? this.tickEls.length - 1 : 1);
    setTimeout(() => { this.transitioning = false; }, instant ? 60 : 950);
    history.replaceState(null, '', '#' + id);
  }

  #syncNav() {
    document.querySelectorAll('.nav-item').forEach(a =>
      a.classList.toggle('active', a.dataset.nav === this.current));
  }

  /* ---------- 作品场色注入 ---------- */
  setWorkTheme(work) {
    const r = document.documentElement.style;
    if (!work) {
      r.setProperty('--work-field', this.data.theme.field);
      r.setProperty('--work-ink', this.data.theme.ink);
      r.setProperty('--work-hl', this.data.theme.hl);
    } else {
      r.setProperty('--work-field', work.field);
      r.setProperty('--work-ink', work.ink);
      r.setProperty('--work-hl', work.hl);
    }
  }

  /* ---------- 全局输入 ---------- */
  onKey(fn) { this.keyHandlers.add(fn); }

  #bindGlobal() {
    addEventListener('keydown', e => {
      const key = (e.shiftKey ? 'Shift+' : '') + e.key;
      for (const fn of this.keyHandlers) fn(key);
    });

    document.querySelectorAll('[data-nav]').forEach(a =>
      a.addEventListener('click', e => {
        if (a.classList.contains('nav-item')) return;
        e.preventDefault();
        this.goto(a.dataset.nav);
      }));

    /* 手机竖屏引导：点「仍然竖屏浏览」后本次会话不再拦截 */
    const rhSkip = document.getElementById('rh-skip');
    if (rhSkip) {
      try { if (sessionStorage.getItem('rh-allow') === '1') document.body.classList.add('allow-portrait'); } catch {}
      rhSkip.addEventListener('click', () => {
        document.body.classList.add('allow-portrait');
        try { sessionStorage.setItem('rh-allow', '1'); } catch {}
      });
    }

    /* 微信号复制（事件委托：复制入口在 footer / about 板块都可能存在） */
    const toast = document.getElementById('toast');
    let timer;
    this.toast = msg => {
      toast.textContent = msg;
      toast.classList.add('show');
      clearTimeout(timer);
      timer = setTimeout(() => toast.classList.remove('show'), 2200);
    };
    document.addEventListener('click', async e => {
      const t = e.target.closest('[data-copy]');
      if (!t) return;
      e.preventDefault();
      const val = t.dataset.copy;
      try { await navigator.clipboard.writeText(val); this.toast('微信号已复制 — ' + val); }
      catch { this.toast('微信号：' + val); }
    });
  }

  onFrame(fn) { onFrame(fn); }
}

new App();
