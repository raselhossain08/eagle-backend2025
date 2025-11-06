/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    swcMinify: true,

    env: {
        API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000',
    },

    // Optimize images
    images: {
        domains: ['localhost', 'res.cloudinary.com'],
        formats: ['image/avif', 'image/webp'],
    },

    // Compress output
    compress: true,

    // Production optimizations
    experimental: {
        optimizeCss: true,
        optimizePackageImports: ['lucide-react', 'recharts'],
    },

    // Redirects
    async redirects() {
        return [
            {
                source: '/admin',
                destination: '/dashboard',
                permanent: true,
            },
        ];
    },
};

module.exports = nextConfig;
