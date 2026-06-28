module.exports = async function (waw) {
	const Schema = waw.mongoose.Schema(
		{
			chat: {
				type: String,
				required: true,
				trim: true,
			},
			company: {
				type: waw.mongoose.Schema.Types.ObjectId,
				ref: "Company",
				sparse: true,
			},
			name: String,
			description: String,
			data: {},
		},
		{
			minimize: false,
		},
	);

	return (waw.Telegramchannel = waw.mongoose.model(
		"Telegramchannel",
		Schema,
	));
};
