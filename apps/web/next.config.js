const path = require('path');

// Load monorepo root `.env` (frontend) before reading API_URL
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const API_URL = process.env.API_URL || 'http://localhost:4000';

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
    return [
      // ⚡ Unified Backend API (/api/* -> localhost:4000/api/v1/*)
      {
        source: '/api/:path*',
        destination: `${API_URL}/api/v1/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
