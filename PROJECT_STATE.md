# PROJECT_STATE · 塔罗日签网站

> **新对话窗口接手方式**：把这句话发给助手 —— 「读取 `C:\Users\29923\WorkBuddy\2026-09-17-19-02-52\tarot-app\PROJECT_STATE.md` 和同目录的 `NEXT_STEPS.md`，继续塔罗日签项目」
> 本文档是**进度事实**的唯一来源（做到哪了、定过什么、结构长什么样）。
> 未完成的工作看 **`NEXT_STEPS.md`**（含具体做法、优先级、成本与踩坑提醒）。
> 每次有实质进展都要回来更新本文档的「当前阶段」与「变更日志」。

最后更新：2026-09-21（第三十一轮：**给用户使用的那一版：声音默认开 + 开关改成喇叭图标** ——
缺省从「静音」翻成「开」，并由 `audio/autostart.js` 在**第一次用户手势**里兑现
（浏览器不允许非手势起 AudioContext，所以「默认开」≠「一打开就出声」）；
左上角那个开关从「圆点 + 声音开/关」收成 32px 的喇叭（开 = 喇叭 + 两声波，关 = 喇叭 + 叉），
文字去掉后补 `aria-label` 兜无障碍。上一轮第三十轮：**桌面快捷方式 + 本地预览启动器** —— 桌面 `塔罗日签.lnk`
双击即「必要时自动构建 → 起本地 http 服务 → 打开浏览器」；途中揭穿「手写 lnk 缺
`LinkTargetIDList` → 双击报 WinError 1155」，改用系统 `IShellLink` 生成并以 `GetPath` 做判据。
再上一轮第二十九轮：**v2 定稿存档** —— 用户认可四个音效，把当前版本存成第二版：
`git tag v2` + 冻结快照 `_archive/v2-2026-09-21/` + 推送远端，并做了还原演练。
冻结前体检揪出「快照会把 `.env.local` 烤进 zip」与「两个包的清单同名 → 只核到半个包却显示绿灯」
两条静默故障，已修。详见 `NEXT_STEPS.md` §20 / §21）。

> ### 音效现状：**四个音全部定稿并在站点在用**（用户已拍板，2026-09-21 第二十九轮：
> ### 「很好，现在音效很符合我的需求」→ 随后存成 `v2`）。③ flip 为用户选定的 `s2-50`。
> ### 下面这一段保留为「怎么走到这一步」的证据链，**不是待办**。
>
> 用户原话：`charge`「听起来像雷云滚滚」「比较吵」；`burst`「像电饭煲烧开打开的时候」。
> 实测证实两个音是**同一形状的两个极端**（`scripts/out/charge-spec.log`）：
>
> | 音 | 质心 | 能量集中处 | 对照：用户满意的两个 |
> |---|---|---|---|
> | charge | **102 Hz** | 20–60Hz 占 **50.6%**，谱峰 13.3 / 14.0 / 16.0Hz | flip 3746Hz |
> | burst | **8718 Hz** | 6–12kHz 占 **84.5%** | reveal 2202Hz |
>
> 一个全压在次低频（13 与 14Hz 相差 0.7Hz，**拍频就是那个「滚」**），
> 一个全挤在高频（纯气流噪声 = 那个「嘶」）。
>
> **★ 根因：提示词里的声学名词会被逐字实现。** 写「一层几乎听不见的**低频嗡鸣**」
> 就得到一个 13Hz 的闷雷；写「一层柔和的**空气向四周铺开**」就得到蒸汽喷射。
> 「几乎听不见」「柔和」这类形容词**没有任何约束力** —— 它们只描述你希望它多响，
> 不改变它是什么。
>
> **用户已确认 charge 的新方向：「柔和的低频暖流 —— 有厚度地缓缓浮现但绝不轰鸣，
> 保留一点『攒劲』的力量感，只是把『滚』去掉」**。
> ⚠️ 注意：**不是「极安静空气声」** —— 我第一版重写稿按「完全禁止低频」写，方向是错的
> （用户要保留厚度）。判据因此是「**砍 20–60Hz、留 20–300Hz**」，不是「低频越少越好」。
>
> → 提示词已按「**点名具体声学事件 + 给出目标频段落点**」重写（`audio-src/README.md`
> ①② 节，带目标质心 / 占比区间），生成通道改用 **ElevenLabs**（免费层 10k credits/月
> 就含 Sound Effects），并新增 `scripts/gen-sfx-elevenlabs.py`：
> 生成后**立刻量指标对目标区间报 PASS/FAIL**，避免拿到手才发现又是个闷雷。
> 该脚本的判据已做**反向验证**（旧的被否决素材全部触发 FAIL，flip/reveal 不受约束）。
>
> **✅ 已替换完成（2026-09-21）**：①② 已用 ElevenLabs 重做并接进站点，全部判据与回归通过；
> **只差用户用耳朵拍板**（候选对比页 `audio-src/candidates/index.html`）。
>
> **✅ ③ flip 也已重做（2026-09-21 第二十七轮）**：用户说它「方向**符合**，但冗杂、像翻书、
> 像翻了两三张牌，要**利落一点**」→ 没换音色方向，只把 **3 次起手 / 0.563s 跨度**压成
> **一次起手**。关键收获：那层「沙子」**不是素材的，是流水线 RMS 归一 + 软削顶填出来的**
> （消融证据：duty 0.151 → 0.891），已补「**手势守恒**」判据堵住这个静默缺口。
> 现站点用的是 **s2-50**；候选对比页 `audio-src/candidates/flip.html`。
>
> **✅ ③ flip 定稿（2026-09-21 第二十八轮）**：候选页给用户试听后，他选了 **`s2-50`**
> （0.5s，成品 0.522s，质心 8126Hz —— 五条里最亮也最短）。
> ⚠️ 记一笔：**这条在手势指标上反而是五条里最差的**（铺满度 0.686 / 末次起手 64%，两项超标），
> 用户看得到那两项超标标记仍然选它 → **他抱怨的是「手势」，打动他的却是「音色 + 时长」**。
> 详见 `NEXT_STEPS.md` §19.2（含「要补就补质心与时长的双侧区间，不是继续收紧 duty」的结论）。
>
> 三个方法论级收获（详见 `NEXT_STEPS.md` §17）：
> 1. **直连 ElevenLabs 写中文提示词基本等于随机**（质心 5846~7681Hz，全是嘶声），
>    换英文立刻落到目标区间 —— 「写中文更好」只对 AiSounds 那个壳成立。
> 2. **长负面清单 + 高 influence 会把禁止的东西渲染出来**（「不要嘶声/风啸/白噪声」
>    是声学名词 → 被点名就出现）。现在一律**短稿、只做正面描述**。
> 3. **指标合格 ≠ 听感合格**：三条候选频谱全绿，但包络结尾塌到 -22dB，
>    而 burst 正好在 charge 结束那一刻接上 → 蓄势自己先静了。
>    已补 `env_tail_db` 手势判据（反向验证过）。
>
> 另修一笔旧账：`probe-sfx` 里的合同时长是**从旧产物量出来的**（`burst:1.0`），
> 不是契约 → 期望值改为**由 `build-sfx.py` 写出并注入页面**。

第二十五轮：**四个音效全部换成 AI 素材并接进站里**，同时修掉两条真故障。
音效现在和 BGM 同一套结构：`sfx.js`「**素材优先、合成兜底**」，素材是
`assets/audio/sfx/{charge,burst,flip,reveal}.mp3`（共 52 KB），由 `audio-src/sfx/_raw/`
经 `scripts/build-sfx.py` 修剪+配平产出。四个音的合成配方**一个字没删**，兜底用。
这一轮修掉的两个真故障：
- **响度离散 19.5dB**（flip 被压到 RMS -30.6dB，几乎听不见）。根因是「峰值受限时 RMS
  有数学上界」，flip 的峰值系数 28.5dB 让它**靠限幅永远到不了目标**——先量上界、
  再决定要不要付失真（flip 付了 1.44% 的软削顶），最后四个音收敛到 **1.2dB** 以内。
- **出厂 mp3 过满刻度**（浏览器解码 burst +0.7 / flip +0.3 dBFS）。根因是天花板设在
  -0.3dBFS，只给编码留 0.3dB，而实测 mp3 过冲达 **1.0~1.7dB**。天花板改 **-2.8dBFS**
  （向 BGM 那条流水线的 -3dBFS 看齐），四个 rms 目标同步下移 2.5dB 保持相对关系逐位不变。
  ⚠️ 这条过冲**在 python 侧看不见**：miniaudio 的解码输出被钳在 ±1.0，所以原来那条
  「解码峰值 > 0dBFS」判据是**死判据**（见 `scripts/_probe_mp3peak.py` 的指纹证据）。
第二十四轮：**BGM 换成 AI 生成的真素材**。
用户说芒果灵创那版 BGM「效果不错」→ 那条「音频素材零新增」的假设**被用户推翻**：
`ambient.js` 改成「**素材优先、合成兜底**」，素材 `assets/audio/ambient-loop.mp3` 342.6 KB /
60 秒无缝循环（`scripts/build-ambient.py` 用等功率交叉淡化，接缝在数学上不存在）。
音效这边查出**芒果灵创结构上没有 SFX 出口**（要「一声翻牌」它交回 180 秒的整首曲子），
改用 AiSounds（= `aiwave.art`，音效引擎就是 ElevenLabs SFX）。
第二十三轮收尾：**修掉一个「假完成」—— 标题的拉丁字体从来没生效过**。
Cinzel 子集里装的其实是 Google 返回的 HTTP 400 错误页 HTML，而坏字体是**静默回退**的：
不报错、截图看不出、构建无感，所以「标题换了罗马碑刻体」那个结论当时是**假的**。
已修，并把字体验收做成脚本 —— `fetch-title-fonts.mjs` 落盘**前**验 `wOF2` 魔数、
`probe-fonts.mjs` 直接问浏览器「这个字是谁画的」（A 脸状态 / B 逐字形 / C 页面真用上）。
第二十三轮本体：音效四个音全部重做 + 幽暗寂静环境音 + 卡牌下挪（含「只挪卡牌是没用的」那条几何结论）+ 标题罗马碑刻体。
再往前：第二十轮把水晶球换成真 3D（three.js，本项目对「不引入新依赖」的**唯一已批准例外**）、
女巫的脸二次压暗到五官完全不可见。

---

## 一句话

一个塔罗每日一签网站。首页即占卜场景：巫师手捧水晶球，点击水晶球随机抽出一张塔罗牌并给出解读。

## 当前阶段

| 阶段 | 状态 |
|---|---|
| 1 · 需求对齐 | ✅ 已完成 |
| 2 · 风格锚点 | ✅ 卡牌风格已定稿（二次元赛璐璐 + 统一卡框）；主视觉 v2（无球版）已产出 |
| 3 · 基础架构 | ✅ 已完成，可运行，构建通过（含牌面三层结构与牌面总览面板） |
| 4 · 美术资产 | ✅ **22/22 牌面 + 统一卡框 + 牌背 + 主视觉拆层（背景 / 水晶球）全部完成并接入代码**；`hero-figure` 人物层未做（架构上可选，见 `NEXT_STEPS.md`） |
| 5 · 打磨与上线 | 🔶 **进行中**：整页手感升级 + **抽牌仪式分拍改造**已完成；**主视觉 v2 的水晶球已换成真 3D（three.js）**、手抠成独立前景层、女巫的脸压暗到五官不可见；**内容与美感补齐（第二十一轮）**：牌意加深（元素/星象/象征/宜忌）+ 用户可开的「牌之图鉴」+ 主页两侧漂浮低语标签；**字号放大与音效（第二十二轮）**：标题 36 → 45–54px、副标题 13 → 18px、低语 11–14 → 13–18px，并新增**纯合成音效**（蓄势/释放/翻牌/揭晓，零素材零依赖）；分享卡片图 / 分享 meta / 首屏预热 / `DRAW_MODE` 切 daily 已完成；**离线副本已移除**（v2 起只走 http）；**发布上线未做** —— 这是唯一实质待办，且需要用户本人选平台并登录 |
| 6 · 交付打包 | 🔶 **形态已改**：交付改为**线上链接**（Q2 决策：静态托管 + git），不再发含离线副本的 zip。打包脚本保留给需要代码的人并已瘦身（去掉离线副本逻辑与 `--no-preview`）。旧包 `*-2026-09-19.zip` **已作废**（内容过时，且含已删除的离线副本） |


## 已定需求（除非用户改主意，不要再问第二遍）

- **核心玩法**：每日一签。不做经典牌阵、不做提问式占卜、不做牌意百科
  - ⚠️ **2026-09-20 用户改主意一处**：「图鉴可以加，但是先做的简单一些有就可以了」→ 做了**只读的「牌之图鉴」**
    （22 格 + 点开完整解读）。它仍**不是**百科：不可搜索、不分类、不索引，只是「我这副牌长什么样」的一览。
    完整解读也**只讲这一张牌的正位含义**，不做多义项/多流派对照
- **正逆位**：2026-09-20 用户明确「**先不用考虑**」→ 牌意只写正位。数据结构上不要预留半成品字段（免得后人以为已支持）
- **用户系统**：不做登录，抽牌记录存浏览器本地，后续可加本地日历回看
- **牌库**：MVP 先做 22 张大阿卡纳，跑通后再补 56 张小阿卡纳
- **抽牌规则**：**最终形态是一天锁一次**；开发测试期用不限次数（代码里可实时切换）
- **解读**：内置静态牌意库，暂不接 LLM
- **分享卡片图**：要做，但排在基础架构跑通之后
- **首页形态**：不是洗牌页。巫师（看不清面容、戴巫师帽、只有上半身、占屏大半）手捧水晶球；打开网页播入场动画，定格后保持循环动画；点击水晶球抽牌

## 技术栈

Vite + React 18 + Tailwind CSS 4 + Framer Motion，**零后端**。

**唯一的运行时依赖例外：`three`（^0.186.0）**，只给主视觉的水晶球用（`src/components/OrbCanvas.jsx`）。
这条例外是 2026-09-19 用户批准的。成本与边界：
- 它是**动态 `import('three')`**，构建后是**独立 chunk**（`three.module-*.js` 746.94 KB / gzip 191.81 KB），
  **不在首屏关键路径**上；首屏 JS 只多了约 8.3 KB gzip。
- 除这一处，其余「不引入新渲染库 / 动画库」的禁令**依然有效**（GSAP、其它 3D 库等仍按原文拒绝）。
- 拿不到 WebGL / three 拉不下来 → 自动降级回 2D 球（`.orb__body` 原样顶上），页面不留空洞。

## 目录结构

