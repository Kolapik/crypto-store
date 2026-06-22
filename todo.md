# Helvetic Reserve — TODO

## Phase 1: Foundation
- [x] Database schema (watches, purchase_requests tables)
- [x] Global CSS design system (Space Grotesk, tokens, CRT, animations)
- [x] Upload hero ocean image to CDN

## Phase 2: Backend
- [x] tRPC watches router (public list, detail, admin CRUD)
- [x] tRPC purchase requests router (create, admin list, update status)
- [x] Admin auth guard (adminProcedure)

## Phase 3: Public Storefront
- [x] ScrollNav (transparent → solid on scroll, hidden on /admin)
- [x] Homepage (ocean hero, glitch headline, featured grid, brand ticker)
- [x] Catalogue page (filter toolbar, square grid, pixel-grid overlays)
- [x] Watch detail page (split layout, sticky panel, purchase CTA)
- [x] Purchase request form page
- [x] Purchase request confirmation page

## Phase 4: Admin Area
- [x] Admin login page (frosted-glass card, glow)
- [x] Admin layout (grouped sidebar: Operate / Configure / Maintain, user chip)
- [x] Admin dashboard (metric cards, activity table)
- [x] Admin catalogue management (list, create, edit, archive)
- [x] Admin purchase requests pipeline (list, status update)

## Phase 5: Polish & Delivery
- [x] Wire all routes in App.tsx
- [x] Write vitest tests (auth.logout passing)
- [x] Verify all pages in browser
- [x] Save checkpoint
