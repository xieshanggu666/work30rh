<script setup>
import { ref, computed } from 'vue'
import { useReviewStore } from '@/stores/review'
import { useAuthStore } from '@/stores/auth'
import MemberSelect from '@/components/common/MemberSelect.vue'
import { formatFull, avatarColor } from '@/utils/format'
import { canStartReview, canApproveReview, canCommentReview } from '@/utils/permission'
import { reviewStatusLabel, reviewActionLabel, visibilityLabel, REVIEW_ACTION_ICON } from '@/utils/review'

// 文档评审面板：发起评审 / 评审意见 / 管理员审批 / 历史留痕
const props = defineProps({
  doc: { type: Object, required: true }
})

const review = useReviewStore()
const auth = useAuthStore()

const startOpen = ref(false)
const targetVisibility = ref('')
const startNote = ref('')
const commentText = ref('')
const commentMentions = ref([])
const decisionNote = ref('')
const busy = ref(false)
const toast = ref('')

const pending = computed(() => review.pendingOf(props.doc.id))
const history = computed(() => review.reviewsOf(props.doc.id).filter((r) => r.status !== 'pending'))
const userById = computed(() => Object.fromEntries(auth.users.map((u) => [u.id, u])))

const canStart = computed(() => canStartReview(auth.user?.role, props.doc, auth.user?.id))
const canApprove = computed(() => canApproveReview(auth.user?.role))
const canComment = computed(() => canCommentReview(auth.user))

const visOptions = [
  { value: 'public', label: '🌐 公开' },
  { value: 'team', label: '👥 团队' },
  { value: 'private', label: '🔒 私有' }
]

function openStart() {
  targetVisibility.value = props.doc.visibility === 'private' ? 'team' : 'public'
  startNote.value = ''
  startOpen.value = true
}

function flash(msg) {
  toast.value = msg
  setTimeout(() => { toast.value = '' }, 2500)
}

async function submitStart() {
  if (busy.value) return
  busy.value = true
  try {
    await review.startReview(props.doc, { targetVisibility: targetVisibility.value, note: startNote.value.trim() }, auth.user)
    startOpen.value = false
    flash('评审已发起，等待管理员审批')
  } finally {
    busy.value = false
  }
}

async function postComment() {
  const content = commentText.value.trim()
  if (!content || !pending.value) return
  await review.addReviewComment(pending.value.id, content, commentMentions.value, auth.user)
  commentText.value = ''
  commentMentions.value = []
}

function onMention(id) { if (!commentMentions.value.includes(id)) commentMentions.value.push(id) }

async function decide(decision) {
  if (busy.value || !pending.value) return
  if (decision === 'rejected' && !decisionNote.value.trim()) {
    if (!confirm('未填写审批意见，确定驳回？')) return
  }
  busy.value = true
  try {
    await review.decideReview(pending.value.id, decision, decisionNote.value.trim(), auth.user)
    decisionNote.value = ''
    flash(decision === 'approved' ? '已通过，文档可见性与版本状态已更新' : '已驳回，结论已留痕')
  } finally {
    busy.value = false
  }
}

async function cancel() {
  if (!pending.value || !confirm('确定撤销本次评审？')) return
  await review.cancelReview(pending.value.id, auth.user)
  flash('评审已撤销')
}
</script>

