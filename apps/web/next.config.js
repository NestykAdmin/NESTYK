const path = require('path');

// Load monorepo root `.env` (frontend) before reading API_URL
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const API_URL = process.env.API_URL || 'http://localhost:4000';

// Account web (consumer-app) on this same site: /login, /register, legal pages, role sites.
// Unset ACCOUNT_WEB_UPSTREAM = no hand-over (links go to NEXT_PUBLIC_ACCOUNT_WEB_ORIGIN as before).
const { accountWebUpstream, accountRewrites, accountDevFallback } = require('./lib/account-routes');
const ACCOUNT_WEB_UPSTREAM = accountWebUpstream(process.env.ACCOUNT_WEB_UPSTREAM);

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Also expose root `.env` / `.env.*` via Next env loading
  envDir: path.join(__dirname, '../..'),
  env: {
    // Share the existing frontend Maps key when Expo web already defines one.
    NEXT_PUBLIC_GOOGLE_MAPS_API_KEY:
      process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
      process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ||
      '',
  },
  transpilePackages: [
    '@nestyk/ui',
    '@nestyk/config',
    '@nestyk/types',
    '@nestyk/i18n',
    '@nestyk/feature-search',
    '@nestyk/feature-services',
    '@nestyk/feature-listing',
  ],
  async rewrites() {
    return {
      // Before the guest pages, so /login never reaches the [locale] route.
      beforeFiles: accountRewrites(ACCOUNT_WEB_UPSTREAM),
      afterFiles: [
        // ⚡ Unified Backend API (/api/* -> localhost:4000/api/v1/*)
        {
          source: '/api/:path*',
          destination: `${API_URL}/api/v1/:path*`,
        },
      ],
      // Local dev with the Expo dev server as upstream: its bundle paths too (off on a deploy).
      fallback: accountDevFallback(ACCOUNT_WEB_UPSTREAM, process.env.NODE_ENV),
    };
  },
};

module.exports = nextConfig;
