/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', "sans-serif"],
        display: ['"Outfit"', "sans-serif"],
      },
      colors: {
        background: "#f8fafc", // slate-50 - Clean light background
        surface: "#ffffff", // white - Pure white surface cards
        primary: "#2563eb", // blue-600 - Readable robust blue
        secondary: "#0f172a", // slate-900 - Dark accent for contrast
        accent: "#ef4444", // red-500
        border: "#e2e8f0", // slate-200 - Light borders
      },
      animation: {
        "fade-in": "fadeIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        "fade-slide": "fadeIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        float: "float 6s ease-in-out infinite",
        "pulse-glow": "pulse-glow 4s infinite",
        "spin-slow": "spin 12s linear infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": {
            opacity: "0",
            transform: "translateY(20px)",
            filter: "blur(10px)",
          },
          "100%": {
            opacity: "1",
            transform: "translateY(0)",
            filter: "blur(0)",
          },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        },
        "pulse-glow": {
          "0%, 100%": { boxShadow: "0 0 20px rgba(99, 102, 241, 0.2)" },
          "50%": { boxShadow: "0 0 40px rgba(99, 102, 241, 0.5)" },
        },
      },
    },
  },
  plugins: [],
};
