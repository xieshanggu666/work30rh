import { db, getMeta, setMeta } from './index'

const now = Date.now()
const h = 3600 * 1000
const d = 24 * h
const ago = (ms) => new Date(now - ms).toISOString()

const seedUsers = [
  { id: 'u-admin', name: '林致远', email: 'admin@knowbase.dev', role: 'admin', avatar: 'LZ', title: '平台管理员' },
  { id: 'u-chen', name: '陈思涵', email: 'chen@knowbase.dev', role: 'editor', avatar: 'CS', title: '后端工程师' },
  { id: 'u-ziwei', name: '王子薇', email: 'ziwei@knowbase.dev', role: 'editor', avatar: 'WZ', title: '产品经理' },
  { id: 'u-xiaoye', name: '高晓叶', email: 'xiaoye@knowbase.dev', role: 'viewer', avatar: 'GX', title: '前端工程师' },
  { id: 'u-mochen', name: '莫尘', email: 'mochen@knowbase.dev', role: 'viewer', avatar: 'MC', title: '设计师' }
]

const seedCategories = [
  { id: 'c-dev', name: '开发文档', icon: 'code' },
  { id: 'c-product', name: '产品设计', icon: 'box' },
  { id: 'c-ops', name: '运维手册', icon: 'server' },
  { id: 'c-life', name: '团队文化', icon: 'heart' }
]

const seedTags = [
  { id: 't-api', name: 'API', color: '#4f6ef7' },
  { id: 't-guide', name: '指南', color: '#0fb981' },
  { id: 't-faq', name: 'FAQ', color: '#f7a24f' },
  { id: 't-vue', name: 'Vue', color: '#42b883' },
  { id: 't-db', name: '数据库', color: '#b062f7' },
  { id: 't-security', name: '安全', color: '#f2555c' },
  { id: 't-onboarding', name: '入职', color: '#28a7e8' }
]

const seedDocs = [
  {
    id: 'doc-1', title: '前端工程初始化与目录规范',
    categoryId: 'c-dev', tagIds: ['t-vue', 't-guide'],
    visibility: 'public', ownerId: 'u-chen', editors: ['u-chen', 'u-xiaoye'],
    createdAt: ago(20 * d), updatedAt: ago(2 * d),
    body: '<h2>创建你的第一个 Vue 项目</h2><p>使用 <b>Vite</b> 脚手架可以快速初始化一个 Vue 3 工程。</p><pre><code>npm create vite@latest my-app -- --template vue</code></pre><p>目录划分为 <i>src/components</i>、<i>src/views</i>、<i>src/stores</i> 等，保持关注点分离。</p><ul><li>组件：按功能拆分子目录</li><li>状态：统一交给 Pinia 管理</li><li>路由：懒加载视图</li></ul>'
  },
  {
    id: 'doc-2', title: 'Dexie 数据库操作指南',
    categoryId: 'c-dev', tagIds: ['t-db', 't-guide'],
    visibility: 'public', ownerId: 'u-chen', editors: ['u-chen'],
    createdAt: ago(15 * d), updatedAt: ago(5 * d),
    body: '<h2>IndexedDB 太繁琐？试试 Dexie</h2><p>Dexie 用关系型 <b>表</b> 与 <i>索引</i> 来封装 IndexedDB，极大简化读写。</p><pre><code>await db.docs.add({ title: "示例", body: "<p>内容</p>" })</code></pre><h3>常用查询</h3><ul><li>按主键：<code>db.docs.get(id)</code></li><li>按索引过滤：<code>db.docs.where("categoryId").equals(id)</code></li><li>计数：<code>db.docs.count()</code></li></ul><blockquote>版本迁移使用 schemaVersion，新增字段时手动迁移即可。</blockquote>'
  },
  {
    id: 'doc-3', title: 'API 鉴权与权限模型',
    categoryId: 'c-dev', tagIds: ['t-api', 't-security'],
    visibility: 'team', ownerId: 'u-admin', editors: ['u-admin', 'u-chen'],
    createdAt: ago(10 * d), updatedAt: ago(3 * d),
    body: '<h2>统一鉴权链路</h2><p>所有请求进入网关后，先校验 <b>Token</b> 再校验 <i>权限点</i>。</p><h3>角色与权限点</h3><ul><li>admin：全部权限</li><li>editor：可新增与编辑</li><li>viewer：只读</li></ul><blockquote>文档级可见性：public / team / private。</blockquote>'
  },
  {
    id: 'doc-4', title: '产品需求评审 Checklist',
    categoryId: 'c-product', tagIds: ['t-guide', 't-faq'],
    visibility: 'public', ownerId: 'u-ziwei', editors: ['u-ziwei', 'u-mochen'],
    createdAt: ago(12 * d), updatedAt: ago(1 * d),
    body: '<h2>评审前必查项</h2><ol><li>目标用户与使用场景是否明确</li><li>数据埋点是否齐全</li><li>异常态与边界是否覆盖</li><li>是否有对应的验收标准</li></ol><p>请在 <b>评审前 24h</b> 将 PRD 同步到知识库并 @ 相关成员。</p>'
  },
  {
    id: 'doc-5', title: '新成员入职指引',
    categoryId: 'c-life', tagIds: ['t-onboarding', 't-faq'],
    visibility: 'public', ownerId: 'u-admin', editors: ['u-admin'],
    createdAt: ago(30 * d), updatedAt: ago(30 * d),
    body: '<h2>欢迎加入团队</h2><p>第一天你将完成：账号开通、环境搭建、代码仓库权限、内部工具说明。</p><ul><li>查看「入职 Checklist」文档</li><li>加入团队频道并设置头像</li><li>联系 mentor 安排一对一交流</li></ul><p>遇到问题可随时 <i>@行政</i> 获取帮助。</p>'
  },
  {
    id: 'doc-6', title: '线上故障排查手册',
    categoryId: 'c-ops', tagIds: ['t-security', 't-faq'],
    visibility: 'team', ownerId: 'u-admin', editors: ['u-chen', 'u-xiaoye', 'u-admin'],
    createdAt: ago(8 * d), updatedAt: ago(6 * h),
    body: '<h2>通用排查步骤</h2><ol><li>查看监控大盘与告警面板</li><li>拉取最近 15 分钟日志，定位错误堆栈</li><li>核对配置版本与灰度开关</li><li>依据 runbook 执行回滚或隔离</li></ol><blockquote>切勿在未知情的情况下直接改生产数据。</blockquote><p>若涉及 <b>密钥泄露</b> 请立即轮换并触发安全响应流程。</p>'
  },
  {
    id: 'doc-7', title: 'Vue 组件设计最佳实践',
    categoryId: 'c-dev', tagIds: ['t-vue', 't-api'],
    visibility: 'private', ownerId: 'u-xiaoye', editors: ['u-xiaoye'],
    createdAt: ago(6 * d), updatedAt: ago(6 * d),
    body: '<h2>组件分层</h2><p>推荐 <b>展示型 / 容器型</b> 拆分，展示型组件不感知数据源。</p><pre><code>defineProps({ items: Array })</code></pre><h3>口诀</h3><ul><li>Props 往下传事件往上抛</li><li>避免在组件内直接改 props</li><li>复杂逻辑外提 composable</li></ul>'
  },
  {
    id: 'doc-8', title: '企业安全基线要求',
    categoryId: 'c-dev', tagIds: ['t-security'],
    visibility: 'team', ownerId: 'u-admin', editors: ['u-admin', 'u-chen'],
    createdAt: ago(18 * d), updatedAt: ago(7 * d),
    body: '<h2>密码与会话策略</h2><ul><li>强制启用两步验证</li><li>会话 14 天过期，支持强制下线</li><li>敏感操作需二次确认</li></ul><p>详见 <i>安全响应手册</i> 相关章节。</p>'
  }
]

