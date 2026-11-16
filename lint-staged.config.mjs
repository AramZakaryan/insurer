export default {
  '*.{js,mjs,cjs,ts,tsx,mts,cts}': [
    'prettier --write',
    'eslint --fix --max-warnings=0',
  ],
  '*.{json,jsonc,md,css,html,yaml,yml}': 'prettier --write',
};
