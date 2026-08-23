import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
      // Les effets réseau positionnent explicitement leurs états loading/error avant le fetch.
      // Cette pratique suit l'exemple officiel React et reste protégée par un cleanup/AbortController.
      'react-hooks/set-state-in-effect': 'off',
    },
  },
  {
    files: ['src/context/**/*.{js,jsx}'],
    rules: {
      // Les modules de contexte exportent volontairement le Provider et son hook associé.
      'react-refresh/only-export-components': 'off',
    },
  },
])
