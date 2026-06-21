/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#FFFFFF',
        surface: '#FAFAFA',
        'surface-alt': '#F5F5F5',
        border: '#E8E8E8',
        'border-focus': '#1A1A1A',
        'text-primary': '#111111',
        'text-body': '#3D3D3D',
        'text-muted': '#888888',
        'text-disabled': '#BBBBBB',
        accent: '#1A1A1A',
        'accent-hover': '#333333',
        error: '#C0392B',
        success: '#2D7D46',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      fontSize: {
        'micro': ['11px', { lineHeight: '1.4', fontWeight: '500' }],
        'caption': ['12px', { lineHeight: '1.5', fontWeight: '500' }],
      },
      letterSpacing: {
        label: '0.04em',
        heading: '-0.02em',
      },
      borderRadius: {
        xs: '4px',
        sm: '6px',
        md: '10px',
        lg: '14px',
        xl: '20px',
      },
      boxShadow: {
        '1': '0 1px 3px rgba(0,0,0,0.05), 0 1px 2px rgba(0,0,0,0.04)',
        '2': '0 4px 12px rgba(0,0,0,0.07), 0 1px 4px rgba(0,0,0,0.04)',
        '3': '0 12px 40px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.05)',
        '4': '0 24px 64px rgba(0,0,0,0.12), 0 4px 16px rgba(0,0,0,0.06)',
      },
      spacing: {
        '18': '4.5rem',
        '22': '5.5rem',
      },
    },
  },
  plugins: [],
}
