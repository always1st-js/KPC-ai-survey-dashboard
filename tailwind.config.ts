import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        'kpc-blue': '#1e40af',
        'kpc-light': '#3b82f6',
        'rookie': '#4285F4',
        'veteran': '#34A853',
      },
    },
  },
  plugins: [],
};
export default config;
