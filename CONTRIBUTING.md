# Contribuindo com o CifrasHub

Obrigado por querer contribuir! Este documento descreve o processo para enviar contribuições.

## Código de Conduta

Este projeto adota o [Contributor Covenant](CODE_OF_CONDUCT.md). Ao participar, você concorda em seguir essas diretrizes.

## Como contribuir

### Reportando bugs

1. Verifique se o bug já foi reportado nas [issues abertas](../../issues)
2. Se não, abra uma nova issue usando o template **Bug Report**
3. Inclua: versão do browser, sistema operacional, passos para reproduzir e comportamento esperado vs. observado

### Sugerindo funcionalidades

1. Verifique as [issues abertas](../../issues) para evitar duplicatas
2. Abra uma issue usando o template **Feature Request**
3. Explique o problema que a funcionalidade resolve e como você imagina que ela funcionaria

### Enviando Pull Requests

1. **Fork** o repositório e crie uma branch a partir de `main`
2. **Nome de branch** sugerido: `feat/nome-da-funcionalidade` ou `fix/descricao-do-bug`
3. **Configure o ambiente local** seguindo o README
4. **Faça suas alterações** seguindo os padrões do projeto (veja abaixo)
5. **Teste** suas mudanças localmente com `npm run dev`
6. **Lint** com `npm run lint` — certifique-se de que não há erros
7. **Abra o PR** usando o template e descreva o que foi feito

## Padrões de código

- **TypeScript** — todo código novo deve ser tipado; evite `any`
- **Componentes** — use os componentes shadcn/ui existentes; não crie novos primitivos sem necessidade
- **Estilização** — use Tailwind CSS; evite CSS inline ou arquivos `.css` separados (exceto `globals.css`)
- **Formatação** — o projeto usa ESLint (`npm run lint`); não envie PRs com erros de lint
- **Commits** — mensagens em inglês ou português, curtas e descritivas:
  - `feat: adiciona suporte a capotraste no modo palco`
  - `fix: corrige transposição em cifras com acordes com barra`
  - `refactor: extrai lógica de parsing para hook separado`

## Estrutura do projeto

```
src/
  app/          # Next.js App Router (páginas e API routes)
  components/   # Componentes React
    ui/         # Primitivos shadcn/ui (não modificar diretamente)
    song/       # Componentes de visualização de cifra
    folder/     # Gerenciamento de pastas
    setlist/    # Setlists
  db/           # Schema Drizzle ORM
  hooks/        # React hooks customizados
  lib/          # Utilitários e lógica de negócio
```

## Lockfile

Regenere o `package-lock.json` no Linux/WSL, nunca no Windows: o npm do Windows descarta entradas opcionais de outras plataformas e quebra o `npm ci` no CI.

## Perguntas?

Abra uma [Discussion](../../discussions) ou uma issue com a label `question`.
