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
    (cardId) => {
      if (mode !== 'daily') return
      const payload = { date: todayKey(), cardId }
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
