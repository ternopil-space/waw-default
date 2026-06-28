// server/cloudflare/util.cloudflare.js
const {
	S3Client,
	PutObjectCommand,
	GetObjectCommand,
	DeleteObjectCommand,
	ListObjectsV2Command,
	DeleteObjectsCommand,
} = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

function ensureNoTrailingSlash(s) {
	if (!s) return s;
	return s.endsWith("/") ? s.slice(0, -1) : s;
}

function safeExtFromName(name = "") {
	const idx = name.lastIndexOf(".");
	if (idx <= 0) return "";
	const ext = name
		.slice(idx + 1)
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "");
	return ext ? `.${ext}` : "";
}

function slugContainer(containerId = "") {
	return String(containerId)
		.normalize("NFKD")
		.replace(/[^a-zA-Z0-9/_-]+/g, "_")
		.replace(/\/+/g, "/")
		.replace(/^\//, "")
		.replace(/\/$/, "")
		.slice(0, 120);
}

/**
 * Mandatory key format:
 *   <containerId>/<fileId>/<variant><ext?>
 */
function makeKey({ containerId, fileId, variant, name } = {}) {
	const c = slugContainer(containerId);
	if (!c) throw new Error("containerId is required");

	const f = String(fileId || "").trim();
	if (!f) throw new Error("fileId is required");

	const v = String(variant || "").trim();
	if (!v) throw new Error("variant is required");

	const ext = safeExtFromName(name || "");
	return `${c}/${f}/${v}${ext}`;
}

function makePrefix({ containerId, fileId } = {}) {
	const c = slugContainer(containerId);
	if (!c) throw new Error("containerId is required");

	const f = String(fileId || "").trim();
	if (!f) throw new Error("fileId is required");

	return `${c}/${f}/`;
}

function createCloudflare(waw) {
	const cfg = waw?.config?.cloudflare || {};
	if (!cfg.bucket) throw new Error("cloudflare.bucket is required");
	if (!cfg.accessKeyId) throw new Error("cloudflare.accessKeyId is required");
	if (!cfg.secretAccessKey)
		throw new Error("cloudflare.secretAccessKey is required");

	const accountId = cfg.accountId;
	const endpoint =
		cfg.endpoint || `https://${accountId}.r2.cloudflarestorage.com`;

	const client = new S3Client({
		region: "auto",
		endpoint,
		credentials: {
			accessKeyId: cfg.accessKeyId,
			secretAccessKey: cfg.secretAccessKey,
		},
		forcePathStyle: true,
	});

	const publicBaseUrl = ensureNoTrailingSlash(cfg.publicBaseUrl || "");
	const expiresSeconds = Number(cfg.signExpiresSeconds || 900);

	function getPublicUrl(key) {
		if (!publicBaseUrl) return null;
		return `${publicBaseUrl}/${encodeURI(key).replace(/%2F/g, "/")}`;
	}

	async function signUpload({ key, contentType }) {
		return getSignedUrl(
			client,
			new PutObjectCommand({
				Bucket: cfg.bucket,
				Key: key,
				ContentType: contentType,
			}),
			{ expiresIn: expiresSeconds },
		);
	}

	async function signDownload({ key }) {
		return getSignedUrl(
			client,
			new GetObjectCommand({
				Bucket: cfg.bucket,
				Key: key,
			}),
			{ expiresIn: expiresSeconds },
		);
	}

	async function deletePrefix({ prefix }) {
		let token;

		do {
			const listed = await client.send(
				new ListObjectsV2Command({
					Bucket: cfg.bucket,
					Prefix: prefix,
					ContinuationToken: token,
				}),
			);

			if (listed.Contents?.length) {
				await client.send(
					new DeleteObjectsCommand({
						Bucket: cfg.bucket,
						Delete: {
							Objects: listed.Contents.map((o) => ({
								Key: o.Key,
							})),
						},
					}),
				);
			}

			token = listed.NextContinuationToken;
		} while (token);
	}

	return {
		bucket: cfg.bucket,
		makeKey,
		makePrefix,
		signUpload,
		signDownload,
		deletePrefix,
		getPublicUrl,
	};
}

module.exports = { createCloudflare };
