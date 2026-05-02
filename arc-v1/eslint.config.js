const { defineConfig } = require('eslint/config');

module.exports = defineConfig({
  ignorePatterns: ['dist/*'],
  root: true,
  overrides: [
    {
      files: ['**/*.{js,jsx,ts,tsx}'],
      parserOptions: {
        sourceType: 'module',
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true }
      }
    }
  ]
});
