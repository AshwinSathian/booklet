import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx,js,jsx,mdx}",
    "./src/components/**/*.{ts,tsx,js,jsx,mdx}",
    "./src/lib/**/*.{ts,tsx,js,jsx,mdx}",
    "./node_modules/primereact/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: "#0B1020",
          soft: "#0F1530",
          glass: "rgba(15,21,48,0.4)",
        },
        text: {
          primary: "#E9ECF2",
          secondary: "#B4BDD1",
          muted: "#8C94AA",
        },
        accent: {
          DEFAULT: "#8B5CF6",
          hover: "#7C3AED",
          soft: "#A78BFA",
          warm: "#FCD34D",
        },
        outline: "#23304E",
      },
      backdropBlur: {
        soft: "12px",
      },
      boxShadow: {
        soft: "0 8px 24px rgba(139,92,246,.15)",
        glass: "0 4px 30px rgba(139,92,246,0.15)",
        glow: "0 0 30px rgba(139,92,246,0.2)",
      },
    },
  },
  plugins: [],
};

export default config;
