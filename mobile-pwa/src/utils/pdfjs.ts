/**
 * Shared pdf.js setup for the mobile app.
 *
 * Configures the worker source ONCE and re-exports pdfjsLib so every
 * caller (script parser, schedule parser, call-sheet extractor) uses
 * the same locally-bundled worker. The previous setup hard-coded a
 * cdnjs.cloudflare.com URL in three different files, which broke
 * the moment cdnjs was unreachable, blocked, or returned a different
 * path for the requested version — exactly the "fake worker failed"
 * dialog users were hitting.
 *
 * Vite's `?url` suffix copies the worker file into the build output
 * at build time and returns its hashed URL, so the worker loads from
 * the same origin as the app — no runtime CDN dependency, works
 * offline, and the version always matches the bundled pdfjs-dist.
 */

import * as pdfjsLib from 'pdfjs-dist';
// eslint-disable-next-line import/no-unresolved
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.js?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;

export { pdfjsLib };
