import { useEffect, useRef } from 'react'
import { ASSETS } from '../config/skin'

/**
 * 3D 水晶球（three.js）—— 全站唯一的新运行时依赖，也是项目唯一批准的例外。
 *
 * ---------------------------------------------------------------------------
 * 为什么是「自身发光的实心球」而不是「折射背景的玻璃球」
 *
 * three 的 `transmission` 采样的是**场景环境**，不是 canvas 背后的 DOM。
 * 也就是说「球体折射出背景里的女巫」这条路在 WebGL 里走不通 ——
 * 除非把女巫也放进 3D 场景（那等于重做整个背景，与「2D 层不动」的决定冲突）。
 * 所以处方是：**内部程序化星云 + 冷蓝菲涅尔边缘 + 镜面高光**，
 * 光的观感由着色器自己给，不依赖环境贴图。连带约束：主视觉球位空区里
 * 不许画任何辉光（已由 scripts/fix_hero_void.py 保证）。
 *
 * ---------------------------------------------------------------------------
 * 三条不能破的架构约束
 *
 * ① **这个 canvas 绝对不能放进 `.hero-plate`。**
 *    plate 挂着 `bgBreath`（14s，scale 1 → 1.028 的呼吸）。canvas 被 CSS 缩放
 *    等于把渲染好的位图拉伸，球会明显发糊。所以球留在 `.hero-frame` 层，
 *    与 `.orb` 同级 —— 它也正因此**不跟着底板呼吸缩放**（这是刻意的）。
 * ② **`.orb` 的 hover/active/charging 缩放仍然有效**：canvas 是 `.orb` 的子元素，
 *    所以按下时球跟着缩，手感与 2D 时代一致。
 * ③ **无 WebGL / 纹理失败 / three 拉不下来 → 一律降级**（`onFail`）。
 *    此时组件不渲染 canvas，2D 球（`.orb__body`，含 hero-orb 素材）原样顶上，
 *    页面不会出现空洞。
 *
 * ---------------------------------------------------------------------------
 * 渲染成本：每像素 = 1 次贴图采样 + 2 次点积 + 几个 pow。
 * 星云噪声全部在**构建期**烤进贴图（scripts/build_orb_texture.py），运行时零噪声计算。
 */

/** 相机垂直 FOV（度）。小球用长焦，透视畸变小，边缘不会被拉成椭圆。 */
const FOV = 30
/**
 * 球体投影直径 / canvas 高度。
 * canvas 比 `.orb` 盒子大 4%（见 CSS 的 `inset: -2%`），
 * 于是实体球的屏幕直径 = orb-size × 1.04 × 0.962 ≈ orb-size —— 与锚点一致。
 */
const ORB_FILL = 0.962
const DPR_MAX = 2
/** 指针视差的最大旋转角（弧度）。再大就会把贴图两极的暗区转到正面来。 */
const YAW_MAX = 0.13
const PITCH_MAX = 0.085
/** 光方向随指针偏移的最大量 */
const LIGHT_SHIFT = 0.22
/**
 * 自转角速度（弧度/秒）。一圈约 180s。
 *
 * 为什么要自转：球面贴图是固定的，静止时某个方位可能恰好落在星云的空白区
 * （实测出图时球左半就很空）。慢慢转起来星云会流动，「内部有活的东西」；
 * 又慢到看不出是在转，只觉得球里在动。
 */
const SPIN = 0.035

const VERT = `
varying vec3 vN;
varying vec3 vV;
varying vec2 vUv;
void main() {
  vUv = uv;
  vN = normalize(normalMatrix * normal);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vV = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}
`

