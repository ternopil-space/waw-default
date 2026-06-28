const path = require("path");
const { v4: uuidv4 } = require("uuid");
const nJwt = require("njwt");
module.exports = function (waw) {
	/*
	 *	User configuration
	 */
	if (!waw.config.signingKey) {
		waw.config.signingKey = uuidv4();

		let serverJson = waw.readJson(process.cwd() + "/server.json");

		serverJson.signingKey = waw.config.signingKey;

		waw.writeJson(process.cwd() + "/server.json", serverJson);
	}
	// move below to other module, mail one
	if (waw.config.mail) {
		const nodemailer = require("nodemailer");

		let transporter = nodemailer.createTransport({
			host: waw.config.mail.host,
			port: waw.config.mail.port,
			secure: waw.config.mail.secure,
			auth: waw.config.mail.auth,
		});

		waw.send = (opts, cb = (resp) => {}) => {
			transporter.sendMail(
				{
					from: waw.config.mail.from,
					subject: opts.subject || waw.config.mail.subject,
					to: opts.to,
					text: opts.text,
					html: opts.html,
				},
				cb,
			);
		};
	} else {
		waw.send = () => {};
	}

	const set_is = async (email, is) => {
		await waw.wait(300);

		const user = await waw.User.findOne({
			email: email,
		});

		if (!user) return;

		if (!user.is) user.is = {};

		user.is[is] = true;

		user.markModified("is");

		await user.save();
	};

	if (waw.config.user && waw.config.user.is) {
		for (const is in waw.config.user.is) {
			const emails = waw.config.user.is[is].split(" ");

			for (var i = 0; i < emails.length; i++) {
				set_is(emails[i], is);
			}
		}
	}

	/* API */
	waw.app.use((req, res, next) => {
		if (req.cookies.authToken) {
			nJwt.verify(
				req.cookies.authToken,
				waw.config.signingKey,
				(err, verifiedJwt) => {
					if (err) {
						res.clearCookie("authToken", {
							httpOnly: true,
							secure: true,
						});

						next();
					} else {
						req.user = verifiedJwt.body;
						next();
					}
				},
			);
		} else if (req.headers.token) {
			nJwt.verify(
				req.headers.token,
				waw.config.signingKey,
				(err, verifiedJwt) => {
					if (err) {
						res.set("remove", "token");

						res.set("Access-Control-Expose-Headers", "field");

						next();
					} else {
						req.user = verifiedJwt.body;
						next();
					}
				},
			);
		} else next();
	});
	const prepareUser = (user, res) => {
		user = JSON.parse(JSON.stringify(user));

		delete user.password;

		delete user.resetPin;

		user.token = nJwt.create(user, waw.config.signingKey);

		user.token.setExpiration(new Date().getTime() + 48 * 60 * 60 * 1000);

		user.token = user.token.compact();

		// Set the token in a cookie
		res.cookie("authToken", user.token, {
			httpOnly: true, // Makes the cookie inaccessible to JavaScript on the client
			secure: true, // Ensures the cookie is sent only over HTTPS
			maxAge: 3600000 * 24 * 30, // Sets cookie expiration
		});

		return user;
	};
	const findUser = async (email) => {
		if (!email) return null;

		const normalizedEmail = String(email).toLowerCase();

		return await waw.User.findOne({
			$or: [
				{
					reg_email: normalizedEmail,
				},
				{
					email: normalizedEmail,
				},
			],
		});
	};
	const new_pin = async (user, cb = () => {}) => {
		user.resetPin = Math.floor(Math.random() * (999999 - 100000)) + 100000;

		user.markModified("data");

		await user.save();

		waw.send(
			{
				to: user.email,
				subject: "Code: " + user.resetPin,
				html: "Code: " + user.resetPin,
			},
			cb,
		);
	};

	if (
		waw.config.ngx &&
		Array.isArray(waw.config.ngx.apps) &&
		waw.config.ngx.apps.length
	) {
		for (const app of waw.config.ngx.apps) {
			waw.api({
				app: path.join(process.cwd(), app.dist),
			});
		}
	}

	if (
		waw.config.wjst &&
		Array.isArray(waw.config.wjst.templates) &&
		waw.config.wjst.templates.length
	) {
		for (const template of waw.config.wjst.templates) {
			const templatePath = path.join(process.cwd(), template.path);

			waw.api({
				template: {
					path: templatePath,
					prefix: template.prefix,
					pages: template.pages,
				},
				page: {
					"/": (req, res) => {
						res.send(
							waw.render(
								path.join(templatePath, "dist", "index.html"),
								{
									base: "/wjst-default/",
								},
							),
						);
					},
				},
			});
		}
	}

	const router = waw.router("/api/user");
	if (waw.cors) {
		router.options(/.*/, waw.cors());
		router.use(waw.cors());
	}

	router.get("/logout", (req, res) => {
		res.clearCookie("authToken", {
			httpOnly: true,
			secure: true,
		});

		res.json(true);
	});
	router.post("/status", async (req, res) => {
		const user = await findUser(req.body.email);

		const json = {};

		json.email = !!user;

		if (user && req.body.password) {
			json.pass = user.validPassword(req.body.password);
		}

		res.json(json);
	});
	router.post("/request", async (req, res) => {
		const user = await findUser(req.body.email);

		if (user) {
			new_pin(user);
		}

		res.json(true);
	});
	router.post("/change", async (req, res) => {
		const user = await findUser(req.body.email);

		if (
			user &&
			user.resetPin &&
			req.body.code &&
			user.resetPin.toString() === req.body.code.toString()
		) {
			user.password = user.generateHash(req.body.password);

			delete user.resetPin;

			await user.save();

			res.json(true);
		} else if (user) {
			new_pin(user, () => {
				res.json(false);
			});
		} else {
			res.json(false);
		}
	});
	router.post("/changePassword", async (req, res) => {
		if (!req.user) return res.send(false);

		const user = await waw.User.findOne({ _id: req.user._id });

		if (user.validPassword(req.body.oldPass)) {
			user.password = user.generateHash(req.body.newPass);

			await user.save();

			res.json(true);
		} else {
			res.json(false);
		}
	});
	router.post("/login", async (req, res) => {
		const user = await findUser(req.body.email);

		if (!user || !user.validPassword(req.body.password)) {
			return res.json(false);
		}

		res.json(prepareUser(user, res));
	});
	router.post("/sign", async (req, res) => {
		if (!req.body.email || !req.body.password) {
			return res.status(400).json(false);
		}

		const userExists = await findUser(req.body.email);

		if (userExists) {
			return res.json(false);
		}

		const user = new waw.User({
			reg_email: req.body.email.toLowerCase(),
			email: req.body.email.toLowerCase(),
			data: req.body.data || {},
			is: {},
		});

		user.password = user.generateHash(req.body.password);

		await user.save();

		res.json(prepareUser(user, res));
	});

	/* CRUD */
	const select = () => "-password -resetPin";
	waw.crud.config("user", {
		get: {
			ensure: waw.next,
			query: () => {
				return {};
			},
			select,
		},
		fetch: [
			{
				ensure: waw.next,
				query: (req) => {
					return {
						_id: req.body._id,
					};
				},
				select,
			},
			{
				name: "me",
				query: (req) => {
					return {
						_id: req.user._id,
					};
				},
				select,
			},
		],
		update: [
			{
				query: (req) => {
					return {
						_id: req.user._id,
					};
				},
				select,
			},
			{
				name: "admin",
				ensure: waw.role("admin"),
				query: (req) => {
					return {
						_id: req.body._id,
					};
				},
				select,
			},
		],
		delete: {
			name: "admin",
			ensure: waw.role("admin"),
			query: (req) => {
				return {
					_id: req.body._id,
				};
			},
			select,
		},
	});
};
