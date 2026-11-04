# VaultShare: contrato da API

Tudo o que o back-end precisa expor para o site deixar de ser mockado.

Hoje os dados vêm de `src/api.ts`, um mock em memória. Cada função tem um comentário com a rota correspondente (`// GET /files`) e já retorna o formato descrito aqui. Para integrar, basta trocar o corpo de cada função por um `fetch`: as telas não mudam.

## Convenções

| Item | Regra |
|---|---|
| URL base | `/api/v1` (sugestão, o front só precisa de um prefixo fixo) |
| Formato | JSON em UTF-8, exceto o upload (`multipart/form-data`) |
| Campos | `camelCase` |
| Datas | ISO 8601 em UTC, ex.: `2026-11-04T14:30:00Z` |
| Tamanhos | Sempre em bytes (número inteiro). O front formata (`2,4 MB`) |
| Textos relativos | O back manda a data. O front calcula "há 12 min", "ontem", "Expira em 7 dias" |
| Autenticação | Toda rota exige sessão, exceto `POST /auth/login`. Sugestão: cookie `HttpOnly`, `Secure`, `SameSite=Lax` |
| CORS | Em desenvolvimento, liberar `http://localhost:5173` com credenciais |

### Erros

Todo erro usa o status HTTP adequado e este corpo. O front mostra `message` direto para o usuário, então ela precisa estar em português.

```json
{ "code": "VALIDATION_ERROR", "message": "Informe o nome do arquivo.", "fields": { "name": "Campo obrigatório" } }
```

`fields` é opcional. Status esperados: `400` (dados inválidos), `401` (sem sessão), `403` (sem permissão), `404` (não encontrado), `409` (conflito, ex.: e-mail já usado), `413` (arquivo grande demais), `507` (cota de armazenamento cheia).

## Resumo das rotas

