<template>
  <div id="app">
    <NuxtPage />
  </div>
</template>

<script setup lang="ts">
// Global app configuration
useHead({
  htmlAttrs: {
    lang: 'en'
  },
  meta: [
    { name: 'charset', content: 'utf-8' },
    { name: 'viewport', content: 'width=device-width, initial-scale=1, user-scalable=no, viewport-fit=cover' },
    { name: 'apple-mobile-web-app-capable', content: 'yes' },
    { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
    { name: 'theme-color', content: '#000000' }
  ]
})
</script>

<style>
/* Global styles */
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html, body {
  height: 100%;
  overflow: hidden;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  user-select: none;
  -webkit-touch-callout: none;
  -webkit-tap-highlight-color: transparent;
}

#app {
  height: 100%;
  width: 100%;
}

/* Disable pull-to-refresh on iOS */
body {
  overscroll-behavior: none;
}

/* iPad specific styles */
@media only screen and (min-device-width: 768px) and (max-device-width: 1024px) {
  html, body {
    height: -webkit-fill-available;
  }
}
</style> 