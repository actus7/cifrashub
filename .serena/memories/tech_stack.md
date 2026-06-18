# Tech Stack

- Language: TypeScript strict mode; path alias `@/* -> ./src/*`; JSX transform `react-jsx`; Next plugin in `tsconfig.json`.
- Runtime/framework: Next.js 16 App Router, React 19, React DOM 19.
- UI: shadcn/ui configured by `components.json` with `base-nova`, RSC enabled, TSX, Tailwind CSS 4, CSS variables, neutral base color, lucide icon library, aliases `@/components`, `@/components/ui`, `@/lib/utils`, `@/hooks`.
- Styling deps: Tailwind CSS 4, `@tailwindcss/postcss`, `tw-animate-css`, `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`, `sonner`, `@base-ui/react`.
- Database: PostgreSQL on Neon serverless; Drizzle ORM/Kit. `drizzle.config.ts` uses `src/db/schema.ts`, output `./drizzle`, dialect `postgresql`, prefers `DATABASE_URL_UNPOOLED` over `DATABASE_URL`.
- Auth: Neon Auth / Better Auth. Server config in `src/lib/auth-server.ts`, client in `src/lib/auth.ts`; package override pins `better-auth`.
- Deploy: Vercel. `npm run vercel-build` runs `scripts/vercel-build.cjs`; production applies migrations/schema push before `next build`, preview only builds.
- Package manager: npm with `package-lock.json`; README requires Node.js 20+ and npm 10+.
- Tooling: ESLint 9 flat config with `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript`; no Jest dependency/script currently in `package.json` despite stale AGENTS.md test note.