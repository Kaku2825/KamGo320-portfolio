/* cover.js — L1 封面
   巨型字母逐字堆叠（每行不同处理）、
   细竖线 + 旋转 SCROLL/DRAG、右下角计数、大圆几何点缀、纯黑底。 */

export function renderCover(el, app) {
  const c = app.data.cover;
  let gi = 0;

  el.innerHTML = `
    <div class="section-inner cover">
      <span class="cover-circle" aria-hidden="true"></span>
      <span class="cover-cross" aria-hidden="true"></span>

      <h1 class="cover-title" id="cover-title">
        ${c.lines.map(l => `
          <span class="cover-line ${l.style}" aria-label="${l.text}">
            ${[...l.text].map(ch => {
              const s = ch === ' ' ? '&nbsp;' : ch;
              return `<span class="ch" style="--i:${gi++}">${s}</span>`;
            }).join('')}
          </span>`).join('')}
      </h1>

      <p class="cover-tag">${c.tag}</p>

      <div class="cover-divider" aria-hidden="true">
        <span class="divider-arrow"></span>
        <span class="divider-text">SCROLL&nbsp;/&nbsp;DRAG</span>
      </div>

      <p class="cover-pct" id="cover-pct">00%</p>

      <button class="cover-enter" id="cover-enter">
        <span>进入作品集</span><span class="arrow"></span>
      </button>

      <!-- 交互提示：紧跟「进入作品集」下方 -->
      <p class="cover-hint" aria-hidden="true">滚动鼠标 / 向左滑动</p>

      <div class="cover-marquee" aria-hidden="true">
        <div class="mq-track" id="mq-track"></div>
      </div>
    </div>`;

  /* 巨字鼠标视差（极轻） */
  const title = el.querySelector('#cover-title');
  let tx = 0, ty = 0, cx = 0, cy = 0;
  window.addEventListener('pointermove', e => {
    tx = (e.clientX / innerWidth - .5) * 14;
    ty = (e.clientY / innerHeight - .5) * 8;
  });
  app.onFrame(() => {
    if (app.current !== 'cover') return;
    cx += (tx - cx) * .04;
    cy += (ty - cy) * .04;
    title.style.transform = `translate(${cx}px, ${cy}px)`;
  });

  /* 升起动画结束后解除 animation 锁定，让字母可被悬停"拨动" */
  el.querySelectorAll('.cover-title .ch').forEach(ch =>
    ch.addEventListener('animationend', () => ch.classList.add('done'), { once: true }));

  /* 底部跑马灯字条 */
  const mqText = 'ARCHITECTURE PORTFOLIO — SELECTED WORKS 2022—2026 — SPACE · LIGHT · ORDER — ';
  el.querySelector('#mq-track').innerHTML =
    `<span>${mqText.repeat(3)}</span><span>${mqText.repeat(3)}</span>`;

  /* 右下角计数：00% → READY（装饰，呼应参考站） */
  const pct = el.querySelector('#cover-pct');
  let n = 0;
  const t0 = performance.now();
  app.onFrame(() => {
    if (app.current !== 'cover' || n >= 100) return;
    n = Math.min(100, Math.floor((performance.now() - t0) / 14));
    pct.textContent = String(n).padStart(2, '0') + '%';
    if (n >= 100) setTimeout(() => { pct.textContent = 'READY'; }, 350);
  });

  el.querySelector('#cover-enter').addEventListener('click', () => app.goto('works'));

  /* 封面上滚轮向下 = 进作品集 */
  el.addEventListener('wheel', e => {
    if (app.current !== 'cover' || app.transitioning) return;
    if (e.deltaY > 40) app.goto('works');
  }, { passive: true });

  /* 长按拖动 / 滑动 = 进作品集：向下拖或向左拖过阈值即进入，
     与滚轮、按钮同一出口；按住文字也不起选区（全站已禁选）。
     触屏上纵向两个方向都算"推进"——竖屏随手滑，或把手机横过来但系统
     仍锁竖屏时（手指"横向"的滑动在系统里是竖向），都能进作品集 */
  let drag = null;
  el.addEventListener('pointerdown', e => {
    if (app.current !== 'cover' || e.button !== 0) return;
    if (e.target.closest('button, a')) return;
    drag = { x: e.clientX, y: e.clientY, touch: e.pointerType === 'touch' };
  });
  el.addEventListener('pointerup', e => {
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    const touch = drag.touch;
    drag = null;
    if (app.current !== 'cover' || app.transitioning) return;
    if (dy > 60 || dx < -60 || (touch && dy < -60)) app.goto('works');
  });
  el.addEventListener('pointercancel', () => { drag = null; });
}
