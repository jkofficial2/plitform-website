import { defineConfig } from 'astro/config';
import { factory, getLiveSite } from './src/data/factory.ts';

const site = getLiveSite(factory);
export default defineConfig({
  ...(site ? { site } : {}),
  output: 'static',
  trailingSlash: 'always',
  build: { inlineStylesheets: 'never' },
  devToolbar: { enabled: false },
});
