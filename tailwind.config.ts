import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: {
          950: "#071018",
          900: "#0d1721",
          800: "#122232",
          700: "#193247"
        },
        accent: {
          cyan: "#69d4ff",
          gold: "#ffbd59",
          mint: "#6ff2d4",
          rose: "#ff768d"
        }
      },
      boxShadow: {
        panel: "0 20px 80px rgba(0, 0, 0, 0.35)"
      },
      backgroundImage: {
        grid:
          "linear-gradient(rgba(105, 212, 255, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(105, 212, 255, 0.05) 1px, transparent 1px)"
      }
    }
  },
  plugins: []
};

export default config;
