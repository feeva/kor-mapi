import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: '.',
  resolve: {
    alias: {
      'kor-mapi': resolve(__dirname, '../src/index.ts'),
    },
  },
});