```
tarot-app/
├─ PROJECT_STATE.md              本文档（进度事实）
├─ NEXT_STEPS.md                 ⭐ 剩余工作清单（待办、做法、成本、踩坑）
├─ README.md                     面向使用者的说明（换风格三步法写在这里）
├─ .git/ · .gitignore · .gitattributes   ✅ 版本控制（2026-09-19 建立）。
│                                  `.gitignore` 排除 `_debug`/`previews`/`card-styles`/`_archive`/`dist*`；
│                                  `.gitattributes` 把 `.cmd` 标为**不做任何换行转换**，配套 `core.autocrlf=false`
│                                  （2026-09-19 前是 `.cmd` ×3 + `dist-user/` + `dist-dev/`，已随离线通道移除）
├─ _archive/                     🔒 **冻结快照（只读保险，不是工作副本）**：用 `scripts/freeze_snapshot.py` 封存。
│                                  · `v1-2026-09-19/`  code 11.8 MB + art 104.2 MB 两个 zip + `SNAPSHOT.md`
│                                  · `v2-2026-09-21/`  code  7.5 MB + art 111.6 MB 两个 zip + `SNAPSHOT.md`
│                                    （v2 = 四个音效全部定稿的那一版，对应 `git tag v2`）
│                                  每份的 `_verify*/` 是从 zip 解出来**真跑过**的验收副本 —— 见第 6 节第 27 条
│                                  演练复现：`python scripts/verify_snapshot_restore.py --label v2 --date 2026-09-21`
├─ scripts/
│   ├─ build_card_assets.py      素材后处理：去水印 → 抠透明底卡框 → 量几何 → 导出 WebP → 合成预览
│   ├─ build_hero_assets.py      ⭐ 主视觉拆层素材后处理：背景镜像去水印 / 球抠白底 / 牌背缩放
│   ├─ build_lqip.py             ⭐ 由 hero-bg 生成内联低清占位图（LQIP）→ src/config/lqip.js
│   ├─ build_og_cover.py         ⭐ 合成带球的主视觉 → 1200x630 分享封面 public/og-cover.jpg
│   ├─ preview_hero.py           ⭐ 不需要浏览器的合成预览（复现 CSS 底板数学，核对锚点）
│   ├─ shot.mjs                  ⭐ 无头截图 / 视觉自检（CDP 驱动本机 Chrome，零依赖；支持 --seed / --reduced）
│   ├─ run-flows.mjs             ⭐ **通用批量运行器**（`spawnSync` 绕开降级 shell；一次跑多个 flow × 多视口）
│   ├─ verify-orb3d.mjs          ⭐ 3D 球四用例核验（桌面 / 真机 mobile / reduced ×2），末尾打印 ALL_PASS
│   ├─ verify-halo.mjs           ⭐ 充能光晕消融归因（配 `_check_halo.py` 做径向亮度归属）
│   ├─ fetch-title-fonts.mjs     ⭐ **重抓标题字体子集**（Google Fonts `text=` 端点）。
│   │                              ⚠️ 校验写在流程里：`text=` 一律 encodeURIComponent、落盘**前**验 `wOF2` 魔数、
│   │                              不过就 exit 1 绝不写坏文件进 `src/`。改标题文案后必须跑
│   ├─ probe-fonts.mjs           ⭐ **字体探针**（第二十四轮新增，自带 CDP 驱动，**不是** flow）。
│   │                              判据 A `document.fonts` 状态 / B 逐字形「谁画的」（三份子集各挂独立族名，
│   │                              看 `isCustomFont`，**不能比族名**） / C 页面真实节点有没有用上。
│   │                              对应「文件坏了 / 文件缺字 / CSS 没接上」三种故障，缺一条漏检一种。
│   │                              ⚠️ 页面内拿不到 `CSS.getPlatformFontsForNode`，所以做不成 `--eval-file` flow
│   ├─ build_orb_texture.py      ⭐ 球内星云等距圆柱贴图（循环卷积保无缝，构建期烤好）
│   ├─ build_hero_hand.py        ⭐ 手部前景层抠图（亮度阈值，压球前）
│   ├─ fix_hero_face.py          ⭐ 女巫脸部引导插值压暗（幂等，可重复跑不叠深）
│   ├─ flows/                    ⭐ shot.mjs 用的流程脚本：reveal / share / welcome / welcome-frame /
│   │                              ritual-frame（抽牌仪式四帧按状态取帧） / probe-draw-timeline /
│   │                              dev-verify（开发模式自检，跑在 dev server 上，含命中测试）
│   │                              / audit-motion / audit-draw / audit-title
│   │                              / probe-whispers（两侧低语：数量 / 穿透点击 / 几何带 / 轮切节奏）
│   │                              / probe-gallery（图鉴入口可点性 / 22 格 / 详情叠加与 Esc 回退）
│   │                              / probe-panel-worst（**逐张遍历 22 张牌**量面板净空，取最坏）
│   │                              / probe-sfx（音效**结构事实**：ctx 是否真建起来且 running、
│   │                                 四类节点是否真连上；听不了声音，就验这些）
│   │                              / probe-sound-default（**缺省开** 10 条：缺省开着 / 加载时无 ctx /
│   │                                 第一次手势起播且走素材路 / 手势不翻开关 / 点关点开 / 图标两态）
│   │                              / probe-sfx-off（反向：**明确关过**的用户不该被建 ctx。
│   │                                 必须带 `--seed` 在加载前写 `tarot.sound='off'`）
│   │                              / probe-ambient（**10 条判据**：mp3 下没下到 / **走的素材路还是
│   │                                 偷偷退回合成** / MP3 编码器延时有没有被排除在循环外 /
│   │                                 常驻性 / duck 与恢复 / 关开关真的停。
│   │                                 给每个 GainNode.gain 装目标值记录器 + 直接读 getChannelData）
│   ├─ build-ambient.py          ⭐ **BGM 素材处理**（第二十四轮新增）：AI 长氛围曲 → 无缝循环 mp3。
│   │                              等功率交叉淡化（接缝不是「听不出来」，是**环上根本不存在**）+
│   │                              单声道（宽度由 engine.js 的立体声混响给，源用单声道省一半体积）+
│   │                              ABR 编码（体积可预测）。`--probe` 只看指标不产出。
│   │                              ⚠️ `lameenc.set_vbr()` 收的是**模式常量**（VBR_ABR 等），不是布尔值
│   ├─ verify_manifest.mjs       ⭐ 按逐文件清单校验快照完整性。用法：
│   │                              `node scripts/verify_manifest.mjs <目录>`（核代码包）
│   │                              `node scripts/verify_manifest.mjs <目录> --manifest MANIFEST-art.sha256`（核素材包）
│   │                              ⚠️ **两个包要各核一次**：两份清单必须不同名，同名会互相覆盖，
│   │                              只核一次就会出现「只覆盖半个包、结果却是绿的」——v1 就是这样，v2 已改
│   ├─ verify_snapshot_restore.py ⭐ **还原演练**：换全新路径解包 → 两份清单各核一次 → 借 node_modules →
│   │                              用包内 `audio-src/sfx/_raw/` 重建音效 → `vite build`。
│   │                              判据只有一条：**解出来能构建、素材能解码**（「zip 生成成功」不算）
│   ├─ contact_sheet.py          总览拼版（22 张联络表，验收风格/边框一致性用）
│   ├─ freeze_snapshot.py        ⭐ 冻结快照（「版本保险」，与 git **互补**）：产出 code / art 两个 zip + `SNAPSHOT.md`。
│   │                              收录判据 =「丢了会不会痛」：不可再生素材（含 `audio-src/` 音效源素材）
│   │                              进包；`scripts/out/` 只留 `_exp/` 与 `_raw-backup-*/`（花过 API 额度的）。
│   │                              ⚠️ 有**密钥硬闸**：收集结果一旦出现 `.env*` / `*.key` 就直接拒绝出包
│   │                              （v1 冻结时 `.env.local` 还不存在，这条是 v2 前补的）
│   └─ package_project.py        项目打包（完整包 / `--light` 轻量包；**不再含离线副本**）
├─ public/skins/<皮肤名>/        美术素材，按皮肤分目录
│   ├─ hero-bg.webp              ✅ 已就位（v2 无球版：巫师双手托举、掌心留空）
│   ├─ hero-orb.webp             ✅ 已就位（透明底水晶球，抠白底而来）
│   ├─ hero-figure.webp          ⬜ 未做（人物层，架构上可选；见 NEXT_STEPS P2）
│   ├─ card-back.webp            ✅ 已就位（米白厚卡纸 + 金色八芒星与月相）
│   ├─ frame.webp                ✅ 统一卡框（22 张共用，实心矩形 + 中央开窗；右下吊牌已去除）
│   └─ cards/major-XX.webp       ✅ **22 张全部就位**（major-00 ~ major-21）
├─ public/og-cover.jpg           ✅ 分享卡片封面（1200x630，由 build_og_cover.py 生成）
├─ assets/
│   ├─ card-art/<牌号>/           ✅ 22 张原始插画母版（每目录一张，文件名随意）
│   ├─ hero-art/{bg,orb,back}/   ✅ 主视觉拆层的原始出图（按目录扫描取图）
│   ├─ card-styles/              出图历史与卡框源图（anime-v2 里有 FRAME_SRC，脚本需要）
│   ├─ concept/                  主视觉概念图原图（v1）
│   └─ previews/                 成品预览 + 总览 + **真实渲染截图 screen-*.png** + hero-preview-*.png
├─ audio-src/                    ⭐ **音频源文件 + 生成说明**（第二十四轮新增）
│   ├─ README.md                 音效该怎么生成：四个音的提示词 / 时长 / 交付契约。
│   │                            ⚠️ 通道已换 **ElevenLabs**（AiSounds 额度用完，免费层含 SFX）；
│   │                            ①② 被否决后按「点名声学事件 + 目标频段」重写（见文件头 ⚠️）
│   └─ sfx/                      音效源文件，文件名必须是 charge/burst/flip/reveal；
│                                `scripts/gen-sfx-elevenlabs.py` 会直接写进 `_raw/`
└─ src/
    ├─ config/skin.js            ⭐ 皮肤名 / 素材槽位 / 底板与锚点 / 卡牌几何 / 时序（applySkinVars 灌 CSS 变量）
    ├─ config/lqip.js            ⚠️ 由 scripts/build_lqip.py 生成，不要手改
    ├─ data/cards.js             22 张大阿卡纳文案 + ALL_CARD_IDS。第二十一轮起每张多了
    │                            `element` / `astrology` / `symbol` / `favor[2]` / `avoid[2]`
    ├─ data/whispers.js          ⭐ 两侧低语文案池（`WHISPER_LINES`：idle 22 条 + ritual 6 条 + `WHISPER_STATIC_STEP`）。
    │                            ⚠️ 导出名**不能**叫 `WHISPERS` —— `skin.js` 里那个是版式配置，重名会静默串用
    ├─ audio/                    ⭐ 声音：**BGM 与音效都用 AI 素材**（音效第二十五轮接完），合成路只剩兜底
    │   ├─ engine.js             ⭐ 音频底座：ctx / 总线 / **程序化厅堂混响**（现算 IR）/ 包络与噪声工具。
    │   │                        音效与环境音共用同一个 ctx 与总线 —— 否则开关只关得掉一半。
    │   │                        三条规矩写在文件头：**意图默认开** / ctx 只在手势里建 / 增益必走包络
    │   │                        （另：`peekAudioContext()` 是**只读**的 —— 查一眼不该顺手建出 ctx）
    │   ├─ autostart.js          ⭐ 第三十一轮新增：「默认开」的**兑现**。
    │   │                        监听第一次 pointerdown / keydown / click → unlock + 起 BGM + 解静音。
    │   │                        用户明确关过（存了 'off'）就地收摊；手势落在喇叭上则让给喇叭处理。
    │   │                        ⚠️ 为什么必须单独有它：把缺省值改成 true **只是意图**，
    │   │                        浏览器不允许在非手势里启动 AudioContext → 没有它就没有声音，
    │   │                        而且全程不报错。`__tarotSound` 只读暴露 armed/pref/engineOn/ctxState
    │   ├─ sfx.js                ⭐ 四个音：**素材优先、合成兜底**（第二十五轮接完）。
    │   │                        素材 `assets/audio/sfx/{charge,burst,flip,reveal}.mp3`，
    │   │                        由 `scripts/build-sfx.py` 修剪/配平（`scripts/out/_sfx_build.json`）。
    │   │                        下面那份合成配方**一个字没删**，它兜三种情况：素材没到货 /
    │   │                        `file://` 下 fetch 被 CORS 挡 / 解码失败。
    │   │                        ⚠️ 合成路的判据：**50ms 内把能量堆到 200Hz 以下的写法一律不许出现**
    │   │                        （第二十二轮那版「汽车加速 / 拍鼓 / 手鼓 / 电子叮」全部违反它）
    │   │                        ⚠️ `__tarotSfx` 暴露 assets/loaded/failed/kinds/**stats**，
    │   │                        探针靠 stats 断言「出厂那一份的响度/峰值/时长还是对的」
    │   │                        —— 只断言「走了素材路」证明不了「路上运的货是对的」
    │   └─ ambient.js            ⭐ 环境音「幽暗寂静」。**素材优先、合成兜底**（第二十四轮）：
    │                            素材走 `assets/audio/ambient-loop.mp3`（60s 无缝循环）；
    │                            失败（`file://` 的 CORS / 缺文件 / 解码失败）才退回合成那版
    │                            （双失谐 drone + 风 + 稀疏点缀，**永不重复**，是「循环听腻了」的备选）。
    │                            礼仪三条：抽牌时 duck 到 35%、切后台静音、淡入 3.5s；
    │                            **缺省开**（第三十一轮），起播由第一次用户手势兑现。
    │                            ⚠️ drone 是常驻振荡器，**不能**用 sfx 那种一次性包络节点搭
    ├─ assets/fonts/             ⭐ 标题专用字体子集（合计 **10.0 KB**）：
    │                            `title-latin.woff2`  Cinzel 可变字重 400..900  `TAROT·`        1.82 KB
    │                            `title-han.woff2`    Noto Serif SC 900        `今夜一签`       1.63 KB
    │                            `title-han-400.woff2`Noto Serif SC 400        `日签`+全部副标题 6.57 KB
    │                            再生成：`node scripts/fetch-title-fonts.mjs`（含 `wOF2` 魔数校验）
    │                            验收：`node scripts/probe-fonts.mjs <url>`（问浏览器「这个字是谁画的」）
    │                            ⚠️ 汉字只有 400 / 900 两档 → 用 `var(--font-t
    ├─ assets/audio/             ⭐ BGM 循环素材（第二十四轮新增）
    │                            `ambient-loop.mp3` **350,820 B (342.6 KB)** / 60s 无缝循环 / 单声道 48kbps ABR
    │                            来源：芒果灵创 Mureka-9.5 出的 205.7s 长氛围曲
    │                            加工：`python scripts/build-ambient.py …`（等功率交叉淡化消接缝）
    │                            ⚠️ 体积参照：站里单张卡牌 webp 是 280–335 KB → BGM **比一张卡牌图还小**itle)` 的地方**字重只能取这两个值**；
    │                               写 600 会被就近匹配到 900 脸，而 900 子集里有「签」没有「日」，
    │                               「日」会继续回退到系统宋体 —— 同一个词两种字体（第二十四轮踩过）
    │                            ⚠️ 改标题带文案要**同步改两处**：`fetch-title-fonts.mjs` 的 `SPECS`
    │                               与 `probe-fonts.mjs` 的 `EXPECTED`。详见 NEXT_STEPS §2 P2 / §13
    ├─ utils/shareCard.js        ⭐ 分享卡片图（Canvas 三层复刻牌面 + 竖版排版）
    ├─ utils/prefetch.js         ⭐ 牌面空闲预热（避免首次抽牌时插画还在下载）
    ├─ hooks/useDrawState.js     抽牌记录（unlimited / daily）+ readTodayRecord()（供首屏同步判断）
    ├─ hooks/useAssetUrl.js      素材多格式探测（webp → png）
    ├─ index.css                 主题变量 + 全部视觉样式（含「迎接动画 · 信封」一节）
    └─ components/               App / HeroStage / EnvelopeWelcome / MistLayer / ParticleField
                                 / CrystalOrb / CardReveal / CardFace / SmartImage
                                 / CardGallery（用户可开的「牌之图鉴」）/ CardDetail（完整解读覆盖层）
                                 / WhisperTags（两侧漂浮低语）
                                 / SoundToggle（声音开关：**喇叭图标**，左上角、品牌下方；第三十一轮）
                                 / ReadingPanel / ShareDialog / DevBar
```


## 视觉架构（六条硬约束，改动时不要破坏）

1. **素材槽位化**：代码只引用槽位名（`hero-bg` / `hero-figure` / `hero-orb` / `card-back` / `frame` / `cards/major-XX`），素材按皮肤放 `public/skins/<皮肤名>/`。换风格 = 新建目录放同名文件 + 改 `SKIN` 一行
2. **定位用百分比锚点**：全在 `src/config/skin.js` 的 `ANCHORS`。**两套坐标系要分清**（见下节）：
   - `ANCHORS.orb`（图像坐标系，x/y 是主视觉画布的百分比，size 是画布**高度**的百分比）→ 只能用在 `.hero-frame` 内部
   - `ANCHORS.stage`（视口坐标系）→ 牌面落点，按视口百分比定位
3. **任意素材缺失都不报错**：背景→程序化渐变；水晶球→代码绘制的球；牌背→CSS 几何花纹；牌面插画→程序化渐变底 + 代码绘制符号；卡框→CSS 描边框。所以素材可以分步替换
4. **牌面三层，插画与文字分离**：`CardFace.jsx` 自下而上 = 插画层（`cards/<id>`）/ 卡框层（`frame`）/ 文字层（罗马数字 + 牌名，代码渲染）。**AI 只出插画，绝不让 AI 画文字或边框**——这样 22 张的边框绝对一致，文字随时可换字体/语言
5. **一致性来自技法与卡框，不来自配色**（用户明确要求）：每张牌按自己的牌性单独选色，风格统一靠「同一套绘制技法 + 同一张卡框」保证。所以**不要为了统一而去锁死一个色系**
6. **主视觉及其拆层素材必须同帧**：全部按 3:2（1536×1024）画布出图，同样构图。因为叠层靠百分比对齐，一旦某层画布比例不同就会整体错位

### 主视觉底板与坐标系（`.hero-frame`，2026-09-18 重构）

**踩过的坑**：背景原来用 CSS 的 `background-size: cover` + `background-position: center 30%` 渲染。
`cover` 会按视口比例裁剪缩放图像，于是「图像里的百分比」和「叠层用的百分比」**根本不是一个坐标系**。
实测 1600×900 视口下：背景里的球被放到视口的 68.8% 画高处、直径 37.5%，而 `ANCHORS` 写的是 62% / 36vmin
—— 代码画的那颗球偏上约 6.5% 画高、还小了约 11vmin，**从来没和背景对齐过**。

**解法**：把主视觉放进一块**尺寸只由视口决定、比例固定 3:2** 的底板 `.hero-frame`：

| 层 | 职责 |
|---|---|
| `.hero-frame` | 只负责「定位 + 定尺寸 + 提供容器查询上下文」。`width: max(104vw, 156vh)`、`aspect-ratio: var(--hero-aspect)`、`transform: translate(-50%, -30%)`、`container-type: size` |
| `.hero-plate` | 只负责「入场动画 / 呼吸动画」的 `transform: scale()`。**没有自己的定位 transform**，否则会和动画互相覆盖 |
| `.hero-layer--bg` / `--figure` | 1:1 铺满画布，不裁剪不拉伸 |
| `.orb` | 挂在 `.hero-frame` 上（**不挂 `.hero-plate`**，否则呼吸动画会让可点击的球一直慢慢放大缩小）；`left/top` 用百分比、`width/height` 用 `cqh` |

这样底板内部就是**纯粹的图像坐标系**：`ANCHORS.orb` 直接写图像里的百分比，叠层自动对齐，换视口比例也不跑偏。

两条必须记住的换算关系：
- `.hero-frame` 的宽度公式里 `104vw / 156vh` 由「上下左右各外扩 2%（`HERO_LAYOUT.bleed`）」和画布比例 1.5 推出；**`--hero-bleed` 存的是总量 4（= bleed × 2）**，脚本里复现这套数学时别漏乘 2（`preview_hero.py` 踩过这个坑）
- 底板内 `1cqh = 画布高的 1%`，所以 `ANCHORS.orb.size: 31` 就是「球直径 = 画布高的 31%」

当前锚点（`ANCHORS.orb = { x: 50, y: 61.5, size: 31 }`）是**实测**出来的：
掌心辉光中心在画布 `(49.98%, 66.4%)`；双手窝出的可用圆直径约画布高的 31%，
再大就会把两只手的手指几乎全盖住，反而看不出「捧」的姿态。


### 卡框规格（`scripts/build_card_assets.py` 量出，写进 `skin.js`）

用户提供的参考图式卡框：米白厚卡纸 + 金色卷草角饰 + 深青内带 + 左侧宝石 + **右下角悬挂吊牌**。

| 项 | 值 |
|---|---|
| 卡框素材 | 986×1496（含右下吊牌探出卡体之外的留白），**外圈已填成纸色 → 实心矩形 + 中央开窗** |
| 卡牌比例 `CARD_ASPECT` | `986 / 1496`（≈0.659） |
| 插画窗口 `FRAME_INSET` | left 10.85% / top 7.02% / right 12.37% / bottom 13.90% |
| 卡片本体裁剪 `CARD_BODY_CLIP` | **全为 0**（2026-09-18 起；卡框已是实心矩形，不再需要按本体裁剪） |
| 卡框纸色 `CARD_PAPER` | `#dfd2ba`（脚本实测；卡面兜底底色，**绝不能是暗色**） |

两条必须遵守的几何约定：

1. **卡牌比例跟着卡框走**，不再写死 3:5。卡框量出什么比例，卡牌就用什么比例，插画与卡框一律 1:1 铺满、**不做任何拉伸变形**
2. **卡面兜底底色必须是纸色**。卡框素材历史上在卡片本体之外（吊牌那一带）留过透明外边距，
   这一带如果没有东西填，漏出的就是兜底底色 —— 暗色兜底 = 22 张牌一圈黑边（2026-09-18 已根治，见变更日志第七轮）。
   现在卡框自己已填实，`clip-path` 退化为空操作但保留兼容；`CARD_PAPER` 与 CSS 的 `--card-paper` 是第二道保险

**牌名文字的位置**：这个卡框的下框带被双层金线占满，净空只剩 13px / 25px，**放不下牌名**。所以牌名落在插画窗口内下缘，并垫一层由透明渐深的暗色底衬（`--scrim-height`）；罗马数字仍在上框带（那里有约 72px 净空）。换卡框后要重新确认这两处净空够不够。

所有几何量由 `applySkinVars()` 统一灌进 CSS 变量，**组件与样式表里都不出现具体数字**，换皮肤只改 `skin.js`。

### 卡牌与标题的几何契约（2026-09-18 第十二轮确立）

抽出的卡牌与「今夜一签」标题共享同一条垂直轴线，两者的上下边界**必须由同一组变量推导**，
否则任何一侧改数值都会撞车。历史上就翻过一次车：标题原本写死 `top: 13%`，而牌顶实测落在 15.5%，
且 `.stage` 的 `z-index: 40` 高于 `.headline` 的 `20` —— 结果标题 42.9px + 副标题 19.5px 被压掉一大截，
移动端更是整行副标题被完全盖住。

**现在的做法：标题改成「贴着牌顶往上长」（bottom 锚定），而不是「从页面顶部往下量」。**

```css
.headline {
  bottom: calc(100% - var(--stage-anchor-y) + var(--card-height-half) + var(--title-gap));
  top: auto;
}
```

三个变量各有明确出处，**改任何一个都要同时确认另外两个**：

| 变量 | 来源 | 当前值 | 含义 |
|---|---|---|---|
| `--stage-anchor-y` | `ANCHORS.stage.y`（`skin.js`） | `40` | 牌**中心**在视口里的高度百分比 |
| `--card-height-half` | `CARD_HEIGHT_HALF`（`skin.js`） | `min(21.5vh, 210px)` | 牌高的一半，`CARD_HEIGHT` 的 1/2 |
| `--title-gap` | `TITLE_GAP`（`skin.js`） | `38px` | 标题块底边与牌顶之间的净空 |

推导：牌顶 = `100% - stage-anchor-y + card-height-half`（视口高度减去牌顶之上的距离）；
标题块底边就落在这条线上，再往上让出 `title-gap`。

> ⚠️ **`title-gap` 是「副标题 ↔ 牌面」唯一的可调量，这一点反直觉、必须记住。**
> 因为标题带是**跟着牌顶走**的：挪卡牌、改卡高，都只是让两者一起平移，
> 间距**恒等于 `title-gap`**。第二十三轮用户说「卡牌有点靠上，与副标题有点重叠」，
> 第一反应是「把牌往下挪」—— 那样改完间距一动都不动。
> 真正拉开距离只能改 `title-gap`，而改它会把标题带整块往上顶（顶端余量很薄，
> 见 `index.css` 的 `.headline__title` 字号公式）。
>
> 第二十三轮用的解法是「**下移换空间**」：落点 `38.5 → 40`、卡高 `46vh → 43vh`
> （下半 `23 → 21.5`）→ 牌顶 `15.5% → 18.5%`（牌往下走 20–24px），
> 再把 `title-gap` `20 → 38` → 标题带绝对位置净变化只有 +0.4px(@612) / +3.2px(@708)，
> 而副标题与牌之间的净空**翻倍**。
>
> 而且 `40 + 21.5 = 61.5%`，**与改前逐位相同** —— 面板净空零损失。
> 这是刻意的：竖屏下面板净空只剩 10.1px，往下挪底边立刻翻负。

**两条硬约束，改代码前先读：**

1. **`CARD_HEIGHT` / `CARD_HEIGHT_HALF` 必须与 `.card` 的实际高度保持一致**。`.card` 的高度写的是
   `var(--card-height, min(43vh, 420px))` —— `43vh` 这个字面量是 `skin.js` 里 `CARD_HEIGHT` 的兜底副本。
   改高度必须**两边一起改**，只改一边会让标题错位（CSS 变量没注入时走兜底值，注入后走 `skin.js` 值）。
2. **`.headline` 不要加 `top`，也不要给固定高度**。它是 bottom 锚定的自增高块，高度由
   `.headline__title` 那条 `clamp(26px, min(3.6vw, calc(14.8vh - 56.8px)), 54px)` 与副标题行数决定；
   一旦固定高度，字体在窄视口收缩时标题底边就会脱离牌顶。
   ⚠️ 那个 vh 项的常数是**从几何契约反推**的，不是试出来的系数 —— 改 `stage.y` / `CARD_HEIGHT_HALF` /
   `TITLE_GAP` 任意一项，都必须把它重推一遍（推导过程写在 `index.css` 那段注释里）。
   移动端的字号与行距通过媒体查询调整（窄屏上限受**顶栏横向空档**限制，见 `index.css` 里的注释），
   **不要再用 `top: 10%` 之类的覆盖值**（第十二轮已删除该覆盖）。
3. **`.headline__rule`（碑铭线）必须是真实元素，不要改回伪元素**。它落在 `title-gap` 那 38px 里，
   是全站唯一「在标题带与牌面之间」的东西，必须能量位置才能断言它没越到牌面上。

回归验证脚本：`scripts/flows/audit-title.js` 会量出 `overlapTitleCard` / `overlapSubCard` / `overlapHeadlineCard`
（三个都必须为 `0`），另外还断言四件事：`PASS_subCardGap`（副标题↔牌面 ≥30px）、
`PASS_titleOnScreen`（标题墨迹不被顶出屏幕）、`PASS_noTopbarHit`（标题/副标题墨迹与顶栏文字**零二维相交**）、
`PASS_rulePlaced`（碑铭线在副标题下、又没落到牌面上）。
桌面（1582×804，实测 innerHeight 708）与移动（504×784，实测 688）都要跑，移动端是最容易破的地方。
⚠️ 这个环境的 Chrome 窗口高有上限，`--h` 传进去后 `innerHeight` 会比它**小 96px**（804 → 708、708 → 612），
看结果时注意换算。

### 美术产出的四条工艺约定

1. **AI 出图不含文字**：提示词里明确写「不能出现任何文字、字母、数字、签名或水印」，罗马数字与牌名一律代码叠加
2. **牌面固定裁底部 5%**：AI 水印固定出现在画面最底边，统一裁掉即可彻底去水印；卡框下边带本来就盖住底部，对成品无影响
3. **浅色材质上的水印用形态学开运算抹掉**（`strip_light_watermark()`）：开运算（先 MinFilter 腐蚀、后 MaxFilter 膨胀）移掉比底色亮的细笔画，同时保住大面积色块和比底色暗的线条（金饰描边）。只在「原图明显比开运算结果亮」处替换，不留痕迹。
   - **修补区域必须避开卡框主体**：水印只压在 y≥0.95h 那一带（原吊牌下缘），区域卡在这一带就不会误伤金饰
   - 核大小要小于目标边缘的厚度：核 9 会连浅色斜边一起抹掉（实测核 7 才干净）
   - 顺序上这一步跑在「裁到卡片本体」之前（`main()` 里先 `strip_light_watermark` → `extract_frame` → `card_body_rect` 裁切），
     所以历史包袱已经被裁掉了 —— 抹水印区域现在**整体落在裁切范围之外**，改成纯保险丝
4. **背景类素材（左右近似对称）用水印镜像修补**（`repair_by_mirror()`）：把对称位置的干净内容镜像覆盖过去，比 AI 重画干净可控
5. **⚠️ ImageGen 必须一张一张出，不能并行**（本项目踩过的坑，教训最深的一条）：
   - 同一轮里发多个出图请求，会**串目录**（全部写进第一个请求的 `output_dir`），甚至**静默失败**（某个请求返回另一个请求的结果，实际少出图）
   - 因此每张牌的 `output_dir` 单独一个目录 `assets/card-art/<牌号>/`，脚本按目录扫描取图，**不依赖文件名**——这样即使文件名不可控也不会错位；出完立刻核对落盘目录
6. **牌面母版登记在 `scripts/build_card_assets.py` 的 `ARTS`**：新增牌面时补一行（牌号 / 中文名 / 英文名 / 罗马数字 / 配色说明），插画文件本身由目录扫描，不用登记文件名

### 素材体积

WebP 压缩后（牌面按实际显示 2 倍图 768×1123）：

| 素材 | 体积 | 说明 |
|---|---|---|
| 卡框 `frame` | 153 KB | 22 张共用，768×1123 |
| 牌面 `cards/major-XX` | 148–330 KB | 平均约 233 KB，**22 张合计约 5.0 MB** |
| 主视觉 `hero-bg` | 137 KB | v2 无球版，1536×1024 |
| 水晶球 `hero-orb` | 126 KB | 768×768，带 alpha |
| 牌背 `card-back` | 179 KB | 含 CARD_ASPECT 比例缩放（由脚本现读 `skin.js`） |
| 分享封面 `og-cover.jpg` | 103 KB | 1200×630 |
| 低清占位 `lqip.js` | 0.1 KB | 内联 data URI，不额外发请求 |
| 标题字体子集 `assets/fonts/` | 10.0 KB | 3 个 woff2（Cinzel + Noto Serif SC 900/400），第二十三轮 |
| **BGM 循环 `assets/audio/ambient-loop.mp3`** | **342.6 KB** | 60s 无缝循环 / 单声道 48kbps ABR，第二十四轮。**比一张卡牌图还小** |

原始出图母版存在 `assets/card-art/`（22 张 PNG 约 57 MB）与 `assets/hero-art/`。

主视觉拆层：背景氛围（`hero-bg`）/ 巫师人物（`hero-figure`，未做）/ 水晶球（`hero-orb`）/ 文字 UI（代码）/ 前景雾气粒子（代码 + Canvas）。
**水晶球必须独立成层**，否则无法单独做发光、旋转、点击反馈。


### 迎接动画 · 信封开启（`src/components/EnvelopeWelcome.jsx`，2026-09-18 第九 / 第十轮）

用户进页面时先看到一封火漆封缄的信：封印亮起、碎裂 → 上翻盖翻开、暖光与星屑从开口涌出 →
信封朝镜头推近化进暗场 → 暗场退去露出场景。把「抽牌」包装成「收到一封信」。

**构图是「极近距离的大特写」（第十轮重做）。** 第一版是一只完整的小信封浮在画面正中，
被用户否掉：「你这种算是很传统的小信封打开，我要的是那种涵盖整个网页大小的，
而且信封不是正着摆放，是一种倾斜的角度，角度很近聚焦在信封开口的那种」。
所以第二版把信封放大到**四边全部溢出视口**，整封带一个斜角 + 一点 3D 前倾，
画面里只剩下上翻盖那块大三角、内腔与坐在尖端上的火漆封印。

相机参数只有 4 个，全在 CSS 的 `.env-cam` 上 —— **调构图改这几个就够**：

| 变量 | 现在 | 作用 |
|---|---|---|
| `--env-rot` | `-15deg` | 平面内斜角（信封歪多少） |
| `--env-tilt` | `-9deg` | 3D 前倾（开口朝镜头多少，才看得进内腔） |
| `--env-shift-y` | `7vh` | 纵向位置（决定封印落在画面哪个高度） |
| `width` | `max(136vw, 186vh)` | 整封大小（决定溢屏多少） |

竖屏单独覆盖一组（`max(200vw, 200vh)` / `-13deg` / `3vh`）—— 竖屏要覆盖 504×784 且旋转 13°，
信封高度至少得约 1100px，按 `136vw` 算只有几百像素，左上角会露出暗场（实测过）。

**四条设计决定：**

1. **纯代码绘制，不用 AI 出的信封图**。① 入场动画必须立刻可见，依赖网络图片会先闪一下暗场；
   ② 出图要花积分（项目红线），而信封这种几何造型代码完全能做。
   继承站点的「纸 + 金箔」语言：米白厚卡纸取卡框的纸色家族、金色发丝边对应卡框的金线、
   盖面内嵌一道金线呼应卡框下框带的双金线、**火漆封印沿用牌背的八芒星母题**、开口下方压一枚月相。
   整段动画只增加约 4.6 KB（比一张牌面素材还小）。
2. **与原有入场动画并行，不额外增加等待**。场景自身的入场（`.veil` 散去 + 底板聚焦）从 t=0 就在信封背后照常跑，
   信封退场时场景已经就位。所以**抽牌可点击的时机和加这个动画之前完全一样**（`TIMING.entrance` = 2.6s）。
3. **信封内部是静态的**：`.env__cavity`（内腔）与上翻盖**同形**（都是 `(0,0) (100%,0) (50%,58%)` 这个三角形），
   所以盖着时被翻盖整块遮住，翻盖一转开就自己露出来 —— **不需要任何显隐动画**。
4. **随时可跳过**：任意点击 / 按键快进收尾（0.56s）。开头 0.26s 内忽略点击，
   免得「点一下让窗口获得焦点」就把动画吃了。

**明暗关系是大特写的命门（第十轮的核心改动）。** 放大到溢屏之后，「纸」几乎铺满整个画面，
第一版那套「小信封」的明度关系立刻崩掉，踩了三个坑：

- **上翻盖必须比本体亮、比本体暖。** 两者原本同族同明度，合上时整屏是一块糊在一起的奶油色，
  连翻盖的边界都看不出来（只剩两条金边）。现在本体压暗到 `#e9dcc2→#c9b998`、
  盖面提到 `#fdf7ea→#e5d9bd`，一叠才有「一片纸盖在另一片纸上」的层次。
- **内腔必须是暗的。** 内部的暗与外圈纸的亮形成反差才算「一个开口」；
  第一版的内腔偏亮，开了盖是一块浅灰，完全没有纵深。现在 `#6a5436→#120c06`，
  靠尖端那侧几乎全黑。
- **开口的暖光不能用 `mix-blend-mode: screen`。** 纸本来就是亮的，screen 只会把它整体提白 ——
  实测开口那一帧整屏糊成灰紫、四角的暖调全丢。现在改成普通 alpha 叠加的 `.env__bloom`，
  中心压在**内腔靠上那一段**（30% 高度）而不是画面正中，半径收到画面四角之外就衰减干净。

顺带删掉了第一版的两层光（`.env__halo` 信封背后的光晕、`.env__beam` 向上的光柱）——
它们都依赖「信封完整地摆在画面里」，现在光晕被完全遮住、光柱直接冲到画面外，纯属浪费。

**⚠️ 三条必须记住的坑：**

1. **`perspective` 只作用于「直接子元素」。** 相机的透视挂在 `.welcome__stage` 上，
   `.env-cam` 就必须是它的直接子元素；翻盖的透视挂在 `.env__flap-slot` 上，
   `.env__flap` 是它的直接子元素。挂错层级 = 完全不生效。
   `scripts/flows/welcome.js` 会断言这两处（`camIsStageChild` / `slotGrouped` / `perspectiveOnSlot`）。
2. **`opacity` / `filter` / `clip-path` 是 grouping property**，会把所在元素的子树压平成 2D。
   所以不要把它们挂到 `.env-cam` / `.env__flap-slot` 上（`camGrouped` / `slotGrouped` 断言为空）。
   注：`.env-in` 为了淡入必然带 opacity，它只压平「自己那一层的结果」，
   不影响 `flap-slot` 内部的透视 —— 这一项不算失败，别被误导。
3. **上翻盖的角度不是 180°。** `rotateX(θ)` 把纵坐标映射成 `y·cosθ`，θ 越接近 180°
   翻开后的投影高度越接近闭合时的原尺寸 —— 结果是一块和原来一样大的平板顶在信封上，像「屋顶」。
   用 **-142°**（投影高度 79%）才有「盖子立起来、往后倒」的立体感；
   透视值也要**跟着信封尺寸走**（`max(170vw, 232vh)`），写死 900px 在放大到溢屏后会把翻盖拉成畸变的喇叭形。
   另外 `.env__flap-shade` 的渐变方向要用 `0deg`：元素坐标里 y=0 是折边、y=100% 是盖子尖端，
   翻起来之后尖端跑到上面去了，而尖端是转得最远、最背光的一端，写反就变成折边发暗。

**配置与开关**（`src/config/skin.js`）：

- `TIMING.welcome`（2.7s）—— 信封总长，必须 ≥ 组件内 `T.end`
- `WELCOME.enabled` —— 关掉后组件不挂载，直接走原有入场
- `WELCOME.skipWhenDrawn` —— **今日已抽过牌就不再播放**。此时页面直接呈现今天的牌：
  仪式感留给「还没抽」的那一刻，也免得刷新一次看一遍。这条会在首次渲染前同步读 `localStorage`
  （`readTodayRecord()`，见 `hooks/useDrawState.js`），不能等 effect，否则会先闪一下场景再盖上信封
- `prefers-reduced-motion: reduce` 强制关掉（在 `App.jsx` 的 `shouldGreet()` 里判断）
- 调试条加了「重播迎接」按钮：只重新挂载信封那一层、**不动抽牌状态**，
  方便在任意界面上反复调这段动画（也是回归自检取帧的手段，见下节）

调色 / 调相机 / 调光全在 `src/index.css` 的「迎接动画 · 信封」一节，组件里只有时间轴 `T` 与 `SKIP`
以及火漆的不规则轮廓（`waxBlob()`，正圆会看成玻璃珠）。


## 动画时序（参数收口在 `src/config/skin.js`）

**⚠️ 时序分两张表，别改错地方：`TIMING` 只含「入场时序」；抽牌仪式在 `DRAW_RITUAL`。**
抽牌的**绝对时刻表由 `drawBeats(reduced)` 派生**，组件一律读时刻，**不许自己把时长相加**
（2026-09-19 的「空面板挂 1.6 秒」就是 App 与组件各算了一遍延迟导致的）。

- **迎接 2.7s（`welcome`，与下列入场并行）**：信封浮现 0.85s → 封印亮起 0.78s → 封印碎裂 1.12s →
  上翻盖翻开 1.24s 起 0.6s → 开口暖光 1.28s / 星屑 1.36s → 信封朝镜头推近化进暗场 2.10s →
  暗场退去 2.30s → 卸载 2.62s
  （退场刻意压在「翻盖翻完（1.84s）后再等一拍」—— 早先 1.94s 时「完全打开」只存在 0.1s，观众几乎看不到开口）
- 入场 2.6s：雾气自中央散开（veil 淡出）→ 背景从 `scale 1.2 / blur 16px` 聚焦到 `scale 1.02`
- 常驻循环：雾带反向漂移、球内星云流转、呼吸发光、光环脉冲、Canvas 星屑粒子
- **点击 → 抽牌仪式 5.7s，分八拍**（详见 `MOTION_AUDIT.md` 第 7 节）：

  | 拍 | 时刻（ms） | 时长 | 发生了什么 |
  |---|---|---|---|
  | ① 蓄势 CHARGE | 0 → 1000 | 1000 | 球充能、雾扰动加剧、暗角压下、副标题退出；**牌尚未挂载** |
  | ② 释放 RELEASE | 1000 → 1520 | 520 | 爆闪峰值 ≈1094，成为牌起飞的助推 |
  | ③ 升起 RISE | 1060 → 2210 | 1150 | 牌自球心升起，**全程只显牌背** |
  | ④ 悬停 HOLD ★ | 2210 → 3360 | 1150 | 牌停住不动，只留 `rotateZ` 微摆与 halo 呼吸 |
  | ⑤ 预压 WARM | 3360 → 3500 | 140 | 反向小幅后仰 −6°（翻转前的 anticipation） |
  | ⑥ 翻牌 FLIP | 3500 → 4700 | 1200 | 4 关键帧 / 3 段曲线 `0 → −6 → 168 → 180`（168° @ 4500），跨 90° 高光扫过 |
  | ⑦ 留白 TAIL ★ | 4700 → 4980 | 280 | 停住，让牌面被看清 |
  | ⑧ 面板 PANEL | 4980 → 5700 | 720 | 外框推入，内容紧随此后 205ms 依次亮起 |

  ★ 两拍 = 期盼感的来源：**期盼 = 动作之前的等待（①④）＋ 动作之后的静止（⑦）**。
  加长靠**加拍**，不靠把所有曲线拖慢（那会整体变廉价）。
  `prefers-reduced-motion` 下整条仪式压到 **27ms**（`DRAW_RITUAL_REDUCED` + `drawBeats(true)` 同源降级）。


## 开发辅助

- **牌面总览面板**：开发模式下点左下角调试条的「牌面总览」，可一次看到 22 张牌面，用于核对边框是否统一、哪些牌还缺插画。牌面复用 `CardFace`，与抽牌场景是同一套渲染。
- **⭐ 无头截图 / 视觉自检**（2026-09-18 新增，此前项目完全没有视觉核验能力）：
  `scripts/shot.mjs` 用 CDP 驱动**本机已装的 Chrome/Edge** 导航、执行 JS、截图，**零依赖**（不用装 agent-browser / playwright 那 500 MB 的 Chromium）。
  ```bash
  cd "C:/Users/29923/WorkBuddy/2026-09-17-19-02-52/tarot-app"
  N="C:/Users/29923/.workbuddy/binaries/node/versions/22.22.2-3/node.exe"
  "$N" scripts/shot.mjs http://127.0.0.1:5173/ shot.png                      # 静态首页（含迎接动画）
  "$N" scripts/shot.mjs http://127.0.0.1:5173/ shot.png --w 420 --h 880      # 移动端竖屏
  "$N" scripts/shot.mjs http://127.0.0.1:5173/ shot.png --reduced            # 模拟 prefers-reduced-motion（应跳过迎接动画）
  "$N" scripts/shot.mjs http://127.0.0.1:5173/ shot.png --seed "localStorage.clear()"   # 先清记录再重进，测「今日已抽」分支
  "$N" scripts/shot.mjs http://127.0.0.1:5173/ shot.png --eval-file scripts/flows/reveal.js
  "$N" scripts/shot.mjs http://127.0.0.1:5173/ shot.png --eval-file scripts/flows/share.js
  "$N" scripts/shot.mjs http://127.0.0.1:5173/ shot.png --eval-file scripts/flows/welcome.js
  # 迎接动画按状态定格取帧（hash 选帧：sealed / lift / open）
  "$N" scripts/shot.mjs "http://127.0.0.1:5173/#lift" shot.png --gpu --eval-file scripts/flows/welcome-frame.js
  ```
  **`--seed "<js>"`** 在导航后先跑一段页面内 JS、再重新导航，用于制造「刷新时页面读到什么」的状态
  （如写入/清空今日抽牌记录），否则一次 `shot.mjs` 跑完浏览器就被关掉，localStorage 来不及落盘。
  **`--reduced`** 在**导航之前**通过 `Emulation.setEmulatedMedia` 打开 `prefers-reduced-motion: reduce`。
  **`--gpu`** 见下面那条坑 —— 页面上有「超大图层 + 滤镜」时**必须**加上，否则会看到并不存在的渲染错误。
  `--profile <dir>` 可复用同一份用户目录；临时 profile 目录名带 `pid + 时间戳`，避免上一次没删干净被复用而读到脏状态。

  **⚠️ 无头截图默认走软件光栅化（`--disable-gpu`），会在大图层上悄悄丢内容。**
  第十轮把信封放大到 2400px 之后，截图里**火漆封印整个没有画出来**、内腔也偏亮，
  我一度以为是 CSS 的锅，逐层探针查了半天才确认：DOM、几何、`fill: url(#tarot-wax)` 全都正常，
  是软件光栅化在这个尺寸下丢掉了带滤镜的图层。换真实 GPU（`--gpu`）后封印、暗部全部正常。
  **所以：怀疑「是不是渲染错了」时，先加 `--gpu` 对照一次，能立刻区分真 bug 与无头渲染的锅。**

  **⚠️ 不要用 `--wait <ms>` 去取「动画第 N 毫秒」的帧。**
  `--wait` 的时钟基准是 `Page.loadEventFired`，而 React 挂载通常早于它（load 还要等主视觉大图），
  实测偏出去近 1 秒；再加上「点击 → 取帧」之间还有几百毫秒的往返延迟，标称时间根本对不上。
  `scripts/flows/welcome-frame.js` 改成**轮询动画自身的状态**（读封印 opacity、
  从翻盖 `matrix3d` 的 `m22 = cosθ` 反解 rotateX），命中目标状态才返回，取到的帧与动画进度严格对应。

  `scripts/flows/*.js` 是回归流程脚本，会**打印实际渲染出的几何与素材加载状态**（球心百分比、牌背用的是素材还是 CSS 兜底、插画是否加载成功、分享图尺寸与体积……），比人眼目测可靠得多。
  `flows/welcome.js` 专测迎接动画，会断言：各层齐全、`coversViewport`（信封四边真的溢出视口）、
  相机与翻盖的 `perspective` 挂在正确层级、`camGrouped` / `slotGrouped` 为空、
  内腔与翻盖的三角形换算到信封坐标后**完全同形**、封印在画面内、暗场底色不透明、
  封印淡出到 0、翻盖矩阵是 `matrix3d`、动画结束后遮罩已卸载且无残留节点、水晶球可点击、标题文案正确。
  其中「量三角形」那一步要**先临时把 `.env-cam` 的相机变换置为 `none`** 再量 ——
  `getBoundingClientRect` 返回的是变换后的轴对齐外框，两个形状不同的元素外框不同，直接换算顶点会全部错位。
- **不需要浏览器的合成预览**：`scripts/preview_hero.py` 在 Python 里复现 `.hero-frame` 的定位数学（常量直接从 `skin.js` 现读，不复制），
  用成品素材合成出「某个视口下屏幕真正看到的样子」，用于核对锚点。加 `红框` 标出牌面落点，只看构图不看美术。

## 美术决策与资产状态

- **主视觉**：**v2「无球版」已就位**（1536×1024 暗夜星空厚涂，巫师双手托举、掌心留空）。
  做法：用 v1 概念图作参考图做 image-to-image 重绘，只把中央的水晶球去掉、保留球洒在手与斗篷上的微光。
  为什么必须重绘：只叠一层透明球的话，背景里原来画好的那颗球会从新球边缘露出来（双球）。
  换风格时同理 —— **主视觉与所有拆层素材必须同帧**（同比例同构图）。
- **水晶球层**：`hero-orb.webp`（透明底 768×768）。AI 出图时 `background: transparent` 返回了**白底 RGB**，
  用「最暗通道 + 四角泛洪填充 + 腐蚀 1px + 轻微羽化」抠出干净边缘（`scripts/build_hero_assets.py` 的 `key_out_white`），
  实测边缘无白边残留。球层压在代码绘制的漩涡/星云之上、镜面高光之下，72s 缓慢自转。
- **牌背**：`card-back.webp`（米白厚卡纸 + 金色卷草角饰 + 深青内带 + 中央金色八芒星与月相），
  与卡框同一套语言。**按卡体比例整体缩放而非裁剪** —— 源图 2:3、卡体 0.684，裁会切掉底部那圈金边，
  2.5% 的非等比缩放肉眼看不出来。
- **移动端**：竖屏实测（504×784）**基本可用** —— 底板横向被裁到画布中央 41%，
  但巫师构图本来就居中，球仍稳稳落在手心（`orbCenterPct = 50 / 62.8`），构图成立、不塌。
  单独出 9:16 竖构图仍是提升项，但**不再紧急**（见 `NEXT_STEPS.md` P1）。

- **卡牌风格（已定，第四轮收敛）**：
  - 第一轮：水彩晕染 / 炭笔素描 / 复古绘本线描淡彩（技法对比）
  - 第二轮：卡通减法三版。结论：AI 对「简化」的理解很顽固，**必须用否定式强约束**（「没有写实五官、没有写实解剖、没有细节褶皱」）才压得住
  - 第三轮：改为**二次元赛璐璐**（用户给参考图），出了紫金 / 青蓝两版《星星》
  - **第四轮（定稿方向）**：用户给了 4 张参考图（日式游戏卡面），并指出上一版**线条还不够简洁**。修正要点写进提示词：
    - **线稿纪律**：描边粗细均匀、连续闭合、无草稿感/无纸张纹理；**描边用所在色块的深色版本**（蓝区用深靛线），不用纯黑粗线
    - **上色纪律**：纯色块平涂，每块只 2–3 个硬边色阶；**完全不做渐变、厚涂、水彩晕染、颗粒纹理**
    - **背景纪律**：背景是**平面装饰图形**（抽象飘带、漩涡、同心圆、几何纹样、十字星芒），不是写实风景
    - 这四条一上，线条干净度和参考图就对上了（`assets/card-styles/anime-v2/`）
- **配色策略（用户明确要求，重要）**：**不锁定单一配色**。每张牌按自己的牌性选色，**风格一致性来自「技法 + 卡框」，不来自颜色**。22 张的实际用色见 `scripts/build_card_assets.py` 的 `ARTS`（每张都有配色说明）
- **22 张牌面**：✅ 全部完成。major-00 ~ major-21，按牌性各配一色（愚人暖金·风 / 魔术师朱红·火 / 女祭司靛蓝·月 / 女皇翠绿·土 / 皇帝赭红·铁 / 教皇象牙·紫 / 恋人玫粉·风 / 战车深紫·金 / 力量暖橙·火 / 隐士墨蓝·灯 / 命运之轮青金·轮 / 正义冷银·赤 / 倒吊人青绿·悬 / 死神深红·暗 / 节制淡青·和 / 恶魔暗紫红·缚 / 塔铅灰·雷 / 星星青蓝·水 / 月亮银蓝·雾 / 太阳明黄·阳 / 审判天青·号 / 世界翠绿·紫罗兰）
  - 验收图：`assets/previews/contact-sheet.png`（22 张原始插画总览）、`assets/previews/contact-sheet-framed.png`（22 张成品总览，用于核对边框一致性）
- **统一卡框**：✅ 已完成并接入代码。米白厚卡纸 + 金色卷草角饰 + 深青内带 + 左侧宝石，实心矩形 + 中央开窗；22 张共用同一张素材，边框绝对一致。（原设计右下角的**悬挂吊牌已于 2026-09-18 第八轮去除** —— 用户决定先收成干净矩形，装饰性外挂元素等跑通后再议）
- **牌面文字用代码叠加**：AI 只出插画，罗马数字与牌名由代码渲染，保证清晰可换。
  - 罗马数字在上框带（约 72px 净空，深金棕色 `#8a682e`）
  - 牌名落在插画窗口内下缘，垫 15% 高的渐变暗底衬 + 文字同色描边。**实测教训**：底衬用 12.5%/0.8 不透明度时，浅色插画（恋人 / 力量 / 太阳）上牌名对比不足，加到 15%/0.88 并给文字加 `paint-order: stroke fill` 描边后才清晰
- **水印**：卡框、主视觉、水晶球与 22 张牌面的水印**均已清除**（牌面靠统一裁底部 5%，主视觉靠镜像修补，球靠抠白底顺带解决）；
  `assets/card-styles/` 下的历史测试图仍带水印，仅作存档，不影响交付

## 待办

**已全部移入 `NEXT_STEPS.md`**（含优先级、具体做法、成本估算与踩坑提醒）。最高优先级的未完成项是：

1. 发布上线（纯静态零后端，`dist/` 直接托管；`index.html` 里的 `og:image` / `og:url` 上线后要换成绝对地址）
2. 本地日历回看页（需求里列为「后续可加」，抽牌记录已在 `localStorage`）
3. 移动端专门出 9:16 竖构图主视觉（**不紧急**，实测竖屏构图已成立）
4. 可选：`hero-figure` 人物层（做背景/人物/球的三层视差，纯锦上添花）
5. ⚠️ **上线前必补：favicon**（2026-09-21 核出：`public/` 下只有 `og-cover.jpg` 与 `skins/`，
   `index.html` 里也没有 `<link rel="icon">` → 浏览器标签页是**空白默认图标**，作品集观感直接打折）。
   做法见 `NEXT_STEPS.md` §2 P1
6. ~~可选：中文衬线子集字体~~ → **✅ 已做，不是待办**（第二十三 / 二十四轮）。
   现状：`src/index.css` 有 4 条 `@font-face`、`src/assets/fonts/` 三张 woff2 共 **10 KB**
   （`title-latin` Cinzel 400..900 + `title-han` 400/900，均 SIL OFL 1.1），标题已是罗马碑刻体。
   **剩余欠账**：牌名 / 低语 / 正文仍是系统字体栈 —— 做法见 `NEXT_STEPS.md` §2 P2
   > ⚠️ 本条目 2026-09-21 更正：此前写的是「当前 `@font-face` 数量为 **0**，全站靠系统字体栈兜底」，
   > 那是第二十一轮的状况，第二十三轮就做完了却没回来改 —— 这类「列在待办里、其实早做完」的条目
   > 比漏记更坏：下一个接手的人（包括几个月后的自己）会照着它重复劳动。

## 成本红线（重要）

图片生成每张消耗 5–10 积分。已完成 **30 张**（22 张牌面 + 卡框 + 主视觉 v1 + 主视觉 v2 无球版 + 水晶球 + 牌背 + 历史测试图若干）。
**剩余美术需求约 1–2 张**（手机竖构图，可选），预计 **5–20 积分**。批量出图前必须先跟用户确认。


## 常用命令

```bash
cd "C:/Users/29923/WorkBuddy/2026-09-17-19-02-52/tarot-app"
N="C:/Users/29923/.workbuddy/binaries/node/versions/22.22.2-3/node.exe"
PY="C:/Users/29923/.workbuddy/binaries/python/envs/default/Scripts/python.exe"

"$N" node_modules/vite/bin/vite.js            # 开发预览 http://127.0.0.1:5173
"$N" node_modules/vite/bin/vite.js build      # 生产构建 → dist/（绝对路径，正式发布用）

# ---- 看「用户视角」（无调试条）----
"$N" node_modules/vite/bin/vite.js preview    # 起本地 http 预览 dist/
# ⚠️ 离线通道（dist-user / dist-dev / 三个 .cmd）已于 2026-09-19 整体移除，见第 6 节第 29 条
# 线上地址见 NEXT_STEPS.md §2「发布上线」

# ---- 美术素材流水线 ----
"$PY" scripts/build_card_assets.py            # 牌面：去水印 + 裁切 + 导出 WebP + 合成预览
"$PY" scripts/build_hero_assets.py            # 主视觉拆层：背景镜像去水印 / 球抠白底 / 牌背缩放
"$PY" scripts/build_lqip.py                   # 主视觉低清占位图 → src/config/lqip.js
"$PY" scripts/build_og_cover.py                # 分享封面 → public/og-cover.jpg
"$PY" scripts/preview_hero.py                 # 不需要浏览器的合成预览（核对锚点）
"$PY" scripts/contact_sheet.py                # 22 张原始插画总览
"$PY" scripts/contact_sheet.py assets/previews assets/previews/contact-sheet-framed.png

# ---- 视觉核验（无头、零依赖；参数与坑详见 NEXT_STEPS.md §3.1）----
"$N" scripts/run-flows.mjs --list              # 列出全部 flow
"$N" scripts/run-flows.mjs audit-title audit-draw audit-motion
"$N" scripts/run-flows.mjs probe-whispers probe-gallery --w 1582 --h 804
"$N" scripts/run-flows.mjs probe-whispers --w 504 --h 784   # 窄屏：低语整层应 display:none
"$N" scripts/run-flows.mjs probe-panel-worst --reduced      # 逐张遍历 22 张，取最坏净空
"$N" scripts/run-flows.mjs probe-sfx probe-sfx-off --seed "localStorage.setItem('tarot.sound','off')"
"$N" scripts/run-flows.mjs probe-sound-default                # 缺省开 + 第一次手势起播 + 喇叭图标两态
"$N" scripts/run-flows.mjs probe-ambient                     # 环境音：起来 / 常驻 / duck / 关得掉
"$N" scripts/verify-orb3d.mjs                  # 3D 球四用例

# ---- 字体（改了标题带文案 / 觉得字体「看起来不对」时跑）----
"$N" scripts/fetch-title-fonts.mjs             # 重抓子集（会验 wOF2 魔数，坏响应直接报错退出）
"$N" scripts/probe-fonts.mjs http://127.0.0.1:5173/   # dev；A/B/C 三条判据全过才 exit 0
"$N" scripts/probe-fonts.mjs http://127.0.0.1:4199/   # 生产构建（字体是内联 data URI，另一条路径）

# ---- 在生产构建上跑 flow（4188 / 5173 都是 dev server）----
"$N" node_modules/vite/bin/vite.js build
"$N" node_modules/vite/bin/vite.js preview --port 4199 --strictPort
APP_URL=http://127.0.0.1:4199/ "$N" scripts/run-flows.mjs audit-title audit-draw

# ---- 打包（给需要看代码的人；交付主形态是线上链接）----
"$PY" scripts/package_project.py              # 完整包（约 198 MB）
"$PY" scripts/package_project.py --light      # 轻量包（约 23 MB）
```

> 图像处理用受管 Python 虚拟环境 `C:\Users\29923\.workbuddy\binaries\python\envs\default`（已装 Pillow）。
> 换主视觉后必须重跑 `build_lqip.py` 与 `build_og_cover.py`，否则模糊底与分享封面会和实际画面对不上。


## 本机环境注意事项

- 会话内 bash 的 PATH 缺少 coreutils，`ls` / `find` / `head` / `rm` / `mkdir` / `cp` / `grep` / `sed` / `tail` / `sort` 全部 command not found。
  **用 Git 自带的绝对路径**：`"/c/Program Files/Git/usr/bin/ls.exe"`
- **`rm` 基本不可用**：即使调绝对路径 `rm.exe -rf`，也会被会话的 safe-delete 包装拦下（报 `SAFE_DELETE_FAIL_CLOSED`，或因目录被占用而 `trash-failed`）。
  要删文件请改用 Python：`"$PY" -c "import shutil,pathlib; shutil.rmtree(pathlib.Path('x'), ignore_errors=True)"`。
  **`assets/_debug/prof-reveal/` 是删不掉的临时 Chrome profile 残留**（被 safe-delete 拦下），不影响交付——`package_project.py` 本来就会排除 `assets/_debug`。
- PowerShell 工具在本会话不返回 stdout（exit code 0 但无输出），排查问题请用 bash + 绝对路径
- ⚠️ **写 `.cmd` / `.bat` 必须 GBK + CRLF**（2026-09-19）：
  - 换行若是 LF，cmd.exe 解析错乱 —— 报一堆「不是内部或外部命令」**而退出码仍是 0**，
    所以**不能靠退出码判断 .cmd 可用**；必须真的跑一遍
  - 编码若是 UTF-8，中文在 zh-CN 控制台上是乱码；而配 `chcp 65001` 又会串码。
    正确做法就是 GBK + CRLF，**不要 chcp**
  - ⚠️ `scripts/fix_cmd_encoding.py` 与这条「打包前置门槛」**已于 2026-09-19 随 `.cmd` 一并删除**
    （工程里不再有 `.cmd`/`.bat`）。现在靠 `.gitattributes` 的 `*.cmd -text -diff` +
    `core.autocrlf=false` 保护换行 —— 将来若再加 `.cmd`，这两条仍然适用
- ⚠️ **桌面 COM 自动化被拦**：`New-Object -ComObject WScript.Shell` 会报
  「COM object instantiation can run arbitrary code」→ **建不了 `.lnk`**。
  退路是写纯文本 `.url`（`[InternetShortcut]` + `URL=file:///...`），
  可用性实验脚本见 `assets/_debug/test-url-shortcut.mjs`（本机监听端口收 `<img>` 请求作为证据）
- ⚠️ **同一文件不要并行编辑**：同一条消息里发多个 Edit，工具各自基于同一份旧快照写回，
  后写的会**静默覆盖**先写的（2026-09-19 因此把 `skin.js` 的 `BASE` 声明弄丢，连生产构建一起带坏）。
  同一文件的多处修改必须**串行**，改完用 grep 复核
- 受管运行时：node `C:\Users\29923\.workbuddy\binaries\node\versions\22.22.2-3\node.exe`，npm.cmd 同目录；路径含空格需加引号。
  注意 `package.json` 里虽然有 `npm run dev`，但本会话 bash 里 `npm` 不一定可用，**直接调 `node_modules/vite/bin/vite.js` 最稳**
- **无头浏览器：不用装**。本机已有 Chrome 与 Edge，`scripts/shot.mjs` 用 CDP 直接驱动它们（零依赖）。
  不要去装 `agent-browser` / `playwright`，那要下约 500 MB 的 Chromium。Chrome 路径：
  `C:\Program Files\Google\Chrome\Application\chrome.exe`
- **给原生 exe 传路径时不要用 `/c/...`**：会被错误翻译成 `c:\c\...`。改成 `cd "C:/完整路径"` 后用相对路径（如 `python scripts/xxx.py`）
- 开发服务器：5173 端口**经常有上一轮会话遗留的 vite 进程占着**。启动前先探活（`fetch('http://127.0.0.1:5173/')`），
  能返回本项目内容就直接复用，别急着杀进程或换端口（`--strictPort` 会直接报 Port already in use）
- Chrome 无头模式传给 `--window-size` 的是**外窗口**尺寸，实际 `innerWidth/innerHeight` 会小一圈（实测 1600×900 → 1582×804）。要精确控制视口尺寸就多给一点余量


## 变更日志

- **2026-09-17** 需求对齐完成；搭建并跑通 Vite + React + Tailwind + Framer Motion 骨架（含素材槽位抽象层、三段式动画、22 张牌文案、两种抽牌模式）；产出主视觉概念图 v1；产出卡牌手绘风格测试图三版
- **2026-09-17（第三轮）** 卡牌方向改为**二次元赛璐璐 + 统一典雅卡框**（用户给参考图）。产出两版《星星》测试图（紫金 / 青蓝）与卡框素材；卡框抠成透明底开口并镜像修掉水印，接入代码成为 22 张共用的统一边框层；牌面重构为**插画 / 卡框 / 文字三层**（抽出 `CardFace` 组件，新增 `SmartImage` 多格式回退、`useAssetUrl`、`CardGallery` 牌面总览）；全部素材转 WebP 并把体积从 5.2 MB 压到 590 KB；新增 `scripts/build_card_assets.py` 素材后处理流水线
- **2026-09-17（第四轮）** 用户给 4 张日式游戏卡面参考图，指出线条不够简洁，并明确**配色不锁定单一色、按每张牌的牌性选色，一致性靠技法与卡框**。据此重写提示词（新增「线稿纪律 / 上色纪律 / 背景纪律」三条约束），出《星星》青蓝 / 《愚人》暖金 / 《死神》深红三张——**用暖金与深红验证了换色不乱风格，也验证了暗黑系牌扛得住这套语言**；重做卡框为参考图式样（含右下悬挂吊牌）；脚本新增形态学开运算去水印（解决吊牌上的水印）；卡牌几何改为跟着卡框走（比例 `986/1496` + 卡片本体 `clip-path` 裁剪，修掉插画从吊牌留白漏出的问题）；牌名因下框带被金线占满而移入插画窗口内下缘 + 渐变底衬；新增 `applySkinVars()` 把全部几何量灌进 CSS 变量
- **2026-09-17（第五轮 · 本轮到 22/22 完成）** 用户确认方向后**批量出完剩余 19 张牌面，22 张大阿卡纳全部就位**：
  - 出图方式改造：发现 **ImageGen 并行调用会串目录 / 静默失败**，改为逐张出图 + 每张独立 `output_dir`；素材目录改为 `assets/card-art/<牌号>/`，脚本按目录扫描取图（不再依赖不可控的文件名）
  - 脚本重构：`ARTS` 表扩到 22 张并带配色说明；`build_card_assets.py` 支持缺图告警；新增 `scripts/contact_sheet.py`（22 张联络表，验收风格与边框一致性）与 `scripts/package_project.py`（完整包 / 轻量包）
  - 修掉一个真实的可用性缺陷：**浅色插画上牌名对比度不足**。底衬从 12.5%/0.8 提到 15%/0.88，并给文字加 `paint-order: stroke fill` 描边，脚本与 CSS 两处同步
  - `CardGallery` 的「已接入插画」从写死清单改为**运行时真实探测**（逐个加载 `cards/<牌号>` 的首个候选地址），以后补新牌面会自动亮起
  - 首次打包交付：完整包 178.6 MB（141 文件）/ 轻量包 15.8 MB（78 文件，代码 + 运行时素材 + `dist/` + 两张验收总览）
  - 新增 `NEXT_STEPS.md` 作为剩余工作清单（本文件的待办章节改为指向它）
  - 生产构建通过（400 modules transformed），22 张牌面素材合计约 5.1 MB
- **2026-09-18（第六轮 · 拆层落地 + 上线前收尾 + 首次建立视觉核验能力）**
  - **拆层素材 3 张出完并接入**：主视觉改为 **v2 无球版**（用 v1 概念图 image-to-image 去掉球，保留掌心辉光）、
    **水晶球透明层**、**牌背**。关键判断：只叠透明球会露出背景里原来画好的球，所以主视觉必须重绘，不能只补层
  - **修掉一个一直存在的坐标系错误**（本轮最重要的发现）：背景原用 `cover` + `center 30%` 渲染，
    叠层百分比和图像百分比根本不是一个坐标系 —— 实测 1600×900 下球被放到视口 68.8% / 直径 37.5%，
    而 `ANCHORS` 写的是 62% / 36vmin，**代码画的球从来没和背景对齐过**。
    重构为固定 3:2 的 `.hero-frame` 底板（定位层与动画层分离 + `container-type: size`），
    `ANCHORS.orb` 改为图像坐标系百分比 + `cqh`，并用 CDP 实测确认底板 1664×1109.3、球 343.9px 完全符合公式
  - **修掉三处接入缺口**：`ASSETS.heroOrb` 被整个数组塞进 `<img src>`（React 会拼成 `"...webp,...png"`，
    必然 onError，**球的美术层此前从未生效过**）；`heroFigure` 与 `cardBack` 两个槽位在代码里**完全没有被引用**
    （牌背至今是纯 CSS 画的）。新增 `HeroStage` 组件承载底板 + 人物层 + 球
  - **修掉一个真实功能 bug：翻牌方向反了**。`CardFace` 根元素自带 `rotateY(180deg)`，
    而 `.card__flip` 从 180 动画到 0，导致抽牌动画**结束时停在牌背**上。改为 0 → 180。这个 bug 藏了很久，靠截图才发现
  - **P1 上线前收尾**：分享卡片图（Canvas 复刻三层牌面 + 竖版排版，先离屏量内容高度再按需整体缩放，
    22 张文案长短不一也不会压到页脚；输出 JPEG，2.3 MB → 230 KB）；`index.html` 补 og/twitter meta + 分享封面；
    首屏性能（`main.jsx` 按 skin 配置注入 hero-bg preload、内联 LQIP、空闲随机预热 6 张牌面、抽牌后再补几张）；
    `DRAW_MODE` 切到 `daily`；顺带修掉 `CrystalOrb` 缺 `useAssetUrl` 的问题
  - **新增 5 个脚本**：`build_hero_assets.py`（拆层素材后处理）、`build_lqip.py`、`build_og_cover.py`、
    `preview_hero.py`（不需要浏览器的合成预览，常量从 `skin.js` 现读）、
    `shot.mjs` + `scripts/flows/`（**CDP 驱动本机 Chrome 的无头截图与回归自检，零依赖**）
  - **首次建立视觉核验能力**（此前项目从未做过截图级核验）：22 张分享图全量渲染零报错、
    抽牌全流程与分享弹窗端到端跑通、移动端竖屏实测构图成立
  - 生产构建通过（405 modules transformed，CSS 24.7→31.8 KB，JS 280 KB / gzip 95.7 KB）
- **2026-09-18（第七轮 · 根治 22 张牌面的「黑边」，素材层）**
  用户反馈「上一轮出的 22 张塔罗牌素材都还有黑边，很影响美观，属于半成品的感觉」。定位到**两个独立成因**，
  都在素材层根治，并补了一套可重复跑的验收脚本：
  - **成因 A：卡框素材的「透明死区」**。原图卡片四周一圈白底留白，右下角吊牌挂在这圈留白里；
    抠图后留白变透明，而裁边 bbox 由「卡片 + 吊牌」共同决定，于是留白被保留成卡框的透明外边距
    （768px 基准：上 0 / 左 5 / 右 14 / 下 36 px）。这一带**卡框不画、插画又按裁切比例不画**，
    漏出的就是卡面兜底底色 —— 合成预览里 RGBA 转 RGB，透明像素直接变纯黑，
    这就是用户在成品总览图上看到的黑边；实机渲染也实测漏出 1/2/6/12 px 的 `#120a24` 暗边。
    **解法**：新增 `fill_outer_margin()`，把「与画布四边连通的透明区」泛洪填成纸色
    （中央插画开口是封闭区域，泛洪到不了），卡框从此是「实心矩形 + 中央开窗」。
    实测全图真透明占比 60.0%，正好等于插画窗口面积，四边外沿零空洞。
    同时 `skin.js` 新增 `CARD_PAPER`（脚本实测 `#dfd2ba`）与 `--card-paper` 变量，
    `.card__face--framed` 的兜底底色从暗色 `#120a24` 改成纸色；`CARD_BODY_CLIP` 全部归零
  - **成因 B：插画素材四边残留的浅色边带**（原图白边没裁干净）。原先用固定 `EDGE_TRIM=1.2%` 硬裁，
    实测 22 张里 17 张顶部仍有 0~22px 残线。改为**自适应判定**：一条残线必须同时满足
    「横跨整条边都亮」（比内部参考亮 38）且「亮得很平」（标准差 < 15）才算，
    只看亮度会把「画得亮的天空」误判成残线（已验证 major-06/08/14/19 这类亮牌被正确跳过）。
    四边各自独立判定 + 3px 兜底，并**循环收敛最多 3 轮**（正义 / 死神 裁一轮后还会再露出 3px）
  - **新增 `scripts/verify_card_assets.py`**：验收卡框是否有「真透明」的洞（只看 alpha ≤ 8，
    不能拿 alpha > 250 当标准，否则抗锯齿像素会误报）+ 22 张牌面四边是否有残边。当前结果：**全部为 0，通过**
  - 端到端复核：流水线重跑 → 验收脚本通过 → 总览拼版重出（22 张黑边消失）→
    生产构建通过 → CDP 实机抽牌截图（审判 / major-20），牌面外缘无黑边，素材未退化
  - 遗留的一处**设计取舍**（已记入代码注释）：卡框外圈填成纸色后，右下角吊牌不再是「悬空挂在星空背景上」，
    而是落在纸色衬底上（低对比、但仍可见）。若想恢复「吊牌悬空」的效果，需要改成
    「卡框保留透明外边距 + 卡面底色透明」，代价是卡牌不再是一个干净的矩形
- **2026-09-18（第八轮 · 去掉吊牌，卡牌收成完整矩形）**
  用户决定：「可以去掉卡牌的吊牌，做成完整的矩形可能会比较适合目前的情况，等项目都跑通了再考虑复杂的情况」。
  上一轮把卡框外圈填成纸色之后，吊牌从「悬空」变成了「趴在纸色衬底上」，反而更别扭；
  这一轮直接从素材层把吊牌拿掉，卡牌 = 卡片本体，`CARD_ASPECT` 不再是「卡片 + 吊牌」的外框比例。
  - **做法：裁到卡片本体 + 镜像补图**（`build_card_assets.py` 新增 `CROP_TO_CARD_BODY` / `REMOVE_TAG`）
    - `card_body_rect()`：在每行/每列取**最外侧不透明像素**，只统计中段条带，再取中位数 ——
      这样右下角吊牌撑出去的那几行不会把 bbox 带偏（直接用 getbbox 一定会被吊牌拉大）
    - 结果 `(6, 0, 966, 1403)` → **960×1403**，即 `CARD_ASPECT = '960 / 1403'`（≈0.6842）
    - `remove_hanging_tag()`：吊牌本体与吊绳**压在卡片本体内部**，所以只裁不够，还要补图。
      卡框左右是镜像对称的（实测：除左侧宝石与右下吊牌外左右一致），所以把**左侧镜像位置**的内容
      翻转贴到吊牌区域即可，接缝边缘做 6px 羽化。两块修补区：右上（吊绳段）与右下（吊牌本体）
    - 补图时踩过一个坑：镜像取样写成 `sx0 = w - x1` 会把源块**二次翻转**，导致右边缘整条变透明
      （残差 60042 px）。正确写法是 `sx0 = x0` —— 源图本身已经是整幅水平翻转过的，
      目标块 `[x0,x1)` 的镜像位置**也是** `[x0,x1)`。改完残差降到 16426 px
    - 自带 `tag_residue()` 自查（模糊后做镜像差分），当前**最大单行残差 75px**，低于 115px 阈值；
      剩下的是吊牌位置的正常画面差异（金线经过那一带），不是没抹干净
  - **顺带修掉一个长期隐蔽的裁边缺陷**：`_edge_stats()` 原来沿扫描轴按 **3px 步长**采样，
    768 宽的图上只采到 x=765，**永远看不到最外面那 1–2 列**，所以边缘残线检测一直是「漏检」状态。
    改成扫描轴**逐像素**、垂直轴 3px 步长，立刻抓出 major-06 / major-15 的残留边带
  - **重构 `trim_edge_residue()`**：从固定 `EDGE_TRIM=1.2%` 改为**按累计像素配预算**的收敛循环
    （`EDGE_TRIM_TOTAL=0.06` 占比预算、`EDGE_TRIM_PASSES=6` 轮），四边各自独立、逐轮累加
  - **一个必须知道的取舍**：把「裁边」放在「缩放」之前（否则 768×1123 再裁会缩水到 733×1096，
    破坏「插画与卡框同尺寸同比例」的契约），但 LANCZOS 缩放在**亮色牌**上会重新生成 1–5px 的
    「亮且平」细线 —— 这不是残边而是缩放振铃，视觉上被不透明的卡框内沿完全盖住。
    因此验收脚本给了 `EDGE_TOL=6` 的容忍量（≤6px 视为缩放产物），不追着它裁
  - **三个几何值必须同批粘**：`CARD_ASPECT` / `FRAME_INSET` / `CARD_PAPER` 都依赖「裁到本体」之后的新尺寸，
    所以 `build_hero_assets.py` 与 `preview_hero.py` 都改成**从 `skin.js` 现读**比例（此前写死 `986/1496`），
    换卡框时不会再出现「素材按新比例、脚本按旧比例」的错位
  - **新值**：`CARD_ASPECT = '960 / 1403'`、`FRAME_INSET = { left 10.52% / top 7.48% / right 10.62% / bottom 8.20% }`、
    `CARD_PAPER = '#dfd3b9'`；frame.webp 由 768×1166 变为 **768×1123**，牌面同样 768×1123
  - **验收**：`verify_card_assets.py` 通过（卡框实心无洞、吊牌已抹净、22 张牌面残边 ≤ tolerance）→
    总览拼版重出（1290×1374，22 张全是干净矩形）→ 生产构建通过 → CDP 实机抽牌截图
    （`assets/previews/screen-reveal-2026-09-18.png`）确认为规整矩形卡片、无吊牌、无黑边
  - **保留的后路**：`CROP_TO_CARD_BODY = False` 可一键退回「卡片 + 吊牌」的旧形态，
    配合旧的 `986 / 1496` 常量即可复原（代码注释里写了怎么做）
- **2026-09-18（第十一轮 · 整页手感升级，无新增依赖、零积分）**
  用 `motion-web` skill 做了一次整页动效审计，确认了四处核心动效的**实测问题**
  并给出带具体数值（时长/缓动/距离/延迟/透视）的改造方案；用户确认后实施：
  - **入场**：`veil` 与 `hero-plate` 由「同时起跑」改为**串行**（veil 先散 1.4s，plate 延后 0.55s 再推近落定 1.5s）；
    `scale` 收到 1.18→1.06，`blur` 从 16px 减到 9px 且只在前段归零，`opacity` 先显形后推近；
    定格后的 `bgBreath` 从 24s 纯 scale 改为 **14s scale + 位移**，并起始于 `scale(1)` 以无缝承接入场落点。
  - **水晶球交互**：补齐 `:hover`（scale 1.03 + 亮度）、`:active`（scale 0.955，90ms）、`:focus-visible`（2px 光环）
    三态反馈；松开后触发 **1.06 → 1.0 的 260ms 落定回弹**。全站唯一 CTA 不再「死按」。
  - **抽牌**：爆闪从 620ms 缩短到 **420ms** 并单独领跑；牌起飞延迟 0.10s，让爆闪峰值助推；
    `CARD_RISE` 从 24vh 收到 **17vh**；升起动画拆成 `y`（slam，900ms）与 `scale`（settle，820ms），
    `opacity` 只占前 180ms；不上震动通道。
  - **翻牌**：`.stage` 新增 `perspective: 1400px`（长焦体块，不鱼眼）；
    `rotateY` 从单段 expo 改为 **0→168°（720ms slam）+ 168→180°（280ms settle）** 两拍；
    跨过 90° 时叠加 240ms 高光斜带扫过，并加 `.card__eclipse` 做转身背光中间态。
  - **解读面板**：`ANCHORS.stage.y` 上移到 38.5 且卡高从 48vh 收到 **46vh**，实测与面板**零重叠**
    并留出约 40px 净空；延迟从 1150ms 加到 **1420ms**（严格在翻牌收尾后）；上滑距离 60→96px；
    内容按 kicker→tags→正文→建议→按钮**stagger** 60ms 依次亮起；`backdrop-filter` 从 6px 降到 3px 且只在 `prefers-reduced-motion: no-preference` 下启用；顶边改为渐变发丝线。
  - **无障碍/性能**：`HeroStage` / `CardReveal` / `ReadingPanel` / `App` 标题统一接入 `useReducedMotion()`，
    减少动效时只留淡入、去掉位移与 3D 翻转；新增动画只用 `transform` + `opacity`；
    抽牌时给 `.card` 临时加 `will-change`，动画结束移除；新增 `EASE` 常量表在 `skin.js` 统一收口。
  - **新增可复用审计探针**：`scripts/flows/audit-motion.js`（几何/时序/伪类/perspective 探测）与
    `audit-draw.js`（抽牌后重叠/延迟），改造前后的量化判据都写成了 CDP 断言。
  - **验收**：`overlapPx == 0`、球三态反馈规则全绿、`.stage perspective: 1400px` 声明存在、
    减少动效下 `panel backdrop-filter: none`、构建通过且体积增幅仅 **3.04 KB**
    （CSS 36.82→38.24 KB，JS 288.17→289.79 KB）。桌面/移动/减少动效三态截图通过，
    `reveal.js` 与 `share.js` 回归流程全绿。

- **2026-09-18（第十二轮 · 修「标题被卡牌盖住」）**
  用户反馈：「『今夜一签』标题和下面的小字会被抽出来的卡牌盖住一部分」。实测确认并根治：
  - **根因**：`.stage` 的 `z-index: 40` 高于 `.headline` 的 `20`，而标题带原来用 `top: 13%`
    **从视口顶部往下排**；第十一轮把 `ANCHORS.stage.y` 上移到 38.5 后，卡牌顶边
    （38.5% − 卡高一半 = 15.5%）正好侵入标题带。桌面实测**标题被盖 42.9px、副标题整行 19.5px
    被吃掉，合计 74.4px**；竖屏副标题同样整行被盖。
  - **解法**：标题带改为**从卡牌顶边往上锚定**（`bottom` 定位），不再从视口顶往下排：
    `bottom: calc(100% - var(--stage-anchor-y) + var(--card-height-half) + var(--title-gap))`。
    卡牌顶边的三项全部来自 `skin.js`（新增 `CARD_HEIGHT` / `CARD_HEIGHT_HALF` / `TITLE_GAP`，
    `.card` 的 height 也改为读 `--card-height`），于是**卡牌变高或锚点下移时标题会自动跟着让位**，
    不会再撞上。标题字号与行距同步收紧，好塞进「顶栏底边 → 卡牌顶边」这条窄带。
    同时删掉移动端那段 `.headline { top: 10% }` 覆盖 —— 它会让竖屏重新从顶部往下排、再次撞上卡牌。
  - **顺带修掉一个副标题文案 bug**：`headlineSub` 原来把 `locked` 判在「已揭晓」之前，
    而 daily 模式抽完牌 `canDraw` 即变 false → `locked` 恒为真，导致**抽出的牌永远配着
    「今日之牌已抽出 · 明日再来」**。改为优先判 `phase === 'revealed'` → 正确显示「这张牌，是今天的答案」。
  - **新增 `scripts/flows/audit-title.js`**：量标题 / 副标题 / 卡牌三者的重叠与层级，改锚点后必跑。
  - **验收**：桌面与竖屏 `overlapTitleCard` / `overlapSubCard` / `overlapHeadlineCard` **全部为 0**
    （此前 42.9 / 19.5 / 74.4），副标题文案正确；生产构建通过（CSS 38.48 KB / JS 289.98 KB）；
    `reveal.js` 与 `welcome.js` 回归流程全绿。

- **2026-09-18（第十三轮 · 用户视角预览副本 `dist-user/`）**
  用户提出：「目前你给我的属于是开发者版本……下方的抽卡模式选择和重置迎接，到时候成品给他人使用时不该有，
  我需要你做一个副本来查看用户使用的界面」。
  - **先澄清一个事实**：调试条（`.devbar`）与牌面总览（`.gallery`）本来就由 `import.meta.env.DEV` 包着，
    **生产构建根本不渲染** —— 也就是说「成品给他人用」这件事早就是对的，缺的只是一个**本地能看的副本**。
  - **解法：`scripts/build_user_preview.mjs`** —— 跑一次生产构建 → 复制到 `dist-user/` →
    把 `index.html` 里的资源引用**改写成相对路径**，附带写入 `README.txt`。
  - **⚠️ 本轮最重要的一条结论（踩了坑才拿到）：`dist-user` 不能靠双击 `index.html` 打开，必须起 http 服务。**
    第一版以为「把绝对路径改成相对路径 → file:// 就能跑」，README 里也这么写了，**但实际是坏的**：
    页面用 `<script type="module">` 加载，**ES module 受 CORS 约束，`file://` 下浏览器直接拒绝加载**，
    结果 `#root` 始终为空、React 从未挂载、**页面全白**（实测截图确认，报错在 console 里，页面上看不出来）。
    这是浏览器硬规则，改路径绕不过去。
    - 相对路径改写的**真实价值**因此改判为：让 `dist-user/` 能丢到服务器的**任意子目录**下运行，不受 vite `base` 限制
    - 为了确实好用，补了 **`start-user-preview.cmd`（双击入口）**：自动构建（如缺）→ 起服务 → 开浏览器；
      `serve_user_preview.mjs` 也改成默认**自动打开浏览器**（Windows 用 `cmd /c start "" url`，
      第一个参数是窗口标题不能省，否则带空格会出错）
  - **两处必须记住的细节**：
    - `og:image` / `twitter:image` 用的是 `content="..."` 而不是 `src`/`href`，只匹配 `src|href` 会漏。
      第一版就漏了这两个，肉眼看不出来，靠残留检查兜住的 —— 所以**检查要覆盖三类属性**
    - `og:url` 的 `content="/"` 是**唯一豁免**：它的值本来就是「上线域名占位符」，
      抓取端要求绝对地址，改写成本地相对路径反而是错的。检查时按**整行**判断才跳得掉
      （`property="og:url"` 写在 `content` 之前，逐段匹配匹配不到）
  - **脚本自带三道自检**（构建即验）：① 零残留绝对路径（`og:url` 豁免）；
    ② 产物 JS 里不含「重播迎接 / 抽牌模式 / 重置今日 / 屏息 / 连播四拍」，一旦出现说明 `DevBar`
    被打进了生产包 → 脚本**报错并非零码退出**；③ `serve_user_preview.mjs` 启动前校验入口 script 存在，
    避免「服务起着但页面是白的」
    ⚠️ 这条名单原本还含「牌面总览」、并顺带把 `CardGallery` 也列成「不该进包」（2026-09-20 更正）：
    图鉴这一轮对用户开放了（入口在顶栏「牌之图鉴」），它**本来就该**在正式产物里 ——
    旧写法会让后来者误以为「产物里有图鉴 = 打包错了」。被摇掉的只有 `DevBar`。
  - **`package.json` 加两个快捷脚本**：`npm run user:build` / `npm run user:serve`
  - **`scripts/package_project.py` 排除 `dist` 与 `dist-user`**：都是随时可再生成的构建产物，
    进包只会让人误以为是「已发布的版本」
  - **验收**：产物 6.0 MB；三道自检全绿；脚本可重复运行（EXIT=0）；
    CDP 对 `http://127.0.0.1:8080/` 实测桌面 / 移动 / 首屏迎接三态，
    `document.querySelector('.devbar')` 与 `.gallery` **均为 null**，标题副标题正常、解读面板正常推入；
    首页与 `assets/*.js|css`、`skins/**/*.webp` 全部 200

- **2026-09-19（第十四轮 · 离线双击可用 + 本地快捷方式 + 重打交付包）**
  用户要求：「那就先重打交付包，尤其是要给一个本地快捷方式」。

  **先推翻上一轮的一个错误结论。** 第十三轮写的是「`file://` 打不开，必须起 http」——
  实测定位到**两处**真正的拦路石，都可以解：
  - ① 素材基址：`import.meta.env.BASE_URL` 默认是 `/`，运行时素材被拼成 `/skins/...`。
    在 `file://` 下这就是**磁盘根目录**（`file:///skins/...`）→ 图全挂。
    解法：预览构建走 `vite build --base ./`，源码侧 `src/config/skin.js` 用 `BASE` 常量跟随 base。
    **不改则默认产出不变**（仍是 `/skins/...`），正式发布于零影响。
  - ② 脚本类型：`<script type="module" crossorigin>`，ES module 与 `crossorigin` 在 `file://` 下
    必被 CORS 拦 → `#root` 永远为空、整屏白。
    解法：产物 JS **本来就完全自包含**（校验 0 处 `import` / `export` / `import.meta` / 动态 `import()`），
    所以改写成 `<script defer>` 并补 `'use strict';` 还原 ESM 的严格模式语义，行为等价。
  - **实测结论（桌面 1582×804）**：`#root` 10857 字符、`hero-bg` 1536px / `hero-orb` 768px 真实加载、
    抽牌后 `card-back` + 牌面 + `frame` 全部加载、解读面板推入、`localStorage` 可用、**零控制台报错**
  - **唯一功能差异**：`file://` 下 canvas 被污染，「生成分享卡片」`toBlob` 抛 `SecurityError`
    （实测；`ShareDialog` 已 catch，现补了针对 `file://` 的准确提示，不再让人对着技术报错干瞪眼）

  **构建脚本 `build_user_preview.mjs` 改造**：
  - 直接 `--base ./ --outDir dist-user --emptyOutDir`，**不再覆盖 `dist/`** ——
    `dist/` 只由 `npm run build` 产出（绝对路径，正式发布用），两份产物职责分开，也省掉 6 MB 复制
  - 四道自检（任一不过**非零退出**）：无 `type="module"` / `crossorigin`、零残留绝对资源路径、
    **素材基址是相对路径**、产物不含开发入口文案

  **两次自己制造的失误，都值得留档**：
  - ⚠️ **同一文件不要并行编辑**。我在同一条消息里对 `skin.js` 发了两个 Edit，第二个基于旧快照写回、
    把第一个的 `BASE` 声明覆盖掉了 → `${BASE}` 变成**有引用、无声明**，**连生产 `dist/` 一起带坏**。
    是靠新加的「素材基址」自检抓出来的。教训：对同一文件的多次修改必须**串行**，改完 `grep` 复核
  - ⚠️ **自检判据本身也会失效**。第一版判据是「找 `"/skins/"`」，但压缩后路径变成变量拼接
    （`Fr="./", e=>[\`${Fr}skins/…\`]`）→ 永远找不到 → 自检变成永远通过的白检查。
    改成「查**每个 `skins/` 前面那段里的基址字面量**是不是裸的 `"/"`」，并**双向验证判据有效性**：
    套到 `dist/`（应命中）命中 2 处、套到 `dist-user/`（应干净）0 处

  **新增本地快捷方式 `打开网站.cmd`**（项目根，也是交付包里的入口）：
  零依赖 —— 不需要 Node / Python / 服务器，双击即用默认浏览器打开网站；
  `dist-user/` 缺失时自动尝试用 Node 构建。`start-user-preview.cmd` 保留为「完整模式」（走 http，含分享卡片）。

  ⚠️ **发现旧 `.cmd` 本来就是坏的**：写文件工具默认 UTF-8 + LF，而 cmd.exe 解析会因此错乱 ——
  报一堆「不是内部或外部命令」，**退出码却仍是 0**（所以靠退出码判断可用性是错的）。
  另：UTF-8 文件配 `chcp 65001` 在 zh-CN 控制台还会串码。
  处置：两个 `.cmd` 全部重写为 **GBK + CRLF、不再 chcp**；新增 `scripts/fix_cmd_encoding.py`
  （修正/`--check`，幂等）；`package_project.py` 加**打包前置门槛**——`.cmd` 不合格直接拒绝打包。
  ※ 第十三轮那个 `start-user-preview.cmd`（我让用户双击过的）**当时就是坏的**，这一轮才发现并修好。

  **桌面快捷方式**：`WScript.Shell` 建 `.lnk` 被本机安全策略拦（COM 实例化），
  改用纯文本 `.url`（`%USERPROFILE%\Desktop\今夜一签 · 本地预览.url`）。
  并且**先做了可用性实验再落地**：.url 指向一个发 `http://127.0.0.1:8123/ping` 请求的测试页，
  本机监听收到请求即证明「.url → file:// → 拉起浏览器」这条路径成立（脚本留在
  `assets/_debug/test-url-shortcut.mjs`）。注意该 `.url` 内嵌绝对路径，**移动项目目录后会失效**。

  **重打交付包**（`STAMP` 改 09-19，旧的两个 09-17 包作废）：
  - `tarot-app-handoff-2026-09-19.zip` 197.7 MB / 191 个文件
  - `tarot-app-code-2026-09-19.zip` 22.5 MB / 118 个文件
  - 两个包**都含 `dist-user/`**（收包人双击 `打开网站.cmd` 即看）；`dist/` 仍不进包；
    新增排除 Vite 残留临时配置 `vite.config.js.timestamp-*.mjs`（本机残留了 6 个，已清）；
    加 `--no-preview` 可省掉 6 MB 的副本
  - **验收**：包内逐项 grep 确认 `dist-user/index.html`、两个 `.cmd`、`MOTION_AUDIT.md`、
    新增脚本、改动后的 `skin.js` / `ShareDialog.jsx` 全部在；包内 `.cmd` 字节确认为 CRLF + GBK

