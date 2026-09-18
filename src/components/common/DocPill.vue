<script setup>
import { computed } from 'vue'
import { useKbStore } from '@/stores/kb'

const props = defineProps({
  doc: { type: Object, required: true }
})
const kb = useKbStore()

const catName = computed(() => kb.catMap[props.doc.categoryId]?.name || '未分类')
const tags = computed(() => (props.doc.tagIds || []).map((id) => kb.tagMap[id]).filter(Boolean))

const visibilityLabel = { public: '公开', team: '团队', private: '私有' }
</script>

<template>
  <div class="docbadges">
    <span class="pill v" :class="'v-' + doc.visibility">{{ visibilityLabel[doc.visibility] || doc.visibility }}</span>
    <span class="pill cat">{{ catName }}</span>
    <span v-for="t in tags" :key="t.id" class="pill tag" :style="{ background: t.color }">{{ t.name }}</span>
  </div>
</template>

<style scoped>
.docbadges { display: flex; flex-wrap: wrap; gap: 6px; }
.v { font-size: 11px; }
</style>