<template>
  <div class="review card">
    <div class="r-head">
      <span class="r-title">📋 评审流程</span>
      <span class="pill rs" :class="'rs-' + (doc.reviewStatus || 'none')">{{ reviewStatusLabel(doc.reviewStatus) }}</span>
      <span class="toast">{{ toast }}</span>
      <div class="spacer"></div>
      <button v-if="canStart && !startOpen" class="btn sm primary" @click="openStart">📨 发起评审</button>
    </div>

    <!-- 发起评审表单 -->
    <div v-if="startOpen" class="start-form">
      <div class="sf-row">
        <label>目标可见性</label>
        <div class="chips">
          <span v-for="o in visOptions" :key="o.value" class="chip" :class="{ on: targetVisibility === o.value }" @click="targetVisibility = o.value">{{ o.label }}</span>
        </div>
      </div>
      <div class="sf-row">
        <label>送审说明</label>
        <textarea v-model="startNote" rows="2" placeholder="说明本次评审的背景与诉求，供审批人参考…"></textarea>
      </div>
      <div class="sf-actions">
        <button class="btn sm primary" :disabled="busy" @click="submitStart">提交评审</button>
        <button class="btn sm ghost" @click="startOpen = false">取消</button>
      </div>
    </div>

    <!-- 进行中的评审 -->
    <div v-if="pending" class="pending-box">
      <div class="p-meta">
        <span><b>{{ userById[pending.createdBy]?.name || pending.createdBy }}</b> 于 {{ formatFull(pending.createdAt) }} 发起</span>
        <span class="vis-flow">{{ visibilityLabel(pending.fromVisibility) }} → {{ visibilityLabel(pending.targetVisibility) }}</span>
        <span class="pill">基于 v{{ pending.baseVersion }}</span>
      </div>
      <div v-if="pending.note" class="p-note">送审说明：{{ pending.note }}</div>

      <div class="p-comments">
        <div class="pc-title">评审意见（{{ pending.comments.length }}）</div>
        <div v-if="!pending.comments.length" class="pc-empty">暂无评审意见，成员可在此讨论</div>
        <div v-for="c in pending.comments" :key="c.id" class="pc-item">
          <span class="ava" :style="{ background: avatarColor(c.authorId) }">{{ userById[c.authorId]?.avatar || '?' }}</span>
          <div class="pc-body">
            <div class="pc-meta"><b>{{ userById[c.authorId]?.name || c.authorId }}</b><span class="pc-time">{{ formatFull(c.createdAt) }}</span></div>
            <div>{{ c.content }}</div>
          </div>
        </div>
        <div v-if="canComment" class="pc-input">
          <MemberSelect v-model="commentText" @mention="onMention" />
          <button class="btn sm primary" :disabled="!commentText.trim()" @click="postComment">发表意见</button>
        </div>
      </div>

      <div v-if="canApprove" class="decide-box">
        <textarea v-model="decisionNote" rows="2" placeholder="审批意见（驳回时建议填写原因）…"></textarea>
        <div class="d-actions">
          <button class="btn sm approve" :disabled="busy" @click="decide('approved')">✅ 通过并发布</button>
          <button class="btn sm reject" :disabled="busy" @click="decide('rejected')">⛔ 驳回</button>
        </div>
      </div>
      <div v-else class="wait-tip">⏳ 等待管理员审批</div>

      <button v-if="pending.createdBy === auth.user?.id" class="btn sm ghost cancel" @click="cancel">撤销评审</button>
    </div>

    <!-- 历史评审留痕 -->
    <div v-if="history.length" class="history">
      <div class="h-title">评审记录（{{ history.length }}）</div>
      <div v-for="r in history" :key="r.id" class="h-item">
        <div class="h-head">
          <span class="pill rs" :class="'rs-' + r.status">{{ reviewStatusLabel(r.status) }}</span>
          <span class="h-vis">{{ visibilityLabel(r.fromVisibility) }} → {{ visibilityLabel(r.targetVisibility) }}</span>
          <span class="h-time">{{ formatFull(r.createdAt) }}</span>
        </div>
        <div class="timeline">
          <div v-for="(h, i) in r.history" :key="i" class="tl-item">
            <span class="tl-ico">{{ REVIEW_ACTION_ICON[h.action] || '•' }}</span>
            <span class="tl-action">{{ reviewActionLabel(h.action) }}</span>
            <span class="tl-who">{{ userById[h.actorId]?.name || h.actorId }}</span>
            <span class="tl-time">{{ formatFull(h.at) }}</span>
            <span v-if="h.note" class="tl-note">{{ h.note }}</span>
          </div>
        </div>
      </div>
    </div>
    <div v-else-if="!pending && !startOpen" class="none-tip">暂无评审记录{{ canStart ? '，可发起评审将文档发布给更多人' : '' }}</div>
  </div>
</template>

<style scoped>
.review { margin-top: 14px; padding: 16px 24px; }
.r-head { display: flex; align-items: center; gap: 10px; }
.r-title { font-weight: 600; }
.spacer { flex: 1; }
.toast { color: var(--accent); font-size: 12px; }