const FRAG = `
precision highp float;

uniform sampler2D uTex;
uniform float uTime;
uniform float uCharge;
uniform float uHasTex;
uniform vec3 uLight;

varying vec3 vN;
varying vec3 vV;
varying vec2 vUv;

#define PI 3.14159265

void main() {
  vec3 N = normalize(vN);
  vec3 V = normalize(vV);
  float ndv = max(dot(N, V), 0.0);

  /* 菲涅尔：球体边缘视线掠射 → 玻璃壳的冷蓝边光。
     指数 5.0 才把亮边收成「薄薄一层壳」；
     试过 2.6 / 3.4 都太宽，球会读成塑料球的外沿，而不是玻璃。 */
  float fres = pow(1.0 - ndv, 5.0);

  /* 内部星云。试过三条路，记下来免得重走：
     · ① 直接贴球面 → 读起来是**行星**（细节太清楚、亮度太均匀）
     · ② 折射采样（refract 后按方向查球面贴图）→ 星云被扭曲成一片无法辨认的色块，
          而且强弱很难调；这条路放弃了
     · ③ **直采 uv + 强明暗塑形** ← 现在这条。
          「球」和「贴了图的球面」的区别全在塑形：中心透亮、边缘压暗。
     两层采样叠一下（一层放大、一层偏移），星云就有了「厚度」而不是一张皮。 */
  vec3 neb;
  if (uHasTex > 0.5) {
    vec2 uv = vUv;
    uv.x += uCharge * 0.02;                         // 充能时星云向中心收拢
    vec3 n1 = texture2D(uTex, uv).rgb;
    /* 第二层只**横向**换一个更大尺度的采样 —— 注意 v 原样传下去。
       早期的写法是把 uv 整体乘 0.72 再偏移 (0.13, 0.41)：v 被压进中段 72% 又整体移了 0.41，
       于是贴图两极那两条压暗带被完全绕开，极点附近会凭 n2 亮起来。
       横向换尺度还有个好处：同样的噪声，特征更大 = 更雾，
       细节不再锐到像一张照片（这是「行星」和「球」的分界之一）。

       ⚠️ 写这里的注释**不许出现反引号，也不许出现美元符紧跟花括号** ——
       整段 GLSL 是 JS 模板字符串：反引号会当场把它截断，后者会被当插值表达式。
       这个坑踩过两次了（上一次在 FRAG 顶部）。 */
    vec3 n2 = texture2D(uTex, vec2(uv.x * 0.62 + 0.17, uv.y)).rgb;
    neb = n1 * 0.46 + n2 * 0.70;
    float lum = dot(neb, vec3(0.2126, 0.7152, 0.0722));
    /* 降饱和只到 0.60 —— **冷蓝留给边缘**。
       贴图本身是高饱和的蓝（色标最亮一档 rgb(120,165,255)），
       按 0.86 保留原色铺满整颗球，读出来就是「一颗蓝色行星」。
       把球体的颜色拉灰、让菲涅尔那一圈独占彩色，「玻璃」才成立。 */
    neb = mix(vec3(lum), neb, 0.60);
    /* 动态范围压向暗部：pow 1.35 之后暗部真的落进黑里，只留最密的几缕丝在发光。
       取向依据是用户对整站的偏好 —— 他刚要求把女巫的脸整个吞进黑暗。
       球作为主 CTA 需要的是「暗处有东西亮着」，不是整颗球都在发亮。 */
    neb = pow(max(neb, vec3(0.0)), vec3(1.35)) * 0.60;
    neb *= mix(0.09, 1.45, pow(ndv, 1.15));         // ★ 明暗塑形：这一行才是「球」
                                                    //   （边缘 0.09、中心 1.45，落差比 16:1）
    neb *= 1.0 + 0.06 * sin(uTime * 0.7);           // 极慢的呼吸：球里有东西在明灭
  } else {
    // 无贴图兜底：同色系的纯程序化渐变（同样压暗，免得降级版反而更亮）
    neb = mix(vec3(0.02, 0.03, 0.10), vec3(0.24, 0.40, 0.92), pow(ndv, 1.4)) * 0.55;
  }

  /* 冷蓝菲涅尔边缘（细、亮、收敛） */
  vec3 rim = vec3(0.46, 0.68, 1.0) * fres * (1.30 + uCharge * 1.15);

  /* 内部亮核：正对视线处最亮，读作「光从球心透出来」。
     0.30 → 0.15：星云压暗之后这一项会重新把球心顶亮，
     于是「球心比边缘亮」的对比被抹平 —— 它就是上一步要消灭的那个效果。
     留一点（而不是删掉）是为了球心不至于死黑。 */
  vec3 core = vec3(0.62, 0.78, 1.0) * pow(ndv, 3.0) * 0.15;

  /* 镜面高光（玻璃反射）。光方向由 JS 随指针微调 —— 用户要的「高光位移」。
     指数 320 / 强度 0.62：收到「一个小亮点」。
     78 那一版会在球正面烧出一大块白斑（读起来是太阳），那是首版的第二个毛病。 */
  vec3 L = normalize(uLight);
  vec3 H = normalize(L + V);
  float spec = pow(max(dot(N, H), 0.0), 420.0);
  float specWide = pow(max(dot(N, H), 0.0), 26.0) * 0.014;

  vec3 col = neb + rim + core;
  col += vec3(0.92, 0.96, 1.0) * (spec * 0.62 + specWide);
  /* 边缘混入一点背景的紫 —— 球的冷蓝边缘与背景的紫直接相接会有一条硬分界，
     掺一点紫之后读起来像玻璃边缘的色散，也把球缝回画面里。 */
  col += vec3(0.07, 0.035, 0.15) * pow(1.0 - ndv, 2.2) * 0.75;
  /* 蓄势：整体提亮 + 色温往白里收一点 */
  col *= (1.0 + uCharge * 0.85);
  col = mix(col, col * vec3(1.06, 1.03, 1.0), uCharge);

  gl_FragColor = vec4(col, 1.0);
}
`

