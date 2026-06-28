module.exports = function (waw) {
	const Schema = waw.mongoose.Schema({
		appId: String,
		domain: String,
		formId: String,

		name: String,
		key: String,
		props: Object,
		components: [
			{
				type: waw.mongoose.Schema.Types.ObjectId,
				ref: "Formcomponent",
			},
		],
	});

	return (waw.Formcomponent = waw.mongoose.model("Formcomponent", Schema));
};
