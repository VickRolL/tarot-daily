/**
 * 雾气层：三条不同速度、不同方向的光雾带，构成常驻循环动画的主体。
 *
 * `intense`（2026-09-19）：抽牌蓄势期把雾「揪紧」—— 浓度提高、亮度略提。
 * 走 CSS 过渡而不是改 `animation-duration`：改 duration 会让正在跑的关键帧
 * 按新时长重算进度，雾带会**瞬间跳一下**（进度 = 已用时长 / 新时长）。
 */
export default function MistLayer({ intense = false }) {
  return (
    <div className={`mist${intense ? ' mist--intense' : ''}`} aria-hidden="true">
      <div className="mist__band mist__band--1" />
      <div className="mist__band mist__band--2" />
      <div className="mist__band mist__band--3" />
    </div>
  )
}
