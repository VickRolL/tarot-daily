import { useCallback, useEffect, useState } from 'react'
import { STORAGE_KEY } from '../config/skin'

function todayKey() {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

/**
 * 同步读取「今天」的抽牌记录。
 *
 * 抽出来单独导出，是因为它在**首次渲染前**就要能拿到值 ——
 * App 需要在这一刻决定要不要播迎接动画（WELCOME.skipWhenDrawn），
 * 而 useState 的初始化函数里没法等 effect。useDrawState 内部也复用它。
 */
export function readTodayRecord() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed && parsed.date === todayKey() ? parsed : null
  } catch (err) {
    console.warn('[tarot] 本地记录读取失败，已忽略', err)
    return null
  }
}

/**
 * 抽牌状态
 * mode = 'unlimited'：随便抽，不落盘
 * mode = 'daily'    ：一天锁一次，记录存本地，刷新后仍是同一张牌
 *
 * 记录里除了 `cardId`，还存 **`adviceIndex`**（第三十二轮）：这张牌今天给的是
 * 第几条今日建议。为什么必须一起存 —— 建议是抽牌那一刻从 3~5 条里随机取的，
 * 不记住的话，「刷新 → 看到同一张牌、却换了一句建议」，所谓「今日建议」
 * 就自相矛盾了（而且分享图上的字也会和页面上不一致）。
 *
 * 旧记录（没有 adviceIndex 这个字段）读回来是 `undefined` —— 这是**正常情况**，
 * 不要报错也不要现随机一条：`adviceAt()` 会退回第 0 条，同一天内保持稳定。
 */
export function useDrawState(mode) {
  const [record, setRecord] = useState(null)

  useEffect(() => {
    if (mode !== 'daily') {
      setRecord(null)
      return
    }
    setRecord(readTodayRecord())
  }, [mode])

  const canDraw = mode !== 'daily' || !record

  const save = useCallback(
    (cardId, adviceIndex) => {
      if (mode !== 'daily') return
      const payload = { date: todayKey(), cardId }
      if (Number.isInteger(adviceIndex)) payload.adviceIndex = adviceIndex
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
      } catch (err) {
        console.warn('[tarot] 本地记录写入失败，本次不落盘', err)
      }
      setRecord(payload)
    },
    [mode]
  )

  const reset = useCallback(() => {
    try {
      window.localStorage.removeItem(STORAGE_KEY)
    } catch (err) {
      console.warn('[tarot] 本地记录清除失败', err)
    }
    setRecord(null)
  }, [])

  return { record, canDraw, save, reset }
}
