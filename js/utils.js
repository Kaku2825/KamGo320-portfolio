/* utils.js — 小工具：rAF 主循环 / 数学 / 缓动 */

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp  = (a, b, t) => a + (b - a) * t;
export const easeInOut = t => t < 0.5 ? 2*t*t : 1 - Math.pow(-2*t + 2, 2) / 2;
export const easeOut = t => 1 - Math.pow(1 - t, 3);

/* 单一 rAF 循环，各模块订阅；避免多个循环互抢帧 */
const subs = new Set();
let running = false;
let last = 0;

function tick(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  for (const fn of subs) fn(dt, now / 1000);
  if (subs.size) requestAnimationFrame(tick);
  else running = false;
}

export function onFrame(fn) {
  subs.add(fn);
  if (!running) { running = true; last = performance.now(); requestAnimationFrame(tick); }
  return () => subs.delete(fn);
}

/* 目标值追踪器：每帧向 target 逼近（横向滑动的"惯性感"来源） */
export class Glide {
  constructor(value = 0, stiffness = 0.085) {
    this.value = value; this.target = value; this.k = stiffness;
    this.off = onFrame(() => this.step());
  }
  step() {
    const d = this.target - this.value;
    if (Math.abs(d) < 0.05) this.value = this.target;
    else this.value = lerp(this.value, this.target, this.k);
  }
  destroy() { this.off(); }
}

/* 只在 idle 时触发一次 */
export function onIdle(fn) {
  if ('requestIdleCallback' in window) requestIdleCallback(fn);
  else setTimeout(fn, 200);
}
