/** 大阿卡纳 22 张 —— MVP 先做这一套，跑通后再补小阿卡纳 56 张 */

export const MAJOR_ARCANA = [
  {
    id: 'major-00',
    num: '0',
    nameZh: '愚人',
    nameEn: 'The Fool',
    keywords: ['启程', '信任', '未知'],
    meaning:
      '你正站在一段旅程的起点，前路没有地图，也没有旧经验可以照抄。此刻的轻盈与毫无防备，恰恰是你最大的资本——它让你敢迈出别人不敢迈的那一步。',
    advice: '不必等到万事俱备，先迈出一小步，路会在走的过程中显形。'
  },
  {
    id: 'major-01',
    num: 'I',
    nameZh: '魔术师',
    nameEn: 'The Magician',
    keywords: ['显化', '专注', '行动力'],
    meaning:
      '你手里其实已经握齐了做这件事需要的工具，问题从来不是「够不够」，而是「用不用」。专注是这一签的核心：把散落的注意力收拢到一个点上，它就会开始显形。',
    advice: '今天就动手做那件你一拖再拖的事，工具早就在你手边。'
  },
  {
    id: 'major-02',
    num: 'II',
    nameZh: '女祭司',
    nameEn: 'The High Priestess',
    keywords: ['直觉', '静观', '潜意识'],
    meaning:
      '答案不在外面。你心里其实已经知道，只是还在等一个外部的许可。这张牌让你安静下来，去听那个没有声音的声音——直觉、梦境、身体的第一反应。',
    advice: '今天少说多听，在下结论之前，先给自己一段不被打扰的独处。'
  },
  {
    id: 'major-03',
    num: 'III',
    nameZh: '女皇',
    nameEn: 'The Empress',
    keywords: ['丰盛', '滋养', '创造'],
    meaning:
      '丰盛正在向你流动，但丰盛需要被承接：好好吃饭、好好睡觉、把身边的环境收拾得有生气。创造力的前提从来不是灵感，而是被滋养的身体和心。',
    advice: '今天对自己好一点，把精力花在让你觉得丰盈的事上。'
  },
  {
    id: 'major-04',
    num: 'IV',
    nameZh: '皇帝',
    nameEn: 'The Emperor',
    keywords: ['秩序', '掌控', '责任'],
    meaning:
      '混乱是需要被收拢的。这张牌请你从情绪里退一步，用规则、结构和边界来安放眼前的事——把该定的规矩定下来，把该说的话说明白。',
    advice: '今天给一件拖沓的事定下明确的时间与责任人。'
  },
  {
    id: 'major-05',
    num: 'V',
    nameZh: '教皇',
    nameEn: 'The Hierophant',
    keywords: ['传统', '指引', '信念'],
    meaning:
      '你面前有一条被无数人走过的路，它稳妥、有章法、有前辈可请教。此刻不必急着标新立异，先接受体系与传统的教导，会让你少走很多弯路。',
    advice: '去找一个有经验的人聊聊，或重新捡起那些被验证过的老办法。'
  },
  {
    id: 'major-06',
    num: 'VI',
    nameZh: '恋人',
    nameEn: 'The Lovers',
    keywords: ['抉择', '联结', '价值观'],
    meaning:
      '一个需要凭价值观而非利弊来做的选择摆在面前。它未必关于爱情，更多时候关乎「你到底认同什么」。选那个让你不必解释自己的方向。',
    advice: '今天做决定前，先问自己一句：这符合我是谁吗。'
  },
  {
    id: 'major-07',
    num: 'VII',
    nameZh: '战车',
    nameEn: 'The Chariot',
    keywords: ['意志', '推进', '掌控方向'],
    meaning:
      '方向已经定了，剩下的就是把缰绳握紧、往前走。这张牌带着强烈的意志与移动感——看似矛盾的两股力量，只要你肯驾驭，就会成为车前的两匹马。',
    advice: '今天拒绝一次犹豫，把已经想清楚的事推进到底。'
  },
  {
    id: 'major-08',
    num: 'VIII',
    nameZh: '力量',
    nameEn: 'Strength',
    keywords: ['温柔的坚定', '耐心', '驯服'],
    meaning:
      '真正的力量不是压制，而是安抚。面对强势的人、难缠的局面，甚至自己心里那头暴躁的兽，用温柔而坚定的方式去驯服它，比用力赢下来更有效。',
    advice: '今天用耐心代替对抗，先把自己的情绪安顿好。'
  },
  {
    id: 'major-09',
    num: 'IX',
    nameZh: '隐士',
    nameEn: 'The Hermit',
    keywords: ['内省', '独处', '寻找答案'],
    meaning:
      '你需要一段退后的时间。人群的噪音会盖住你真实的判断，而这张牌把你送进一间只点着一盏灯的小屋——在独处里，你会找到那把能开锁的钥匙。',
    advice: '今天关掉一部分外部输入，给自己半天安静。'
  },
  {
    id: 'major-10',
    num: 'X',
    nameZh: '命运之轮',
    nameEn: 'Wheel of Fortune',
    keywords: ['转机', '周期', '顺势'],
    meaning:
      '局势正在转动，风向开始改变，而这未必由你推动。顺势比逆势省力得多：看清周期走到哪一段，然后把力气用在正确的时机上。',
    advice: '今天别硬扛，观察变化，跟着转机走一步。'
  },
  {
    id: 'major-11',
    num: 'XI',
    nameZh: '正义',
    nameEn: 'Justice',
    keywords: ['公平', '衡量', '因果'],
    meaning:
      '因果正在被称量，一切回到「公平」的尺度上。这张牌要求你诚实——不夸大、不逃避、不双标，把事实和感受分开来看，然后承担属于自己的那一份。',
    advice: '今天把一件需要摊开说的事，如实说清楚。'
  },
  {
    id: 'major-12',
    num: 'XII',
    nameZh: '倒吊人',
    nameEn: 'The Hanged Man',
    keywords: ['换个角度', '暂停', '放下'],
    meaning:
      '停滞不是失败，而是一次视角的换取。当你愿意暂时放下「必须马上解决」，换一个高度重新看这件事，答案会以完全不同的样子出现。',
    advice: '今天允许一件事暂时悬着，换个角度再看它。'
  },
  {
    id: 'major-13',
    num: 'XIII',
    nameZh: '死神',
    nameEn: 'Death',
    keywords: ['结束与重生', '断舍离', '清理'],
    meaning:
      '一段关系、一个身份、一种活法已经走到了它的终点。这张牌描述的不是灾难，而是清理：只有腾空的手，才能接住新的东西。',
    advice: '今天主动断掉一件早已消耗你的事。'
  },
  {
    id: 'major-14',
    num: 'XIV',
    nameZh: '节制',
    nameEn: 'Temperance',
    keywords: ['平衡', '调和', '节奏'],
    meaning:
      '两股力量需要调和——工作与休息、理智与情感、给予与保留。这张牌讲究的是节奏和剂量，找到中间那个刚刚好的刻度，事情就会自己流动起来。',
    advice: '今天把节奏放慢一档，试试「不多不少」。'
  },
  {
    id: 'major-15',
    num: 'XV',
    nameZh: '恶魔',
    nameEn: 'The Devil',
    keywords: ['束缚', '欲望', '看清执念'],
    meaning:
      '你被什么东西绑住了，而且很可能是自愿的：一段关系、一份收入、一种习惯、一个上瘾的念头。牌面不评判欲望，只请你看见那根绳子，然后承认自己随时可以解开。',
    advice: '今天诚实写下那件「割舍不掉」的事，看清它的代价。'
  },
  {
    id: 'major-16',
    num: 'XVI',
    nameZh: '塔',
    nameEn: 'The Tower',
    keywords: ['震荡', '崩塌', '重建'],
    meaning:
      '一个你精心维护的结构正在裂开。它会疼，但崩塌的原因是它本来就建在不牢的地基上——被震落的东西，恰好是你不需要的。',
    advice: '今天接受一次失控，把注意力放在「重建什么」上。'
  },
  {
    id: 'major-17',
    num: 'XVII',
    nameZh: '星星',
    nameEn: 'The Star',
    keywords: ['希望', '疗愈', '指引'],
    meaning:
      '长夜之后的那点微光。经历了一段消耗之后，这张牌带来疗愈、希望和缓慢的复原——不需要立刻振作，只需要相信光还在。',
    advice: '今天做一件温柔的小事，允许自己慢慢来。'
  },
  {
    id: 'major-18',
    num: 'XVIII',
    nameZh: '月亮',
    nameEn: 'The Moon',
    keywords: ['迷雾', '幻象', '不安'],
    meaning:
      '迷雾、错觉与不安。你看到的未必是真的，恐惧会自行编织画面。这张牌提醒你：在情绪退潮之前，不要基于想象做重大判断。',
    advice: '今天少下结论，多核实事实，早点休息。'
  },
  {
    id: 'major-19',
    num: 'XIX',
    nameZh: '太阳',
    nameEn: 'The Sun',
    keywords: ['明朗', '成就', '活力'],
    meaning:
      '清清楚楚的明朗。所有遮掩都退开，事情回到它最简单、最明亮的样子——这是一种被看见、被认可、可以尽情舒展的状态。',
    advice: '今天大方地展示自己，把好心情分享出去。'
  },
  {
    id: 'major-20',
    num: 'XX',
    nameZh: '审判',
    nameEn: 'Judgement',
    keywords: ['觉醒', '召唤', '清算'],
    meaning:
      '一个召唤正在响起：过往的账单、未处理的心结、真正想做的事，都需要被回应。这张牌带着觉醒的意味，是重新定义自己的时刻。',
    advice: '今天认真回应那件心里搁了很久的事。'
  },
  {
    id: 'major-21',
    num: 'XXI',
    nameZh: '世界',
    nameEn: 'The World',
    keywords: ['完成', '圆满', '整合'],
    meaning:
      '一个循环完成了。你走到了这一段的尽头，也站上了新的起点——先把成果收好，允许自己为已经做到的事高兴一下。',
    advice: '今天给自己一个完整的收尾与庆祝。'
  }
]

export const CARD_BY_ID = MAJOR_ARCANA.reduce((acc, card) => {
  acc[card.id] = card
  return acc
}, {})

/** 全部牌号，按顺序。首屏预热与牌面总览都用它 */
export const ALL_CARD_IDS = MAJOR_ARCANA.map((card) => card.id)

export function pickRandomCard() {
  const index = Math.floor(Math.random() * MAJOR_ARCANA.length)
  return MAJOR_ARCANA[index]
}
