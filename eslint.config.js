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
    // Les fichiers de configuration tournent sous Node, pas dans le navigateur :
    // analysés avec les seules globales du navigateur, leur `process` passait
    // pour une faute.
    files: ['*.config.js'],
    languageOptions: { globals: globals.node },
  },
  {
    /**
     * Les scripts de garde-fou, qu'ESLint ne voyait pas.
     *
     * Le motif ci-dessus ne couvre que `.js` et `.jsx` : les six scripts de
     * `scripts/` sont en `.mjs` et n'étaient donc **jamais analysés**. Le
     * défaut n'est pas théorique — une variable renommée à moitié a traversé un
     * `npm run lint` vert et n'a été trouvée qu'à l'exécution, le 29 août.
     *
     * C'est le pire endroit où laisser un angle mort : ces fichiers sont
     * précisément ceux qui gardent les autres. Un garde-fou qui s'interrompt
     * sur une faute de frappe ne garde rien, et il s'interrompt en annonçant
     * une panne plutôt qu'un défaut.
     *
     * `varsIgnorePattern` est volontairement absent ici, à la différence du
     * bloc principal : une constante en majuscules laissée sans emploi dans un
     * script de mesure est le signe d'un seuil qu'on a cessé d'appliquer.
     */
    files: ['**/*.mjs'],
    extends: [js.configs.recommended],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
      parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
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
