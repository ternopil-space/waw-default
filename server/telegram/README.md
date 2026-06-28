# Telegram contact API

Use this endpoint to send a short contact message to a Telegram chat.

## Config

`config.json` or `server.json` can provide either:

```json
{
	"telegram": "BOT_TOKEN",
	"telegramDefaultChat": "CHAT_ID"
}
```

or:

```json
{
	"telegram": {
		"token": "BOT_TOKEN",
		"defaultChat": "CHAT_ID"
	}
}
```

## Endpoint

`POST /api/telegram/contact`

## Body

```json
{
	"message": "Contact text"
}
```

Optional fields:

- `chat`: direct chat override.
- `company`: company id used to find a stored `Telegramchannel`.
- `slug`: company slug used to find a company when the project has a `Company` model.

## Response

Success:

```json
true
```

Error:

```json
{
	"error": "telegram message failed"
}
```
