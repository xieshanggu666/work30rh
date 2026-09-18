<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useKbStore } from '@/stores/kb'
import { useAuthStore } from '@/stores/auth'
import RichEditor from '@/components/doc/RichEditor.vue'
import { uid } from '@/utils/format'
import { docVersion, fieldLabels } from '@/utils/version'

const route = useRoute()
const router = useRouter()
const kb = useKbStore()
const auth = useAuthStore()

const isEdit = computed(() => route.params.id && route.params.id !== 'new')
const editingDoc = ref(null)

const title = ref('')
const categoryId = ref('')
const tagIds = ref([])
const visibility = ref('public')
const body = ref('')
const stats = ref({ chars: 0, words: 0, imgs: 0 })
const draftKey = 'kb:draft:' + route.params.id
const backupKey = 'kb:conflict-backup:' + route.params.id
const savedToast = ref('')
const saving = ref(false)
// 乐观锁基线：打开编辑器时的版本号与字段快照，保存时据此检测并合并并发修改
const baseVersion = ref(null)
const baseDoc = ref(null)
// 保存冲突信息（含冲突字段与自动合并字段），非空时展示冲突处理条
const conflict = ref(null)
// 冲突时自动备份的未提交内容，保证任何情况下都不丢失
const backup = ref(null)

const tagChecked = (id) => tagIds.value.includes(id)
function toggleTag(id) {
  tagIds.value = tagIds.value.includes(id) ? tagIds.value.filter((x) => x !== id) : [...tagIds.value, id]
}
async function addNewTag() {
  const name = prompt('新标签名称：')
  if (!name) return
  const t = await kb.addTag(name.trim())
  toggleTag(t.id)
}
async function addNewCat() {
  const name = prompt('新分类名称：')
  if (!name) return
  const c = await kb.addCategory(name.trim())
  categoryId.value = c.id
}

function saveDraft() {
  localStorage.setItem(draftKey, JSON.stringify({ title: title.value, categoryId: categoryId.value, tagIds: tagIds.value, visibility: visibility.value, body: body.value, ts: Date.now() }))
}

// 记录基线快照（版本号 + 字段），保存时用于三方合并
function snapshotBase(d) {
  baseVersion.value = docVersion(d)
  baseDoc.value = { title: d.title, categoryId: d.categoryId, tagIds: [...(d.tagIds || [])], visibility: d.visibility, body: d.body }
}

function applyDoc(d) {
  editingDoc.value = d
  title.value = d.title; categoryId.value = d.categoryId; tagIds.value = [...(d.tagIds || [])]
  visibility.value = d.visibility; body.value = d.body
  snapshotBase(d)
}

// 冲突时把当前未提交内容备份到 localStorage，任何后续操作都不会将其覆盖
function saveBackup() {
  const b = { title: title.value, categoryId: categoryId.value, tagIds: [...tagIds.value], visibility: visibility.value, body: body.value, ts: Date.now() }
  localStorage.setItem(backupKey, JSON.stringify(b))
  backup.value = b
}
function restoreBackup() {
  const b = backup.value
  if (!b) return
  title.value = b.title; categoryId.value = b.categoryId; tagIds.value = [...(b.tagIds || [])]
  visibility.value = b.visibility; body.value = b.body
  dismissBackup()
  savedToast.value = '已恢复你未提交的内容'
  setTimeout(() => { savedToast.value = '' }, 2500)
}
function dismissBackup() {
  backup.value = null
  localStorage.removeItem(backupKey)
}

async function submit(force = false) {
  if (!title.value.trim()) { alert('请填写标题'); return }
  if (saving.value) return
  saving.value = true
  try {
    const payload = { title: title.value.trim(), categoryId: categoryId.value, tagIds: [...tagIds.value], visibility: visibility.value, body: body.value }
    if (isEdit.value) {
      const res = await kb.updateDoc(route.params.id, payload, auth.user, '编辑文档', { baseVersion: baseVersion.value, base: baseDoc.value, force })
      if (!res || res.status === 'missing') { alert('文档不存在或已被删除'); return }
      if (res.status === 'conflict') {
        // 保留未提交内容：内容留在编辑器中，同时写入备份
        conflict.value = res
        saveBackup()
        return
      }
      conflict.value = null
      dismissBackup()
      localStorage.removeItem(draftKey)
      const query = res.autoMerged?.length ? { merged: fieldLabels(res.autoMerged).join('、') } : {}
      router.push({ path: '/docs/' + route.params.id, query })
    } else {
      const d = await kb.createDoc(payload, auth.user)
      localStorage.removeItem(draftKey)
      router.push('/docs/' + d.id)
    }
  } finally {
    saving.value = false
  }
}