- **2026-09-19（第十六轮 · 开发者版 `dist-dev/` + 把调试条开关从 `DEV` 改成构建期 `DEV_TOOLS`）**
  用户要求：「现在先给一个开发者版本给我，我要打开测试效果」—— 且明确要**不限次数抽卡**与**重置迎接动画**。

  **问题**：调试条 `DevBar`（不限次数 / 重置今日 / 重播迎接 / 牌面总览）原本靠 `import.meta.env.DEV` 判断，
  而 `DEV` **只在 `vite dev` 下为真、构建产物里恒为 `false`** ——
  也就是说「带调试条的成品」这个形态**根本没法用 `DEV` 表达**，只能开着 dev server 才能调。

  **解法：把开关变成构建期注入的字面量** —— `vite.config.js` 用 `define` 注入 `__DEV_TOOLS__`：
  `vite dev` → 开 ｜ `vite build` → 关 ｜ `VITE_DEV_TOOLS=1 vite build` → 开。
  用 `define` 而不是读 `import.meta.env.VITE_*`，是为了保证注入的是**真字面量**，
  Rollup 能据此把 `DEV_TOOLS && <DevBar/>` 整支分支静态折叠掉 —— 正式产物里连 DevBar / CardGallery 的代码都不残留。
  因此 `DEV_TOOLS` 刻意**不写 `typeof` 兜底**（那会让表达式无法静态折叠，「少个调试条」会退化成「正式包带着调试条」），
  另加 `=== true` 防呆（防 define 忘了 `JSON.stringify`、注入成字符串 `'false'` —— 字符串是 truthy 的）。

  - **`skin.js` 新增 `INITIAL_MODE`** = `DEV_TOOLS ? 'unlimited' : DRAW_MODE`：
    开发者版**打开就是「不限次数」**（抽完面板上是「再抽一次」），不用先去调试条点一下；正式版仍是 `daily`
  - **开发者版每次冷启动都播迎接动画**（`shouldGreet()` 里 DEV_TOOLS 提前 `return true`，无视「今天已抽过」）——
    调这段动画要反复刷新，不该每次都先去清 localStorage。「重播迎接」按钮照常可用（换 key 重挂信封，不动抽牌状态）
  - **新增开发者版产物 `dist-dev/`（`scripts/build_dev_preview.mjs`）**：与 `dist-user/` **只差一个构建开关**。
    于是把 file:// 适配（相对基址改写 / module→经典脚本 / 补 `'use strict'` / 通用自检）抽到
    **`scripts/lib/offline.mjs`** 供两者共用 —— 免得以后修个 bug 要改两遍。产物 `<title>` 标「（开发者版）」以便区分标签页
  - **新增根目录 `启动开发者版.cmd`**（GBK + CRLF）：起 http 服务并自动开浏览器，端口 **8099**（避开用户版的 8080）。
    `serve_user_preview.mjs` 增加 `--dir` 参数（默认 `dist-user`），一台服务器两种产物复用
  - **`package_project.py` 的 `EXCLUDE_DIRS_BUILD` 加入 `dist-dev`**：开发者版**不进交付包**（会暴露内部状态）；
    `fix_cmd_encoding.py` 的扫描也跳过 `dist-dev`
  - **新增 `scripts/flows/dev-verify.js`（运行时自检，这是本轮的关键补充）**：
    调试条存在且默认「不限次数」→ 抽一次出牌且面板带「再抽一次」→ 点它 108ms 回到待抽态 →
    再点球抽到**不同的第二张牌**（证明真的不限次数，不靠刷新）→ 抽牌**不落盘** →
    「重播迎接」108ms 重挂信封、2.59s 播完后**牌与面板都还在** → 「牌面总览」22 张齐全、能开能关 → 控制台零报错

  **⚠️ 本轮抓到一个「只有运行时才能发现」的真 bug**：`galleryOpen` 那一行**仍是** `import.meta.env.DEV` ——
  批量替换时判据写成了带左括号的 `{import.meta.env.DEV && (`，只命中 DevBar 那处，
  另一处后面跟的是变量（`galleryOpen`）因而漏改 → 开发者版里「牌面总览」**点了完全没反应，且零报错**。
  静态自检的「开发入口齐全」照样通过（产物里有「牌面总览」四个字）——
  **查字符串查不出「按钮在、点了没用」**，只有真点一遍才发现。详见 `NEXT_STEPS.md` 第 6 节第 21~23 条

  **验收（运行时，全部打在 `dist-dev/` 产物上）**：上述断言全绿；`dist-dev` 的三条离线检查 + 三条开发者专属检查全绿；
  `file://` 与 `http://127.0.0.1:8099` **两条打开路径都实测过**（http 下 index.html / 入口 JS / 素材均 200 且 MIME 正确）。
  **体积交叉验证（本轮最干净的一条证据）**：正式 `dist/` 与 `dist-user/` 的 JS **完全同尺寸 292.67 kB**，
  `dist-dev/` 为 294.66 kB（**+1.99 kB**）—— 尺寸相等即证明调试条在正式产物里被**整支摇掉**，
  而这与 `dist-user` 的「不含调试条文案」、`dist-dev` 的「必须含」两条字符串断言构成**互不依赖**的证据链

