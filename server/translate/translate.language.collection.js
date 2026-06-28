module.exports = async function (waw) {
	const Schema = waw.mongoose.Schema({
		name: String,
	});

	Schema.methods.create = function (obj) {
		this.name = obj.name;
	};

	return (waw.Translatelanguage = waw.mongoose.model(
		"Translatelanguage",
		Schema
	));
};
