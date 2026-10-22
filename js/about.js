/* about.js — 关于我板块
   左侧巨型字标（Big Shoulders）+ 底部状态行，
   右侧 A/B/C 键位数据列（FOCUS / CONTACT）。 */

import { SITE } from './data.js?v=15';

export function renderAbout(el, app) {
  const a = SITE.about;

  const rowHTML = r => {
    let val;
    if (r.copy) {
      val = `<a href="#" data-copy="${r.text}" class="val-link">${r.text} <span class="glyph">⧉</span></a>`;
    } else if (r.href) {
      val = `<a href="${r.href}" class="val-link" target="_blank" rel="noopener">${r.text} <span class="glyph">↗</span></a>`;
    } else {
      val = `<span class="val-plain">${r.text}</span>`;
    }
    return `<p class="col-row"><span class="key">${r.key}</span><span class="lab">${r.label}</span>${val}</p>`;
  };

  el.innerHTML = `
    <div class="about">
      <div class="about-mark">
        ${a.wordmark.map((l, i) => `
          <span class="cover-line ${l.style}"><span class="ln" style="animation-delay:${i * 90 + 150}ms">${l.text}</span></span>`).join('')}
      </div>

      <div class="about-status">
        ${a.status.map((s, i) => `<span class="${i ? 'dim' : ''}">${s}</span>`).join('')}
      </div>

      <div class="about-cols">
        ${a.cols.map((c, ci) => `
          <div class="about-col" style="--d:${ci * 110 + 350}ms">
            <p class="col-head">${c.head}</p>
            ${c.rows.map(rowHTML).join('')}
          </div>`).join('')}
      </div>
    </div>`;
}