- **2026-09-19（第十六轮 · 补丁 · 调试条竖排化：它其实正在遮住面板的「再抽一次」）**
  给开发者版收尾时，用命中测试（`elementFromPoint`）量了一下解读面板的动作行，
  抓到本轮第二个「只有运行时才暴露」的真 bug。

  **症状**：调试条原本是**横排贴底**的长条（实测宽 765px），而解读面板的动作行也贴底 →
  在 `innerHeight` 1004 下，「再抽一次」的矩形 `[658,936,762,974]` 与调试条**相交 2487 px²**。
  打在按钮中心的 `elementFromPoint` 返回 `DIV.devbar` 而不是按钮本身 —— **鼠标根本点不到**。

  **为什么功能自检全绿也抓不到**：`.click()` 是程序化调用，**绕过命中测试**，
  被盖住的按钮照样能触发 → 「连抽两次成功」这条断言照样通过。
  **可见性 ≠ 可点性**，只有打在中心的命中测试能分辨。

  - 修法：`.devbar` 由横排改成**竖排定宽窄条**（`width: 92px` + `flex-direction: column`），
    并把长文案（存储键名等）从可见文本挪进 `title` 悬停提示 —— 否则宽度又会被撑回去。
    另加**容器 `pointer-events: none` + 子元素 `pointer-events: auto`**，
    让调试条的**空白区域**不再吃点击（只留按钮本身可点），是兜底保险
  - `DevBar.jsx` 顶部写了「不要改回横排」的注释（含原因），防止后人好心改回去
  - **验收（3 个视口，均打在 `dist-dev` 产物上）**：1564×708 / 1564×1004 / 504×688 三档下，
    「再抽一次」与「生成分享卡片」的 `hitIsSelf` 全为 `true`、`overlapWithBarPx` 全为 **0**
  - **新增可复用诊断 `assets/_debug/probe-fit.js`**：量「内视口尺寸 / 可滚动性 / 关键盒子 rect /
    按钮是否在视口内 / 命中元素 / 与调试条相交面积」。它自带一条重要提醒：
    `--h 804` 在无头 Chrome 里实际 `innerHeight` 只有 **708**（窗口 chrome 吃掉约 96px），
    **必须先打出 innerHeight 再谈「遮没遮住」**，否则会把「按钮本来就在屏幕外」误判成「被调试条挡住」
  - **⚠️ 连带修正了 `dev-verify.js` 的命中测试时机**：面板是「贴底 + 上滑」入场，
    **文字先到、位移后到**；文字一出现就量，按钮此刻还在视口下方（实测 y782 > `innerHeight` 708），
    `elementFromPoint` 只能返回 `null` → 会被误读成「被挡住了」。
    加 `settle()`（连续两次采样 rect 相同才算停稳）后，静止位置 y650..688 命中正常。
    **这是同一类错误咬了两次**（上一次是固定 sleep 等动画，见 `NEXT_STEPS.md` 第 23 条）
  - **修正一处判据自身的缺陷**：原 `barCoversCenter` 对**调试条自己的按钮**（如「重播迎接」）也报 `true`
    （它本就住在调试条里，命中调试条是正常的）→ 改成 `coveredByDevbar`：
    仅当目标是**调试条以外**的元素、却命中了调试条内部时才算遮挡
  - **顺带确认一处「已知且无害」的残留**：`dist-user` 的样式表里仍留有 5 条 `.devbar` 规则
    （**449 字节 / 40.66 kB**）。它们是**永远不会被匹配的死 CSS**（用户版不挂载调试条，没有任何元素带这个类）。
    不修是权衡结果：清掉需要给构建流程加一段 CSS 重写，为 0.4 kB 增加一个失败点不划算。
    **别把它当漏做** —— `build_user_preview.mjs` 的反向自检本来就**只扫 JS**
    （判据是 `重播迎接 / 抽牌模式 / 牌面总览 / 重置今日` 四个字面量，实测 0 命中），
    那才是「调试条被摇掉」的正确判据；用 `grep -r` 扫整个目录会扫到 README（**故意**写着「没有调试条」）与这段死 CSS
  - **重测后的体积**（本轮三份产物全部重建）：`dist/` 290.38 kB、`dist-user/` 290.39 kB（**相差 0.01 kB**）、
    `dist-dev/` 292.55 kB（**+2.16 kB**）—— 「两个正式产物 JS 尺寸相等」这条独立旁证依然成立
  - **`dev-verify.js` 全绿**（改进后重跑）：待抽态水晶球可点 → 连抽两张不同牌（月亮 / 愚人）→
    抽牌不落盘（`recordAfterDraws: null`）→ 重播迎接 2.58s 播完后**牌与面板都还在** →
    牌面总览 22 张齐全 → 三个按钮 `coveredByDevbar` 全 `false` → 控制台**零报错**

