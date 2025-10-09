module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: false,
    ecmaVersion: 'latest',
    sourceType: 'module'
  },
  plugins: ['@typescript-eslint', 'react-hooks'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
    'prettier'
  ],
  settings: {
    react: {
      version: 'detect'
    }
  },
  env: {
    browser: true,
    es2021: true,
    node: true
  },
  ignorePatterns: ['dist', 'build', '*.config.js', 'coverage'],
  rules: {
    '@typescript-eslint/no-explicit-any': 'warn'
  }
};