.pill.rs { font-size: 11px; border: none; color: #fff; }
.rs-none { background: var(--text-3); }
.rs-pending { background: var(--warn); }
.rs-approved { background: var(--accent); }
.rs-rejected { background: var(--danger); }
.rs-cancelled { background: var(--text-3); }

.start-form { margin-top: 12px; padding: 14px; background: var(--panel-2); border-radius: var(--radius-sm); display: flex; flex-direction: column; gap: 12px; }
.sf-row { display: flex; align-items: flex-start; gap: 14px; }
.sf-row label { font-size: 13px; color: var(--text-2); width: 70px; padding-top: 5px; flex-shrink: 0; }
.sf-row textarea { flex: 1; padding: 8px 10px; border: 1px solid var(--border); border-radius: var(--radius-sm); font-size: 13px; resize: vertical; outline: none; background: #fff; }
.sf-row textarea:focus { border-color: var(--primary); }
.chips { display: flex; flex-wrap: wrap; gap: 8px; }
.chip { padding: 4px 12px; border-radius: 999px; border: 1px solid var(--border); background: #fff; cursor: pointer; font-size: 13px; transition: all 0.15s; }
.chip.on { background: var(--primary); border-color: var(--primary); color: #fff; }
.sf-actions { display: flex; gap: 8px; padding-left: 84px; }

.pending-box { margin-top: 12px; border: 1px solid var(--warn); background: #fffbf3; border-radius: var(--radius-sm); padding: 14px 16px; }
.p-meta { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; font-size: 13px; color: var(--text-2); }
.vis-flow { font-weight: 600; color: var(--warn); }
.p-note { margin-top: 8px; font-size: 13px; color: var(--text-2); background: #fff; border-radius: 6px; padding: 8px 10px; }

.p-comments { margin-top: 12px; }
.pc-title { font-size: 13px; font-weight: 600; margin-bottom: 8px; }
.pc-empty { color: var(--text-3); font-size: 12px; padding: 6px 0; }
.pc-item { display: flex; gap: 10px; padding: 8px 0; border-bottom: 1px dashed var(--border); font-size: 13px; }
.pc-item:last-of-type { border-bottom: none; }
.ava { width: 26px; height: 26px; border-radius: 50%; color: #fff; font-size: 11px; display: grid; place-items: center; flex-shrink: 0; }
.pc-meta { display: flex; align-items: center; gap: 8px; margin-bottom: 2px; }
.pc-time { color: var(--text-3); font-size: 12px; }
.pc-input { display: flex; gap: 8px; align-items: flex-end; margin-top: 10px; }
.pc-input > div { flex: 1; }

.decide-box { margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--border); }
.decide-box textarea { width: 100%; padding: 8px 10px; border: 1px solid var(--border); border-radius: var(--radius-sm); font-size: 13px; resize: vertical; outline: none; background: #fff; }
.decide-box textarea:focus { border-color: var(--primary); }
.d-actions { display: flex; gap: 8px; margin-top: 8px; }
.btn.approve { background: var(--accent); border-color: var(--accent); color: #fff; }
.btn.approve:hover { background: #0da271; color: #fff; }
.btn.reject { background: var(--danger); border-color: var(--danger); color: #fff; }
.btn.reject:hover { background: #d9444b; color: #fff; }
.wait-tip { margin-top: 12px; padding-top: 10px; border-top: 1px solid var(--border); color: var(--text-3); font-size: 12px; }
.cancel { margin-top: 10px; color: var(--text-3); }

.history { margin-top: 14px; }
.h-title { font-size: 13px; font-weight: 600; color: var(--text-2); margin-bottom: 8px; }
.h-item { border-top: 1px solid var(--panel-2); padding: 10px 0; }
.h-head { display: flex; align-items: center; gap: 10px; font-size: 13px; }
.h-vis { color: var(--text-2); }
.h-time { color: var(--text-3); font-size: 12px; margin-left: auto; }
.timeline { margin-top: 8px; padding-left: 4px; }
.tl-item { display: flex; align-items: baseline; gap: 8px; font-size: 12px; color: var(--text-2); padding: 3px 0; flex-wrap: wrap; }
.tl-action { font-weight: 600; color: var(--text); }
.tl-time { color: var(--text-3); }
.tl-note { width: 100%; padding-left: 24px; color: var(--text-3); }
.none-tip { margin-top: 10px; color: var(--text-3); font-size: 13px; }
</style>
