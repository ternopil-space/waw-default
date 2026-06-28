module.exports = async function (waw) {
	const Schema = waw.mongoose.Schema({
		text: String,
		language: {
			type: waw.mongoose.Schema.Types.ObjectId,
			ref: "Translatelanguage",
		},
		phrase: {
			type: waw.mongoose.Schema.Types.ObjectId,
			ref: "Translatephrase",
		},
	});

	Schema.methods.create = function (obj) {
		this.text = obj.text;

		this.language = obj.language;

		this.phrase = obj.phrase;
	};

	return (waw.Translate = waw.mongoose.model("Translate", Schema));
};
