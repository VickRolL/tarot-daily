/**
 * 牌面预热
 * ---------------------------------------------------------------
 * 22 张牌面加起来约 5.1 MB，绝对不能进首页就全量下载。
 * 但完全不预热的话，第一次抽牌会出现「牌飞出来了、插画还在下载」的空档。
 *
 * 策略：
 *   1) 入场动画结束后，趁浏览器空闲**随机**预热 PREFETCH_COUNT 张
 *      （一天只抽一次，随机预热把「抽中即秒出」的概率铺开，而不是死磕前 3 张）
 *   2) 每次抽到牌之后，再随机补几张没下过的
 * 已经预热过的牌不会被重复请求。
 *
 * 说明：只预热 .webp —— 素材流水线固定导出 webp；若某张只有 .png，
 * 这次预热会 404 并在真正渲染时由 SmartImage 回退，功能不受影响。
 */
import { ASSETS, PREFETCH_COUNT } from '../config/skin'

const warmed = new Set()

function whenIdle(cb) {
  if (typeof window === 'undefined') return
  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(cb, { timeout: 3000 })
  } else {
    window.setTimeout(cb, 500)
  }
}

/**
 * 从候选牌号里随机挑 count 张还没预热过的做后台预加载。
 * @param {string[]} ids 全部候选牌号
 * @param {number} [count]
 * @returns {string[]} 本次实际预热的牌号
 */
export function prefetchCards(ids, count = PREFETCH_COUNT) {
  if (typeof window === 'undefined' || !Array.isArray(ids) || !ids.length) return []

  const pool = ids.filter((id) => !warmed.has(id))
  // Fisher-Yates 洗牌，避免每次刷新都预热同一批
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = pool[i]
    pool[i] = pool[j]
    pool[j] = tmp
  }

  const picks = pool.slice(0, Math.max(0, count))
  picks.forEach((id) => {
    warmed.add(id)
    whenIdle(() => {
      const img = new Image()
      img.decoding = 'async'
      img.src = ASSETS.cardFace(id)[0]
    })
  })
  return picks
}

/** 已经渲染过的牌记一笔，后续不再重复预热 */
export function markCardWarmed(id) {
  if (id) warmed.add(id)
}