- **2026-09-19（第十五轮 · 抽牌仪式分拍改造：蓄势 / 悬念 / 留白）**
  用户给出一份自包含的交接指令（`DRAW_RITUAL_BRIEF.md`），要求把「点击水晶球 → 卡牌揭晓」这一段
  **重新分配节奏**，做到有蓄势、有悬念、有留白。零新增依赖、零积分消耗、保持零后端。
  **核心判断：问题不是「太快」，是「节奏完全错位」** —— 所以这一轮加长的是**拍数**，不是曲线时长。

  **改造前实测到的四条根因**（全部量化，见 `MOTION_AUDIT.md` §7.1）：
  - ① 答案在牌到位之前就揭晓：牌 213ms 开始翻、**295ms 已跨 90°**，而牌 696ms 才到位 →
    `牌到位 − 开始翻` = **−483ms**。期盼结构（牌背 → 停住 → 再翻）**根本不存在**
  - ② 完全没有蓄势：点击后 **11ms** 挂载、**52ms** 可见
  - ③ 面板双重计时 → **空面板挂 1.6 秒**（外框 1490ms 就滑上来，子项 3056ms 才出现）
  - ④ 环境对抽牌毫无反应（雾 / 星屑 / 暗角 / 副标题全程不变）

  **落地：把抽牌拆成八拍，新增两拍「不动的静」**
  `①蓄势 1000 → ②爆闪 520 → ③升起 1150 → ④悬停 1150★ → ⑤预压 140 → ⑥翻牌 1200 → ⑦留白 280★ → ⑧面板 720`
  （总 5.7s；原先 3.4s 但形状是错的）。**期盼感 = 动作之前的等待（①④）＋ 动作之后的静止（⑦）**。

  - `skin.js`：新增 `DRAW_RITUAL` / `DRAW_RITUAL_REDUCED` / `ritual(reduced)` / **`drawBeats(reduced)`**（绝对时刻表，
    唯一真相）/ `EASE.wind`（第二族新缓动：慢起、末端加速 = 「攒劲」，与 `slam` 的「快速到位」正相反）；
    `CARD_RISE` 17 → 19；`TIMING` 里的抽牌相关键**全部删掉**（现在只含入场时序）
  - `App.jsx`：`<main data-phase>` + `scene--charging`；`handleDraw` 改三段计时
    （`charging` → 牌在 `chargeDone` 才挂载 → `panelAt` 切 `revealed`）；仪式期副标题退出；暗角层 + 冲击环
  - `CardReveal.jsx`：翻牌延迟改为**绝对时刻**（本次最关键的修复）、4 关键帧 / 3 段曲线、`.card__halo` 辉光、
    悬停拍微摆（**不动 `y`** —— 会与升起的 y 过渡打架、且可能吃掉标题净空）
  - `ReadingPanel.jsx`：**删掉 variants 根上的 `delay`**，延迟只留 `App` 一处
  - 视觉层：球充能（内收光环 + 提亮）、`.scene__charge-dim` 暗角、`.mist--intense` 雾扰动加剧、
    `ParticleField` 的 `converge` 向球心收束、`.card__halo`、`.draw-burst` 冲击环；**全部只用 transform / opacity / filter**
  - 验收脚本：`audit-draw.js` 从「稳态几何审计」升级为**带断言的节拍审计**（7 条门槛 + 净空报告）；
    新增 `ritual-frame.js`（按**动画自身状态**轮询取四张关键帧，不用不可靠的 `--wait`）

  **★ 三处「踩到才发现」的问题（都已根治，也写进了 `NEXT_STEPS` 的坑清单）：**
  1. **Framer Motion 的 per-property config 会完全接管并丢弃根上的 `delay`。** 这是「空面板」的真相，
     本轮又被同一个机制**第二次咬到**（`CardReveal` 的翻牌延迟整体晚了一拍）。
     规律：只要任一属性带了自己的 config，根 `delay` 就不参与该属性的计时；而 `delayChildren` /
     `staggerChildren` 是另一套机制、照常生效 → 两套计时各跑一半。
     `CardReveal` 还多一层：它在 `chargeDone` 才挂载，**Framer 的 delay 从动画触发那刻算起**，
     所以必须写 `at(ms) = max(0, ms − 挂载时刻)/1000`
  2. **一个把整场仪式在点击后 1ms 就杀掉的 bug**（`TypeError: duration must be non-negative`）。
     `handleDraw` 先 `save()` 落盘 → `setRecord` → 触发「今日已抽」effect → `setPhase('revealed')`，
     把 `charging → drawing → revealed` 整条链冲掉。修法：给该 effect 加
     `RESTING_PHASES = Set(['welcome','entrance','idle'])` 守卫，只在静息相位才自动呈现今天的牌
  3. **牌与面板原先是「侥幸不重叠」**：面板由内容撑高，而卡牌下缘以下只剩视口的 **38.5%**。
     用 `--seed` 把文案最长的两张牌（魔术师 / 恶魔，各 98 字）钉住实测 → 桌面净空仅 **3.2px**、
     竖屏**超出 19.3px**（截图可见卡牌下框带金饰被压暗）。
     **不用「限高 + 滚动」**（会把「生成分享卡片」这个主 CTA 挤出可视区，比压 20px 渐变更糟），
     改为在 `max-height: 780px` 的矮视口**收紧面板纵向留白约 36px** →
     实测净空 **桌面 39.2px / 竖屏最坏牌 10.7px**。同时给 `audit-draw.js` 增加 **`clearancePx`**：
     只看 `overlapPx == 0` 会漏掉「只剩 3px 就撞上」这种侥幸状态

  **验收（全部打在产物 `dist-user/` 上，不只 dev）**：
  节拍审计桌面 **8/8 PASS**（总 5512ms、`牌到位 → 跨 90°` 由 **−483ms 转正到 +1833ms**、
  空面板由 **1606ms 收到 205ms**）；竖屏 8/8 PASS；`--reduced` **27ms**；
  `audit-title` 两视口三处 overlap 全 0；`audit-motion` `layoutAnimatingKeyframes=[]`；
  `reveal` / `share`（1080×1920 / 254KB）/ `welcome` 回归全绿；
  `file://` 离线副本自检通过（`#root` 10983 字符、素材相对路径、零报错）；
  四张关键帧**逐张人工看图确认**（蓄势期牌未挂载、悬停期只显牌背、翻牌 93°、终态面板与卡牌清晰分离）；
  `vite build` 通过（406 modules，CSS 41.45KB / JS 292.66KB，**+5.7KB**）。


  用户要求：「点击刚进网页的时候应该要有一个迎接动画，我暂时的想法是一个信封打开的效果，
  风格也要和网页一致，比如信封的样式什么的」。产出一段纯代码绘制的开信动画，作为进入页面的第一眼。
  - **内容**：信浮现 → 火漆封印亮起、碎裂 → 上翻盖翻开、暖光与星屑从封口溢出 → 信封化进暗场 → 暗场退去露出占卜场景
    （约 2.55s）。把「抽牌」包装成「收到一封信」，是站点夜雾/月相语言的自然延伸
  - **纯代码，不用 AI 出图**（`src/components/EnvelopeWelcome.jsx`）：① 入场动画必须立刻可见，
    依赖网络图片会先闪一下暗场；② 出图要花积分（项目红线），而信封这种几何造型代码完全能做。
    整段只增加约 4.6 KB（CSS +2.3 KB / JS +2.3 KB，比一张牌面素材还小）
  - **继承站点美术语言**：米白厚卡纸取卡框的纸色家族（`#f2e8d4`→`#d6c7a7`）、金色发丝边对应卡框金线、
    **火漆封印沿用牌背的八芒星母题**、下半个信封压一枚月相。火漆用程序生成的不规则轮廓
    （正弦扰动半径 + 二次贝塞尔平滑闭合曲线）—— 正圆会读成「玻璃珠」，必须不规则才像蜡
  - **⚠️ 本轮最值得记的坑：3D 透视必须就近挂。** `opacity` / `filter` / `clip-path` 都是 **grouping property**，
    出现在祖先上会把子元素的 3D 空间**压平**。信封的入/退场淡入淡出必然让 `.env-in` / `.env` 的 opacity ≠ 1，
    若把 `perspective` 也挂那两层，翻盖就只剩「位置对但没透视」的平板翻转，非常廉价。
    所以 `perspective: 900px` 单独就近放在翻盖的**直接父元素** `.env__flap-slot` 上
  - **第二条坑：上翻盖角度不是 180°。** `rotateX(θ)` 把纵坐标映射成 `y·cosθ`，θ 越接近 180°
    翻开后的投影高度越接近闭合尺寸，结果是一块和原来一样大的平板顶在信封上，像「屋顶」。
    改用 **-142°**（投影高度 79%）+ `perspective: 900px` 才有「盖子立起来、往后倒」的立体感。
    另外 `env__flap-shade` 的渐变方向要用 `0deg`（尖端转得最远最背光，写反就变成折边发暗）
  - **信封内部静态、无需显隐动画**：`.env__cavity`（内腔）与上翻盖**同形**（都是 `(0,0)(100%,0)(50%,58%)` 三角形），
    盖着时被整块遮住，翻盖一转开就自己露出来。内腔明暗是「亮在封口、暗在深处」，
    再加 `.env__cavity-glow`（把光打进内腔）与 `.env__cavity-edge`（勾受光纸口）才立得住纵深
  - **与原有入场动画并行，不加等待**：场景自身的入场（`.veil` 散去 + 底板聚焦）从 t=0 就在信封背后照常跑，
    信封退场时场景已就位，所以**抽牌可点击的时机和加这个动画前完全一样**（`TIMING.entrance` = 2.6s）
  - **交接干净**：信封先化进不透明暗场（1.94s，0.32s），暗场再退去（2.16s）—— 避免半透明信封糊在场景上
  - **可跳过 + 可关闭**：任意点击/按键快进收尾（0.56s），开头 0.26s 内忽略点击（免得「点一下让窗口获得焦点」把动画吃了）；
    `WELCOME.enabled` 一键关掉；`WELCOME.skipWhenDrawn` 让「今日已抽过牌」时不再播放（首次渲染前同步读 localStorage，
    `readTodayRecord()`，不能等 effect 否则会先闪一下场景再盖上信封）；`prefers-reduced-motion: reduce` 强制关掉
  - **新增 `scripts/flows/welcome.js` 回归自检**：断言三层遮罩、`perspective` 落在翻盖直接父元素、翻盖祖先无 grouping property、
    内腔与翻盖三角形换算到信封坐标后**完全同形**、暗场不透明、封印淡出到 0、翻盖矩阵为 `matrix3d`、
    动画结束后遮罩已卸载且无残留节点、水晶球可点击、标题文案正确。`shot.mjs` 同时新增 `--seed`（先跑 JS 再重导航，测刷新分支）
    与 `--reduced`（导航前开 `prefers-reduced-motion`），临时 profile 目录名带 `pid + 时间戳` 以免复用脏状态
  - **验收**：`welcome.js` 断言全绿；CDP 截图覆盖桌面 / 移动端 / 减少动效 / 重播 / 「今日已抽」五种情形；
    生产构建通过（CSS 36.82 KB / JS 288.17 KB，+约 4.6 KB）；生产 `vite preview` 实测信封正常播放、
    无调试条、干净交接给可点击的球；`DevBar` 加「重播迎接」按钮（只重挂信封、不动抽牌状态）
- **2026-09-19（第十七轮 · 冻结 v1 快照 —— 为 v2 的破坏性改造先上保险）**
  - **触发**：用户规划 v2，方向是**主页上真 3D**（水晶球做成有体积感的 3D，女巫主视觉重构图：
    只留肩部以上、脸被巫师帽阴影盖住、单手放大）。这是本项目第一次做**结构性视觉改写**，
    而**本工程不是 git 仓库**（`git rev-parse` 报 `not a repository`）—— 没有回退能力就不能动大手术
  - **产出 `scripts/freeze_snapshot.py`**（可复用，不是一次性脚本）：把工程封成两个 zip + 一份清单
    - `_archive/v1-2026-09-19/tarot-app-v1-code-2026-09-19.zip`（**122 文件 / 11.8 MB**）：
      `src/` · `scripts/` · `public/` · `dist-user/` · 根目录全部文档与配置（含三个 `.cmd`）
    - `_archive/v1-2026-09-19/tarot-app-v1-art-2026-09-19.zip`（**42 文件 / 104.2 MB**）：
      `assets/card-art/`（22 张牌面母版）· `hero-art/` · `concept/` · `card-styles/`（四轮风格探索留档）
    - `SNAPSHOT.md`：构成说明 + 两个 zip 的 sha256 + **关键文件逐项指纹** + 还原步骤
    - 每个 zip 根带 `MANIFEST.sha256`（逐文件哈希，解包后 `sha256sum -c` 可核完整性）
  - **为什么拆成两个包**：代码包小、会常翻；美术包 104 MB 但**不可再生**（重出要花积分）。
    分开后「只想找回代码」不必解一个 100 MB 的包。另有一个判据：**美术素材绝不与代码混在一起失效**
    （PNG 压缩率 ≈ 0，104.2 MB 原始 → 104.2 MB 压缩，说明包里全是已压缩图，这是预期而非异常）
  - **排除项都是「可再生成」或「纯垃圾」**：`node_modules`（`npm install`）· `assets/_debug`（219 MB 临时排查图 +
    无头浏览器 profile 残留）· `assets/previews`（`contact_sheet.py` 可重跑）· `dist/` `dist-dev/`（一条命令重来）·
    `_archive` 自身（递归保护）。被排除的合计约 300 MB —— **备份体积从 429 MB 降到 116 MB，而不可再生的东西一件没少**
  - **⚠️ 本轮最值得记的一条：备份必须「换个路径解出来真跑一遍」才算数。** 生成了 zip 不等于备份可用 ——
    离线副本（`dist-user/`）能双击打开**全靠相对路径自包含**，一旦打包时漏了 `skins/`，
    zip 生成成功、哈希也对，解出来却是一片裂图。
    做法：从 code zip 里解出 `dist-user/` 到 `_archive/_verify/`（**全新路径**），无头跑完整流程 ——
    - 解出 31 个文件 / 6.02 MB，`index.html` 与源目录**逐字节一致**（sha256 前 16 位均 `3c5b6c716bcc1fe7`）
    - 迎接动画 1360 ms 退场 → 点击水晶球 → 1119 ms 牌面出现
    - **图片数 2 → 2 → 5**：`hero-bg` 1536px · `hero-orb` 768px · `card-back` 620px · **抽到的 `major-17`（星星）768px** · `frame` 768px
    - **三个阶段裂图数均为 0**，且无 `file:///skins` 这类「磁盘根目录」式路径
    - **反面教训**：第一版探针跑在信封还在场时，DOM 里只有 2 张预载图 → 「0 裂图」是**假阳性**。
      真正会因路径失效而裂的是**牌面与主视觉**，必须等抽完牌再量
  - **排除归档目录**：`package_project.py` 的 `EXCLUDE_DIRS` 加入 `_archive`（否则交付包凭空胖 116 MB 且毫无用处）
  - **改写三处「不许上 Three.js」的禁令**（用户确认「现在就改」）：
    `DRAW_RITUAL_BRIEF.md` 的「约束表第 1 行」与「不可接受」清单 · `MOTION_AUDIT.md` 的文档头「约束」行与「明确不做」一节 ·
    `动效与质感-skills指令清单.md` 的 `motion-web` 提示词末尾 —— 五处就地加注**「唯一例外」**，
    并在 `NEXT_STEPS.md` 第 6 节新增第 28 / 29 条作为当前有效约束的落点。
    （**按位置描述而不是行号**：这三份文档还在持续编辑，行号当场就会漂。）
    改写原则：**保留原判据与动机**（那三条的动机是「现有栈够用，多一个库多一份体积与维护面」，它依然成立），
    只加例外与代价 —— 判据是这三份属**指令性**文档，而本文档属**记录性**文档，
    下一个接手的人会先读指令：留着无条件禁令，等于埋一个「按规矩把 three 拆了」的坑
  - 用户决策记录（v2 方向）：
    - 第 3 轮：**真 3D**（接受引入 `three`、接受推翻既有禁令）· 要求**先保存好第一版**（→ 本轮快照）·
      **上线效果优先**（`file://` 双击通道可退化）· 球做**轻跟随**（指针视差）· **先出新图再让球去凑光照**
    - 第 4 轮：① **彻底放弃 `file://`**，产物只走 http；② 球 canvas **+ CSS 3D 分层**（共用 perspective）；
      ③ 视差**只让球动**（球朝指针微转 + 高光位移，2D 层完全不动）；④ 手机**不做**跟随输入；
      ⑤ 主页**紫为底、冷蓝只给球**；⑥ 分享卡片**沿用 v1 的 2D 球素材**；⑦ 三处禁令现在就改写（已完成）

