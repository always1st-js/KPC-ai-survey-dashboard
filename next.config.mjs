/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    GOOGLE_API_KEY: process.env.GOOGLE_API_KEY,
    SPREADSHEET_ID: process.env.SPREADSHEET_ID,
  },
};

export default nextConfig;
