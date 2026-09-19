#!/usr/bin/env node
/**
 * ============================================================================
 * 标题字体子集下载器（第二十三轮追加，第二十四轮修正）
 * ----------------------------------------------------------------------------
 * 用法：
 *     node scripts/fetch-title-fonts.mjs
 *
 * 干什么：
 *     用 Google Fonts CSS2 的 `text=` 端点，把「只要这几个字」的字体子集
 *     （woff2）抓下来，落到 src/assets/fonts/。整个站点的标题字体就是这
 *     几个 1~7KB 的小文件，零 CDN、零运行时请求。
 *
 * ★ 为什么要有这个脚本（血泪）：
 *   第二十三轮我手搓了个一次性 fetch，把 `text=` 里没做百分号编码的 `·`
 *   直接塞进 URL，Google 回了 **HTTP 400 的 HTML 错误页**，我把它当字体存成了
 *   `title-latin.woff2`（1.7KB，内容开头是 `<html lang="en" ...Error 400`）。
 *   浏览器遇到坏字体是**静默回退**的，页面照常渲染，肉眼完全看不出，
 *   于是「标题用了罗马碑刻体」这个结论就一直挂在那儿，直到第二十四轮
 *   构建产物里发现有段 data URI 解出来是 HTML 才露馅。
 *
 *   所以本脚本把「校验」写进流程里，而不是靠人记得：
 *     ① text= 一律 encodeURIComponent（URL 里绝不出现裸非 ASCII）
 *     ② 落盘前**先验魔数**：真 woff2 前 4 字节必须是 `wOF2`
 *     ③ 校验不过 → 直接抛错退出（exit 1），绝不写一个坏文件到 src/
 *     ④ 校验不过时把响应体的开头打出来，好认到底是不是错误页
 *
 * 追加新字体：往 SPECS 里加一条，重跑即可（幂等，会覆盖同名文件）。
 * ============================================================================
 */

import fs from 'node:fs/promises';
import path from 'node:path';

const OUT_DIR = path.resolve(process.cwd(), 'src/assets/fonts');

/* 必须带桌面 Chrome 的 UA：Google 按 UA 决定给 woff2 还是给 ttf。
   用 node 默认 UA 会拿到旧格式，体积大好几倍。 */
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

/**
 * 每一行 = 一个 @font-face 实例。
 *
 * text 里必须写**穷尽**该字体族实际会渲染到的每一个字 ——
 * 少一个字，那个字会在运行时逐字符回退到 stack 里的下一个字体，
 * 表现为「同一行里两种字体」，而且同样不报错。
 * 所以下面每个 text 都精确对应一处用法，改文案时这里也要跟着改。
 */
const SPECS = [
  {
    out: 'title-latin.woff2',
    /* 罗马碑刻体。只用于 .topbar__brand 的 "TAROT" 与它中间的分隔点。
       （标题「今夜一签」和副标题里没有拉丁字母。） */
    family: 'Cinzel:wght@400..900',
    text: 'TAROT·',
    note: 'TAROT · 日签 → 拉丁部分',
  },
  {
    out: 'title-han.woff2',
    /* 900 字重只管主标题「今夜一签」四个字。 */
    family: 'Noto Serif SC:wght@900',
    text: '今夜一签',
    note: '主标题',
  },
  {
    out: 'title-han-400.woff2',
    /* 400 字重管：顶栏品牌里的「日签」+ 全部副标题文案。
       副标题四种取值（App.jsx 的 headlineSub）：
         「这张牌，是今天的答案」
         「今日之牌已抽出 · 明日再来」
         「静心片刻，想着你此刻的疑问」
         仪式期间为空字符串（渲染成 nbsp，不需要字形）
       下面是这几句 + 「日签」的并集，末尾再塞一个普通空格兜底。 */
    family: 'Noto Serif SC:wght@400',
    text: '日签这张牌，是今天的答案已抽出·明日再来静心片刻想着你此刻的疑问 ',
    note: '品牌「日签」+ 全部副标题文案',
  },
];

const WOFF2_MAGIC = 'wOF2';

function cssUrl(spec) {
  return (
    `https://fonts.googleapis.com/css2?family=${spec.family}` +
    `&text=${encodeURIComponent(spec.text)}&display=swap`
  );
}

/** 抓 CSS，取出唯一那条 @font-face 里的 woff2 地址 */
async function resolveWoff2Url(spec) {
  const url = cssUrl(spec);
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  const body = await res.text();

  if (!res.ok) {
    throw new Error(
      `CSS2 端点返回 HTTP ${res.status}\n  URL: ${url}\n  响应开头: ${body.slice(0, 160)}`
    );
  }

  const urls = [...body.matchAll(/url\((https:\/\/[^)]+)\)/g)].map((m) => m[1]);
  if (urls.length === 0) {
    throw new Error(
      `CSS 里没有 url()，说明字体族/字重名写错了或该字符集无子集\n  URL: ${url}\n  CSS: ${body.slice(0, 240)}`
    );
  }
  /* 给了 text= 时 Google 只回一条 @font-face，取最后一条最稳 */
  return urls[urls.length - 1];
}

/** 下载 + ★ 魔数校验 —— 这是整个脚本存在的理由 */
async function downloadWoff2(url, spec) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  const buf = Buffer.from(await res.arrayBuffer());

  if (!res.ok) {
    throw new Error(
      `字体下载返回 HTTP ${res.status}\n  URL: ${url}\n  响应开头: ${buf.subarray(0, 160).toString('utf8')}`
    );
  }

  const magic = buf.subarray(0, 4).toString('latin1');
  if (magic !== WOFF2_MAGIC) {
    /* 最典型的情况：拿到了一个 HTML 错误页（第二十三轮就是这么翻车的） */
    throw new Error(
      `不是 woff2！magic=${JSON.stringify(magic)}（应为 ${JSON.stringify(WOFF2_MAGIC)}）\n` +
        `  ${spec.out} ← ${url}\n` +
        `  响应开头: ${buf.subarray(0, 160).toString('utf8').replace(/\s+/g, ' ')}`
    );
  }
  if (buf.length < 512) {
    throw new Error(`${spec.out} 只有 ${buf.length} 字节，小到不可能是有效字体`);
  }
  return buf;
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });

  const rows = [];
  let failed = 0;

  for (const spec of SPECS) {
    const label = spec.out.padEnd(22);
    try {
      const woff2Url = await resolveWoff2Url(spec);
      const buf = await downloadWoff2(woff2Url, spec);
      await fs.writeFile(path.join(OUT_DIR, spec.out), buf);
      rows.push([label, `${(buf.length / 1024).toFixed(2)} KB`, spec.note]);
      console.log(`  OK   ${label} ${(buf.length / 1024).toFixed(2)} KB  (${spec.note})`);
    } catch (err) {
      failed += 1;
      rows.push([label, 'FAILED', spec.note]);
      console.error(`  FAIL ${label} ${err.message}`);
    }
  }

  const total = SPECS.length;
  console.log(`\n  ${total - failed}/${total} 个子集写入 ${path.relative(process.cwd(), OUT_DIR)}`);
  if (failed > 0) {
    console.error('  有字体没抓到 —— 不要提交，先修 SPECS。');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
