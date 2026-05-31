/** @type {import('next').NextConfig} */
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  // Jangan cache halaman ujian — harus selalu fresh dari server
  buildExcludes: [/middleware-manifest\.json$/],
  runtimeCaching: [
    {
      // Halaman ujian siswa — network only, tidak boleh di-cache
      urlPattern: /^https:\/\/.*\/siswa\/ujian/,
      handler: 'NetworkOnly',
    },
    {
      // Supabase API — network only
      urlPattern: /^https:\/\/.*\.supabase\.co\/.*/,
      handler: 'NetworkOnly',
    },
    {
      // Font Google
      urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/,
      handler: 'CacheFirst',
      options: {
        cacheName: 'google-fonts',
        expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
      },
    },
    {
      // Aset statis JS/CSS Next.js
      urlPattern: /^https:\/\/.*\/_next\/static\/.*/,
      handler: 'CacheFirst',
      options: {
        cacheName: 'next-static',
        expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
      },
    },
    {
      // Gambar
      urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/,
      handler: 'CacheFirst',
      options: {
        cacheName: 'images',
        expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 },
      },
    },
    {
      // Halaman lain (dashboard, admin, dll) — network first
      urlPattern: /^https:\/\/.*/,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'others',
        networkTimeoutSeconds: 10,
        expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 },
      },
    },
  ],
});

const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['your-project.supabase.co'],
  },
};

module.exports = withPWA(nextConfig);
