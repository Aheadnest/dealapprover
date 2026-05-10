/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Mirrors dealapprover-landing palette
        bg: { page: "#f9f9f9", muted: "#f3f3f4" },
        ink: {
          DEFAULT: "#0F172A",
          soft: "#45464d",
          mute: "#76777d",
        },
        line: {
          DEFAULT: "#e2e2e2",
          strong: "#c6c6cd",
        },
        brand: {
          DEFAULT: "#22C55E",
          hover: "#16a34a",
          soft: "#dcfce7",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "sans-serif",
        ],
      },
      boxShadow: {
        card: "0 2px 12px rgba(15,23,42,0.04)",
        cardHover: "0 4px 20px rgba(15,23,42,0.10)",
        nav: "0 1px 8px rgba(15,23,42,0.04)",
        modal: "0 24px 48px rgba(15,23,42,0.18)",
      },
      maxWidth: {
        content: "1280px",
      },
    },
  },
  plugins: [],
};
