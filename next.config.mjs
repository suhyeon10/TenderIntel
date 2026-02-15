import { fileURLToPath } from 'url';
import path from 'path';

/** @type {import('next').NextConfig} */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  webpack: (config, { isServer }) => {
    // Windows에서 webpack 캐시 경고를 줄이기 위한 설정
    if (process.platform === 'win32') {
      config.cache = {
        type: 'filesystem',
        buildDependencies: {
          config: [__filename],
        },
        cacheDirectory: path.resolve(__dirname, '.next/cache/webpack'),
        compression: 'gzip',
      };
    }
    return config;
  },
}

export default nextConfig
