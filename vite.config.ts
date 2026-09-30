import { defineConfig, type Plugin } from 'vite';
import solid from 'vite-plugin-solid';

// The browser baseline, specified in 02-architecture.md.
// This is the explicit expansion of Vite's `'modules'` default, pinned here so the
// baseline is stated rather than inherited and silently moved by a Vite upgrade.
// CSS nesting is not a factor: esbuild's CSS minifier flattens every nested rule at
// all targets (identical output at es2020-only and at esnext), so nesting sets no
// production floor. Only `crypto.randomUUID` sat above this baseline, and
// `newId()` in utils.ts now covers it.
const BROWSER_BASELINE = ['es2020', 'edge88', 'firefox78', 'chrome87', 'safari14'];

// The policy, per 07-security-standard.md. `data:` in img-src is required by the
// data: URI favicon; `'unsafe-inline'` in style-src is required for as long as any
// inline style attribute survives in JSX. `frame-ancestors` is deliberately omitted:
// it has no effect except as a response header, so framing control belongs to hosting.
const CSP = [
  "default-src 'self'",
  "img-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ');

// Build-only: the meta tag lands in dist/index.html and never in the dev server's
// HTML, where it would break Vite's inline scripts and the HMR socket.
function cspPlugin(): Plugin {
  return {
    name: 'csp-meta',
    apply: 'build',
    transformIndexHtml() {
      return [
        {
          tag: 'meta',
          attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP },
          injectTo: 'head-prepend',
        },
      ];
    },
  };
}

export default defineConfig({
  plugins: [solid(), cspPlugin()],
  build: {
    target: BROWSER_BASELINE,
  },
});
