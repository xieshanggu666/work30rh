// 权限工具：基于角色与文档可见性
import { isShareActive } from './share'

export const ROLE = { ADMIN: 'admin', EDITOR: 'editor', VIEWER: 'viewer' }

// 可新增/编辑/删除的（内容治理）
export function canEditContent(role) {
  return role === ROLE.ADMIN || role === ROLE.EDITOR
}

// 文档编辑者：角色可编辑 且（拥有者/协作成员/公开可编辑）
// 评审中（pending）的文档冻结编辑：仅管理员可改，避免评审期间内容被变更导致审验不一致
export function canEditDoc(role, doc, userId) {
  if (!doc) return false
  if (!canEditContent(role)) return false
  if (doc.reviewStatus === 'pending' && role !== ROLE.ADMIN) return false
  if (doc.ownerId === userId) return true
  if (doc.editors && doc.editors.includes(userId)) return true
  return false
}

// 是否可查看某文档（可见性 + 拥有者 + 协作成员 + 有效共享链接）
export function canViewDoc(doc, userId, share) {
  if (!doc) return false
  if (doc.visibility === 'public') return true
  if (doc.visibility === 'team') {
    // team 指全员可见（演示简化：所有登录成员可见）
    return true
  }
  // private：仅拥有者与协作成员可见（或持有效共享链接——已撤销/已过期不授权）
  if (doc.ownerId === userId) return true
  if (doc.editors && doc.editors.includes(userId)) return true
  if (isShareActive(share)) return true
  return false
}

export function canDeleteDoc(role, doc, userId) {
  return canEditDoc(role, doc, userId)
}

// 可发起评审：有文档编辑权 且 当前没有进行中的评审
export function canStartReview(role, doc, userId) {
  if (!doc || doc.reviewStatus === 'pending') return false
  return canEditDoc(role, doc, userId)
}

// 仅管理员可审批（通过 / 驳回）
export function canApproveReview(role) {
  return role === ROLE.ADMIN
}

// 可发表评审意见：登录成员即可（含只读成员，游客除外）
export function canCommentReview(user) {
  return !!user && user.id !== 'u-guest'
}

export function roleLabel(role) {
  return { admin: '管理员', editor: '编辑者', viewer: '只读' }[role] || role
}