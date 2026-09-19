// 让页面自己报出「脸椭圆」在屏幕上的落点（CSS px），用于从截图里精确裁剪验收。
// 用法：shot.mjs <url> <out.png> --w W --h H --eval-file scripts/flows/probe-face-rect.js
const f = document.querySelector('.hero-frame');
if (!f) return { err: 'no .hero-frame' };
const r = f.getBoundingClientRect();
const px = (x) => r.left + r.width * x / 100;
const py = (y) => r.top + r.height * y / 100;
const orb = document.querySelector('.orb');
return {
  innerW: innerWidth, innerH: innerHeight, dpr: devicePixelRatio,
  frame: { left: +r.left.toFixed(1), top: +r.top.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1) },
  faceBox: { x0: +px(51).toFixed(1), y0: +py(21).toFixed(1), x1: +px(66).toFixed(1), y1: +py(39).toFixed(1) },
  orbRect: orb ? (() => { const o = orb.getBoundingClientRect(); return { l: +o.left.toFixed(1), t: +o.top.toFixed(1), w: +o.width.toFixed(1), h: +o.height.toFixed(1) }; })() : null,
};
