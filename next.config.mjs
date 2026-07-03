/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // three / r3f ship ESM that Next transpiles fine, but be explicit for drei helpers.
  transpilePackages: ['three', '@react-three/fiber', '@react-three/drei'],
  webpack: (config) => {
    // Allow importing .glsl-style strings if we ever add raw shader files.
    config.module.rules.push({
      test: /\.(glsl|vs|fs|vert|frag)$/,
      type: 'asset/source',
    });
    return config;
  },
};

export default nextConfig;
