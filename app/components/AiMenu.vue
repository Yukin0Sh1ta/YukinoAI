<!--
  AiMenu.vue - AI 右键菜单组件
  - 显示在窗口顶部的浮动菜单条
  - 提供"设置 / 隐藏 / 再见"三个操作项
  - 通过 emit 向父组件传递用户选择
-->
<script setup lang="ts">
const emit = defineEmits<{
  settings: []
  hide: []
  bye: []
}>()

const menuItems = [
  { key: 'settings', label: '设置' },
  { key: 'hide', label: '隐藏' },
  { key: 'bye', label: '再见' },
]

function handleClick(key: 'settings' | 'hide' | 'bye') {
  emit(key)
}
</script>

<template>
  <div class="absolute inset-0 z-200 pointer-events-none">
    <!-- 点击时阻止事件冒泡 @click.stop-->
    <div class="absolute top-3 left-1/2 -translate-x-1/2 flex flex-row gap-1 p-1 pointer-events-auto bg-[rgba(30,30,40,0.95)] backdrop-blur-xl rounded-xl shadow-lg" >      
      <button
        v-for="item in menuItems"
        :key="item.key"
        class="px-3 py-1.5 border-none rounded-lg bg-transparent text-white/85 cursor-pointer text-xs font-sans transition-colors whitespace-nowrap hover:bg-white/[0.14] hover:text-white active:bg-white/[0.08]"
        @click="handleClick(item.key)"
      >
        {{ item.label }}
      </button>
    </div>
  </div>
</template>
