# Mobile PWA Source Code

This directory contains the **source code** for the Hair & Makeup Pro mobile companion app.

## Directory Relationship

```
mobile-pwa/     <-- SOURCE CODE (this directory)
    src/            React/TypeScript components
    package.json    Dependencies
    vite.config.ts  Build configuration

mobile/         <-- BUILD OUTPUT (generated - do not edit directly)
    index.html      Compiled HTML
    assets/         Bundled JS/CSS
    sw.js           Service worker
```

## Development

```bash
cd mobile-pwa
npm install
npm run dev      # Start dev server on port 3000
```

## Building

```bash
npm run build    # Outputs to ../mobile/
```

The build is configured to output directly to the `../mobile/` directory, which is served at `/mobile/` on the main site.

## Important

- **Edit source files in `mobile-pwa/src/`** - never edit files in `mobile/` directly
- **Run `npm run build`** after changes to update the deployed version
- The `mobile/` directory contains only generated files and will be overwritten on each build
