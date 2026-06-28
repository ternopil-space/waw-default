# WAW Default Backend

Default WAW backend project with reusable server modules.

## Requirements

- Node.js `>=24` for the current WAW package.
- MongoDB running on `127.0.0.1:27017` unless `config.json` or `server.json` overrides it.
- WAW installed globally:

```sh
npm i -g @wawjs/cli
```

The `core` and `sem` runtime modules are declared in `config.json` (`config.modules`, `"npm"`
source) and installed into isolated per-module folders under
`node_modules/.waw/core/node_modules/@wawjs/waw-core` and
`node_modules/.waw/sem/node_modules/@wawjs/waw-sem`.

## Start

Run the project from the repository root:

```sh
waw
```

By default this project listens on port `8080`, configured in `config.json`.

Health check:

```http
GET http://localhost:8080/status
```

## Add A Module

Use the WAW CLI from the repository root:

```sh
waw add {name}
```

This adds a local module under `server/{name}`.

## Project Structure

```text
config.json        Project runtime config
server/           Local WAW modules
server/user       Auth and user CRUD
server/form       Form and form-component CRUD
server/cloudflare Cloudflare R2 upload helpers
server/telegram   Telegram contact API
server/translate  Translation CRUD models
AGENTS.md         Notes for AI/code agents working in this repo
```

Each module usually contains:

- `module.json` for metadata, CRUD config, dependencies, and load ordering.
- `*.collection.js` for Mongoose models.
- `api.js` or `*.api.js` for routes and CRUD behavior.

## Configuration

Primary project config lives in `config.json`. Environment-specific or secret values should go in `server.json`, which is treated as local runtime config.

Do not commit real API keys, signing keys, session secrets, payment tokens, or Telegram bot tokens.

## More Information

- npm package: https://www.npmjs.com/package/@wawjs/cli
- WAW wiki: https://wawjs.wiki/
