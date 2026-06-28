module.exports = async function (waw) {
	const Schema = waw.mongoose.Schema({
		text: {
			type: String,
			unique: true,
		},
	});

	Schema.methods.create = function (obj, user, waw) {
		this.text = obj.text;
	};

	return (waw.Translatephrase = waw.mongoose.model(
		"Translatephrase",
		Schema
	));
};
