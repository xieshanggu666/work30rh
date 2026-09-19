// 文档评审流程：状态常量、展示标签与流转判断（纯函数，便于测试）

export const REVIEW_STATUS = { NONE: 'none', PENDING: 'pending', APPROVED: 'approved', REJECTED: 'rejected' }

export const REVIEW_STATUS_LABEL = {
  none: '未送审',
  pending: '评审中',
  approved: '已通过',
  rejected: '已驳回'
}

export function reviewStatusLabel(s) {
  return REVIEW_STATUS_LABEL[s] || '未送审'
}

// 评审动作中文名（留痕时间线用）
export const REVIEW_ACTION_LABEL = {
  submit: '发起评审',
  comment: '发表评审意见',
  approve: '审批通过',
  reject: '审批驳回',
  cancel: '撤销评审'
}

export function reviewActionLabel(a) {
  return REVIEW_ACTION_LABEL[a] || a
}

// 可见性中文名（评审单中展示「当前可见性 → 目标可见性」）
export const VISIBILITY_LABEL = { public: '公开', team: '团队', private: '私有' }

export function visibilityLabel(v) {
  return VISIBILITY_LABEL[v] || v
}

// 评审留痕动作对应的图标
export const REVIEW_ACTION_ICON = {
  submit: '📨',
  comment: '💬',
  approve: '✅',
  reject: '⛔',
  cancel: '↩️'
}
