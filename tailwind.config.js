/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'curaleaf-teal': '#00A79D',    // Primary brand color
        'curaleaf-dark': '#1A3C34',    // Dark teal for headers
        'curaleaf-accent': '#F5A623',  // Warm accent for highlights
        'curaleaf-bg': '#F7FAFC',      // Light background
        'curaleaf-light': '#E2ECE9',   // Secondary light teal
        'curaleaf-gray': '#6B7280',    // Neutral gray for text
      },
      fontFamily: {
        poppins: ['Poppins', 'sans-serif'],
      },
      boxShadow: {
        'soft': '0 4px 12px rgba(0, 0, 0, 0.1)',
        'hover': '0 6px 16px rgba(0, 0, 0, 0.15)',
      },
      transitionProperty: {
        'height': 'height',
        'spacing': 'margin, padding',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.4s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};