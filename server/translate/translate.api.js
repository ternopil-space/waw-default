module.exports = async (waw) => {
	// await waw.Translatephrase.deleteMany({});
	// await waw.Translatelanguage.deleteMany({});
	// await waw.Translate.deleteMany({});
	const crud = (model) => {
		const ensure = async (req, res, next) => {
			req.body = req.body || {};

			if (
				model &&
				(!req.body.text ||
					(await model.countDocuments({
						text: req.body.text,
					})))
			) {
				res.json(false);
			} else {
				next();
			}
		};

		return {
			get: {
				ensure: waw.next,
				query: () => {
					return {};
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
			create: {
				ensure,
			},
			update: {
				ensure: waw.next,
				query: (req) => {
					return {
						_id: req.body._id,
					};
				},
			},
			delete: {
				ensure: waw.next,
				query: (req) => {
					return {
						_id: req.body._id,
					};
				},
			},
		};
	};
	waw.crud.config("translate", crud(waw.Translate));
	waw.crud.config("translatephrase", crud(waw.Translatephrase));
	waw.crud.config("translatelanguage", crud());
};