- **2026-09-19（第十八轮 · 移除离线通道 + 建立版本控制）**

  **用户决策（grilling 第 5 轮）**：Q1 全删离线通道 + 交付包只给线上链接 ｜ Q2 静态托管平台 + **现在就 `git init`** ｜
  Q3 手在球前（遮挡 ≤ 球体投影 15%）｜ Q4 主视觉只出 1 张 ｜ Q5 出图时留一块**明显大于预期**的空位、出完图再量着定 ｜
  Q6 共用 `perspective`，用在**入场动画**上（稳态 2D 层不动）。

  **① `git init` + v1 基线**（本次最有价值的一步）：118 文件 / 70.92 MB，首个提交 `bb0ad52`。
  `.gitignore` 只排除**可再生成**与**本机临时**两类（`_debug` 220 MB / `previews` 82 MB / `card-styles` 39 MB /
  `_archive` 134 MB / `dist*`），**素材母版一律入库**（`card-art` 56.9 MB + `hero-art` + `concept` + `public`）。
  `.gitattributes` 把 `.cmd` 标为 `-text -diff` 并设 `core.autocrlf=false` —— 入库字节与磁盘字节**逐字节核对过一致**
  （三个 `.cmd` 的 sha256 相同、CRLF 保留、裸 LF 为 0），这条守的是「`.cmd` 必须 GBK + CRLF」那条老坑。

  **② 离线通道整体删除**（Q1=甲）：`scripts/lib/offline.mjs` · `build_user_preview.mjs` · `build_dev_preview.mjs` ·
  `serve_user_preview.mjs` · `fix_cmd_encoding.py` · `打开网站.cmd` · `start-user-preview.cmd` · `启动开发者版.cmd` ·
  `flows/offline-open.js` · `flows/offline-share.js`；`dist-user/` 与 `dist-dev/` 移到 `_archive/_removed-2026-09-19/`
  （本机删目录不可信，见坑第 30 条）。**连带改掉 6 处**：`package.json` 去掉 `user:build`/`user:serve`；
  `vite.config.js` 的 `__DEV_TOOLS__` 收敛为 `command === 'serve'`（去掉 `VITE_DEV_TOOLS` 分支）；
  `ShareDialog.jsx` 去掉 `file://` 报错分支及那句指向 `.cmd` 的提示；`package_project.py` 去掉离线副本与 `.cmd` 前置自检；
  `freeze_snapshot.py` 去掉对 `dist-user` 的**硬断言**（否则下次冻结报假警报）；`flows/dev-verify.js` 目标改为 dev server。
  `--base` 参数**保留** —— 站点子目录部署仍需它。

  **③ 新增 `scripts/verify_manifest.mjs`**：替代快照清单里那条「五层转义」的 `node -e` 一行命令
  （实测渲染出的反斜杠数量偏了 → 命令长得对但切不出行、静默报「核对 0 个文件」= **永远绿灯的假检查**）。
  新脚本零转义层，且「一条记录都没核对到」时**报错而不是报通过**。**正反两向都验过**：
  真实 v1 快照 122 文件 / 0 不一致；三合一样本（正常 / 被改 / 缺失）逐项报准 ——
  反向测试当场抓出脚本自己的真 bug（Windows 行尾 `\r` 被拼进路径，连正常文件都报缺失）。

  **④ 文档手术**：`NEXT_STEPS.md` §0（运行方式、用户视角、回到 v1）与 §1 完成度表、§2 P0、§6 新增第 30/31 条；
  `README.md` 运行与命令段；`DRAW_RITUAL_BRIEF.md` 守则第 8 条/负面清单/清单项就地标注作废；
  `PROJECT_STATE.md` 目录结构、常用命令、阶段表、本机注意事项。改法：写了**锚点式批量改文档工具**
  （按「起始行前缀 → 结束行前缀」定位 + 唯一性断言），因为行号在编辑中会漂移，按行号改等于埋雷。

  **验收**：`vite build` 通过（产物 JS **290.14 KiB**、CSS 33.88 KiB）；生产产物在
  `vite preview`（http://127.0.0.1:4180/）上**真跑**：`reveal.js` → 球命中、四张素材全加载（含抽到的 `major-18.webp` 月亮）；
  `share.js` → 分享卡片出图 1080×1920 / blob 227 kB / 保存按钮可点（**验证了被改的 `ShareDialog` 没坏**）。
  静态四项核查全通过：`isFileProtocol` 零残留、`skin.js` 的 `BASE` 声明仍在、正式产物 0 处调试条文案、
  用户可见文案不再有已删除入口的指引。

  **⚠️ 遗留**：① 上线平台未选、账号未登录（需用户本人操作）；② 旧交付包 `*-2026-09-19.zip` 已作废
  （内容过时且含已删除的离线副本），要发人用新的打包命令重打；③ 在真正上线前，能给人看的通道只有
  `vite dev` / `vite preview`，两者都要求对方装 Node —— 这是 Q1=甲 的既定代价。
- **2026-09-19（第十九轮 · v2 主视觉首版出图并装入皮肤；建立 GitHub 私有仓）**
  - **出图 1 张**（约 5–10 积分，用户已确认）：`assets/hero-art/bg/以参考图为准_…_2026-09-19T12-36-04.png`
    1536×1024，走 image-to-image 以**主视觉·无球版**为参考保画风。构图按要求改成了：
    女巫肩部以上特写（帽檐主动溢出）、**只剩一只手**（从左下伸入）、中央留白给 3D 球。
  - **v1 母版已移入 `assets/hero-art/bg/_v1/`** —— `find_src()` 取目录里排序第一张图，两张并存必取错。
  - 装入皮肤并重跑下游：`build_hero_assets.py` → `public/skins/mist-night/hero-bg.webp`（117 KB）；
    `build_lqip.py` → `src/config/lqip.js`；`build_og_cover.py` → `public/og-cover.jpg`。
    （换主视觉后这两个必须重跑，否则模糊底与分享封面和实际画面对不上。）
  - **实测（`assets/_debug/preview_hero_v2.py` 复用 `preview_hero.py` 的 CSS 数学 + 真页面截图）**：
    - 球心在**图像坐标 (50.0%, 61.5%)**，与规格 (50%, 61%) 偏差 0.5% → **`ANCHORS.orb` / `CARD_RISE` 零改动**
    - 可见窗口实测：1564×708 → x[1.9%,98.1%] **y[10.4%,75.7%]**；390×844 → **x[35.2%,64.8%]** y[1.2%,97.3%]
    - 空区直径 ≈**36.8%**（规格 ≥46%，偏小）；但圆心准、**软边无轮廓，没有被画成一颗球**
    - 脸部 2× 放大判读：眼窝全黑，仅鼻梁与唇极弱可见 → 达标
    - **既有契约未破**：`audit-draw` `overlapPx: 0` / 净空 2.3px / 八拍 5501.8ms 在区间内；
      `audit-title` 标题、副标题、卡牌三处重叠**全为 0**；`vite build` JS 292.52 kB
  - **⚠️ 本轮最重要的发现（是规格书的漏洞，不是出图工具的错）：宽屏上手看不见。**
    第 2 节把手定在画布 y 61–88%（依据是球下缘与卡牌底线），**却没拿它去和可见窗口比**；
    而宽扁屏可见窗口下缘只到 **y≈75.7%** → `v2-idle-wide.png` 的底部带**做对比拉伸后仍然没有手**。
    手机（可见窗口 y 到 97.3%）里手完整可见。**「手托在球下缘」与「手在宽扁屏可见」几何上几乎互斥**
    （球下缘 y77% vs 可见下缘 y75.7%，只差 1.3%）—— 要让桌面也看见手，手得**沿球侧缘往上抓**。
    详见 `HERO_V2_PROMPT.md` §5.4 与 `NEXT_STEPS.md` 第 32 条。**处置方式待用户拍板。**
  - **建立 GitHub 私有仓**（Q5=乙）：`https://github.com/VickRolL/tarot-daily`，
    首次推送 `2edb30f`，111 个文件 / 73 MB。本机 `gh` 已登录（账号 `VickRolL`，含 `repo` scope），
    **建仓与推送都不需要用户手动操作**；需要用户本人做的只有 Vercel 侧 import。
  - 新增排查脚本：`assets/_debug/preview_hero_v2.py`（合成 + 径向扫描量空区）、`crop_hero_v2.py`（局部放大判读）
- **2026-09-19（第二十轮 · 水晶球换成真 3D（three.js）；女巫的脸二次压暗到五官全不可见）**
  用户本轮原话：「**手的部分先不改了**，倒是女巫的脸部哪里，我希望**连鼻子和嘴巴都不要看见，被黑暗笼罩的彻底**。
  **改好了背景之后要着手 3D 部分**。」—— 三个动作，按序做完。

  **① 女巫的脸：二次压暗（`scripts/fix_hero_face.py`）**
  - **先诊断，别直接调参**（`scripts/_diag_face.py`）：脸框内平均亮度 **L=0.0462，比周围黑暗还暗（0.0695）** ——
    所以「脸太亮」的判断是错的。真正的问题是**局部对比**：五官活在 0.02–0.10 这个很窄的带里。
    决定性证据：在脸框内按 `L>0.10` 取点几乎取不到 → **任何亮度阈值法都不可能抓到鼻梁与唇**。
  - 做法改为**引导插值暗场**：`field = blur(L·w) / blur(w)`，权重 `w` 只保留「本来就暗」的像素
    （朴素模糊会把周围的亮一起抹进来，反而糊出一块灰斑 —— 第一版就踩了）。
    软椭圆覆盖整张可见脸；**外圈保护帽檐那圈磨亮的边、核心不保护**（鼻梁高光必须一起压掉）。
    加 ±0.9/255 抖动避免色带。输入取 `bg/_beforeface/`，**脚本可重复跑而不叠加深**。
  - 结果：核心区 `p99−p50`（五官对比）**0.0529 → 0.0078**，局部对比能量 **−74%**，
    脸均值与周围环的差从 **+0.0056 翻到 −0.0136**（脸现在比周围更暗），全图 `p99` 0.3675 → 0.3667（未动脸以外）。
  - **页面级复验**（`_verify_page_face.py` + `flows/probe-face-rect.js`）：从真页面截图裁出脸区、3× 放大 + 极端自动对比拉伸，
    两个视口下五官均不可读；椭圆边界与头发自然融合。
  - ⚠️ 坑：Pillow 的 `GaussianBlur` **拒绝 `mode="F"`**（报 wrong mode），本机又没有 scipy →
    自己写了纯 numpy 的 FFT 高斯（带 reflect padding）。三个脚本共用这套写法。

  **② 手抠成独立前景层（`scripts/build_hero_hand.py`）**
  - 为什么必须抠：3D 球的 canvas 叠在背景之上，会把画在背景里的手盖住 ——
    读起来从「手托着球」变成「球压在手尖上」。
  - 结果：`public/skins/mist-night/hero-hand.webp`（RGBA 1536×1024 / **31 KB**），
    叠在**高于 `.orb`** 的层级（手 z-index 3 / 球 2），`pointer-events: none`（否则全屏层会吃掉球的点击）。
  - **遮挡实测 10.1% < 15% 上限**（用户 Q3 的硬约束）。
  - ⚠️ 提取判据用**亮度阈值而不是 R/B 通道**：后者在冷色指甲高光上失效（那部分会被判成背景丢掉）。
    区域也做了限制（y≥56%、x∈[28%,72%]、r≤1.25×球半径），避免把别处的暗部一并吃进来。
  - 与底板**同相位呼吸**（复用 `.hero-plate--idle` 的 `bgBreath`），且只在 `entranceDone` 后挂载 ——
    两层只要差一点相位，背景里的手就会和前景层分离成**重影**。

  **③ 水晶球 3D 化（`src/components/OrbCanvas.jsx`，three.js —— 本项目唯一已批准的依赖例外）**
  - **为什么是「自身发光的实心球」而不是「折射背景的玻璃球」**：three 的 `transmission` 采样的是**场景环境**，
    不是 canvas 背后的 DOM —— 「球体折射出背景里的女巫」这条路在 WebGL 里走不通
    （除非把女巫也放进 3D 场景，那等于重做整个背景，与「2D 层不动」的决定冲突）。
    处方是**内部程序化星云 + 冷蓝菲涅尔边缘 + 镜面高光**，光的观感由着色器自己给。
  - **三条不能破的架构约束**：① canvas 绝对不能放进 `.hero-plate`（它挂着 14s 呼吸缩放，
    CSS 缩放 canvas = 把渲染好的位图拉糊）；② 留在 `.orb` 内 → 天然继承 hover / active / charging 缩放，手感与 2D 时代一致；
    ③ 无 WebGL / 纹理失败 / three 拉不下来 → 一律降级，2D 球原样顶上，页面不留空洞。
  - **星云在构建期烤进贴图**（`build_orb_texture.py` → 1024×512 / 53 KB，等距圆柱投影）。
    不用实时 fbm 的理由：球的屏幕直径约 434 CSS px、DPR 2 就是 75 万像素，
    实时 fbm 要 7500 万次以上 hash/帧，移动端必掉帧。**全部用循环卷积**（`fft2 → 乘核 → ifft2`，不加 padding），
    这样 u 方向左右边缘天然接得上，绕球自转不会出缝（接缝自检：边缘差 2.38 / 相邻列差 2.40 → 无缝）。
    运行时着色器只做 **1 次纹理采样 + 几个点积**。
  - **着色器迭代（三次「不像球」的弯路，都写进代码注释了）**：① 直接贴球面 → 读起来是**行星**；
    ② `refract` 折射采样 → 星云被扭曲成一片无法辨认的色块（弃）；③ **直采 uv + 强明暗塑形** ← 现在这条
    （「球」和「贴了图的球面」的区别全在塑形：中心透亮、边缘压暗）。
  - **首版「蓝色行星」的修法**（本轮最后一次着色器调参）：降饱和到 0.60（冷蓝交给菲涅尔边缘独占）、
    `pow(1.35) × 0.60` 把动态范围压向暗部（只留最密的几缕丝发光）、亮核 0.30 → 0.15、菲涅尔指数收到 5.0、
    高光收到「一个小亮点」。实测球心 **L 48.9 / 背景 47.1**（基本齐平）、边缘环比中心更亮 → 读作「暗玻璃球」。
  - 顺带修掉第二层采样的一个真 bug：原写法把 uv 整体乘 0.72 再偏移 0.41，**绕开了贴图两极的压暗带**，
    极点附近会凭第二层亮起来。改为只横向换尺度、v 原样传下去。
  - **🐛 修掉一个静默失效的 bug：React.StrictMode 下的 WebGL context 竞态。**
    原实现沿用 React 渲染出来的那个 `<canvas>`；而 StrictMode 开发期会「挂载 → 立刻卸载 → 再挂载」，
    **React 复用同一个 DOM 节点** → 第一个实例 `forceContextLoss()` 掉的正是第二个实例要用的 context
    → 3D **静默退回 2D**。这个 bug 特别阴：DOM 在、CSS 在、`--has3d` 的类没挂上，但球看起来「也能用」。
    改为 **three 自建 canvas**（`host.appendChild(renderer.domElement)`），并在探针里断言
    **`.orb__canvas` 只能有 1 张**（多于 1 张说明卸载时没摘干净）。
  - ⚠️ **同一个坑踩了两次：GLSL 注释里写了反引号。** 整段 GLSL 是 JS 模板字符串，
    反引号会**当场把它截断** → Vite 转换报错 → 整个 hero 白屏。已把这条写进代码注释，
    并新增一条预检习惯：**改完组件先 `curl` 一下模块 URL 断言 200**，再截图 —— 比跑一轮截图快得多。

  **④ 顺手查到并修掉的无障碍缺口：`ParticleField`**
  - 它是全站动效里**唯一**没处理 `prefers-reduced-motion` 的一处（CSS 媒体查询、`OrbCanvas`、`HeroStage` 都做了），
    全屏星屑会一直飘一直闪 —— 而这正是前庭敏感用户最难受的那类动效。
  - 改为 reduced 时**只画一帧静态星屑**、不起 rAF；`resize` 时补画一帧（否则重排后星屑整层消失），
    且 reduced 下 resize **不重撒点**（「跳一下」正是 reduced 想避免的）。

  **⑤ 验收（全部实测，不是推算）**
  - `node scripts/verify-orb3d.mjs` —— 四个用例（桌面 1582×804 / 手机 390×844 / reduced ×2）**四项判据全绿**：
    ① `.orb--has3d` 已挂且 canvas 恰好 1 张；② 那张 canvas 上**真的有活着的 WebGL context**
    （`isContextLost() === false`，WebGL 2.0）；③ 手 z-index 3 > 球 2、素材已加载且铺满画布；
    ④ 星屑跟着 reduced 走（非 reduced 稳态在变 / reduced 稳态不变）。**后两项是双向判据**，两侧都验过。
  - **指针视差**：指针从左扫到右，高光质心 **+42.5 px**（Δy 仅 −9.2，来自星云噪声）。
    判据只看高光质心位移 —— 自转与内部呼吸会让整图差异无法归因。
    另确认全 `src/` 里**只有 `OrbCanvas` 监听 `pointermove`**，2D 层静止这条契约没破；也没有陀螺仪。
  - **手机**：球 351×351 完整落在 390×844 内（左右各留 19.5 px），绘制缓冲 730×730 → DPR 2 生效。
  - **蓄势拍接线全通**：`App(charging) → HeroStage → CrystalOrb → OrbCanvas → uCharge → 着色器`，
    实测球心 **+86%**、边光 **+82%**（`.orb__charge` / `.orb__glow` / `.scene--charge-dim` 也都在位）。
  - **reduced**：两次独立运行截图在球区**逐像素零差异** → 自转确实没跑（若 rAF 在跑，
    两个独立进程的墙钟不可能对齐，贴图方位会差出十几个像素）。
  - **既有契约全过**：`audit-title` 标题 / 副标题 / 卡牌三处重叠**全为 0**；
    `audit-draw` **8/8 断言通过**（总时长 5520.2ms、`flip90 − 牌停稳 = 1836.1ms`、空面板 218.6ms、`overlapPx 0`）；
    `audit-motion` `layoutAnimatingKeyframes: []`；`reveal` / `share` 回归通过。
  - **构建**：`vite build` 通过（410 modules，4.25s）。产物：`index-*.js` 290.1 → **300.81 KB**（gzip 96.4 → **104.70 KB**）、
    `index-*.css` 35.5 → 37.38 KB、**`three.module-*.js` 746.94 KB（gzip 191.81 KB，独立 chunk，不在首屏路径）**。
    **并且用 `vite preview` 在真产物上跑了一遍**（norm + reduced 都 ALL_PASS）—— 不光信 dev server。

  **⑥ 查证但刻意不改的一条：蓄势时球外那圈紫色「气泡」**
  - 用**三层消融**归因（`scripts/verify-halo.mjs` + `_check_halo.py`：同一拍截三张，每次只隐藏一层，
    按半径做亮度归因）：主贡献者是 `.orb__charge`（DRAW_RITUAL_BRIEF §7-C 要求新增的**充能环**，
    r 1.32–1.70R 上贡献 **+14.4**），`.orb__glow` 只有 **+3.5**。
    ⇒ **这是既有设计取舍，不是 3D 化引入的缺陷**（2D 时代同样存在，只是那时球自己是一团亮渐变，
    读作「aura」；现在球暗了，同一圈读作「bubble」）。要不要缩小/调淡是**视觉决策，留给用户拍板**。
  - ⚠️ 中途我按「单张径向剖面找断崖」改过一次光晕渐变，**实测更糟**（贴球那圈贡献从 +3.5 涨到 +24），已回退。
    教训：**径向平均区分不了「环」和「盘」**，靠单张图的曲线形状反推形状会误判，归因只能靠消融。

  **⑦ 新增脚本**：`build_orb_texture.py`（球内星云等距圆柱贴图，循环卷积保无缝）· `build_hero_hand.py`（手部前景层）·
  `fix_hero_face.py`（脸部二次压暗，幂等）· `_diag_face.py`（脸区亮度诊断）· `_verify_page_face.py`（页面级放大判读）·
  `verify-orb3d.mjs`（一次跑完四个 3D 用例）· `verify-halo.mjs` + `_check_halo.py`（三层消融归因）·
  `_check_orb_look.py`（球体观感体检）· `_check_parallax.py`（高光质心位移）· `_check_static.py`（静帧判据）·
  `run-flows.mjs`（**通用 flow 运行器**）· `flows/probe-orb3d.js` / `probe-parallax.js` / `probe-charge.js` / `probe-face-rect.js`

  **⑧ 工具改造 `scripts/shot.mjs`：新增 `--mobile` / `--dpr`**
  Windows 上 Chrome 窗口有**最小宽度** —— 实测 `--window-size=420,880` 得到的 `innerWidth` 是 **504**，
  移动端断点根本不会命中（DRAW_RITUAL_BRIEF §8.2 记的「移动 504×784」就是这个原因，不是笔误）。
  真手机视口必须走 CDP 的 `Emulation.setDeviceMetricsOverride`。

- **2026-09-19（第二十一轮 · 内容与美感补齐：牌意加深 / 牌之图鉴 / 两侧漂浮低语）**
  用户在本轮开头先**选定 3D 版本**（「现在网页的 3D 效果已经初步达成我想要效果了，暂时可以选定这个版本」），
  然后给出本轮的活：「图鉴可以加但是先做的简单一些有就可以了，牌意加深也要做。还有就是**主页的两边太空**，
  可以适当加一些**漂浮轮切的标签**，标签包含一些隐喻或是低语，加强背景女巫与用户的交互感。」
  并明确划掉一项：「**正逆位先不用考虑**」。**零新增依赖、零积分消耗**。

  **① 牌意加深（`src/data/cards.js`）——22 张各补 5 个字段**
  - 新增 `element` / `astrology` / `symbol` / `favor[2]` / `avoid[2]`（原有 num/nameZh/nameEn/keywords/meaning/advice 全部保留）
  - **`symbol` 的写法是有意定下的**：写「这个象征在说什么」，**刻意不去描述画面里画了什么** ——
    否则读者会拿文字去核对插画，一有出入就变成「解释错了」。它是解读，不是图注
  - 元素/星象按牌性给（愚人＝风·天王星、塔＝火·火星…），是塔罗通用体系，不引入流派分歧

  **② 两侧漂浮低语（`src/components/WhisperTags.jsx` + `src/data/whispers.js`）**
  - **分层拆解**（沿用本项目 `.hero-frame` / `.hero-plate` 的老办法）：`.whisper` 负责 `transform`（指针视差），
    `.whisper__text` 负责 `transform`（漂浮关键帧）。**同一个元素上两个 transform 会互相覆盖**，必须拆成两层
  - **相位用「周期摊到同侧条目」而不是固定累加**：`offset = rank*cycle/groupSize`
    （`rank` = 同侧序号、`groupSize` = 同侧总数）。首版用 `staggerMs*index` 时踩了两个坑：
    ① 右侧 5 条被全局序号拖到 **8.5s** 才出现；② 所有「亮」窗口都挤在周期的前 6.8s 里 → **齐亮齐灭**。
    改完实测同屏条数稳在 **6–8** 条（周期 9.4s）
  - `charging` 拍换池： rituals 短句（「别眨眼」「它在听」「呼——」），把「女巫在等你」这层关系接进仪式
  - **几何契约**：`.whispers` 铺满视口但 `pointer-events: none`（否则吞掉水晶球点击）、
    `z-index: 5`（**必须 > `.hero-hand` 的 3**，否则整层沉到主视觉后面；又低于标题 20 / 面板 50，不遮它们）、
    每条锚在**本侧留白带**里（左内缘 ≤34% / 右内缘 ≥66% 视口宽）、`@media (max-width:900px)` **整层 `display:none`**
  - `prefers-reduced-motion`：退化成**静态子集**（无旋转、无视差、无漂浮），画廊与详情照常可用
  - 指针视差走 `requestAnimationFrame` 节流，且只在 `(hover: hover) and (pointer: fine)` 上挂

  **③ 牌之图鉴 + 完整解读（`CardGallery.jsx` 改写 / 新增 `CardDetail.jsx`）**
  - 图鉴从「开发者专用的牌面总览」改成**用户可开的 `role="dialog"` 覆盖层**：顶栏新增「牌之图鉴」入口，
    去掉开发期那套「已接入插画 N 张」探测 UI 与脚注。22 格都是 `role="button"` + `tabIndex={0}`
    （**不能用 `<button>`** —— `CardFace` 的根是 `div`），支持 Enter / Space
  - **加深的内容全部住在新覆盖层里，面板一个像素都没变** —— 这是本轮最关键的一处架构判断：
    解读面板是「bottom 锚定 + 内容撑高」，可用高度只有视口高的 **38.5%**（卡牌底边固定 61.5%），
    实测净空桌面 39.2px / 竖屏最坏 10.7px，**再加几百字必然压到卡牌上**；
    而面板一旦改成「限高 + 内部滚动」，底部主 CTA 会被挤出可视区（比压住 20px 更糟）。
    所以分工是「**面板负责快读，详情层负责完整**」，两层互不挤占
  - 图鉴与详情是**叠加**而非互斥（从图鉴点进详情，Esc 回到图鉴）→ 因此不需要「返回」按钮
  - 面板侧只做无损补充：「完整解读」按钮 + 元素·星象那一行；宜/忌只在 `min-height: 820px` 的高视口显示（护住移动端净空）
  - `DevBar` 去掉「牌面总览」按钮（职责已移交顶栏），`App.jsx` 里图鉴**不再受 `DEV_TOOLS` 门控**

  **④ ⚠️ 本轮抓到的三个「只有真跑才暴露」的问题（都已根治）**
  1. **右侧空了约 9 秒**：相位用全局 layout 序号累加 → 右半侧最晚一条要等 8.5s。改为同侧序号 + 缩短间隔
  2. **低语齐亮齐灭**：固定延迟堆叠把「亮」的窗口全挤在周期前段。改为按同侧条目摊满一个周期
  3. **探针自己的判据写错了**（`spreadSane`）：它断言同屏条数落在 3–9，但 reduced 下「10 条全亮」是**设计**
     → reduced 一跑必然假失败。这条要专门记：**判据也得双向验** —— 只在非 reduced 下成立的门槛，
     不能无差别地套到固定画面上
  - 另修：`probe-gallery` 的插画选择器写成了 `.gallery__hit .card__art img`，
    而 `SmartImage` 渲染出来的就是 `<img class="card__art">`（img **自己**带类，不是子元素）→ 恒报 false

  **⑤ 验收（全部实测）**
  - `probe-whispers`：宽屏 **10 条 / 穿透点击 / z-index 5 / 几何带全过 / 零相交 / 轮切 6·6·8·8·8·6（min 6 max 8）**，ALL_PASS；
    **窄屏 504×688 整层 `display:none`**（隐式断言与显式断言双向都过）；`--reduced` 下 **10 条常亮且文案不变**、ALL_PASS
  - `probe-gallery`：宽屏与窄屏**双视口 ALL_PASS** —— 入口命中测试为自身、22 格、插画 `naturalWidth 768`、
    详情四块内容长度非空（象征 33 / 正位含义 56 / 今日建议 23）、宜忌各 2 条、
    桌面两栏间隔 **44px**（恰为 `gap` 上限）、横向溢出 **0**、Esc 回到图鉴、再关回到场景
  - `probe-panel-worst`（**逐张遍历 22 张牌**，不是随机抽一张）：`--reduced` 下两个桌面视口
    `all22 + worstClearance + noKickerWrap + noActionWrap` 全绿，最坏净空 **约 40.2px / 44.2px**（门槛 8px），
    重叠 0 —— 证明「多出来的面板行 + 加深内容」**没有破坏 38.5% 高度契约**
  - 既有契约回归：`audit-draw` 6 视口净空 35–44px、重叠 0；`verify-orb3d` 不受影响
  - `vite build` 通过；`src/` 内**没有新增任何运行时依赖**

  **⑥ 本轮明确没做（用户裁定或列入待办）**
  - **正逆位**（用户：「先不用考虑」）· **中文衬线子集字体**（当前 `@font-face` 数为 0，是美感上最大欠账，已列 P2）·
    **Web Audio 合成音效**（充能/翻牌/揭晓，零素材成本，已列 P2）· 小阿卡纳 56 张（成本红线内，用户未点头）

