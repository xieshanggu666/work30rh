import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { db } from '@/db'
import { uid } from '@/utils/format'
import { ensureVersions } from '@/utils/version'
import { visibilityLabel } from '@/utils/review'
import { useKbStore } from './kb'

// 评审流程：编辑者发起 → 成员评论 → 管理员审批留痕 → 回写文档可见性与版本状态
export const useReviewStore = defineStore('review', () => {
  const reviews = ref([])
  const loaded = ref(false)

  async function loadAll() {
    if (loaded.value) return
    reviews.value = await db.reviews.toArray()
    loaded.value = true
  }

  async function reload() {
    reviews.value = await db.reviews.toArray()
  }

  // 某文档的全部评审（新的在前）
  function reviewsOf(docId) {
    return reviews.value
      .filter((r) => r.docId === docId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  }

  // 某文档进行中的评审（同一文档同一时刻最多一条 pending）
  function pendingOf(docId) {
    return reviews.value.find((r) => r.docId === docId && r.status === 'pending') || null
  }

  // 全部待审批（评审中心 / 侧边栏徽标用）
  const pendingReviews = computed(() =>
    reviews.value
      .filter((r) => r.status === 'pending')
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
  )

  async function syncKb() {
    const kb = useKbStore()
    await kb.reloadDocs()
    await kb.reloadComments()
  }

  // 编辑者发起评审：记录目标可见性与送审说明，文档进入「评审中」
  async function startReview(doc, { targetVisibility, note }, user) {
    await loadAll()
    const now = new Date().toISOString()
    const actor = user?.id || 'u-guest'
    const review = {
      id: uid('rev'),
      docId: doc.id,
      docTitle: doc.title,
      fromVisibility: doc.visibility,
      targetVisibility: targetVisibility || doc.visibility,
      baseVersion: doc.versions?.length || 1,
      status: 'pending',
      note: note || '',
      createdBy: actor,
      createdAt: now,
      comments: [],
      decidedBy: null,
      decidedAt: null,
      decisionNote: '',
      history: [{ action: 'submit', actorId: actor, at: now, note: note || '' }]
    }
    await db.transaction('rw', db.reviews, db.docs, async () => {
      await db.reviews.add(review)
      const fresh = await db.docs.get(doc.id)
      if (fresh) await db.docs.put({ ...fresh, reviewStatus: 'pending' })
    })
    await reload()
    await syncKb()
    return review
  }

  // 成员发表评审意见（留痕到 history）
  async function addReviewComment(reviewId, content, mentionIds, user) {
    const now = new Date().toISOString()
    const actor = user?.id || 'u-guest'
    const cmt = { id: uid('rc'), authorId: actor, content, mentionIds: mentionIds || [], createdAt: now }
    await db.transaction('rw', db.reviews, async () => {
      const r = await db.reviews.get(reviewId)
      if (!r || r.status !== 'pending') return
      await db.reviews.put({
        ...r,
        comments: [...(r.comments || []), cmt],
        history: [...(r.history || []), { action: 'comment', actorId: actor, at: now, note: content.slice(0, 60) }]
      })
    })
    await reload()
    return cmt
  }

  // 管理员审批：留痕 + 回写文档可见性与版本状态 + 结果同步到文档评论区
  // decision: 'approved' | 'rejected'
  async function decideReview(reviewId, decision, note, user) {
    await loadAll()
    const now = new Date().toISOString()
    const actor = user?.id || 'u-guest'
    let done = null
    await db.transaction('rw', db.reviews, db.docs, db.comments, async () => {
      const r = await db.reviews.get(reviewId)
      if (!r || r.status !== 'pending') return
      const decided = {
        ...r,
        status: decision,
        decidedBy: actor,
        decidedAt: now,
        decisionNote: note || '',
        history: [...(r.history || []), { action: decision === 'approved' ? 'approve' : 'reject', actorId: actor, at: now, note: note || '' }]
      }
      await db.reviews.put(decided)
      done = decided

      const doc = await db.docs.get(r.docId)
      if (!doc) return
      if (decision === 'approved') {
        // 回写可见性 + 追加版本记录（版本状态随审批结论流转）
        const versions = ensureVersions(doc, now)
        const visChanged = r.targetVisibility && r.targetVisibility !== doc.visibility
        const verNote = visChanged
          ? '评审通过：可见性由「' + visibilityLabel(doc.visibility) + '」调整为「' + visibilityLabel(r.targetVisibility) + '」'
          : '评审通过'
        await db.docs.put({
          ...doc,
          visibility: r.targetVisibility || doc.visibility,
          reviewStatus: 'approved',
          updatedAt: now,
          versions: [...versions, { version: versions.length + 1, savedAt: now, savedBy: actor, note: verNote }]
        })
      } else {
        await db.docs.put({ ...doc, reviewStatus: 'rejected' })
      }
      // 评论联动：审批结论作为系统评论写入文档讨论区，便于成员周知
      const visText = decision === 'approved' && r.targetVisibility ? '，可见性已调整为「' + visibilityLabel(r.targetVisibility) + '」' : ''
      await db.comments.add({
        id: uid('cmt'),
        docId: doc.id,
        authorId: actor,
        mentionIds: [],
        content: (decision === 'approved' ? '【评审通过】' : '【评审驳回】') + (note ? '审批意见：' + note : '无审批意见') + visText,
        createdAt: now
      })
    })
    await reload()
    await syncKb()
    return done
  }

  // 发起人撤销进行中的评审
  async function cancelReview(reviewId, user) {
    const now = new Date().toISOString()
    const actor = user?.id || 'u-guest'
    await db.transaction('rw', db.reviews, db.docs, async () => {
      const r = await db.reviews.get(reviewId)
      if (!r || r.status !== 'pending' || r.createdBy !== actor) return
      await db.reviews.put({
        ...r,
        status: 'cancelled',
        decidedAt: now,
        history: [...(r.history || []), { action: 'cancel', actorId: actor, at: now, note: '' }]
      })
      const doc = await db.docs.get(r.docId)
      if (doc) await db.docs.put({ ...doc, reviewStatus: 'none' })
    })
    await reload()
    await syncKb()
  }

  return {
    reviews, loaded, loadAll, reload, reviewsOf, pendingOf, pendingReviews,
    startReview, addReviewComment, decideReview, cancelReview
  }
})
