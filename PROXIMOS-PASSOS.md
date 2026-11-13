# Próximos passos

Revisão feita antes do primeiro pull request do portal em Next.js.

## Resultado da análise

**Chaves e dados sensíveis:** nenhuma chave, token ou senha real no repositório.
- `.env*` fica fora do Git (`.gitignore`); o endereço da API vem de variável de ambiente.
- As senhas `orbi123` em `lib/orbi/data.ts` são das contas **fictícias** do modo demonstração e só existem no navegador.
- O token JWT da API fica no `sessionStorage` (some ao fechar a aba). O portal nunca guarda a senha.
- `npm audit`: 0 vulnerabilidades nas dependências de produção.

**Comunicação portal ↔ Orbi API (corrigido neste PR):**
- Token vencido sem resposta 401 levava ao login sem explicar o motivo. Agora mostra "Sua sessão expirou".
- Uma ação (ex.: atribuir motorista) feita durante uma sincronização em andamento não forçava a atualização. A tela ficava até 10 s com o dado antigo. Agora a ação espera e sincroniza de novo.
- Ao excluir uma rota, a página mostrava "não encontrado" por um instante. Agora volta para a lista antes.

## Portal web (este repositório)

1. **Publicar na Vercel.** Importar o repositório; se precisar, definir `ORBI_API_URL`. Testar o login com uma conta ADMIN real.
2. **Escolher uma versão do portal.** Existe também a versão estática dentro da API (PR #9 do `orbi-api`). Manter as duas dá retrabalho. Sugestão: usar esta (Next.js) e fechar o PR #9, ou mantê-lo só como reserva.
3. **Cabeçalho CSP.** Adicionar Content-Security-Policy em `next.config.ts`, liberando `tile.openstreetmap.org` (mapa), `nominatim.openstreetmap.org` (busca de endereço) e `fonts.gstatic.com`.
4. **Testes e CI.** Testes de ponta a ponta (Playwright) do login e das telas principais, e um GitHub Actions rodando `npm run lint` e `npm run build` em cada PR.
5. **Tipagem.** Trocar os `any` por tipos que espelhem os DTOs da API (`RouteResponseDTO`, `DeliveryDTO`, `UserDTO`).

## Orbi API (Henrique)

Itens de **segurança** encontrados na análise. Nenhum foi alterado; todos dependem do backend.

6. **Exigir login nas rotas.** Hoje várias respondem sem token: `GET /api/route` devolve CNH e telefone dos motoristas, e o perfil do motorista também fica aberto. Configurar `authorizeHttpRequests` liberando só o login (e as páginas do portal, se o PR #9 for usado).
7. **Esconder a senha.** Adicionar `@JsonIgnore` no campo `password` de `User`.
8. **Restringir motoristas.** Um motorista não deve conseguir alterar entregas de rotas de outro motorista.
9. **Proteger a cota do OpenRouteService.** `POST /api/route/optimize` e `GET /api/route/{id}/directions` chamam o OpenRouteService sem login e sem cache. Exigir login e guardar o resultado.
10. **Prazo da sessão.** O token expira em 1440 **segundos** (24 min). Aumentar o prazo ou criar *refresh token*.
11. **Datas com fuso.** Devolver datas com fuso (`OffsetDateTime`/`Instant`). Hoje o portal supõe UTC.

**Recursos que faltam na API.** Hoje essas telas só funcionam no modo demonstração:

12. Mensagens gestor ↔ motorista, alerta de segurança (SOS), veículo e seguro, comprovante de entrega (recebedor/foto), recuperação de senha e cadastro de motorista pelo portal.

## Infraestrutura e projeto

13. **Render gratuito "dorme".** A primeira chamada pode levar até 1 minuto. O portal já repete a chamada e avisa o usuário. Para a apresentação, acordar a API alguns minutos antes ou usar um plano sem hibernação.
14. **Conta de produção.** Definir quem terá conta ADMIN de verdade e trocar senhas padrão (ex.: o usuário `admin`).
15. **LGPD.** Telefone, CNH e e-mail são dados pessoais. Limitar quem vê e registrar isso na documentação do TCC.
