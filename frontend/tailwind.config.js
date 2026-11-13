/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#17211c',
        moss: '#28634b',
        lime: '#d6f36a',
        paper: '#f5f6ef',
      },
    },
  },
  plugins: [],
};
