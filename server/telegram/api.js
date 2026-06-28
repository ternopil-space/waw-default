const { Bot } = require("grammy");

function getTelegramToken(waw) {
	const cfg = waw.config.telegram;
	return typeof cfg === "string" ? cfg : cfg?.token;
}

function getDefaultChat(waw) {
	const cfg = waw.config.telegram;
	if (typeof cfg === "object" && cfg.defaultChat) return cfg.defaultChat;
	return waw.config.telegramChat || waw.config.telegramDefaultChat || null;
}

module.exports = async (waw) => {
	const token = getTelegramToken(waw);
	if (!token) return;

	const bot = new Bot(token);
	bot.start();

	const router = waw.router("/api/telegram");
	if (waw.cors) {
		router.options(/.*/, waw.cors());
		router.use(waw.cors());
	}

	async function findCompanyId(body) {
		if (body.slug && waw.Company) {
			const company = await waw.Company.findOne({ slug: body.slug });
			if (company) return company._id;
		}

		return body.company || null;
	}

	router.post("/contact", async (req, res) => {
		try {
			const message = String(req.body?.message || "").trim();
			if (!message) {
				return res.status(400).json({ error: "message required" });
			}

			const companyId = await findCompanyId(req.body || {});
			const channel =
				companyId && waw.Telegramchannel
					? await waw.Telegramchannel.findOne({ company: companyId })
					: null;
			const chat = channel?.chat || req.body?.chat || getDefaultChat(waw);

			if (!chat) {
				return res.status(400).json({ error: "telegram chat required" });
			}

			await bot.api.sendMessage(chat, message);
			res.send(true);
		} catch (error) {
			res.status(error.status || 500).json({
				error: error.message || "telegram message failed",
			});
		}
	});

	bot.on("message:text", (ctx) => {
		if (ctx.message.text === "id") {
			ctx.reply(String(ctx.chat.id));
		}
	});
};
