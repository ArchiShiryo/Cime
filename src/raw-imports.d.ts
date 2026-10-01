// Tells TypeScript that Vite's `?raw` imports of .md files resolve to a string.
// Without this, TS would error on `import content from './foo.md?raw'`.
declare module "*.md?raw" {
  const content: string;
  export default content;
}

declare module "*.txt?raw" {
  const content: string;
  export default content;
}

declare module "*.css";

// Vite inlines `?inline` image imports as base64 data URIs (used by the splash
// screen, which must not depend on files outside the packaged bundle).
declare module "*.webp?inline" {
  const dataUri: string;
  export default dataUri;
}
