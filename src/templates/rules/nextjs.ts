export const template = `---
name: {{name}}
description: Next.js App Router conventions — server components, ISR, route handlers, middleware, SEO
priority: medium
alwaysApply: false
managed_by: codi
language: typescript
---

# Next.js App Router Conventions

## Server Components by Default
- Use Server Components for all pages and layouts — they run on the server with zero client JS
- Add \`'use client'\` only when the component needs interactivity (event handlers, hooks, browser APIs)
- Keep client components small and push them to the leaves of the component tree
- Pass server data to client components via props — do not fetch on the client what you can fetch on the server

\`\`\`typescript
// app/products/page.tsx — Server Component (default)
import { getProducts } from '@/lib/data';
import { AddToCartButton } from './add-to-cart-button';

export const metadata = {
  title: 'Products',
  description: 'Browse our product catalog',
};

export default async function ProductsPage() {
  const products = await getProducts();

  return (
    <ul>
      {products.map((p) => (
        <li key={p.id}>
          {p.name} — <AddToCartButton productId={p.id} />
        </li>
      ))}
    </ul>
  );
}
\`\`\`

## Data Fetching & Caching
- Fetch data directly in Server Components using \`async/await\` — no \`useEffect\` needed
- Use ISR with \`revalidate\` for pages that change periodically but benefit from caching
- Use \`revalidateTag()\` or \`revalidatePath()\` for on-demand revalidation after mutations
- Deduplicate requests automatically — Next.js memoizes \`fetch\` calls in the same render pass

\`\`\`typescript
// ISR: revalidate every 60 seconds
export const revalidate = 60;

export default async function PricingPage() {
  const plans = await fetch('https://api.example.com/plans', {
    next: { tags: ['pricing'] },
  }).then((r) => r.json());
  return <PricingTable plans={plans} />;
}
\`\`\`

## Route Handlers
- Place API endpoints in \`app/api/.../route.ts\` files
- Export named functions matching HTTP methods: \`GET\`, \`POST\`, \`PUT\`, \`DELETE\`
- Return \`NextResponse.json()\` with appropriate status codes
- Validate request bodies before processing

## Images & Fonts
- Use \`next/image\` for all images — it handles lazy loading, resizing, and format conversion
- Use \`next/font\` to load fonts — eliminates layout shift and external network requests
- Set explicit \`width\` and \`height\` or use \`fill\` to prevent cumulative layout shift

## Middleware
- Use \`middleware.ts\` at the project root for auth checks, redirects, and geolocation logic
- Keep middleware fast — it runs on every matched request at the edge
- Use \`matcher\` config to limit which routes trigger the middleware

## Error & Loading Boundaries
- Add \`loading.tsx\` in route segments for instant loading states with Suspense
- Add \`error.tsx\` (client component) in route segments to catch and display errors gracefully
- Add \`not-found.tsx\` for custom 404 pages per route segment
- Use \`global-error.tsx\` to catch errors in the root layout

## SEO
- Export a \`metadata\` object or \`generateMetadata()\` function from every page
- Include \`title\`, \`description\`, and \`openGraph\` properties at minimum
- Use \`generateStaticParams()\` for dynamic routes to enable static generation
- Add \`robots.ts\` and \`sitemap.ts\` files at the app root
`;
