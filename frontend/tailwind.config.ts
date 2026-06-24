import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: "#0099DD",
        "navy-hover": "#0088C4",
        "navy-active": "#0077AD",
        teal: "#66C2E8",
        "bg-sec": "#ffffff",
        "status-normal": "#11B584",
        "status-warn": "#F2A53C",
        "status-danger": "#F05A66",
        muted: "#9A9A94",
        subtle: "#6B6B66",
        "card-border": "#E4E2DC",
        "card-border-light": "#EDEBE5",
      },
      fontFamily: {
        sans: [
          "Pretendard",
          "Apple SD Gothic Neo",
          "Noto Sans KR",
          "-apple-system",
          "BlinkMacSystemFont",
          "sans-serif",
        ],
      },
      screens: {
        xs: "400px",
        sm: "640px",
        md: "900px",
      },
      borderRadius: {
        card: "16px",
        pill: "999px",
      },
      keyframes: {
        fadeUp: {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "none" },
        },
        pulse: {
          "0%, 100%": { opacity: "0.45" },
          "50%": { opacity: "1" },
        },
      },
      animation: {
        "fade-up": "fadeUp 0.3s ease-out",
        skeleton: "pulse 1.2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
export default config;
