module.exports = function (waw) {
	const bcrypt = require("bcrypt-nodejs");
	const schema = waw.mongoose.Schema(
		{
			is: {},
			data: {},
			thumb: { type: String, default: "/assets/default.png" },
			email: { type: String, unique: true, sparse: true, trim: true },
			reg_email: { type: String, unique: true, sparse: true, trim: true },
			password: String,
			name: String,
			phone: String,
			bio: String,
			name: String,
			resetPin: Number,
		},
		{
			minimize: false,
		},
	);

	schema.methods.generateHash = function (password) {
		return bcrypt.hashSync(password, bcrypt.genSaltSync(8), null);
	};

	schema.methods.validPassword = function (password) {
		return bcrypt.compareSync(password, this.password);
	};

	schema.methods.create = function (obj, user, sd) {
		this.thumb = obj.thumb || "/assets/default.png";

		this.reg_email = obj.email;

		this.is = {};
	};

	return (waw.User = waw.mongoose.model("User", schema));
};
