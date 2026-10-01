import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Owed dark premium theme — zero glassmorphism.
        // Depth comes from tonal tiers + hairlines only.
        canvas: "#0B0C0E",
        surface: "#131416",
        surface2: "#1A1B1E",
        hairline: "rgba(255,255,255,0.06)",
        amber: {
          DEFAULT: "#F5A623", // trade-craft accent
          bright: "#FFB62E", // interactive states
          dim: "rgba(245,166,35,0.12)",
        },
        danger: "#E5484D",
        success: "#3BA55D",
        ink: "#EDEDEF",
        muted: "#9BA0A6",
        faint: "#5F6368",
      },
      fontFamily: {
        sans: ["system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
