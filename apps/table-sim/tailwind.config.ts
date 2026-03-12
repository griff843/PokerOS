import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        felt: {
          DEFAULT: "#1a5c2e",
          dark: "#0f3d1d",
          light: "#2d8a4e",
        },
        card: {
          red: "#dc2626",
          black: "#1e293b",
        },
      },
    },
  },
  plugins: [],
};

export default config;
