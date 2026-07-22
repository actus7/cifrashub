# CifrasHub

Visualizador de cifras para qualquer instrumentista — violão, guitarra, baixo, teclado e mais — com pastas, transposição, metrônomo e ferramentas de palco.

[English](#english) · [Português](#português)

---

## Português

### O que é

CifrasHub é uma aplicação web open source para músicos que querem organizar e visualizar cifras (tablatures) de músicas. Suporta autenticação, sincronização na nuvem, modo offline via PWA e diversas ferramentas de prática e apresentação.

### Funcionalidades

- **Busca e visualização** de cifras integrada com o Cifra Club
- **Pastas** para organizar suas cifras favoritas
- **Transposição** automática com cálculo de capotraste
- **Setlists** para montar e executar repertórios ao vivo
- **Metrônomo** integrado com controle de BPM
- **Modo palco** — tela limpa otimizada para apresentações
- **Compartilhamento público** via link
- **PWA** — funciona offline após a primeira visita
- **Integração com YouTube** — associe vídeos às cifras
- **Sincronização na nuvem** para usuários autenticados

### Stack

| Camada | Tecnologia |
|--------|-----------|
| Framework | Next.js 16 (App Router) |
| UI | React 19 + shadcn/ui + Tailwind CSS 4 |
| Banco de dados | PostgreSQL via Neon (serverless) |
| ORM | Drizzle ORM |
| Autenticação | Neon Auth (Better Auth) |
| Deploy | Vercel |

### Pré-requisitos

- Node.js 20+
- npm 10+
- Conta no [Neon](https://neon.tech) (banco de dados PostgreSQL serverless gratuito)

### Instalação

```bash
# Clone o repositório
git clone https://github.com/Geeks-Zone/cifrashub.git
cd cifrashub

# Instale as dependências
npm install

# Configure as variáveis de ambiente
cp .env.example .env.local
# Edite .env.local com suas credenciais
```

### Configuração do banco de dados

1. Crie um projeto no [Neon Console](https://console.neon.tech)
2. Copie as connection strings para `.env.local`
3. Gere migrações versionadas quando alterar `src/db/schema.ts`:

```bash
npm run db:generate
```

4. Aplique o schema apenas em ambientes locais ou revisados:

```bash
npm run db:push
```

### Executando localmente

```bash
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000).

### Scripts disponíveis

| Script | Descrição |
|--------|-----------|
| `npm run dev` | Inicia o servidor de desenvolvimento |
| `npm run build` | Gera o build de produção |
| `npm run start` | Inicia o servidor de produção |
| `npm run lint` | Executa o ESLint |
| `npm run typecheck` | Valida os tipos TypeScript |
| `npm run test` | Executa a suíte Vitest uma vez |
| `npm run test:watch` | Executa a suíte Vitest em modo watch |
| `npm run audit` | Verifica vulnerabilidades moderadas ou maiores |
| `npm run verify` | Executa lint, typecheck, testes, build e audit |
| `npm run db:generate` | Gera migrações Drizzle versionadas |
| `npm run db:push` | Aplica o schema ao banco de dados em ambiente controlado |
| `npm run db:studio` | Abre o Drizzle Studio (GUI do banco) |

### Deploy (Vercel)

1. Conecte o repositório ao [Vercel](https://vercel.com/new)
2. Em **Settings → Environment Variables**, configure as variáveis do `.env.example` para os ambientes **Production**, **Preview** e **Development**:
   - `DATABASE_URL` — connection string pooled do Neon; o hostname deve conter `-pooler` e é a única URL usada pelo runtime
   - `DATABASE_URL_UNPOOLED` — connection string direct do Neon, reservada para migrations e `drizzle-kit`
   - `NEON_AUTH_COOKIE_SECRET` — gerado com `openssl rand -base64 32` (aceita `AUTH_COOKIE_SECRET` como fallback)
   - `NEON_AUTH_BASE_URL` — URL do seu projeto Neon Auth (aceita `NEON_AUTH_URL` como fallback)
   - `NEXT_PUBLIC_BASE_URL` — domínio público (ex.: `https://www.cifrashub.com.br`)
   - Em produção, use `https://www.cifrashub.com.br` como domínio canônico e mantenha `https://cifrashub.com.br` apenas como redirecionamento para `www`
3. O comando de build é `npm run vercel-build`, que em Production aplica migrações SQL e faz `drizzle-kit push` antes do `next build`. Em Preview, só roda o `next build`.
4. Clique em **Deploy**.

> **Atenção:** se `DATABASE_URL` não estiver configurada em Production, o build falha com mensagem clara indicando quais variáveis estão faltando.

---

## English

### What is it

CifrasHub is an open source web application for musicians to organize and view chord sheets (cifras). It supports authentication, cloud sync, offline mode via PWA, and various practice and performance tools.

### Features

- **Search and view** chord sheets integrated with Cifra Club
- **Folders** to organize your favorite chords
- **Transposition** with automatic capo calculation
- **Setlists** to build and perform live repertoires
- **Built-in metronome** with BPM control
- **Stage mode** — clean screen optimized for performances
- **Public sharing** via link
- **PWA** — works offline after the first visit
- **YouTube integration** — link videos to songs
- **Cloud sync** for authenticated users

### Prerequisites

- Node.js 20+
- npm 10+
- [Neon](https://neon.tech) account (free serverless PostgreSQL)

### Installation

```bash
git clone https://github.com/Geeks-Zone/cifrashub.git
cd cifrashub
npm install
cp .env.example .env.local
# Edit .env.local with your credentials
```

### Database setup

Generate versioned migrations after schema changes:

```bash
npm run db:generate
```

Apply the schema only in local or reviewed environments:

```bash
npm run db:push
```

### Running locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Aviso Legal / Legal Notice

**PT:** Este projeto é uma ferramenta pessoal de organização de cifras. O conteúdo das cifras (letras, acordes) é buscado diretamente pelo navegador do usuário a partir do [Cifra Club](https://www.cifraclub.com.br/) no momento da visualização — o CifrasHub **não armazena, redistribui ou reproduz** esse conteúdo. Ao usar o CifrasHub, você concorda com os [Termos de Uso do Cifra Club](https://www.cifraclub.com.br/info/termos-de-uso/). O CifrasHub não tem nenhuma relação comercial ou oficial com o Cifra Club.

**EN:** This project is a personal chord sheet organization tool. Chord content (lyrics, chords) is fetched directly by the user's browser from [Cifra Club](https://www.cifraclub.com.br/) at the time of viewing — CifrasHub does **not store, redistribute, or reproduce** that content. By using CifrasHub, you agree to [Cifra Club's Terms of Use](https://www.cifraclub.com.br/info/termos-de-uso/). CifrasHub has no commercial or official relationship with Cifra Club.

---
## Comunidade

Este projeto tem uma comunidade no WhatsApp para tirar dúvidas, compartilhar ideias e acompanhar novidades.

Entre pelo link: [WhatsApp Community](https://chat.whatsapp.com/Jmzd8D79eyGBIHElnAlZJv)

---


## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request.

## Security

Please read [SECURITY.md](SECURITY.md) for responsible disclosure guidelines.

## License

[MIT](LICENSE) © CifrasHub Contributors
