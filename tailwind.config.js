module.exports = {
    content: ['./src/**/*.{ts,tsx}'],
    theme: {
      extend: {
        // Matches --primary* in src/styles/modern.css. Components use bg-primary,
        // text-primary, border-primary, hover:bg-primary-dark, text-primary-dark.
        colors: {
          primary: {
            DEFAULT: '#2196F3',
            dark: '#1976D2',
            light: '#BBDEFB',
          },
        },
      },
    },
    plugins: [],
  }
