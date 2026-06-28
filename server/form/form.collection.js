module.exports = function (waw) {
	const Schema = waw.mongoose.Schema({
		appId: String,
		domain: String,
		formId: String,

		title: String,
	});

	return (waw.Form = waw.mongoose.model("Form", Schema));
};
