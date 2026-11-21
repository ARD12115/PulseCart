/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: 'rgb(var(--color-ink) / <alpha-value>)',
        moss: 'rgb(var(--color-moss) / <alpha-value>)',
        'moss-solid': 'rgb(var(--color-moss-solid) / <alpha-value>)',
        lime: 'rgb(var(--color-lime) / <alpha-value>)',
        paper: 'rgb(var(--color-paper) / <alpha-value>)',
        surface: 'rgb(var(--color-surface) / <alpha-value>)',
        danger: 'rgb(var(--color-danger) / <alpha-value>)',
        'danger-soft': 'rgb(var(--color-danger-soft) / <alpha-value>)',
        success: 'rgb(var(--color-success) / <alpha-value>)',
        'success-soft': 'rgb(var(--color-success-soft) / <alpha-value>)',
        warning: 'rgb(var(--color-warning) / <alpha-value>)',
        'warning-soft': 'rgb(var(--color-warning-soft) / <alpha-value>)',
      },
      zIndex: {
        0: '0',
        10: '10',
        20: '20',
        30: '30',
        40: '40',
        50: '50',
      },
      fontSize: {
        '10px': '10px',
        '11px': '11px',
        '12px': '12px',
        '13px': '13px',
        '14px': '14px',
        '17px': '17px',
        '20px': '20px',
        '24px': '24px',
        '26px': '26px',
        '30px': '30px',
        '44px': '44px',
      },
      padding: {
        '1.5': '0.375rem',
        '3.5': '0.875rem',
      },
    },
  },
  plugins: [],
};
