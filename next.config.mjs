/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      // 成长日记支持一次上传多张照片（单张 ≤2MB，单次总量 ≤8MB）。
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
