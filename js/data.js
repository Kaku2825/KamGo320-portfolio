/* ==========================================================================
   data.js — 站点全部内容都在这里
   改文字 / 换图 / 调色，只动本文件，不用碰 HTML / CSS / JS。

   三级结构：
     L1 板块 blocks    封面 → 作品集 → 项目经历（占位，未开发）
     L2 作品集入口     一排横向阵列卡片
     L3 作品详情       全部 PDF 页连成一条横向长卷，作品之间首尾相连
   ========================================================================== */

export const SITE = {

  profile: {
    name:      '郭锦涛',
    nameEn:    'GUO JINTAO',
    role:      '建筑学',
    roleEn:    'ARCHITECTURE',
    period:    '2022—2026',
    school:    '江西师范大学 · 城市建设学院',
    email:     '1278267210@qq.com',
    wechat:    'kaku_101',
    location:  '江西 · 南昌',
  },

  /* ---------- L1 板块（封面是最上一级的独立板块，不进导航；
     关于我放最右侧；projects / sharing 尚未开发，nav 里置灰显示） ---------- */
  blocks: [
    { id: 'works',    nav: '作品集',   navEn: 'WORKS',    ready: true  },
    { id: 'projects', nav: '项目经历', navEn: 'PROJECTS', ready: false },
    { id: 'sharing',  nav: '个人分享', navEn: 'SHARING',  ready: false },
    /* 关于我暂时关闭：ready 改回 true 即可整体复出（导航 / 路由 / 刻度都会跟着恢复） */
    { id: 'about',    nav: '关于我',   navEn: 'ABOUT',    ready: false },
  ],

  /* ---------- 封面（对齐 yourbana.com：巨型字母逐字堆叠的海报构图） ----------
     style: 'gold' 实心金 | 'ink' 实心鼠尾草 | 'outline' 描边空心
     每个字母独立动画 + 偶数字母微沉，形成贴纸字节奏 */
  cover: {
    lines: [
      { text: 'WELCOME',   style: 'gold' },
      { text: 'PORTFOLIO', style: 'ink'  },
    ],
    tag: 'SELECTED WORKS · ARCHITECTURE',
  },

  /* ---------- 关于我（版式对齐 aristidebenoist.com/about：
     左侧巨型字标 + 右侧键位数据列；EMAIL / WECHAT 收在此板块） ---------- */
  about: {
    wordmark: [
      { text: 'KAMGO', style: 'gold' },
      { text: '320',   style: 'ink'  },
    ],
    status: ['建筑学 · 2026 届 · 求职中', 'OPEN TO WORK'],
    cols: [
      { head: 'PROFILE', rows: [
        { key: 'A', label: 'NAME',   text: '郭锦涛 GUO JINTAO' },
        { key: 'B', label: 'SCHOOL', text: '江西师范大学 · 城市建设学院' },
        { key: 'C', label: 'MAJOR',  text: '建筑学 ARCHITECTURE' },
        { key: 'D', label: 'BASE',   text: '江西 · 南昌' },
      ]},
      { head: 'FOCUS', rows: [
        { key: 'A', label: 'DESIGN',  text: '建筑设计 / 城市设计' },
        { key: 'B', label: 'EXPRESS', text: '制图 · 模型 · 空间叙事' },
        { key: 'C', label: 'TOOLS',   text: 'SU · CAD · PS · InDesign' },
      ]},
      { head: 'CONTACT', rows: [
        { key: 'A', label: 'EMAIL',  text: '1278267210@qq.com',
          href: 'mailto:1278267210@qq.com' },
        { key: 'B', label: 'WECHAT', text: 'kaku_101', copy: true },
      ]},
    ],
  },

  /* ---------- 全局场色 ---------- */
  theme: {
    field: '#111111',   // 软黑底
    ink:   '#d8dbd3',   // 主文字（鼠尾草灰绿）
    dim:   '#6f746c',   // 弱文字
    hl:    '#CC9933',   // 金色强调
  },

  /* ---------- 作品（卡阵列顺序 = 长卷顺序） ----------
     pages 对应 assets/pages/pNN.webp；
     ratio: 跨页 2.8286 / 单页 1.4143（按作品集 PDF 实际幅面） */
  works: [
    {
      id: 'w01', no: '01',
      title: '人机共图',
      titleEn: 'Human-Robot Symbiosis',
      tocPage: '04',
      pages: ['p03', 'p04', 'p05', 'p06'],
      field: '#251C1B', ink: '#F7EFE9', hl: '#F09C86',
    },
    {
      id: 'w02', no: '02',
      title: '序乐同檐',
      titleEn: 'Courtyard of Shared Harmony',
      tocPage: '13',
      pages: ['p07', 'p08', 'p09'],
      field: '#1B221C', ink: '#EEF4EC', hl: '#A9D69B',
    },
    {
      id: 'w03', no: '03',
      title: '檐纳四时',
      titleEn: 'Framing the Seasons',
      tocPage: '18',
      pages: ['p10', 'p11', 'p12'],
      field: '#241F19', ink: '#FBF3E6', hl: '#F3C88C',
    },
    {
      id: 'w04', no: '04',
      title: '贤风绕墙诉流年',
      titleEn: 'Virtue Aura by Walls, Telling Time',
      tocPage: '24',
      pages: ['p13', 'p14', 'p15', 'p16'],
      field: '#1A1F26', ink: '#E8EEF7', hl: '#A8C6E8',
    },
    {
      id: 'w05', no: '05',
      title: '瑶光栖时',
      titleEn: 'Roaming Light',
      tocPage: '33',
      pages: ['p17', 'p18', 'p19', 'p20'],
      field: '#1F1F23', ink: '#F1F1F3', hl: '#D2D4DB',
    },
  ],

  ratio: { spread: 2.8286, single: 1.4143 },
  singlePages: [],
};
