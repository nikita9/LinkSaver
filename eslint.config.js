const browserGlobals = {
    confirm: 'readonly',
    document: 'readonly',
    navigator: 'readonly',
    requestAnimationFrame: 'readonly',
    setTimeout: 'readonly',
    clearTimeout: 'readonly',
    URL: 'readonly',
    window: 'readonly'
};

const nodeGlobals = {
    Buffer: 'readonly',
    console: 'readonly',
    process: 'readonly',
    setTimeout: 'readonly',
    URL: 'readonly'
};

export default [
    {
        ignores: ['coverage/**', 'dist/**', 'dist.old-*/**', 'node_modules/**']
    },
    {
        files: ['**/*.js', '**/*.mjs'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: nodeGlobals
        },
        rules: {
            'no-constant-condition': 'error',
            'no-debugger': 'error',
            'no-dupe-else-if': 'error',
            'no-duplicate-imports': 'error',
            'no-fallthrough': 'error',
            'no-irregular-whitespace': 'error',
            'no-loss-of-precision': 'error',
            'no-promise-executor-return': 'error',
            'no-self-assign': 'error',
            'no-unexpected-multiline': 'error',
            'no-unreachable': 'error',
            'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
            'no-undef': 'error',
            'no-useless-catch': 'error',
            'no-useless-escape': 'error',
            'no-useless-return': 'error',
            'prefer-const': 'error'
        }
    },
    {
        files: ['src/renderer/**/*.js'],
        languageOptions: {
            globals: browserGlobals
        }
    },
    {
        files: ['**/*.test.js'],
        languageOptions: {
            globals: nodeGlobals
        }
    },
    {
        files: ['**/*.cjs'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'commonjs',
            globals: {
                require: 'readonly'
            }
        },
        rules: {
            'no-undef': 'error',
            'no-unused-vars': 'error'
        }
    }
];