export default function OrbCanvas({ charging = false, reduced = false, onFail, onReady }) {
  const hostRef = useRef(null)
  /** 渲染循环读的实时状态（不走 state，避免每帧触发 React 重渲） */
  const liveRef = useRef({ charge: 0, targetCharge: 0, px: 0, py: 0, tpx: 0, tpy: 0 })

  useEffect(() => {
    liveRef.current.targetCharge = charging ? 1 : 0
  }, [charging])

  useEffect(() => {
    let dead = false
    let raf = 0
    /** 统一的清理清单：three 的每一样都要显式释放（renderer/geometry/material/texture） */
    const disposables = []
    let onResize = null
    let onPointer = null
    let onVis = null
    let renderer = null
    let canvasEl = null

    const fail = (why) => {
      if (dead) return
      // 兜底失败路径：告诉父级走 2D 球，页面不留空洞
      console.warn('[orb] 3D 降级：' + why)
      onFail?.(why)
    }

    /** 球画出来了：淡入 canvas，并告诉父级「2D 球可以关掉内层动画了」 */
    const markReady = () => {
      if (dead || !canvasEl) return
      canvasEl.classList.add('is-ready')
      onReady?.()
    }

    async function boot() {
      let THREE
      try {
        THREE = await import('three')
      } catch (e) {
        fail('three 加载失败')
        return
      }
      if (dead) return

      const host = hostRef.current
      if (!host) return

      /* ⚠️ 让 three 自己建 canvas，**不要**沿用 React 渲染出来的那一个。
         本页跑在 <React.StrictMode> 下（main.jsx），开发期 effect 会
         「挂载 → 立刻卸载 → 再挂载」，而 React 会**复用同一个 DOM 节点**。
         若两层共用一个 canvas：第一个实例可能在它上面建好 context、
         卸载时又被 forceContextLoss 掉，第二个实例就再也拿不到 context
         → 3D 静默退回 2D。每次挂载都用新 canvas，这类竞态直接消失。 */
      try {
        renderer = new THREE.WebGLRenderer({
          alpha: true,
          antialias: true,
          powerPreference: 'high-performance'
        })
      } catch (e) {
        fail('WebGL 上下文创建失败')
        return
      }
      if (!renderer.getContext()) {
        fail('拿不到 WebGL 上下文')
        return
      }
      renderer.setClearAlpha(0)
      canvasEl = renderer.domElement
      canvasEl.className = 'orb__canvas'
      host.appendChild(canvasEl)

      const scene = new THREE.Scene()
      const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100)
      camera.position.z = 1 / (Math.tan((FOV * Math.PI) / 180 / 2) * ORB_FILL)

      const uniforms = {
        uTex: { value: null },
        uTime: { value: 0 },
        uCharge: { value: 0 },
        uHasTex: { value: 0 },
        // 视图空间光方向：左上前方（与主视觉里那束冷月光同侧）
        uLight: { value: new THREE.Vector3(-0.46, 0.52, 0.72).normalize() }
      }

      const geo = new THREE.SphereGeometry(1, 80, 56)
      const mat = new THREE.ShaderMaterial({
        uniforms,
        vertexShader: VERT,
        fragmentShader: FRAG
      })
      const mesh = new THREE.Mesh(geo, mat)
      scene.add(mesh)
      disposables.push(geo, mat)

      /* 星云贴图：按槽位给的候选地址依次试（webp → png）。
         全部失败也不算致命 —— uHasTex=0 时着色器走纯程序化渐变。 */
      const loader = new THREE.TextureLoader()
      const urls = ASSETS.orbNebula
      const tryLoad = (i) => {
        if (dead || i >= urls.length) return
        loader.load(
          urls[i],
          (tex) => {
            if (dead) {
              tex.dispose()
              return
            }
            tex.colorSpace = THREE.SRGBColorSpace
            tex.wrapS = THREE.RepeatWrapping // 水平本就无缝，环绕后转起来不会出缝
            tex.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy())
            uniforms.uTex.value = tex
            uniforms.uHasTex.value = 1
            disposables.push(tex)
          },
          undefined,
          () => tryLoad(i + 1)
        )
      }
      tryLoad(0)

      /* 尺寸：canvas 的 CSS 尺寸由样式表给，这里只同步绘制缓冲。
         用 ResizeObserver 而不是 window.resize —— hero-frame 的尺寸是
         `max(104vw, 104vh×1.5)`，视口一变它自己就变，且两者不是线性关系。 */
      const applySize = () => {
        const r = host.getBoundingClientRect()
        const w = Math.max(1, Math.round(r.width))
        const h = Math.max(1, Math.round(r.height))
        const dpr = Math.min(window.devicePixelRatio || 1, DPR_MAX)
        renderer.setPixelRatio(dpr)
        renderer.setSize(w, h, false)
        camera.aspect = w / h
        camera.updateProjectionMatrix()
      }
      applySize()
      if (typeof ResizeObserver !== 'undefined') {
        const ro = new ResizeObserver(applySize)
        ro.observe(host)
        onResize = () => ro.disconnect()
      } else {
        window.addEventListener('resize', applySize)
        onResize = () => window.removeEventListener('resize', applySize)
      }

      /* 指针视差：只有球动，2D 层完全不动（用户第七轮拍板）。
         手机不做陀螺仪 —— 没有 pointermove 就保持静止。 */
      const onMove = (e) => {
        const t = e.touches ? e.touches[0] : e
        const nx = (t.clientX / window.innerWidth) * 2 - 1
        const ny = (t.clientY / window.innerHeight) * 2 - 1
        const s = liveRef.current
        s.tpx = Math.max(-1, Math.min(1, nx))
        s.tpy = Math.max(-1, Math.min(1, ny))
      }
      if (!reduced) {
        window.addEventListener('pointermove', onMove, { passive: true })
        window.addEventListener('touchmove', onMove, { passive: true })
        onPointer = () => {
          window.removeEventListener('pointermove', onMove)
          window.removeEventListener('touchmove', onMove)
        }
      }

      /* reduced / 页面不可见时停帧。用 rAF 而不是 setAnimationLoop，
         这样「渲一帧就停」这种路径好写。 */
      const baseTime = performance.now()
      const renderOnce = () => renderer.render(scene, camera)

      if (reduced) {
        // 无障碍：只渲一帧静态球，不起循环
        liveRef.current.charge = charging ? 1 : 0
        uniforms.uCharge.value = liveRef.current.charge
        renderOnce()
        markReady()
      } else {
        const tick = () => {
          if (dead) return
          raf = requestAnimationFrame(tick)
          if (document.hidden) return
          const s = liveRef.current
          const t = (performance.now() - baseTime) / 1000
          // 平滑跟随：指针 0.07、充能 0.09 —— 都比一帧慢得多，读作「有惯性」
          s.px += (s.tpx - s.px) * 0.07
          s.py += (s.tpy - s.py) * 0.07
          s.charge += (s.targetCharge - s.charge) * 0.09

          mesh.rotation.y = s.px * YAW_MAX + t * SPIN
          mesh.rotation.x = s.py * PITCH_MAX
          uniforms.uLight.value.set(
            -0.46 + s.px * LIGHT_SHIFT,
            0.52 - s.py * LIGHT_SHIFT * 0.8,
            0.72
          ).normalize()
          uniforms.uTime.value = t
          uniforms.uCharge.value = s.charge
          renderer.render(scene, camera)
        }
        tick()
        onVis = () => {
          /* visibilitychange 本身不用做额外事：tick 里已经按 document.hidden 跳过渲染，
             但回前台时要立刻补一帧，避免停帧期间的时间跳变。 */
          if (!document.hidden) renderOnce()
        }
        document.addEventListener('visibilitychange', onVis)
      }

      markReady()
    }

    boot()

    return () => {
      dead = true
      cancelAnimationFrame(raf)
      onResize?.()
      onPointer?.()
      if (onVis) document.removeEventListener('visibilitychange', onVis)
      for (const d of disposables) {
        try {
          d.dispose?.()
        } catch {
          /* 释放失败不影响卸载 */
        }
      }
      try {
        renderer?.dispose?.()
        renderer?.forceContextLoss?.()
      } catch {
        /* 同上 */
      }
      /* 把自建的 canvas 摘下来。宿主 span 在 StrictMode 下会被复用，
         不清掉旧 canvas 就会和新实例 append 的那张叠在一起
         （旧的那张已经被 forceContextLoss 冻住，永远停留最后一帧）。 */
      if (canvasEl && canvasEl.parentNode) canvasEl.parentNode.removeChild(canvasEl)
      canvasEl = null
    }
    // 只在挂载时启动一次；charging / reduced 的变化通过 liveRef 与分支读取
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* canvas 不在这里渲染 —— 由 three 在 boot() 里创建后 append 进来。
     见 boot() 里的 StrictMode 注释：复用 React 生成的 canvas 会踩 context 竞态。 */
  return <span className="orb__stage" ref={hostRef} aria-hidden="true" />
}