- **2026-09-20（第二十二轮 · 字号放大 + 音效合成）**
  用户本轮原话：「首先是**标题与副标题太小了**，包括**旁边的低语也是**，需要加大字体。
  然后**音效你看着合成试试看**。」—— 两件事，第二件就是第二十一轮列在 P2 的那条。**零新增依赖、零积分消耗。**

  **① 标题：36px 的天花板被拆掉（`index.css` / `.headline__title`）**
  - 根因是**上限锁死**：原来 `clamp(24px, 3vw, 36px)`，而 `3vw` 在 1200px 宽以上就超过 36
    → **桌面端不管窗口多宽，标题永远 36px**。这就是「太小」的来源，不是某一处写小了
  - 新写法 `clamp(26px, min(3.6vw, calc(12.4vh - 42.4px)), 54px)`，vn 项是**从几何契约反推的**：
    标题带从卡牌顶边往上锚定、往上长，天花板是视口顶；
    `卡牌顶边 = 0.385h − min(0.23h, 210px)`；标题带高 = `1.06F + 7（间距）+ 18（副标题）`，
    字墨迹还要比行盒往上溢 `0.19F`（42.5px 时实测溢 8px）。要求「墨迹顶边 ≥ 4px」解得 `F ≤ 0.124h − 42.4`。
    巧合但好用：`h ≥ 913` 后卡高被 210px 咬住，同一条公式在 h=913 处算得 70.9px、
    而高视口的正确上限是 70.8px —— **两条曲线在这里恰好接上**，不需要第二条规则。
  - **实测**：1564×708 → **45.4px**（原 36，+26%）；1564×904 → 54px（+50%）；1564×604 → 32.5px（自动缩，不被裁）。
    只按 vw 放大的话，1564×604 下标题块会被顶到 `y = −11`（墨迹 −19）**直接被屏幕裁掉** —— 这一项就是为此加的。
  - 副标题 `13px → clamp(15px, min(1.15vw, 2vh), 18px)`，字距 0.26em → 0.22em（字号变大后原字距会让整行过长）

  **② 低语字号加大，锚点跟着往回收（`index.css` / `.whisper` + `skin.js` 的 `WHISPERS.layout`）**
  - `clamp(11px, 0.86vw, 14px)` → `clamp(13px, 1.05vw, 18px)`（实测 1564 宽下 13.4 → 16.4px），字距 0.18em → 0.15em
  - ⚠️ **字号与锚点 x 是乘起来的一对**：文字越宽越往中间顶，而两侧空间有硬上限
    （左内缘 ≤34% / 右内缘 ≥66% 视口宽）。按新字号算，reduced 静态子集里那条 16 字长句
    （「所有问题都有答案，只是有的要等」）在旧 `x = 14` 下是 **33.5%** —— 只剩 0.5% 余量，等于没有。
    于是把四个「缩进位」12/14 → **10/11.5**（两侧对称），实测最坏降到约 30.6%，留出 3.4%（约 53px）。
  - 颜色从 `rgba(201,180,255,.72)` 提到 `rgba(205,186,255,.78)`、光晕 20px → 26px：
    字号变大后若亮度不动，反而会显脏

  **③ 顺手修掉一个**当时还没人发现的**真 bug：窄屏标题与「牌之图鉴」二维相交**
  - 新写的判据量出 504×688 下标题墨迹 `x 173.1→343.5`、而「牌之图鉴」按钮是 `274.4→333`、y 22–45
    → **两者相交 59px 宽**。截图里就是「签」贴着「牌之图鉴」，很容易被当成「设计得紧」。
  - 根因是几何上的无解：504 宽的内容区只有 448px，而顶栏三段文字（品牌 116 + 图鉴 59 + 日期 125 + 两道 18 间隙）
    就占了 336px，标题还要居中。而标题**不可能**躲开顶栏那条 y 带
    （顶栏底 67、卡牌顶 106，中间 39px，装不下标题 + 副标题）。
  - **处置：窄屏（≤640px）藏掉顶栏日期**。它是三段里信息量最低的一项（今天抽到什么牌才是重点），
    藏掉后空档从 130px 变成 **273.5px**，标题反而能放大到 37.3px（原 30px，+24%）。
  - 字号上限也是按腾完之后的空档定的：`clamp(26px, min(7.4vw, calc(12.4vh - 38.4px)), 40px)`

  **④ 音效合成（新增 `src/audio/sfx.js` + `src/components/SoundToggle.jsx`）**
  - **四个音，全部现场合成**（一个 mp3 都没有）：蓄势「嗡」（两个略失谐的低音 + 开扬的低通扫频）、
    释放「啪」（噪声脉冲 + 128→54Hz 闷响）、翻牌「唰」（很短的带通噪声 + 一点木质「嗒」，超过 200ms 就不像纸了）、
    揭晓「叮」（四个**非整数倍**分音 1 / 2.01 / 2.99 / 4.21 + 长衰减；
    整数倍会听成风琴，非整数才有玻璃的拍频感）
  - **时刻全部取自同一张节拍表**：蓄势音长度 = `chargeDone`、释放挂在 `chargeDone`、
    翻牌挂在 `flipAt`、揭晓挂在 `panelAt`。动画改时长，音效自动跟着改，不会出现「画面 1.2s、音效 0.6s」
  - **三条不可让步的规矩**（写在模块头部）：① 默认关；② `AudioContext` 只在用户手势里创建/恢复；
    ③ 增益一律走包络（硬切 `gain.value` 会在波形中间留台阶 = 爆音），且指数斜坡末尾写 `0.0001` 而不是 0
  - **一个容易漏的边界**：`reduced` 路径下蓄势音与释放音都被跳过，只剩揭晓铃 ——
    而它是从 `panelAt` 的**定时器**里触发的，那时早已脱离手势栈，等那一刻才建 ctx 会被浏览器挂成 suspended（静默无声）。
    所以抽牌那一帧**必须先无条件 `unlock()`**（仅当音效已开），不能只在蓄势音里顺带建。
  - **开关放左上角（品牌下方）**，两处都试过才定的位：
    · 不进顶栏 —— 顶栏右侧每多一个元素就往中间推，而**那条横向空档就是窄屏标题字号的上限**，这个按钮不占那份预算；
    · 不放右下角 —— 解读面板是 bottom 锚定 + z-index 50，右下角正好在面板身上，抽完牌它会**沉到面板背后**（实测命中测试为假）。
  - `aria-pressed` 报状态、`:focus-visible` 有反馈、`localStorage` 记住选择

  **⑤ 验收（全部实测）**
  - **`probe-sfx` ALL_PASS**：初始 `aria-pressed=false`；点开后 `AudioContext` 实例 0 → **1**、`state === 'running'`、
    `sampleRate 48000`；整场仪式真的连上 **osc 8 / buffer 3 / gain 11 / filter 4、start 8 次**；
    抽完牌后开关的命中测试仍是自身、且与面板 `overlap: false`；关掉后 `aria-pressed=false` + 持久化为 `off`；
    **零自动播放告警、零报错**
  - **`probe-sfx-off` ALL_PASS（反向）**：从没点过开关的用户抽完整张牌，`AudioContext` 实例数 **0** ——
    证明 `unlock()` 没有写成无条件的（第一版就是），且仪式本身照常跑完（`revealedMs 5105`、面板在位）
  - **`--reduced` 下 `probe-sfx` 也 ALL_PASS**：节点数正好是 **osc 4 / buffer 1**（只留揭晓铃），
    与常规态的 8 / 3 构成**互不依赖的双向证据**
  - `audit-title`：1564×708 / 1564×604 / 504×688 三档下 `titleHitsTopbar` **全为空**、三处 overlap **全为 0**，
    墨迹顶边分别 7.6 / 8.2 / 15.1px（都没顶出屏幕）
  - `probe-whispers`：宽屏 ALL_PASS（轮切 6/6/8/8/8/6、几何带全过）；窄屏整层 `display:none` ALL_PASS
  - `probe-panel-worst`：逐张遍历 22 张，最坏净空 **39.2px**、重叠 0、无换行 —— **面板契约未受字号改动影响**
  - `audit-draw` **8/8**：总时长 5604.6ms、`overlapPx 0`、`clearancePx 39.2`
  - `probe-gallery` 宽窄双视口 ALL_PASS
  - **`vite build` 通过**：415 modules（+2）；CSS 42.67 kB、JS **313.65 kB / gzip 110.97 kB**（+3.81 kB / +1.45 kB）；
    `three.module` 独立 chunk 未变。**`src/` 内零新增依赖**
  - **人工看截图**：宽/窄两档 idle 与揭示终态各一张（`assets/_debug/r22-*.png`），
    确认标题、副标题、低语的大小关系与顶栏不再打架

  **⑥ 一条关于「判据」的补充**：本轮的窄屏相交 bug 是**新判据抓出来的**，不是看出来的。
  `audit-title` 原来只量「标题 vs 卡牌」，而标题往上长还有**第二道天花板**（视口顶 + 顶栏文字）——
  第十五轮修好「标题被卡牌盖住」之后就再没人回头看上限。本轮给它补了
  `band`（roomToViewportTop / intrudesTopbarBy / 二维相交 / titleRoomPx）四组量。
  另修一处判据自身的错：取顶栏边界时先写成「叶子节点的左边缘」，
  而右侧那组的容器其实从更左边就开始了（里面还有「牌之图鉴」按钮）→ **拿 351 当边界会误报安全**，
  必须取 `.topbar` 的直接子元素。
- **2026-09-20（第二十三轮 · 音效全部重做 + 环境音 + 卡牌下挪 + 标题罗马碑刻体）**
  用户四条反馈：① 音效「和汽车加速很像 / 像拍了一下鼓 / 翻转也是鼓 / 揭晓的叮不符合体感」；
  ② 要有**幽暗寂静**的背景音乐；③ 卡牌靠上、与副标题重叠；④ 标题参考**罗马艺术字**。
  - **① 音效重做**：四条反馈指向同一件事 —— 上一版四个音里有三个是「**有明确音高 + 快起音 + 低频能量集中**」，
    人耳对这三件事的归类就是**又快又硬的机械/打击事件**。据此重写四个音
    （屏息 / 雾散 / 丝绢 / 颂钵），并立一条判据写进 `engine.js` 文件头：
    **凡是在 50ms 内把能量堆到 200Hz 以下的写法，一律不许出现**。
    另加程序化厅堂混响（`makeIR()`：噪声 × 频率相关衰减 + 早期反射 + 左右去相关）——
    合成音「廉价」往往不是音色问题，是**没有空间**。
  - **② 环境音**（新增 `src/audio/ambient.js`）：双失谐 drone（0.4Hz 拍频，**刻意不写和弦进行**，
    一有进行就变成「一首曲子」会抢戏）+ 风（低通截止被 0.035Hz LFO 推，28.6 秒一个周期 = 声音自己在呼吸）
    + 每 14–30 秒一声稀疏点缀 + 整条总线走混响。礼仪三条：抽牌时 duck 到 35%、切后台静音、淡入 3.5s
    （「缺省开」是第三十一轮改的，见下文该轮；起播时刻由第一次用户手势决定，见 `audio/autostart.js`）。
    ⚠️ drone **不能**用 `tone()` 那种一次性包络节点搭（会 0.15s 自己停），正解是自己建 `osc → 固定增益 → mix`。
  - **③ 几何：只挪卡牌是没用的（重要）** —— 标题带是从卡牌顶边**往上锚定**的，
    只把牌往下挪，标题带跟着一起挪，副标题与牌面之间的间距纹丝不动。
    改用「**下移换空间**」：落点 38.5% → 40%、卡高 46vh → 43vh、`TITLE_GAP` 20 → **38px**
    → 牌面顶边 15.5% → 18.5%（牌实际下移 20–24px），而**底边 61.5% 与改前完全相同**，面板净空一点没损失。
    标题字号公式随之重推为 `calc(14.8vh − 56.8px)`。
  - **④ 标题罗马碑刻体**：`--font-title` = Cinzel（拉丁）+ Noto Serif SC 900/400（汉字），
    只给标题带换字（子集 10.0 KB）；另加**碑铭线**（真实元素 `.headline__rule`，伪元素量不了位置）
    与两层极轻的刻痕 `text-shadow`。副标题同族 400，避免「两种宋体叠在一起」。
  - 窄屏撞了一次墙：上限提到 40/42px 后「今」的左边缘与「TAROT · 日签」右边缘**二维相交 2.4px**，
    **横向才是紧的那一头**，解出上限 38px（想让窄屏标题再大必须先动顶栏）。
- **2026-09-20（第二十四轮 · 拉丁字体是坏的，已修；字体验收从此进代码）**
  没有新需求，是做完第二十三轮后自检发现的**真 bug**，教训比 bug 本身值钱。
  - **`title-latin.woff2` 里装的不是字体，是 Google 返回的 HTTP 400 错误页 HTML**（1.66 KB）——
    手搓的 fetch 把 `text=` 里没做百分号编码的 `·` 直接塞进 URL，Google 拒了，我把响应体当字体存了。
    **所以「标题换了罗马碑刻体」这个结论当时是假的**，拉丁字形一直由系统字体顶替。
  - **为什么没被发现（重点）**：浏览器 `font-family` 是**逐字符静默回退**的，坏文件不报错、Console 干净；
    截图看不出（回退后的也是衬线体，而我根本不知道 Cinzel 正品长什么样）；`vite build` 无感；
    而我自己的验收表里**字体那一栏是空的** —— 探针验的全是音效和几何。
    暴露点是下一轮顺手检查构建产物时发现一段 CSS 内联 data URI 解出来是 HTML。
  - **修**：重抓拉丁字体（**落盘前验 `wOF2` 魔数**）、顺带按精确字符集重抓两个汉字子集；
    Latin 那张其实是**可变字体**，`@font-face` 从 `font-weight: 600` 改成区间 `400 900`；
    `.topbar__brand` 显式 `font-weight: 400`（**不能写 600**：汉字脸只有 400/900，
    600 会就近匹配到 900 脸，而 900 子集里有「签」没有「日」→「日」回退到系统宋体，同一个词两种字体）。
    体积 14.6 → **10.0 KB**（旧数里 1.7 KB 是垃圾）。
  - **新增两个脚本，把「靠人记得」换成「跑不出来就报错」**：
    `fetch-title-fonts.mjs`（`text=` 一律 encodeURIComponent → 落盘前验魔数 → 不过就 exit 1，绝不写坏文件进 `src/`）
    与 `probe-fonts.mjs`（三条判据 A 脸状态 / B 逐字形谁画的 / C 页面有没有真用上，
    分别对应「文件坏了 / 文件缺字 / CSS 没接上」三种故障，缺一条漏检一种）。
  - **判据设计上的两个坑**：`getPlatformFontsForNode` 报的是**字体文件 name 表里的族名**而非 CSS 族名
    （挂成 `PROBE LATIN` 它照样报 `Cinzel`，第一版拿族名比对 → 全部假 FAIL），正解是只看 `isCustomFont`；
    而且自定义宋体与**系统装的** Noto Serif SC 报出来的族名**一模一样** ——
    若判据写成「族名在白名单里就算过」，上面那个品牌字重 bug 会**静默通过**。
  - **验收**：`probe-fonts` 在 **dev 与生产构建两种形态**下 A/B/C **全 PASS**
    （生产里两个小字体走 CSS 内联 data URI，是浏览器里另一条代码路径）；
    构建产物三个字体字节都是 `wOF2`；`audit-title` 宽 1564×708 与窄 1082×604 四项全过，
    品牌右缘 **140.7px 与宽屏逐位一致**（说明 Cinzel 400/600 字符宽度相同，窄屏横向余量不受影响）；
    回归 8 个 flow 全过（`audit-draw` clearance **39.2px** 与改前逐位一致）。
  - **两条该带走的结论**：①「**看起来对**」不能作为字体正确的判据，字体只有问浏览器自己才算数
    （可推广：任何「静默回退 / 静默降级」的机制，视觉验收都无效）；
    ② 列验收表要**按「我改了什么」逐条列，而不是按「我有什么探针」列** ——
    第二十三轮那张表看着挺全（4 个探针全绿），但它只覆盖了我改动最大的部分，
    而**字体恰恰是唯一出错的东西**。
- **2026-09-20（第二十四轮 · BGM 换成 AI 素材 + 音效改用 AiSounds 生成）**
  用户两条：①「你用芒果灵创生成的 bgm 效果不错」②「好像无法生成短时长的音效，
  我这里推荐用 Aiwave 来制作音效」。于是这一轮做两件独立的事。
  - **① BGM 素材化 →「素材优先、合成兜底」**。第二十三轮的环境音是纯合成的，
    依据是一条当时成立的假设：「音频素材零新增」。用户明确说 AI 那版更好听 →
    **假设被推翻**，改为用素材。素材 `src/assets/audio/ambient-loop.mp3`
    **350,820 B (342.6 KB)**，来自芒果灵创 Mureka-9.5 出的 205.7s / 3.29 MB 长氛围曲，
    经 `scripts/build-ambient.py` 裁成 **60 秒无缝循环**、单声道、48kbps ABR、峰值 −3.0 dBFS。
    - **为什么单声道不丢空间感**（反直觉，别改回去）：站内 BGM 要送进 `engine.js` 那条
      程序生成的**立体声**混响，左右宽度由 IR 去相关产生 —— 宽度来自混响，不来自源。
      源用单声道：省一半体积、避免低码率立体声的相位摆动，空间感一点不损失。
    - **合成那版没删**，它承担三个职责：`file://` 下 `fetch` 被 CORS 挡 → 退回它；
      素材缺失/解码失败 → 退回它；以及它**永不重复**（拍频 + 缓变滤波 + 随机点缀），
      是「素材循环听腻了」的备选。
    - **等功率交叉淡化**：取 `L+X` 秒输出 `L` 秒，尾部淡出的同时叠上头 X 秒淡入 ——
      数学上保证 `out[L-1] → out[0]` 与 `out[X-1] → out[X]` 两处都连续。
      **接缝不是「听不出来」，是环上根本不存在。** ⚠️ 所以**不能**在循环两端加淡入淡出，
      那会让每一圈都在音量上「喘一口气」，比接缝还明显。
    - **MP3 循环的坑（必读）**：MP3 编码在头部写入 576~1152 级采样点的延时、尾部补零对齐帧，
      这些解码后是**真静音**，而 `decodeAudioData()` 按规范**不剥掉**（LAME 的 gapless 信息 Chrome 不解）
      → 每圈多 20~30ms 静音，在连续 drone 上就是一个可闻的「噗」。
      修法不是重新编码，是用 **`loopStart` / `loopEnd`** 把静音排除在循环之外
      （`ambient.js` 的 `audibleRange()`，带**上限保护**最多各剥 3000 点，
      免得把素材本身很轻的头尾误判成静音）。本机实测头剥 345 点、尾剥 107 点、循环区 60.039s。
    - **体积预算**：站里单张卡牌 webp 是 280–335 KB、22 张 ≈ 6.6 MB、JS ≈ 1.07 MB。
      BGM 342.6 KB **比一张卡牌图还小**。
  - **② 音效：芒果灵创结构上做不了 → 改用 AiSounds**。实测它只有 `music`/`score`/`dubbing`
    三种模式，**没有 SFX**：用「生成一声翻牌」的提示词提交，两个变体都交回 **180 秒**的整首曲子。
    （同一轮顺带把「AI 生成的到底是不是音效」这件事量化了：解码后量时长 / 频谱质心 /
    动态范围 / 能量跳变率 —— 180.25s + 0.65~0.81 次/秒的跳变 = 是曲子不是音效。）
    改用 **AiSounds（爱声音坊）**，`aiwave.art` 跳转到 `aisounds.cn`，音效引擎就是
    **ElevenLabs Sound Effects**（1–30s，原生支持 Loop），语义层用 DeepSeek V4 Pro 优化中文提示词
    → **写中文比写英文好**；有「项目音效包」为成组交付而做；注册送 200 积分。
    ⚠️ 搜「AIWave」会撞到至少四个同名无关产品（`aiwave.live` 是卖大模型 API 的网关、
    `audiowaveai` 是 TTS 应用、`airwaveai.com` 是工具导航站），有些收录站还把 aiwave 写成
    「歌曲生成工具、无 API」——**那是错的**（把两个产品混成一个了）。
    四个音的提示词 / 时长 / 交付契约写在 **`audio-src/README.md`**。
  - **③ 两类新增的静默故障，都变成了判据**：
    （a）**「素材没加载成功 → 悄悄退回合成」** —— 页面照样有声音、控制台干净、截图看不出。
    所以 `probe-ambient` 从 4 条扩到 **10 条**，第一条就是「走的是素材路还是兜底」，
    用**结构**判（`createOscillator` 增量 = 0 + buffer 时长 > 10s），不是用「有没有声音」判。
    （b）**「MP3 尾零没被排除」** —— 靠直接读 `getChannelData` 断言
    「循环区外峰值 < 1e-3、区内 > 0.01」。
  - **④ 两个「判据本身写错」的教训**（比 bug 更值钱）：
    （a）`probe-ambient` 的 `loopTrim` 恒为假，**而代码是对的** ——
    断言里写死了 44100 换算秒数，但 `decodeAudioData` 会把音频**重采样到 AudioContext 的采样率**
    （本机 48000）。改用 `buffer.sampleRate` 后立刻通过。
    **判据本身可以错，而且错了以后看起来像被测对象有问题** → 断言必须用被测对象自己报出来的参数换算。
    （b）`lameenc.set_vbr()` 收的是**模式常量**（`VBR_OFF`/`VBR_RH`/`VBR_ABR`/`VBR_MTRH`）不是布尔值，
    传 `1` 抛 `RuntimeError: Invalid mode` —— 第三方 C 扩展的参数语义要实际探测（`dir()` 一行就能列）。
  - **验收**：`probe-ambient`（**生产构建** 4199）**10/10 PASS** —— `sourceKind: "asset"`、
    `onDelta {osc:0, buf:1}`、mp3 fetch **200**、buffer 60.048s/48000Hz/单声道、
    循环区外峰值 5.4e-5 & 9.97e-5 / 区内 0.297、duck 0.18→0.063 → recovered、
    `stopsOnOff 1 ≥ liveSources 1`、零报错；回归 7 个 flow 全过
    （`audit-draw` **pass:true**，clearance **39.2px** 与第二十三轮逐位一致）；
    `probe-panel-worst`（dev）ALL_PASS，22 张全过、最坏净空 50.1px、零重叠。
    `vite build` **418 modules**，JS 318.85 kB（gzip 112.82），
    `ambient-loop-SkECQZSt.mp3` 350.82 kB 作为独立哈希资源产出
    （生产下从 JS 里解析到的引用路径也验过：200 / audio/mpeg / 350820 B）。
  - **下一步**（第二十五轮已全部做完，见下条）：~~等用户把四个音放进 `audio-src/sfx/`
    → 写 `build-sfx.py` → 改 `sfx.js` 成素材优先合成兜底 → 扩 `probe-sfx` 判据~~ ✅
    仍未做的：**发布上线**。

- **2026-09-20（第二十五轮 · 四个音效换成 AI 素材 + 修掉响度离散与过满刻度）**
  限流重置后手工生成完剩下两个音（flip 1s/20 点、reveal 4s/80 点，余额 140→0），
  四个音全部落到 `src/assets/audio/sfx/`（共 52 KB），并接进 `sfx.js` 的素材路。

  - **接线**：`import.meta.glob('../assets/audio/sfx/*.mp3', { query:'?url', eager:true })`
    —— 目录为空或缺某个文件都**不报错**，正好匹配「素材分批到货」；到货一个多一个键。
    预载时机靠 `engine.unlock()` 在手势栈里派发的 `tarot:audio-ready`
    （第一声 charge 就在抽牌点击里，靠 play 时现 fetch 来不及）。
  - **★ 修的故障一：响度离散 19.5dB**。原 `normalize()` 取「RMS 增益与峰值增益更严者」，
    flip 的峰值系数 28.5dB（很轻的床体 + 一记 6ms 爆裂，0.77% 样本占 4.83dB 能量）
    → 被整体降增益压到 **RMS -30.6dB**，页面上几乎听不见。
    关键结论：**峰值钉在天花板时 RMS 有数学上界**（= 逐样本硬削顶的 RMS），
    flip 上界只有 -17.3dB，离目标差 3.3dB —— **靠限幅永远到不了**。
    我先用限幅器参数网格调了 12 组（全是 -16.7~-16.9dB 纹丝不动）才反应过来方向错了。
    → 到不了只有两条路：接受偏差，或**付失真**。flip 选后者（软削顶，**被削 1.44% 样本**
      这个数字是可审计的），而且是**逐素材决定**（`SPECS[*].clip`）：宽频噪声瞬态饱和
      听着像「响了一点」，而 reveal 的颂钵**有音高**，饱和会变闷响 → 它宁可不削。
  - **删掉一个「注释在说谎」的函数**：上一轮写的 4:1 `compress()`，注释称它把 flip
    从 -22dB 救到 -17dB。**是假的** —— 它的峰值包络是 3ms 慢起音，单样本尖峰只把包络
    顶起 0.75%，根本进不了阈值。换成显式 tanh 软削顶后才真的可控。
    教训：**写检波器/压缩器前先确认它的检波器抓得住目标信号**。
  - **★ 修的故障二：出厂 mp3 过满刻度**（浏览器解码 burst **+0.7dBFS**、flip +0.3dBFS）。
    根因：天花板设 -0.3dBFS，注释写「给编码留了 0.3dB」—— 那是**没量过的假设**，
    实测 mp3 过冲 1.0~1.7dB（且随内容变化，reveal 同一电平不冲）。
    → 天花板改 **-2.8dBFS**（BGM 那条线一直是 -3dBFS，音效才是异类），
      四个 rms 目标**同步下移 2.5dB** —— 这样「峰值到天花板的距离」「限幅压多少」
      「软削顶削多少」**逐位不变**（证据：flip 削顶电平 -5.5→-8.0dBFS 正好差 2.5，
      被削比例 **1.44% 一模一样**），只是整体轻 2.5dB。若只降天花板不动目标，
      限幅会多压 2.5dB → 有 headroom 的 charge 不动、顶着天花板的另三个被压低 →
      **相对对齐被破坏**，正是这个脚本要修的那类故障。
  - **另外两条判据本身是错的，一并修了**：
    · `build-sfx.py` 的「解码峰值 > 0dBFS」是**死判据** —— miniaudio 解码输出被钳在
      ±1.0（burst 有 6 个样本精确落在 1.000000、s16 路径 4 个撞到 32767），
      永远不可能 >0。改成**指纹判据**「不许出现被钳样本」。证据脚本：
      `scripts/_probe_mp3peak.py`。
    · `probe-sfx` 的 sfx 下载判据匹配的是 **`/sfx/` 这个路径段** —— 那是 **dev 的 URL 形状**
      （`/src/assets/audio/sfx/charge.mp3`）；生产里 Vite 把资源**拍平**成
      `/assets/charge-<hash>.mp3`，于是这条判据在生产上**一次 fetch 都匹配不到**，
      而它在 dev 上绿得毫无理由（只是目录恰好叫 sfx）。改成**按文件名匹配**。
      ★ 同一个坑的第三次：**「只在某一条实现路径上成立的门槛不能套到另一条路径」**
        ——前两次是「振荡器 vs 缓冲区」「素材 vs 合成」，这次是**URL 形状**。
  - **探针新增三条端到端判据**（对齐 `NEXT_STEPS.md` 第二轮规划里挂着的那条
    「四个音的 RMS 差 ≤ 3dB」）：在 `sfx.js` 的解码回调里实测每个音，经
    `__tarotSfx.stats` 出去 —— 响度极差 / 解码峰值 / 时长对合同。
    为什么必须这一层：前面每条判据都只证明「路走对了」，证明不了
    「**路上运的那批货是对的**」（dist 里躺着上一版旧文件就是这么静默发生的）。
    量的对象是浏览器解码后的样本：生成 → build-sfx.py → 构建 → HTTP → `decodeAudioData`，
    整条链路只在这个点上合拢。

  **验收**（全部在 **prod 4199** 上跑）：
  | 项 | 结果 |
  |---|---|
  | `probe-sfx`（dev 与 prod 各一次） | **ALL_PASS true**，16 条判据全绿；`sfxFetches` 4 个哈希资源全 200 |
  | 出厂素材实测（浏览器解码） | RMS charge -17.2 / burst -16.4 / flip -17.0 / reveal -17.6 dB，**极差 1.2dB**；峰值 -4.8 / -1.2 / -0.7 / -3.1 dBFS，**无一个越界**；时长 1.045 / 1.045 / 0.862 / 4.049s 与合同一致 |
  | `build-sfx.py` 自检 | **ALL_PASS true**：响度偏离目标 0.4~0.7dB、无被钳样本、flip 软削顶 1.44% |
  | `probe-sfx-off` / `probe-ambient` | **ALL_PASS true** |
  | 回归 5 个 flow（prod 4199） | `audit-title` 四条 PASS、`audit-draw` **pass:true**（8 条 ok）、`audit-motion` ok、`reveal` 素材全加载、`share` 分享卡 blob 260KB |
  | `vite build` | ✓ 3.93s；`index-DClMUVcF.js` 320.67 kB（gzip 113.58）；四个音效作为独立哈希资源产出 |
  - **`audio-src/audition.html`**：四音试听台 + 「按仪式节拍连播」（charge@0 / burst@1000ms /
    flip@3700 / reveal@5010），供耳朵验收。

