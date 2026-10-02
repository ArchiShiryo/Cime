// Cover images for the built-in templates, drawn locally (inline SVG) so the
// Templates page needs no network access.

function cover(title: string, stack: string, accent: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#005A5B"/><stop offset="1" stop-color="#003F40"/></linearGradient></defs>
<rect width="640" height="360" fill="url(#g)"/>
<circle cx="560" cy="60" r="130" fill="${accent}" opacity="0.18"/>
<circle cx="90" cy="330" r="110" fill="#F4EFED" opacity="0.08"/>
<rect x="48" y="96" width="544" height="168" rx="14" fill="#F4EFED" opacity="0.96"/>
<rect x="72" y="120" width="120" height="14" rx="7" fill="${accent}"/>
<rect x="72" y="146" width="300" height="10" rx="5" fill="#005A5B" opacity="0.35"/>
<rect x="72" y="166" width="240" height="10" rx="5" fill="#005A5B" opacity="0.2"/>
<rect x="72" y="204" width="96" height="36" rx="8" fill="#005A5B"/>
<text x="48" y="64" font-family="Segoe UI, Arial, sans-serif" font-size="30" font-weight="700" fill="#F4EFED">${title}</text>
<text x="48" y="304" font-family="Segoe UI, Arial, sans-serif" font-size="18" fill="#F4EFED" opacity="0.85">${stack}</text>
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export const REACT_COVER = cover(
  "React",
  "Vite · Shadcn · Tailwind · TypeScript",
  "#94A088",
);
export const NEXT_COVER = cover(
  "Next.js",
  "React · Shadcn · Tailwind · TypeScript",
  "#94A088",
);
export const NITRO_COVER = cover(
  "Vite + Nitro",
  "Fullstack · React · Nitro · TypeScript",
  "#94A088",
);
export const PORTAL_COVER = cover(
  "Portal",
  "Neon DB · Payload CMS · Next.js",
  "#94A088",
);
