/** @type {import('next').NextConfig} */
const nextConfig = {
  images: { unoptimized: true },
  async rewrites() {
    const backend = (process.env.BACKEND_URL || "http://127.0.0.1:8000").replace(/\/$/, "")
    return [{ source: "/api/:path*", destination: `${backend}/api/:path*` }]
  },
}
export default nextConfig
