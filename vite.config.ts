import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import seed from './src/tenant/partners.seed.json'
import type { Partner } from './src/types/partner'
import { partnerHtmlFile, renderSocialMeta, socialMetaFor, withSocialMeta } from './src/tenant/socialMeta'

/** index.<partnerId>.html per Partner, with its link-preview tags (served by vercel.json). */
function partnerHtml(): Plugin {
  return {
    name: 'partner-html',
    apply: 'build',
    enforce: 'post',
    generateBundle(_, bundle) {
      const index = bundle['index.html']
      if (index?.type !== 'asset') return this.error('index.html is missing from the bundle')
      for (const p of seed.partners) {
        this.emitFile({
          type: 'asset',
          fileName: partnerHtmlFile(p.id),
          source: withSocialMeta(String(index.source), renderSocialMeta(socialMetaFor(p as unknown as Partner))),
        })
      }
    },
  }
}

export default defineConfig({
  plugins: [react(), partnerHtml()],
  base: './',
})
