module.exports = async function (waw) {
	waw.app.get("/status", (req, res) => {
		res.status(200).send(true);
	});

	const crud = {
		create: {
			ensure: waw.role("admin", (req, res, next) => {
				req.body.domain = req.get("host");

				next();
			}),
		},
		get: {
			ensure: waw.next,
			query: (req) => {
				return req.query.appId
					? { appId: req.query.appId }
					: { domain: req.get("host") };
			},
		},
		fetch: {
			ensure: waw.next,
			query: (req) => {
				return {
					_id: req.body._id,
				};
			},
		},
		update: {
			ensure: waw.role("admin"),
			query: (req) => {
				return {
					_id: req.body._id,
				};
			},
		},
		delete: {
			ensure: waw.role("admin"),
			query: (req) => {
				return {
					_id: req.body._id,
				};
			},
		},
	};
	waw.crud.config("form", crud);
	waw.crud.config("formcomponent", crud);
};