const seedComments = [
  { id: 'cmt-1', docId: 'doc-1', authorId: 'u-xiaoye', mentionIds: ['u-chen'], content: '@陈思涵 补充一下 lint 规则部分吧？', createdAt: ago(1 * d) },
  { id: 'cmt-2', docId: 'doc-1', authorId: 'u-chen', mentionIds: [], content: '已补充，见代码块。', createdAt: ago(20 * h) },
  { id: 'cmt-3', docId: 'doc-4', authorId: 'u-mochen', mentionIds: ['u-ziwei'], content: '需要补一版交互还原图，麻烦 @王子薇 确认排期。', createdAt: ago(2 * d) },
  { id: 'cmt-4', docId: 'doc-6', authorId: 'u-xiaoye', mentionIds: ['u-admin'], content: '已按手册完成一次演练，@林致远 请审核。', createdAt: ago(8 * h) }
]

const seedShares = [
  { id: 'sh-1', docId: 'doc-1', token: 'share-abc123', permission: 'edit', createdBy: 'u-chen', createdAt: ago(2 * d), expiresAt: null, revokedAt: null },
  { id: 'sh-2', docId: 'doc-6', token: 'share-xyz789', permission: 'view', createdBy: 'u-admin', createdAt: ago(5 * d), expiresAt: null, revokedAt: null }
]

const seedFavorites = [
  { id: 'fav-1', userId: 'u-admin', docId: 'doc-1' },
  { id: 'fav-2', userId: 'u-admin', docId: 'doc-8' }
]

const seedRatings = [
  { id: 'rt-1', docId: 'doc-1', slug: 'helpful', authorId: 'u-chen', value: 1 },
  { id: 'rt-2', docId: 'doc-2', slug: 'helpful', authorId: 'u-ziwei', value: 1 }
]

