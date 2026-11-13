# Orbi Web — portal da empresa (Next.js)

Portal web para **gestores e empresas** acompanharem a operação de entregas da Orbi.
Usa a mesma **Orbi API** (Spring Boot) que o app Android do motorista, então tudo que o motorista faz no app aparece aqui em poucos segundos.

## Telas

| Rota | O que faz |
| --- | --- |
| `/login` | Entrada só para contas com perfil **ADMIN** |
| `/overview` | Visão geral: indicadores do dia, gráficos, frota no mapa, ranking |
| `/live` | Mapa ao vivo das rotas do dia |
| `/routes`, `/routes/[id]`, `/routes/new` | Rotas: lista, detalhe (atribuir, cancelar, excluir) e criação |
| `/drivers`, `/drivers/[id]` | Motoristas e desempenho |
| `/occurrences` | Paradas puladas/canceladas, rotas sem motorista e atrasos |
| `/reports` | Relatórios com exportação CSV e impressão/PDF |
| `/messages` | Conversas com motoristas (só no modo demonstração; a API ainda não tem) |
| `/settings` | Conexão, equipe, metas e tema |

## Como rodar

```bash
npm install
npm run dev
```

Abra http://localhost:3000.

- **Modo API (padrão):** entre com uma conta ADMIN da Orbi API.
- **Modo demonstração:** abra `/?demo` (dados fictícios no navegador, sem internet). Para voltar: `/login?api`.

### Endereço da API

O portal chama `/api/...` e o Next.js repassa para a Orbi API (`next.config.ts`), sem problema de CORS.

| Variável | Padrão | Uso |
| --- | --- | --- |
| `ORBI_API_URL` | `https://orbi-api-em6s.onrender.com` | Para onde `/api/*` é repassado |
| `NEXT_PUBLIC_ORBI_API_PUBLIC_URL` | igual acima | Endereço mostrado em Configurações |
| `NEXT_PUBLIC_ORBI_POLL_SECONDS` | `10` | Intervalo de atualização |

Para desenvolver sem usar a API real, crie `.env.local` com `ORBI_API_URL=http://127.0.0.1:5175` apontando para a API simulada.

## Endpoints usados (nenhuma mudança na API)

`POST /api/auth/login` · `GET /api/route` · `GET /api/deliveries/route/{id}` · `GET /api/user` ·
`PATCH /api/route/{id}/assign-driver` · `PATCH /api/route/{id}/cancel` · `DELETE /api/route/{id}` ·
`POST /api/route/optimize` (consome a cota do OpenRouteService; o portal pede confirmação).

## Estrutura

```
app/                 páginas (App Router)
  (portal)/          telas internas, protegidas por login (components/PortalGate.tsx)
  login/             tela de entrada
components/          layout (Shell), gráficos, mapas (Leaflet e simulado), janelas de ação
lib/orbi/            estado e regras (portal.ts), conexão com a API (api.ts), formatação, dados de demonstração
```

## Deploy

Funciona em qualquer hospedagem de Next.js (ex.: **Vercel**): importe o repositório e, se quiser, defina `ORBI_API_URL`.

O `vercel.json` já diz à Vercel que o projeto é **Next.js**. Se o projeto tiver sido criado com outro preset, confira em
*Settings → Build and Deployment*: **Framework Preset = Next.js** e **Output Directory** sem valor personalizado
(o erro `No Output Directory named "public"` aparece quando o preset está como "Other").
