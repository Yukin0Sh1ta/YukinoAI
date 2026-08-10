<!--
  app.vue - 应用根组件
  - 作为整个 Nuxt 应用的最外层容器
  - 设置全屏无边框画布样式，隐藏滚动条溢出
  - 通过 NuxtPage 渲染各页面内容
-->
<template>
  <!-- 主容器：占满整个屏幕并隐藏溢出内容 -->
  <div class="w-screen h-screen overflow-hidden">
    <!-- 路由播报器：为辅助技术提供页面导航提示 -->
    <NuxtRouteAnnouncer />
    <!-- 页面出口：渲染当前路由对应的页面组件 -->
    <NuxtPage />
  </div>
</template>

<style>
/* html, body {
  overflow: hidden;
} */
/* 画布样式：去除边框和轮廓，避免影响显示效果 */
canvas {
  border: none;
  outline: none;
}
</style>
