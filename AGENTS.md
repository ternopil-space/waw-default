# Agent Notes

This repository is a WAW backend project. Read this before making changes.

## Project Shape

- Runtime entrypoint is the `waw` CLI, provided by the `@wawjs/cli` package, run from the repository root.
- This repo is mostly local WAW modules under `server/<moduleName>`.
- Root JSON files such as `config.json` and `server.json` provide runtime config.
- `config.json` maps global modules in `config.modules` as a `{ "<name>": "<source>" }` map. The
  `<source>` value selects how each module is fetched. This template uses the npm source:
  - `"core": "npm"` installs the npm package `@wawjs/waw-core`
  - `"sem": "npm"` installs the npm package `@wawjs/waw-sem`
- `waw` is installed globally as `@wawjs/cli`. npm-sourced global modules are installed in isolated
  per-module folders under `node_modules/.waw/<name>/node_modules/@wawjs/waw-<name>`, not at repo
  root and not under the CLI install. Inspect those folders to read core/sem source.

## WAW Runtime

WAW is a minimal Node.js runtime and module loader for Node `>=24`. The installed package reviewed
for this repo is `@wawjs/cli@26.1.2` (its `bin` is still `waw`).

Startup behavior:

1. WAW merges config in this order:
   - global WAW `config.json`
   - global WAW `server.json`
   - project `config.json`
   - project `server.json`
2. Later config values override earlier values.
3. Module discovery uses project `config.json` and project `server.json` to find `config.server`
   or the default `server` directory.
4. Global modules are resolved from project `config.modules`, a `{ "<name>": "<source>" }` map. The
   `<source>` selects how each module is fetched:
   - `"npm"`: install the npm package `@wawjs/waw-<name>` (the shorthand this template uses).
   - any other string: treated as a literal npm package name and installed as-is (e.g. `"@scope/pkg"`).
   - a git org alias (`waw` or `itkp`): clone the module repo into the global CLI install.
5. Supported git org aliases:
   - `waw`: `https://github.com/WebArtWork/waw-{NAME}.git`
   - `itkp`: `git@github.com:IT-Kamianets/waw-{NAME}.git`
6. npm-sourced modules install into an isolated per-module prefix at
   `<installRoot>/node_modules/.waw/<name>/node_modules/<package>`, so installing one module never
   prunes a sibling. Git org aliases and the `core` fallback force-sync into the global CLI install
   under `@wawjs/cli/server/<name>`. A module's own `module.json` may declare a nested `modules`
   map, which WAW resolves recursively using that module's folder as the install root.
7. If no modules are found, WAW ensures `core` exists (force-synced from the `waw` git org).
8. Marker files such as `angular.json`, `react.json`, `vue.json`, and `wjst.json` can cause WAW to
   ensure matching global modules.
9. Modules are ordered using `before` / `after` constraints from `module.json`; `"*"` means all
   other modules except explicit opposite constraints. If ordering cycles, WAW falls back to
   descending `priority`.
10. Runtime loads each module `index.js` sequentially with a shared `waw` object.

Module dependencies declared in `module.json` are installed into that module directory with
`npm i --prefix ... --legacy-peer-deps --no-save --no-package-lock --no-fund --no-audit`. Do not
assume module dependencies are available from repo-root `node_modules`.

## Global Modules

### `waw-core`

Core is foundational but intentionally small.

Runtime additions:

- `waw.wait(ms)`
- `waw.http(hostname, port)`

Core also provides CLI workflows such as:

- `waw new`
- `waw add` / `waw a`
- `waw css`
- `waw sync`
- `waw version`
- `waw start` / `waw stop` / `waw restart` (PM2 process control; see below)
- `waw ai`

Core does not implement Express, Mongo, routing, CRUD, sessions, or business logic.

`waw ai` prints WAW and loaded-module `AI_INSTRUCTIONS.md` content when those files exist.

#### Process Management (PM2)

`waw start`, `waw stop`, and `waw restart` are thin wrappers over PM2. The `core` module bundles
`pm2` as its own dependency, so a global PM2 install is not required to run them (install PM2
globally only if you want `pm2 ls` / `pm2 logs` for inspection).

- `waw start` registers and starts a PM2 process:
  - process name: `config.name` (falls back to `config.title`, then the current working directory)
  - script: the global CLI runtime (`util.runtime.js`), so PM2 runs the same loader `waw` runs
  - tunables from optional `config.pm2`: `exec_mode` (default `fork`), `instances` (default `1`),
    and `memory` → PM2 `max_memory_restart` (default `800M`)
- `waw stop` runs `pm2 delete <name>`, which **removes** the process from PM2 entirely (not a pause).
- `waw restart` runs `pm2 restart <name>`.

