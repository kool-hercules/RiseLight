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
    head: {
      title: 'RiseLight',
      meta: [
        { name: 'description', content: 'A digital night light simulator for iPad' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' }
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