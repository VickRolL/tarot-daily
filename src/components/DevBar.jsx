import { DRAW_MODE, INITIAL_MODE, STORAGE_KEY } from '../config/skin'

/**
 * 开发调试条：切换抽牌模式、重置今日记录、重播迎接动画。
 *
 * ⚠️ 2026-09-20：「牌面总览」按钮**已移除**。图鉴这一轮放开给用户了（入口在顶栏
 * 「牌之图鉴」），两边打开的是同一个覆盖层，留着就是两个入口做同一件事。
 * 素材核对的活本来就该交给脚本（`contact_sheet.py`），不该占调试条一格。
 *
 * 只在 `DEV_TOOLS` 为真时渲染（本地开发 + 开发者版构建），正式产物里整块被摇掉。
 * 打开页面默认模式是 `INITIAL_MODE`：开发者版 = 不限次数，正式版 = 一天一次。
 *
 * ⚠️ 布局是**竖排定宽的窄条**（`.devbar` 里写了原因）：它和解读面板的动作行都贴底，
 * 横排时长条会**盖住「再抽一次」**，鼠标点不到。所以这里不要改回横排，
 * 也不要把长文案（存储键名之类）放回可见文本 —— 那会把宽度重新撑开。
 * 长信息走 `title` 悬停提示。
 */
export default function DevBar({
  mode,
  onModeChange,
  onReset,
  hasRecord,
  onReplayWelcome,
  welcomeEnabled
}) {
  return (
    <div className="devbar" title={`初始模式 ${INITIAL_MODE} · 正式版默认 ${DRAW_MODE} · 存储键 ${STORAGE_KEY}`}>
      <span className="devbar__cap">抽牌模式</span>
      <button type="button" data-active={mode === 'unlimited'} onClick={() => onModeChange('unlimited')}>
        不限次数
      </button>
      <button type="button" data-active={mode === 'daily'} onClick={() => onModeChange('daily')}>
        一天一次
      </button>
      <button type="button" onClick={onReset} disabled={!hasRecord}>
        重置今日
      </button>
      <button type="button" onClick={onReplayWelcome} disabled={!welcomeEnabled}>
        重播迎接
      </button>
      <span className="devbar__cap">初始 {INITIAL_MODE}</span>
    </div>
  )
}