// 载入库中最新版本继续编辑；未提交内容已备份，可随时恢复
async function loadLatest() {
  const d = await kb.getDocFresh(route.params.id)
  if (!d) { alert('文档不存在或已被删除'); return }
  applyDoc(d)
  conflict.value = null
  savedToast.value = '已载入最新版本，你未提交的内容已保留在备份中'
  setTimeout(() => { savedToast.value = '' }, 3000)
}

function doCancel() {
  if (isEdit.value) router.push('/docs/' + route.params.id)
  else router.push('/docs')
}

function manualSave() {
  saveDraft()
  savedToast.value = '已保存草稿 ' + new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  setTimeout(() => { savedToast.value = '' }, 2000)
}

async function load() {
  if (isEdit.value) {
    // 直接读库取最新文档作为编辑基线，避免基于内存缓存的旧快照保存
    const d = await kb.getDocFresh(route.params.id)
    if (d) applyDoc(d)
    // 上次冲突时备份的未提交内容，重新进入编辑器时提示可恢复
    const b = localStorage.getItem(backupKey)
    if (b) { try { backup.value = JSON.parse(b) } catch { localStorage.removeItem(backupKey) } }
  } else {
    const draft = localStorage.getItem(draftKey)
    if (draft) {
      const p = JSON.parse(draft)
      title.value = p.title || ''
      categoryId.value = p.categoryId || kb.categories[0]?.id || ''
      tagIds.value = p.tagIds || []
      visibility.value = p.visibility || 'public'
      body.value = p.body || ''
    } else if (kb.categories[0]) {
      categoryId.value = kb.categories[0].id
    }
  }
}

const saveTimer = ref(null)
function scheduleAutoSave() {
  clearTimeout(saveTimer.value)
  saveTimer.value = setTimeout(() => {
    saveDraft()
    savedToast.value = '草稿已自动保存 ' + new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    setTimeout(() => { savedToast.value = '' }, 2000)
  }, 1200)
}
watch([title, categoryId, tagIds, visibility, body], scheduleAutoSave, { deep: true })

onMounted(load)
onBeforeUnmount(() => { clearTimeout(saveTimer.value); if (!isEdit.value) saveDraft() })

const canPublish = computed(() => title.value.trim() && categoryId.value)
</script>