// 评审示例：一条待审批、一条已通过、一条已驳回，覆盖完整流转留痕
const seedReviews = [
  {
    id: 'rev-1', docId: 'doc-3', docTitle: 'API 鉴权与权限模型',
    fromVisibility: 'team', targetVisibility: 'public', baseVersion: 1,
    status: 'pending', note: '鉴权方案已稳定运行一个季度，申请公开给全公司查阅',
    createdBy: 'u-chen', createdAt: ago(4 * h),
    comments: [
      { id: 'rc-1', authorId: 'u-ziwei', content: '建议补充网关限流与重试策略的说明再公开。', mentionIds: [], createdAt: ago(3 * h) },
      { id: 'rc-2', authorId: 'u-chen', content: '@王子薇 已补充限流章节，请再看下。', mentionIds: ['u-ziwei'], createdAt: ago(2 * h) }
    ],
    decidedBy: null, decidedAt: null, decisionNote: '',
    history: [
      { action: 'submit', actorId: 'u-chen', at: ago(4 * h), note: '鉴权方案已稳定运行一个季度，申请公开给全公司查阅' },
      { action: 'comment', actorId: 'u-ziwei', at: ago(3 * h), note: '建议补充网关限流与重试策略的说明再公开。' },
      { action: 'comment', actorId: 'u-chen', at: ago(2 * h), note: '@王子薇 已补充限流章节，请再看下。' }
    ]
  },
  {
    id: 'rev-2', docId: 'doc-4', docTitle: '产品需求评审 Checklist',
    fromVisibility: 'team', targetVisibility: 'public', baseVersion: 1,
    status: 'approved', note: 'Checklist 已覆盖主要评审场景，申请公开',
    createdBy: 'u-ziwei', createdAt: ago(2 * d),
    comments: [
      { id: 'rc-3', authorId: 'u-mochen', content: '设计侧验收项已确认无误。', mentionIds: [], createdAt: ago(2 * d) }
    ],
    decidedBy: 'u-admin', decidedAt: ago(1 * d), decisionNote: '内容完整，同意公开',
    history: [
      { action: 'submit', actorId: 'u-ziwei', at: ago(2 * d), note: 'Checklist 已覆盖主要评审场景，申请公开' },
      { action: 'comment', actorId: 'u-mochen', at: ago(2 * d), note: '设计侧验收项已确认无误。' },
      { action: 'approve', actorId: 'u-admin', at: ago(1 * d), note: '内容完整，同意公开' }
    ]
  },
  {
    id: 'rev-3', docId: 'doc-7', docTitle: 'Vue 组件设计最佳实践',
    fromVisibility: 'private', targetVisibility: 'team', baseVersion: 1,
    status: 'rejected', note: '申请转为团队可见，供前端同学参考',
    createdBy: 'u-xiaoye', createdAt: ago(3 * d),
    comments: [],
    decidedBy: 'u-admin', decidedAt: ago(2 * d), decisionNote: '示例代码涉及未脱敏的内部项目名，请先脱敏后再送审',
    history: [
      { action: 'submit', actorId: 'u-xiaoye', at: ago(3 * d), note: '申请转为团队可见，供前端同学参考' },
      { action: 'reject', actorId: 'u-admin', at: ago(2 * d), note: '示例代码涉及未脱敏的内部项目名，请先脱敏后再送审' }
    ]
  }
]

// 文档评审状态与 seedReviews 对应（冗余在文档上，便于列表/搜索直接读取）
const seedReviewStatus = { 'doc-3': 'pending', 'doc-4': 'approved', 'doc-7': 'rejected' }

async function isSeeded() {
  return (await getMeta('seeded')) === '1'
}

export async function ensureSeeded() {
  if (await isSeeded()) {
    await migrateV2()
    return
  }
  await db.transaction('rw', db.users, db.categories, db.tags, db.docs, db.comments, db.shares, db.favorites, db.ratings, db.reviews, async () => {
    if ((await db.users.count()) > 0) return
    await db.users.bulkAdd(seedUsers)
    await db.categories.bulkAdd(seedCategories)
    await db.tags.bulkAdd(seedTags)
    await db.docs.bulkAdd(seedDocs.map((d) => ({
      ...d,
      reviewStatus: seedReviewStatus[d.id] || 'none',
      versions: [{ version: 1, savedAt: d.updatedAt, savedBy: d.ownerId, note: '初始版本' }]
    })))
    await db.comments.bulkAdd(seedComments)
    await db.shares.bulkAdd(seedShares)
    await db.favorites.bulkAdd(seedFavorites)
    await db.ratings.bulkAdd(seedRatings)
    await db.reviews.bulkAdd(seedReviews)
  })
  await setMeta('seeded', '1')
  await setMeta('seededReviews', '1')
}

// v2 迁移：为已初始化的老库补评审示例数据与文档评审状态（只执行一次）
async function migrateV2() {
  if ((await getMeta('seededReviews')) === '1') return
  await db.transaction('rw', db.reviews, db.docs, async () => {
    if ((await db.reviews.count()) === 0) await db.reviews.bulkAdd(seedReviews)
    for (const [docId, st] of Object.entries(seedReviewStatus)) {
      const d = await db.docs.get(docId)
      if (d && !d.reviewStatus) await db.docs.put({ ...d, reviewStatus: st })
    }
  })
  await setMeta('seededReviews', '1')
}