// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  devtools: { enabled: true },
  css: ['~/assets/css/main.css'],
  modules: [
    '@nuxtjs/tailwindcss',
    '@pinia/nuxt',
    '@vueuse/nuxt'
  ],
  app: {
    // Kept here (not in a component) so these land in the prerendered HTML
    // shell even though the app is client-rendered (ssr: false). PWA install and
    // iOS add-to-home-screen are far more reliable when the manifest and
    // apple-touch-icon are present in the initial markup.
    head: {
      title: 'RiseLight',
      htmlAttrs: { lang: 'en' },
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1, user-scalable=no, viewport-fit=cover' },
        { name: 'description', content: 'A gentle night light that tells little ones when to stay in bed and when it’s okay to get up.' },
        { name: 'mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
        { name: 'apple-mobile-web-app-title', content: 'RiseLight' },
        { name: 'theme-color', content: '#05070d' }
      ],
      link: [
        { rel: 'manifest', href: '/manifest.webmanifest' },
        { rel: 'icon', href: '/icon.svg', type: 'image/svg+xml' },
        { rel: 'icon', href: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.png', sizes: '180x180' }
      ]
    }
  },
  typescript: {
    typeCheck: true
  },
  tailwindcss: {
    cssPath: '~/assets/css/main.css'
  },
  experimental: {
    payloadExtraction: false
  },
  nitro: {
    preset: 'static',
    prerender: {
      routes: ['/']
    }
  },
  ssr: false
}) 