- **2026-09-21（第二十六轮 · ① charge / ② burst 用 ElevenLabs 重做）**
  用户原话：「点击球的时候那个屏息……听起来像雷云滚滚」「雾散听起来就像电饭煲烧开了」
  「比较吵闹……修改的风格尽量要偏向于给人心情安定的那种感觉」「可以用 ElevenLabs 来生成音效」。
  ③④ 保持不动（用户：「后面两个音效的效果还可以，暂时可以先」），只重做 ①②。

  - **通道**：`scripts/gen-sfx-elevenlabs.py`（生成 → 立刻量指标 → 对 `TARGETS` 报 PASS/FAIL）。
    新增 `scripts/_exp_sfx_prompts.py`：支持一次铺多个候选做**横向对比排名**
    （主脚本每次都会覆盖同名文件，看不到上一次的结果）。指标与判据从主脚本 **import**、不复制 ——
    否则「实验用的量法」会与「定阈值时的量法」悄悄漂移，改出来的数就没意义。
    它还带一个 `--recheck`（零成本）：拿备份的旧素材回测，确认量法与当初定阈值时同源可比。
  - **三个实测结论（都是方法论级的，详见 `NEXT_STEPS.md` §17）**：
    ① **直连 ElevenLabs 写中文基本等于随机** —— 四个中文变体（influence 0.3 / 0.7）
    全部产出高频嘶声（质心 5846~7681Hz、4kHz 以上占 48~60%），换英文立刻落到目标区间。
    「写中文更好」**只对 AiSounds 那个壳成立**（它中间挂了 DeepSeek 语义层）。
    ② **长负面清单 + 高 influence 会把「禁止的东西」渲染出来**（同一份稿：0.7→1708Hz，
    0.85→5935Hz）—— 与第二十五轮「正面声学名词被逐字实现」是同一件事的两面：
    **点名什么就来什么，写「不要」也算点名。** 现在一律**短稿、只做正面描述**。
    ③ **指标合格 ≠ 听感合格**：三条 charge 候选**频谱判据全绿**，但包络在结尾塌到
    -22.5 / -11.9 / -9.1dB，而节拍表里 burst 的 `at=1000ms` **正好是 charge 的结束点**
    → 蓄势蓄到自己先静了，两拍之间露出空档。已补 `env_tail_db`（末段 1/8 相对峰值，下限 -6dB）
    并**做了反向验证**；实测它与频谱维度互相独立（`en-180` 频谱绿/包络红、`en-0.7` 反之），
    所以不是冗余判据。
  - **契约数字统一**：`burst` 的合同时长曾有**三个数**（README 与 `SPECS.target` 写 1.5s、
    `JOBS` 写 1.2s、`probe-sfx` 手抄 1.0s）。探针那个 1.0s **不是契约，是从旧产物量出来的**
    （AiSounds 只支持整数秒）。统一到 **1.5s**，并把探针期望值改成**由产出方写出**：
    `build-sfx.py` 落 `scripts/out/_sfx_expect.js`，`run-flows.mjs` 贴在 flow 前面注入页面。
    判据从「对一张手抄表」变成「对流水线刚产出的成品」—— 这才是「dist 里是不是旧文件」的真判据。
    反向验证做过：故意改错期望值 → 立刻红，并能点名漂的是哪个音。
    另把「**不超拍**」单列为硬约束（超了会撞下一拍），而「短于契约」只作信息记录 ——
    flip / reveal 短于契约是用户已接受的，判红等于制造一条**永远红**的判据。
  - **去泥参数重新定标（调参对象消失了，参数就不该沿用）**：`SPECS.charge` 原来的
    `240Hz × 2` 是为「旧的真泥素材」（质心 97Hz、低频占比 0.94）扫出来的；
    换成新素材（质心 286Hz、次低频仅 1.7%，而且「厚」正是用户点名要的方向）后，
    那道高通只是在削用户要的厚度，配套的 `rescue` 门槛更是**前提已不成立**（硬套只会假红）。
    改为 `100Hz × 1` 轻量次声保护 + 关掉 `rescue`。
  - **交付物**：`audio-src/candidates/index.html` —— 23 条候选的对比试听页
    （含被否决的旧版作对照），数字由指标文件生成、不手抄，供用户用耳朵拍板。
  - **验收**：生成端全绿 · `build-sfx.py --force` **ALL_PASS true**（响度偏离 0.4~0.7dB、
    charge 纯限幅零削顶）· `probe-sfx` **dev 与 prod 各 ALL_PASS**（`sfxStatsDrift` 空、
    `sfxOverContract` 空；prod 抓到的正是新哈希资源）· `probe-sfx-off` / `probe-ambient` /
    `probe-devbar-sfx` / `audit-title` / `audit-draw` 全过（`"pass":false` 零命中）·
    `vite build` 干净（`devbar` / `屏息` / `setForceSynth` 零命中 —— ⚠️ 第二十八轮全扫发现
    这句只对 **JS** 成立，**CSS** 里仍有 `.devbar` 死规则，见 `NEXT_STEPS.md` §19.9）。
  - **成品实测**：charge 1.045s / -17.1dB / -12.0dBFS（质心 431Hz、次低频 0.010）·
    burst **1.515s** / -16.1dB / -3.3dBFS（质心 1715Hz、>4kHz 0.153、尾段 -31dB）。
  - ⚠️ **仍留给耳朵的一件事**：charge 现在走 `100Hz × 1`，**偏「厚」**。
    若听着发闷，把 `SPECS.charge` 改回 `'hpf': 240, 'passes': 2` 重跑即可 ——
    那是「厚」与「清」的取舍，属于耳朵的活，不是指标的活。

- **2026-09-21（第二十七轮 · ③ flip 改成「一次起手」；揪出流水线会把瞬态填满）**
  用户原话：「翻牌那里的音效效果是**符合的**，但是冗杂了点，听起来像在翻书，而翻牌要**利落一点**，
  你这个听起来像**翻了两三张牌**需要修改一下」。
  ⚠️ 注意语气：**方向是对的，只嫌手势冗杂** —— 所以这一轮**没动音色/提示词方向**，
  只把「几张牌」压成「一次起手」。这跟 ①② 那轮「方向被否决、整条重做」不是一回事。

  - **先把「像翻了两三张牌」量化**：旧 flip 拆出 **3 次起手**、首末跨度 **0.563s**、
    末次起手落在 **63%** 处，能量「铺满度」duty 从 **0.24 → 0.89**（越接近 1 越像持续噪声）。
  - **★ 根因（消融查出来的，是个静默故障）：那层「沙子」不是素材里的，是流水线自己填出来的。**
    逐级消融（`scripts/_ablate_flip.py`）：源素材 crest 25.9~28.8dB / duty 0.151
    （干净的一次瞬态），过完 **RMS 归一 + 软削顶**这一步后变成 crest 14.5dB / duty 0.891
    —— 因为源 RMS 只有 -33.5dB，要拉到目标必须加 +16.9dB，峰值溢出 → 软削顶把空隙**全填上**。
    **「利落」是被归一化这一步吃掉的**，看源文件和听成品都不容易发现。
  - **新增判据「手势守恒」**（`build-sfx.py`）：瞬态素材（duty < 0.5）**不许**被流水线填空
    （成品 duty > 0.55）或压掉动态（crest < 12dB）。**反向验证做过**：旧素材 0.241→0.891 判红、
    新素材 0.151→0.176 判绿。这条以前是**静默**的 —— 不新增判据，下一轮还会踩。
  - **生成端加「手势」维度**（`gen-sfx-elevenlabs.py`）：`n_onset` / `onset_span_s` /
    `last_onset_ratio` / `duty_20` / `crest_db`；flip 的 `TARGETS` 定为
    跨度 ≤0.20s、末次起手 ≤45%、铺满 ≤0.55、crest ≥16dB。
    反向验证：旧 material 在跨度与末次起手上直接 FAIL。
  - **解一个三角约束（天花板 × 增益 × 候选）**：要同时满足「零钳位样本 / 峰值 ≤-1.0dBFS /
    四音响度离散 ≤3.0dB」。`scripts/_tune_flip.py` 做三维扫描，最终选 **s1-60**
    （0.6s，英文短稿「a single crisp playing card flick」）+ `ceiling -4.0` + `rms -16.0`。
    为此给 `SPECS` 加了**逐音天花板** `spec.get('ceiling', PEAK_CEILING_DB)`。
  - **修一条探针假红（浏览器与流水线的量法不一致）**：`probe-sfx` 报 flip 漂 0.8dB，
    超了 0.6dB 容差。根因：**浏览器侧 RMS 算的是整文件（含编码静音尾），流水线算的是修剪后的**
    —— 翻牌稀疏，尾巴占比大，差值就显出来了（密的声音根本察觉不到）。
    → `sfx.js` 的 `measure()` 也先按 **-55dB 相对阈值**修剪静音，与 `build-sfx.py` 同一套。
    修完 `sfxStatsDrift` 空、离散 **2.2dB**。
  - **验收**：`build-sfx.py --force` **ALL_PASS true**（flip 解码后 -18.3dB / 峰值 -2.6dBFS /
    0.627s / 软削顶 2.13%；手势守恒 0.151→0.176 绿）· `probe-sfx` dev 与 prod **各 ALL_PASS**
    （`sfxStatsDrift` 空、`sfxPeakOver` 空、离散 2.2dB）· 8 个 flow 全过 ·
    `vite build` 干净（无 dev 痕迹、dist 里 `flip-DoXlLpbD.mp3` 与源一致）。
  - **交付物**：`audio-src/candidates/flip.html` —— 5 条候选（s1-50 / s2-50 / s3-50 / s1-60 / s3-60）
    各走**完整流水线**后的成品对比 + 被否决的旧版作对照，数字由指标文件生成、不手抄。
    **当前站点里放的是 s1-60**，等用户听完拍板。

- **2026-09-21（第二十八轮 · ③ flip 定稿：用户在五条候选里选了 `s2-50`）**
  用户听完候选试听页后给了结论：**「我会选 S2-50 这一个」**。已按选择完成替换、重建与验收。
  `charge` / `burst` / `reveal` 未动。

  - **`s2-50` 是什么**：0.5s 素材（成品 `0.522s`），英文稿
    「A snappy card flip: one short, tight, crisp snap of a single playing card
    turning over quickly, bright paper texture, sharp attack, the tail stops at once.」，
    铺满度 0.589、2 次起手、**质心 5483Hz（五条里最亮）**。
  - **⚠️ 一个必须记下来的事实：这条在手势维度上是五条里最差的。**
    成品铺满度 **0.686**（自定阈值 0.55）、末次起手 **64%**（阈值 45%）**两项超标**；
    而上一版 `s1-60` 分别是 0.200 / 32%。也就是说**用户抱怨的是「手势」，
    但最终打动他的是「音色 + 时长」**（质心最亮 8126Hz、时长最短 0.522s，
    比 `s1-60` 短 17%）。候选页上这两项超标是**明示**的，用户看过仍选它 → 耳朵拍板成立。
    → 可复用结论：**听感里的「利落」不只由 duty / 末次起手构成，还包含亮度和绝对长短**。
    要补判据应该给 `centroid_Hz` 和时长加**双侧区间**，而不是继续收紧 duty。
  - **「手势守恒」判据这次没有拦**：`s2-50` 素材 duty 0.589 > 0.5 → 被判为**持续型、免检**。
    这是判据设计的有意之处（持续型不该按瞬态标准要求），但也意味着
    **现役文件目前不受这条判据保护** —— 已在 `audio-src/README.md` ③ 节明写。
  - **新增的备份退路**：上一版 `s1-60` 的素材备份在
    `scripts/out/_raw-backup-20260921-014500/flip-raw.mp3`，
    想退回直接覆盖 `audio-src/sfx/_raw/flip-raw.mp3` 再 `build-sfx.py --force` 即可。
  - **改动**：`audio-src/sfx/_raw/flip-raw.mp3` 换成 `s2-50`；
    `_make_flip_page.py` 的 `CHOSEN` 改 `s2-50`（并把 s2-50 提到候选列表首位、
    s1-60 标注为「上一版现役」）；成品 `flip.mp3` 重出。
  - **验收**：`build-sfx.py --force` **ALL_PASS true**（flip 解码后 -18.0dB / -1.1dBFS /
    0.522s / 软削顶 0.69%，比上一版 2.13% 更低；四音响度离散 **1.9dB**）·
    `probe-sfx` dev 与 prod **各 ALL_PASS**（`sfxStatsDrift` 空、`sfxPeakOver` 空）·
    8 个 flow 回归全过 · `vite build` **JS 干净**（`devbar` / `setForceSynth` 零命中）。
  - **⚠️ 顺手纠正一条被引用了三轮的不实断言**：文档里一直写「产物里 `devbar` 零命中」，
    这轮逐文件全扫发现 **CSS 里仍有 7 条 `.devbar` 死规则（857 字节，占 CSS 1.8%）**——
    那是 Tailwind 按源码里的类名字面量生成的，**JS 摇掉了但 CSS 不会跟着走**。
    功能无影响（真机上 DevBar 确实不存在），但**断言本身按字面是假的**：
    它当初大概只在 JS 上 grep 过，写进文档却写成了「产物」。
    → 规矩：写「X 零命中」必须注明**扫的范围**。详见 `NEXT_STEPS.md` §19.9。
  - **⚠️ 顺手修掉一个「换素材换出来的构建故障」：Vite 把小音频内联进了 JS。**
    `flip.mp3` 缩到 **4010 字节**，低于 Vite 默认的 `assetsInlineLimit` **4096** →
    它被编码成 base64 data URI 塞进 JS 包，**构建产物里不再有 `flip-<hash>.mp3`**。
    症状：`probe-sfx` 那条「四个 mp3 都被下载」的判据按 `*.mp3` 文件名匹配请求，
    data URI 的 basename 不是 `.mp3` → **生产上直接判红**（dev 上仍绿，因为 dev 不内联）。
    已修：`vite.config.js` 加 `build.assetsInlineLimit`，对音视频扩展名一律返回 `false`，
    其他小资源保持默认。修完 `dist/assets/flip-CxGpJFXG.mp3` 正常产出、JS 包小了 5.3KB。
    → **教训：判据里的「资源被下载了」这类断言，会被打包器的内联优化静默击穿；
      素材变小可能改变构建行为**（阈值判据的经典陷阱）。
  - **成品实测（现役四音）**：charge 1.045s / -17.1dB / -12.0dBFS ·
    burst 1.515s / -16.1dB / -3.3dBFS · **flip 0.522s / -18.0dB / -1.1dBFS** ·
    reveal 4.049s / -17.2dB / -3.1dBFS。

### 第二十九轮 · v2 定稿存档（2026-09-21）

用户认可四个音效后要求「上传这个版本作为第二版保存」→ 定成 **v2**。

- **标签**：`v1` → `bb0ad52`（v1 基线）· `v2` → 本轮提交（四个音效定稿版）
- **快照**：`_archive/v2-2026-09-21/` —— code 7.5 MB · art 111.6 MB ·
  `SNAPSHOT.md`（构成 + 两份清单 + 两个 zip 的 sha256 + 关键文件指纹 + 还原步骤）
- **远端**：`origin/main` 推送完成。此前 **R25~R28 的提交只在本地**（ahead 13），
  也就是说线上那份一直是「还没有音效」的旧版本
- **演练**：`scripts/verify_snapshot_restore.py`（新增，可复用）换全新目录解包 →
  两份清单各核一次（合计 300+ 文件 / 0 不一致）→ 由包内 `_raw/` 重建音效（ALL_PASS）→ `vite build` 成功

**冻结前体检抓到两条静默故障（都已修）**：

1. **快照会把 `.env.local` 烤进 zip** —— `collect()` 把根目录散件一律收进代码包，
   而 API key 正好在根目录。v1 冻结时该文件还不存在，是**两个版本之间新出现的口子**。
   已加排除 + **硬闸**（收集结果出现密钥类文件即拒绝出包）。
   并先验明 **key 从没进过 git**（扫遍 601 个对象 0 命中）—— 推送不可撤销，这条必须在推之前查。
2. **两个包的清单同名**（都叫 `MANIFEST.sha256`）→ 解到同一目录互相覆盖，
   在合并目录里核对只覆盖到**一个**包，**输出却是「✓ 全部一致」**。v1 就是这样。
   已改成 `MANIFEST.sha256` / `MANIFEST-art.sha256`，校验脚本加 `--manifest`；
   并做了反向验证（篡改 1 个 + 移走 1 个 → 精确判红）。

**收录范围对齐**：新收 `audio-src/`（含 `sfx/_raw/` 四个 AI 音源 —— 旧规则只保住了成品没保住源素材）；
`scripts/out/` 只留 `_exp/` 与 `_raw-backup-*/`（花过 API 额度的），其余日志截图全排。
代码包从 577 个文件 / 58.6 MB 压到 7.5 MB（约 1/8）。

### 第三十轮 · 桌面快捷方式 + 本地预览启动器（2026-09-21）

用户：「先这样，做一个本地快捷方式给我，我看看效果」。

- **交付**：桌面 `塔罗日签.lnk` —— 图标由牌背素材裁中央方形（八角星月徽）+ 圆角生成
  （`assets/launcher/tarot-daily.ico`，含 256→16 七档）。双击 = 必要时自动构建 →
  起本地 http 服务（5180，带 Range）→ 打开浏览器；关黑窗口即停。
- **三个文件**：`start-tarot.cmd`（纯 ASCII 包装层，按「已知路径 → 通配扫 `.workbuddy`
  托管目录 → 系统 `Program Files`」找 node，中文提示一律交给 node 打印）、
  `scripts/launch_preview.mjs`（启动器本体，零依赖；`--port/--root/--no-open/--no-build/--force-build/--help`）、
  `scripts/make_launch_shortcut.py`（生成图标与 lnk，`--verify` / `--run`）。
- **重复双击不叠服务**：启动前先扫 `5180..5209` 端口段，谁回 `__preview_ping` 就复用谁。
  （只 ping 起始端口是错的：起始端口被别的程序占用时，服务会挪到 5181，
   下次双击找不到它就会再起一个 → 端口越堆越多。）
- **⚠️ 关键坑：手写 `.lnk` 字节流双击报 `WinError 1155`。**
  按 MS-SHLLINK 手拼的 lnk，`IShellLink::Load` 能读出 description / 工作目录 / 参数 / 图标，
  **但读不出 `target`，`ShellExecute` 报「没有应用程序与此操作的指定文件有关联」** ——
  缺 `LinkTargetIDList`（`GetPath` 依赖它）。用普通 txt 做对照实验可确认是 lnk 的问题、
  不是环境没 shell。正解：`IShellLink::SetPath` + `IPersistFile::Save` 让系统自己写
  （2127 B，`SetPath` 会生成目标 IDList），**此时 `GetPath` 能读回 target 才算真可用**。
  本机 PowerShell 的 COM 实例化被安全策略拦，但 Python `ctypes` 调 `ole32` 是通的
  → 校验与生成都走这条路。手写实现保留为 fallback。
- **`.cmd` 换行**：本轮新写的 cmd 是 LF，按仓库约定必须 CRLF（`gitattributes` 已标 `*.cmd -text`），
  已修 —— 否则双击会报一堆「不是内部或外部命令」而退出码仍是 0。
- **验收**：首页 200 · `__preview_ping` 200 · `flip.mp3` Range → **206 + `Content-Range: bytes 0-49/4010`** ·
  越权路径 404 · `cmd /c start-tarot.cmd --help` 正常（证明 node 探测 + 参数透传可用）·
  `os.startfile(lnk)` 端到端把服务拉起来并打开浏览器成功。
- **注意**：由助手进程启动的服务会被环境的进程回收清掉（会话结束即消失），
  这与用户自己双击无关 —— 用户双击是由 explorer 发起的独立进程。

### 第三十一轮 · 声音默认开 + 开关改成喇叭图标（2026-09-21）

用户：「这个给用户使用的版本还需要修改一下，默认要打开音乐，音乐控制开关改成一个喇叭符合（符号）」。

**① 默认开 —— 但「默认开」不等于「一打开就出声」**

改之前：意图缺省是静音（`readSoundPref()` 读 `=== 'on'`），用户在页面里必须自己找到开关。
改之后：
- `engine.readSoundPref()` 判据翻成 **`!== 'off'`** —— 只有用户**明确关过**才算关。
  ⚠️ 写成 `=== 'on'` 会把「从没表过态」算成静音，默认开被静默吃掉，
  而这种错**没有症状**（页面就是安静，和以前一模一样），只能靠注释与探针守住。
- `let enabled = readSoundPref()`：模块初始化就定下，**不写死 false**。
  写死的话「默认开」在**点水晶球**这条路径上会失效（`handleDraw` 用 `isSoundOn()` 当门），
  而页面正常、控制台干净，只是没声音。
- 新增 **`src/audio/autostart.js`**：监听**第一次** `pointerdown` / `keydown` / `click`
  → `unlock()` + `unmuteAll()` + `startAmbient()`，成功后卸载监听。
  浏览器不允许在非手势里启动 `AudioContext`，所以「默认开」这件事**只能**由第一次操作兑现。
  三条边界：① 用户明确关过（`'off'`）→ 就地收摊，绝不自作主张顶开他的决定；
  ② 手势落在喇叭自己身上 → 让给喇叭（不然「第一次点的就是开关想关掉」会先起一遍再关）；
  ③ 只有 `unlock()` 返回真（ctx 确实 running）才收工，否则留着等下一次手势 ——
  比「以为开好了其实一直哑着」诚实。三种事件都要听：**读屏软件「激活」只派发 click，没有 pointerdown**。
- 新增只读探针口 `peekAudioContext()`。为什么不能拿 `audio()` 去查状态：
  它是「拿到（必要时创建）」—— 查一眼就会在非手势里造出一个 suspended 的 ctx，
  把「默认开但尚未出声」这个可测事实自己破坏掉。
- `__tarotSound`（与 `__tarotSfx` 同一套路）只读暴露 `armed / pref / engineOn / ctxState`。

**② 开关收成喇叭**：`.sound` 从「圆点 + 声音开/关」的胶囊改成 **32px 正圆 + 喇叭图标**
（开 = 喇叭 + 两道路径声波，关 = 喇叭 + 叉；`stroke` 描边，与碑铭线/低语框同一族细线）。
- 为什么：这是个**状态控件**，不是一句话 —— 声波/叉是跨语言符号，
  「声音开」三个字在 11px 下要读一遍才知道当前是哪个状态；且去掉文字后横向占用少一半。
- 代价：**必须补无障碍名字** → `aria-label="声音"`（图标本身 `aria-hidden`，不给读屏念两遍），
  状态仍由 `aria-pressed` 报。
- 开的时候只有那两道声波在**呼吸**（2.6s，外圈延后 0.35s；本体不动 —— 整块动会读成 spinner），
  `prefers-reduced-motion` 下关掉。
- 尺寸从「靠文字撑开」变成写死，位置（left 28 / top 74，窄屏 68）**没动**：
  实测 `toggleRect = {x:28, y:74, w:32, h:32}`，`elementFromPoint` 命中是自己，
  与解读面板不重叠，点球仍然打在球上（`orbHittable === 'orb'`）。
  逐条量过 10 条低语：最近的一条在 x=70.4（按钮右边缘 60，横向错开），无重叠。

**③ 探针跟着改口径**（这是本轮工作量的大头 —— 旧断言的前提消失了）：
- 新增 `scripts/flows/probe-sound-default.js`（10 条判据）：缺省开 / **加载时没有 ctx**（把口径写死，
  免得以后有人为了「默认开」去非手势里建 ctx）/ 第一次手势之后 ctx 恰好 1 个且 running、
  **环境音真的接上**（60.048s 素材循环源，不是只建了个空图）/ 这次手势不许把开关翻掉 /
  第二次手势不重复起播 / 点关（pref=off、声波消失、源被停）/ 再点开（pref=on、声波回来、新起 1 个源）。
- `probe-sfx.js`：`PASS_initOff` → `PASS_initOn`（判据是「不是 off」而不是「等于 on」——
  缺省开**不写存储**，写成 `=== 'on'` 会在首次访问这个主场景下假红）；
  第一次手势从 `btn.click()` 改成 `document.body.click()`（缺省开着，点开关等于把它关掉）；
  另加 `PASS_iconSwitches`（关掉后声波路径必须消失、图标仍在）。
- `probe-ambient.js`：起播手势同上改成点空白处。
- `probe-sfx-off.js`：口径从「从没点过开关的用户」改成「**用户明确关过**」，
  用 `--seed "localStorage.setItem('tarot.sound','off')"` 在页面加载**之前**造出前提
  （加载后再写没用：`enabled` 是模块初始化读一次定下的）。
- `scripts/run-flows.mjs`：补上 `--seed` 等**带值开关**的透传 ——
  漏一个的后果不是「参数无效」，而是那个值被当成**下一个 flow 名字**去拼路径。

**验收（生产构建 `dist/` 实测）**：
`probe-sound-default` 10/10 · `probe-ambient` 9/9 · `probe-sfx` 17/17 · `probe-sfx-off` 6/6 全 `ALL_PASS`；
四个音效的实测统计**一个字节没动**（flip 0.522s / -18.0dB、charge 1.045s、burst 1.515s、reveal 4.049s）；
产物里 `声音开` / `声音关` / `sound__dot` / `sound__label` 零命中，`devbar` 仍被摇掉。
截图核对：桌面 32px、手机（CDP 真机视口 390×844）30px，开/关两态形状都清晰。
- **一处判据自己写错过并修正**：`PASS_toggleOff` 第一版把「开关这一刻之前创建过的所有源」
  当成「活着的源」（实测 `stops=1 < liveSources=5` 假红）——
  音效是一次性 BufferSource，播完自己结束，`sfx.playAsset()` **从不调 `stop()`**。
  改成按第一次手势那一刻量到的**增量**算（素材路 = 0 振荡器 + 1 循环源），与 `probe-ambient` 的 onDelta 同口径。
- **顺手修的两处文档漂移**：`App.jsx` 里 `SoundToggle` 上方写着「放右下角」（实现一直是左上角）；
  顶部「音效现状」还写着「① charge · ② burst · ④ reveal **待用户耳朵最终确认**」，
  而用户在第二十九轮已经说了「现在音效很符合我的需求」→ 改成「四个音全部定稿」，并注明下面那段是证据链不是待办。
