---
status: completed
generated: 2026-06-17
agents:
  - type: "architect-specialist"
    role: "Priorizar correções estruturais e governança"
  - type: "test-writer"
    role: "Adicionar cobertura inicial para regras críticas"
  - type: "devops-specialist"
    role: "Adicionar CI e scripts verificáveis"
  - type: "security-auditor"
    role: "Reduzir riscos de dependências e segredos"
  - type: "documentation-writer"
    role: "Alinhar documentação operacional"
phases:
  - id: "phase-1"
    name: "Planejamento e alinhamento"
    prevc: "P"
    agent: "architect-specialist"
  - id: "phase-2"
    name: "Implementação"
    prevc: "E"
    agent: "feature-developer"
  - id: "phase-3"
    name: "Verificação"
    prevc: "V"
    agent: "code-reviewer"
  - id: "phase-4"
    name: "Conclusão"
    prevc: "C"
    agent: "documentation-writer"
---

# Plano de correções de qualidade e governança

## Objetivo
Elevar o projeto CifrasHub de um MVP funcional para uma base mais segura e sustentável, corrigindo os pontos identificados na auditoria: ausência de testes, ausência de CI, scripts inconsistentes, dependências auditáveis, migrações versionadas e documentação de contribuição desalinhada.

## Escopo
- Adicionar runner de testes e cobertura inicial em módulos puros críticos.
- Adicionar script de typecheck e script de auditoria de segurança.
- Adicionar workflow de CI para lint, typecheck, test, build e audit.
- Criar baseline de migração Drizzle versionada sem executar alterações no banco.
- Corrigir instruções de `AGENTS.md` para refletir Next.js, App Router e scripts reais.
- Executar validação local completa.

## Fora de escopo
- Alterar schema em produção ou aplicar migrações em Neon.
- Reescrever grandes áreas de UI ou parser sem regressão comprovada.
- Corrigir arquivos modificados previamente pelo usuário sem necessidade direta.

## Achados que orientam a execução
- O app usa Next.js 16, React 19, Tailwind 4, Zustand, Drizzle e Neon.
- `src/lib/parser.ts`, `src/lib/parse-plain-cifra.ts`, `src/lib/music.ts` e utilitários de identidade são bons candidatos para testes iniciais porque são regras de domínio puras.
- `drizzle.config.ts` já aponta para `./drizzle`, mas o diretório não existe.
- `AGENTS.md` cita Jest e `dist/`, porém o projeto não tinha Jest, `test` script nem bundle CommonJS.
- `.gitignore` já protege `.env.local` por meio de `.env.*` e mantém `.env.example` permitido.

## Plano de execução

### 1. Base de automação
- Adicionar `vitest` como dev dependency.
- Criar `vitest.config.ts` com aliases compatíveis com `@/*`.
- Adicionar scripts:
  - `test`: execução única dos testes.
  - `test:watch`: execução interativa.
  - `typecheck`: `tsc --noEmit`.
  - `audit`: `npm audit --audit-level=moderate`.
  - `db:generate`: geração de migrações Drizzle.
  - `verify`: cadeia local de lint, typecheck, test, build e audit.

### 2. Cobertura inicial de testes
- Cobrir parser de cifra em texto puro.
- Cobrir regras musicais de transposição/classificação quando exportadas.
- Cobrir geração de chaves de identidade/arranjo e deduplicação.
- Evitar testes acoplados a rede, Neon ou UI para manter a suíte rápida e determinística.

### 3. CI
- Criar `.github/workflows/ci.yml`.
- Rodar em push e pull request.
- Usar Node 20, `npm ci`, lint, typecheck, test, build e audit.

### 4. Migrações
- Gerar snapshot inicial com Drizzle usando o schema existente.
- Manter `db:push` disponível para ambiente controlado, mas documentar `db:generate` como caminho preferencial para mudanças versionadas.
- Não executar SQL contra banco remoto nesta tarefa.

### 5. Documentação
- Atualizar `AGENTS.md` com comandos reais e mapa do repositório.
- Remover referência a Jest e `dist/`.
- Registrar que artefatos locais sensíveis não devem ser commitados.

### 6. Validação
- Executar `npm run lint`.
- Executar `npm run typecheck`.
- Executar `npm run test`.
- Executar `npm run build`.
- Executar `npm run audit`.

## Critérios de aceite
- `npm run lint` passa.
- `npm run typecheck` passa.
- `npm run test` passa com testes reais.
- `npm run build` passa.
- `npm run audit` não reporta vulnerabilidades moderadas ou maiores.
- CI existe e executa os mesmos gates principais.
- Migrações Drizzle existem em `drizzle/`.
- `AGENTS.md` está consistente com o projeto.

## Riscos e mitigação
| Risco | Impacto | Mitigação |
| --- | --- | --- |
| Vulnerabilidade exigir mudança de lockfile ampla | Médio | Aplicar `npm audit fix` e validar build/testes depois |
| Migração gerada não representar banco real | Médio | Tratar como baseline do schema atual e não aplicar sem revisão humana |
| Testes iniciais insuficientes | Médio | Priorizar módulos de domínio e deixar estrutura pronta para expansão |
| Build depender de variáveis de ambiente | Baixo | Confirmar comportamento existente antes de alterar scripts |

## Evidências esperadas
- Arquivos de teste adicionados.
- `package.json` e lockfile atualizados.
- `vitest.config.ts` criado.
- `.github/workflows/ci.yml` criado.
- `drizzle/` com baseline criado.
- `AGENTS.md` revisado.
- Saídas dos comandos de validação registradas na conversa.