| Método | Rota | Usada em |
|---|---|---|
| `POST` | `/auth/login` | Sem tela ainda (ver [pendências](#pendências-do-design)) |
| `POST` | `/auth/logout` | Sem tela ainda |
| `GET` | `/me` | Cabeçalho (nome, iniciais, plano), Configurações |
| `PATCH` | `/me` | Configurações: Salvar alterações |
| `GET` | `/me/settings` | Configurações, modal Gerar link |
| `PUT` | `/me/settings` | Configurações: Salvar alterações |
| `GET` | `/overview` | Visão geral: 4 cards de métricas |
| `GET` | `/activity` | Visão geral (`limit=4`), Atividade |
| `GET` | `/notifications` | Sino do cabeçalho |
| `GET` | `/files` | Meus arquivos, modal Gerar link |
| `POST` | `/files` | Modal Criar arquivo |
| `POST` | `/files/upload` | Visão geral: Enviar arquivo |
| `GET` | `/links` | Links compartilhados |
| `POST` | `/links` | Modal Gerar link |
| `GET` | `/search` | Campo de busca do cabeçalho |

## Modelos

```ts
interface User {
  id: string
  name: string
  email: string
  plan: string // texto exibido no cabeçalho, ex.: "Pro Secure"
}

interface UserSettings {
  requirePassword: boolean     // Exigir senha em novos links
  notifyAccess: boolean        // Notificar acessos aos arquivos
  allowAccessRequests: boolean // Permitir pedidos de acesso
}

interface VaultFile {
  id: string
  name: string       // "Planejamento_2026.pdf"
  type: string       // em maiúsculas: "PDF", "PNG", "DOCX", "ZIP"
  sizeBytes: number
  createdAt: string
}

interface ShareLink {
  id: string
  fileId: string
  fileName: string
  url: string               // sem protocolo: "vaultshare.app/s/a8k2"
  expiresAt: string | null  // null = não expira
  hasPassword: boolean      // nunca devolver a senha nem o hash
  readOnly: boolean
  accessCount: number
  createdAt: string
}

interface ActivityEvent {
  id: string
  type: 'file_accessed' | 'link_created' | 'password_added'
      | 'access_requested' | 'file_created' | 'file_uploaded'
  actor: string | null     // quem fez a ação; null quando foi o próprio usuário
  fileName: string | null  // null quando o evento não envolve arquivo
  createdAt: string
}

interface Person {
  id: string
  name: string
  email: string
}
```

O back manda o evento estruturado e o front monta a frase. `type`, `actor` e `fileName` são obrigatórios conforme a tabela:

| `type` | Campos usados | Frase exibida |
|---|---|---|
| `file_accessed` | `actor`, `fileName` | financeiro@empresa.com acessou Planejamento_2026.pdf |
| `link_created` | `fileName` | Você criou um link seguro para Apresentação produto.png |
| `password_added` | `fileName` | Contrato_fornecedores.pdf recebeu proteção por senha |
| `access_requested` | `actor` | Novo pedido de acesso de Lucas Almeida |
| `file_created` | `fileName` | Você criou Relatorio_agosto.pdf |
| `file_uploaded` | `fileName` | Você enviou relatorio.pdf |

## Autenticação

### `POST /auth/login`

```json
{ "email": "marina@empresa.com", "password": "..." }
```

`200` com um `User` e a sessão criada. `401` se as credenciais estiverem erradas, com a mesma mensagem para e-mail inexistente e senha incorreta.

### `POST /auth/logout`

`204`. Encerra a sessão.

## Conta

### `GET /me`

`200` com um `User`.

```json
{ "id": "u1", "name": "Marina Costa", "email": "marina@empresa.com", "plan": "Pro Secure" }
```

### `PATCH /me`

```json
{ "name": "Marina Costa", "email": "marina@empresa.com" }
```

`200` com o `User` atualizado. `400` se o nome estiver vazio ou o e-mail for inválido, `409` se o e-mail já estiver em uso.

### `GET /me/settings`

`200` com `UserSettings`.

```json
{ "requirePassword": true, "notifyAccess": true, "allowAccessRequests": false }
```

### `PUT /me/settings`

Recebe o `UserSettings` completo. `200` com o valor salvo.

O botão "Salvar alterações" chama `PATCH /me` e `PUT /me/settings` juntos. Para usar uma rota só, basta juntar as duas chamadas em `SettingsForm` (`src/pages.tsx`).

## Visão geral

### `GET /overview`

```json
{
  "storageUsedBytes": 18400000000,
  "storageQuotaBytes": 30000000000,
  "protectedFiles": 24,
  "activeLinks": 2,
  "recentAccesses": 12
}
```

- `activeLinks`: links que não expiraram.
- `recentAccesses`: acessos nos últimos 7 dias, como diz o card.
- O front formata os bytes em base 1000 (`18,4 GB`).

## Atividade e notificações

### `GET /activity`

Query opcional: `limit` (número). Sem `limit`, devolve o histórico completo. `200` com `ActivityEvent[]`, do mais recente para o mais antigo.

### `GET /notifications`

`200` com até 5 `ActivityEvent[]`, do mais recente para o mais antigo. Só devolver eventos de acesso se `notifyAccess` estiver ligado. O design não tem contador de não lidas, então não existe rota de "marcar como lida".

## Arquivos

### `GET /files`

`200` com `VaultFile[]`, do mais recente para o mais antigo.

### `POST /files`

Usada pelo modal "Criar arquivo".

```json
{ "name": "Relatorio_agosto.pdf", "type": "PDF" }
```

`201` com o `VaultFile`. Deve registrar um evento `file_created`.

- `type` aceita `PDF`, `PNG`, `DOCX` ou `ZIP`.
- Se `name` vier sem a extensão de `type`, adicionar a extensão.
- O arquivo nasce com `sizeBytes: 0`. Ver a primeira [pendência](#pendências-do-design).

### `POST /files/upload`

Usada pelo botão "Enviar arquivo". `multipart/form-data` com o campo `file`.

`201` com o `VaultFile`, e `type` derivado da extensão. Deve registrar um evento `file_uploaded`. `413` se passar do limite por arquivo, `507` se estourar a cota.

## Links

### `GET /links`

`200` com `ShareLink[]`, do mais recente para o mais antigo. Inclui os expirados: o front mostra "Expirado".

### `POST /links`

```json
{ "fileId": "f2", "expiresInDays": 7, "password": "minha-senha" }
```

| Campo | Regra |
|---|---|
| `fileId` | Obrigatório, precisa ser um arquivo do próprio usuário. Senão, `404` |
| `expiresInDays` | `1`, `7`, `30` ou `null` (sem expiração) |
| `password` | Mínimo de 8 caracteres, ou `null` |

`201` com o `ShareLink`. Deve registrar um evento `link_created`.

Se `requirePassword` do usuário estiver ligado e `password` vier `null`, responder `400`. O front já bloqueia esse caso, mas só o back garante a regra.

## Busca

### `GET /search?q=texto`

Busca sem diferenciar maiúsculas de minúsculas.

```json
{ "files": [], "links": [], "people": [] }
```

- `files`: `VaultFile[]`, por nome.
- `links`: `ShareLink[]`, por nome do arquivo ou URL.
- `people`: `Person[]`, por nome ou e-mail.

Sem resultados, devolver `200` com as três listas vazias, não `404`.

## Segurança

O front só valida para ajudar o usuário. Estas regras precisam estar no back:

- **Isolamento:** toda consulta filtra pelo usuário da sessão. Acessar recurso de outra pessoa retorna `404`.
- **Senhas:** guardar só o hash (argon2 ou bcrypt), tanto de contas quanto de links. Nunca devolver nem registrar em log.
- **URLs de link:** usar identificador aleatório e longo o bastante para não ser adivinhado. O `a8k2` do design tem só 4 caracteres, o que não basta para proteger um arquivo sem senha.
- **Upload:** validar tamanho e cota no servidor, não confiar no tipo informado pelo cliente, e nunca usar o nome enviado como caminho em disco.
- **Login e senha de link:** limitar tentativas para impedir força bruta.
- **Cookie de sessão:** se usar cookie, proteger as rotas de escrita contra CSRF.
- **"Criptografia ativa":** a interface afirma isso em um card, então os arquivos precisam mesmo estar criptografados em repouso.

## Pendências do design

Estes pontos não estão definidos no Figma e precisam de decisão entre vocês:

1. **O que "Criar arquivo" cria?** O modal só pede nome e tipo, sem conteúdo. Hoje isso gera um arquivo vazio de 0 B, e "Enviar arquivo" é o único jeito de mandar conteúdo.
2. **Login:** não há tela de login nem de logout. O site assume um usuário já logado. As rotas de `/auth` estão aqui porque o back precisará delas, mas nada no front as chama ainda. Sem sessão (`401`), hoje as telas só mostram "Não foi possível carregar os dados".
3. **Página pública do link:** `vaultshare.app/s/a8k2` não tem tela. Falta definir a página em que quem recebe o link digita a senha e baixa o arquivo. Ela precisará de algo como `GET /public/links/:slug`, `POST /public/links/:slug/unlock` e uma rota de download. É aí que `accessCount` e o evento `file_accessed` são gerados.
4. **Excluir e baixar:** não há botões para excluir arquivo, revogar link nem baixar arquivo. Se entrarem no design, as rotas naturais são `DELETE /files/:id`, `DELETE /links/:id` e `GET /files/:id/download`.
5. **Pedidos de acesso:** o evento `access_requested` e o switch "Permitir pedidos de acesso" existem, mas não há tela para aprovar ou recusar.
6. **"Somente leitura":** aparece em um link do design, mas o modal Gerar link não tem esse campo. Por ora, `POST /links` cria com `readOnly: false`.
7. **Paginação:** o design não tem paginação e mostra 5 arquivos enquanto o card conta 24 protegidos. Com muitos arquivos, `GET /files` e `GET /activity` vão precisar de `limit` e `cursor`, e o front de um "carregar mais".