<template>
  <div class="editor-page">
    <div class="toolbar row">
      <button class="btn" @click="doCancel">← 返回</button>
      <span class="mode-badge">{{ isEdit ? '编辑文档' : '新建文档' }}</span>
      <span class="toast">{{ savedToast }}</span>
      <div class="spacer"></div>
      <button class="btn" @click="manualSave">保存草稿</button>
      <button class="btn primary" :disabled="!canPublish || saving" @click="submit()">{{ saving ? '保存中…' : (isEdit ? '保存变更' : '发布文档') }}</button>
    </div>

    <div v-if="conflict" class="card conflict-bar">
      <div class="c-head">⚠️ 保存冲突：这篇文档已在其他窗口被修改并保存</div>
      <div class="c-desc">
        冲突字段：{{ fieldLabels(conflict.conflictFields).join('、') }}<template v-if="conflict.autoMerged?.length">；已自动合并：{{ fieldLabels(conflict.autoMerged).join('、') }}</template>。
        你当前未提交的内容已自动备份，不会丢失。
      </div>
      <div class="c-actions">
        <button class="btn sm danger-solid" :disabled="saving" @click="submit(true)">以我的内容覆盖保存</button>
        <button class="btn sm" @click="loadLatest">载入最新版本</button>
        <button class="btn sm ghost" @click="conflict = null">继续编辑</button>
      </div>
    </div>

    <div v-if="backup && !conflict" class="card backup-bar">
      <span>检测到你有一份未提交的修改（{{ new Date(backup.ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) }}）</span>
      <div class="c-actions">
        <button class="btn sm primary" @click="restoreBackup">恢复</button>
        <button class="btn sm ghost" @click="dismissBackup">忽略</button>
      </div>
    </div>

    <div class="form card">
      <div class="field title-field">
        <input class="big-title" v-model="title" placeholder="文档标题…" maxlength="80" />
      </div>

      <div class="field row-auto">
        <label>分类</label>
        <div class="chips">
          <span v-for="c in kb.categories" :key="c.id" class="chip" :class="{ on: categoryId === c.id }" @click="categoryId = c.id">{{ c.name }}</span>
          <button class="chip add" @click="addNewCat">＋ 新建分类</button>
        </div>
      </div>

      <div class="field row-auto">
        <label>标签</label>
        <div class="chips">
          <span v-for="t in kb.tags" :key="t.id" class="chip" :class="{ on: tagChecked(t.id) }" :style="tagChecked(t.id) ? { background: t.color, borderColor: t.color, color: '#fff' } : {}" @click="toggleTag(t.id)">#{{ t.name }}</span>
          <button class="chip add" @click="addNewTag">＋ 新建标签</button>
        </div>
      </div>

      <div class="field row-auto">
        <label>可见性</label>
        <div class="chips">
          <span class="chip" :class="{ on: visibility === 'public' }" @click="visibility = 'public'">🌐 公开</span>
          <span class="chip" :class="{ on: visibility === 'team' }" @click="visibility = 'team'">👥 团队</span>
          <span class="chip" :class="{ on: visibility === 'private' }" @click="visibility = 'private'">🔒 私有</span>
        </div>
      </div>
    </div>

    <div class="card editor-wrap">
      <RichEditor v-model="body" @stats="stats = $event" />
    </div>
    <div class="statline">正文 {{ stats.chars }} 字 · {{ stats.words }} 词 · 图片 {{ stats.imgs }} 张</div>
  </div>
</template>

<style scoped>
.editor-page { max-width: 860px; margin: 0 auto; }
.toolbar.row { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; }
.mode-badge { font-weight: 600; color: var(--text-2); }
.toast { color: var(--accent); font-size: 12px; }
.spacer { flex: 1; }
.form { padding: 20px 24px; margin-bottom: 14px; display: flex; flex-direction: column; gap: 14px; }
.field { display: flex; flex-direction: column; gap: 8px; }
.field.row-auto { flex-direction: row; align-items: center; gap: 14px; }
.field label { font-size: 13px; color: var(--text-2); width: 60px; }
.big-title { width: 100%; border: none; outline: none; font-size: 26px; font-weight: 700; color: var(--text); padding: 6px 0; border-bottom: 2px solid var(--border); }
.big-title:focus { border-color: var(--primary); }
.chips { display: flex; flex-wrap: wrap; gap: 8px; }
.chip { padding: 4px 12px; border-radius: 999px; border: 1px solid var(--border); background: var(--panel-2); cursor: pointer; font-size: 13px; transition: all 0.15s; }
.chip.on { background: var(--primary); border-color: var(--primary); color: #fff; }
.chip.add { border-style: dashed; color: var(--text-3); background: transparent; }
.editor-wrap { padding: 0; overflow: hidden; }
.statline { color: var(--text-3); font-size: 12px; margin-top: 8px; padding-left: 4px; }
.conflict-bar { padding: 14px 20px; margin-bottom: 14px; border-color: var(--warn); background: #fff7ed; }
.conflict-bar .c-head { font-weight: 600; color: #b45309; margin-bottom: 6px; }
.conflict-bar .c-desc { font-size: 13px; color: var(--text-2); margin-bottom: 10px; }
.conflict-bar .c-actions { display: flex; gap: 8px; }
.btn.danger-solid { background: var(--danger); border-color: var(--danger); color: #fff; }
.btn.danger-solid:hover { background: #d9444b; color: #fff; }
.backup-bar { padding: 10px 20px; margin-bottom: 14px; display: flex; justify-content: space-between; align-items: center; gap: 12px; font-size: 13px; color: var(--text-2); border-color: var(--primary); background: var(--primary-weak); }
.backup-bar .c-actions { display: flex; gap: 8px; }
</style>