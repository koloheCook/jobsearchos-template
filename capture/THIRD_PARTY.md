# Third-party capture dependencies

## Turndown 7.2.4

- Upstream: https://github.com/mixmark-io/turndown
- License: MIT, reproduced in `licenses/turndown-MIT.txt`
- Purpose: deterministic HTML-to-Markdown conversion for selected and JSON-LD job
  description content. It replaces no LLM behavior.
- Registry integrity: `sha512-I8yFsfRzmzK0WV1pNNOA4A7y4RDfFxPRxb3t+e3ui14qSGOxGtiSP6GjeX+Y6CHb7HYaFj7ECUD7VE5kQMZWGQ==`
- Vendored browser build: `chrome-extension/vendor/turndown.browser.es.js`
- Vendored browser build SHA-256: `3bcd2dd53d6eb3f7a8ed2363404c8869d92cfcaae7a76dca2d556e7ec4cb1f42`

## @mixmark-io/domino 2.2.0

- Upstream: https://github.com/mixmark-io/domino
- License: BSD-2-Clause, reproduced in `licenses/domino-BSD-2-Clause.txt`
- Purpose: local DOM parsing for the public JSON-LD batch CLI only. It is never
  shipped to the Chrome extension.
- Registry integrity: `sha512-Y28PR25bHXUg88kCV7nivXrP2Nj2RueZ3/l/jdx6J9f8J4nsEGcgX0Qe6lt7Pa+J79+kPiJU3LguR6O/6zrLOw==`

Dependencies are exact-pinned by `package-lock.json`. Install with `npm ci
--ignore-scripts`. Dependency updates require an explicit review, checksum refresh,
license review, and regression test run.