For this project `config.name` is `wawDefault`, so PM2 registers the app under that name. To add the
app to PM2, run `waw start` from the repo root; to remove it, run `waw stop`. The bare `waw` command
(no subcommand) runs the app in the foreground under `nodemon` instead and does not touch PM2.

### `waw-sem`

Sem is the server engine.

Runtime additions:

- `waw.app`
- `waw.server`
- `waw.express`
- `waw.cors`
- `waw.router(basePath)`
- `waw.mongoose`
- `waw.ensure`
- `waw.role(roles, middleware)`
- `waw.next`
- `waw.block`
- `waw.socket`
- `waw.crud`

Sem behavior:

- Initializes Express and HTTP.
- Adds `/status`, returning `true`.
- Adds global CORS preflight handling and exposes `waw.cors`.
- Adds cookie parsing, method override, JSON and URL-encoded parsing with `10mb` limits.
- Adds secure/sameSite session middleware and, when Mongo is configured, Connect-Mongo session storage.
- If `waw.config.mongo` exists, builds `waw.mongoUrl` from URI strings, `uri`, SRV, hosts,
  credentials, TLS, replica set, auth source, and option passthrough, then connects Mongoose.
- Rotates session secrets weekly and persists them in project `server.json` under `secretKeys`, keeping up to 5 active keys.
- Initializes Socket.IO and forwards default `create`, `update`, `unique`, and `delete` events.
- Loads every module file ending with `collection.js` first.
- Loads every module file ending with `api.js` second.
- Calls `waw.crud.finalize()`.
- Starts listening on `waw.config.port`, defaulting to `8080`.

## Local Module Conventions

Each module usually contains:

- `module.json`: metadata, CRUD config, dependency declarations, ordering, and an optional nested
  `modules` map. A legacy `part.json` is auto-renamed to `module.json` on load when no `module.json`
  exists.
- `*.collection.js`: Mongoose model definitions; loaded before APIs.
- `api.js` or `*.api.js`: Express routes or `waw.crud.config(...)`; loaded after collections.

CRUD modules typically declare `crud` in `module.json`; Sem generates routes under:

```text
/api/<crudName>/create
/api/<crudName>/get
/api/<crudName>/fetch
/api/<crudName>/update
/api/<crudName>/unique
/api/<crudName>/delete
```

`waw.crud.config(part, config)` can override per-action behavior with:

- `required`
- `ensure`
- `query`
- `sort`
- `skip`
- `limit`
- `select`
- `populate`

The generated CRUD code stores these hooks on the shared `waw` object using predictable names such as `ensure_update_user`, `query_fetch_user_me`, and `select_fetch_user_me`.

Generated CRUD defaults are owner/moderator-oriented:

- `get`, `fetch`, and `update` use `moderators: req.user && req.user._id` unless a query hook overrides them.
- `delete` uses `author: req.user._id` unless a query hook overrides it.
- `create` calls a document `create(req.body, req.user, waw)` method when present.

Define explicit `ensure` and `query` hooks for public, admin, or project-specific access rules.

## This Repo's Main Modules

- `server/user`: auth, JWT cookie/header token handling, password reset, user CRUD.
- `server/form`: form and form-component CRUD.
- `server/cloudflare`: Cloudflare R2/S3-style upload intents, base64 upload, signed URLs, and `waw.base64ToUrl`.
- `server/translate`: early translation CRUD modules.
- `server/telegram`: Telegram contact message endpoint and Telegram channel storage.

## CLI Notes

- CLI commands are implemented by files named exactly `cli.js` inside modules.
- WAW scans modules from last to first for CLI commands, so later modules can override earlier ones.
- `waw ai` prints an AI-oriented description of WAW and installed modules when available in the active WAW runtime.

## Security Notes

- Treat `server.json` and sensitive parts of `config.json` as secret-bearing files.
- Do not print or repeat real API keys, signing keys, session secrets, payment tokens, mnemonics, webhook secrets, or Telegram bot tokens in responses.
- If secrets appear committed or shared, recommend rotation instead of copying them into chat.

## Engineering Guidance

- Prefer existing WAW module patterns over introducing a new framework structure.
- When adding a model, place it in `*.collection.js`.
- When adding routes, place them in `api.js` or `*.api.js`.
- When adding conventional CRUD, prefer `module.json` plus `waw.crud.config(...)`.
- Remember that module-specific dependencies are installed inside the module folder, not necessarily at repo root.
- To read runtime source, inspect the globally installed `@wawjs/cli` package and the npm-sourced
  modules under `node_modules/.waw/<name>/node_modules/@wawjs/waw-<name>` (e.g. core and sem).
