// server/cloudflare/cli.js
const fs = require("fs");
const path = require("path");
const {
	S3Client,
	PutObjectCommand,
	ListObjectsV2Command,
} = require("@aws-sdk/client-s3");

function usage() {
	console.log(
		`
Usage:
  waw cloudflare upload <containerId> <imageId> <localPath>
  waw cloudflare list <containerId> [imageId]

Rule:
  bucket/<containerId>/<imageId>/*

Examples:
  waw cloudflare upload general default ./default.jpg
  waw cloudflare list general
  waw cloudflare list general default
`.trim(),
	);
}

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

function slugId(s = "") {
	return String(s)
		.normalize("NFKD")
		.replace(/[^a-zA-Z0-9/_-]+/g, "_")
		.replace(/\/+/g, "/")
		.replace(/^\//, "")
		.replace(/\/$/, "")
		.slice(0, 120);
}

function guessMimeByExt(filename = "") {
	const ext = path.extname(filename).toLowerCase();
	if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
	if (ext === ".png") return "image/png";
	if (ext === ".webp") return "image/webp";
	if (ext === ".gif") return "image/gif";
	if (ext === ".svg") return "image/svg+xml";
	if (ext === ".pdf") return "application/pdf";
	if (ext === ".zip") return "application/zip";
	if (ext === ".txt") return "text/plain";
	if (ext === ".json") return "application/json";
	return "application/octet-stream";
}

function encodeKeyForUrl(key) {
	// keep slashes, but escape everything else
	return encodeURI(key).replace(/%2F/g, "/");
}

function makePublicUrl(publicBaseUrl, key) {
	if (!publicBaseUrl) return null;
	return `${publicBaseUrl}/${encodeKeyForUrl(key)}`;
}

function makeClient(waw) {
	const cfg = waw?.config?.cloudflare;
	if (!cfg) throw new Error("missing waw.config.cloudflare");

	const accountId = cfg.accountId;
	const endpoint =
		cfg.endpoint ||
		(accountId ? `https://${accountId}.r2.cloudflarestorage.com` : null);

	if (!endpoint)
		throw new Error(
			"cloudflare.endpoint or cloudflare.accountId is required",
		);
	if (!cfg.bucket) throw new Error("cloudflare.bucket is required");
	if (!cfg.accessKeyId) throw new Error("cloudflare.accessKeyId is required");
	if (!cfg.secretAccessKey)
		throw new Error("cloudflare.secretAccessKey is required");

	const client = new S3Client({
		region: "auto",
		endpoint,
		credentials: {
			accessKeyId: cfg.accessKeyId,
			secretAccessKey: cfg.secretAccessKey,
		},
		forcePathStyle: true,
	});

	return {
		bucket: cfg.bucket,
		publicBaseUrl: cfg.publicBaseUrl
			? ensureNoTrailingSlash(cfg.publicBaseUrl)
			: "",
		client,
	};
}

function makeKey(containerId, imageId, localFilename) {
	const c = slugId(containerId);
	const i = slugId(imageId);
	if (!c) throw new Error("containerId is required");
	if (!i) throw new Error("imageId is required");

	const ext = safeExtFromName(localFilename);
	return `${c}/${i}/original${ext}`;
}

async function upload(waw, containerId, imageId, localPath) {
	if (!containerId || !imageId || !localPath) {
		usage();
		return;
	}

	const abs = path.resolve(process.cwd(), localPath);
	if (!fs.existsSync(abs)) throw new Error(`file not found: ${abs}`);

	const s3 = makeClient(waw);

	const filename = path.basename(abs);
	const mime = guessMimeByExt(filename);
	const key = makeKey(containerId, imageId, filename);

	await s3.client.send(
		new PutObjectCommand({
			Bucket: s3.bucket,
			Key: key,
			Body: fs.createReadStream(abs),
			ContentType: mime,
		}),
	);

	const publicUrl = makePublicUrl(s3.publicBaseUrl, key);

	console.log("[cloudflare] uploaded");
	console.log("  bucket:", s3.bucket);
	console.log("  key   :", key);
	console.log("  url   :", publicUrl || "(no publicBaseUrl configured)");
}

/**
 * Lists objects under a prefix, handling pagination.
 */
async function listAllObjects(s3, prefix) {
	let token;
	const out = [];
	do {
		const res = await s3.client.send(
			new ListObjectsV2Command({
				Bucket: s3.bucket,
				Prefix: prefix,
				MaxKeys: 1000,
				ContinuationToken: token,
			}),
		);
		for (const o of res.Contents || []) out.push(o);
		token = res.NextContinuationToken;
	} while (token);
	return out;
}

async function list(waw, containerId, imageId) {
	if (!containerId) {
		usage();
		return;
	}

	const s3 = makeClient(waw);

	const containerSlug = slugId(containerId);

	// if imageId passed -> list that image folder, else list whole container
	const prefix = imageId
		? `${containerSlug}/${slugId(imageId)}/`
		: `${containerSlug}/`;

	const items = await listAllObjects(s3, prefix);

	if (!items.length) {
		console.log("[cloudflare] empty:", prefix);
		return;
	}

	// If listing whole container -> group by imageId and show one URL per object
	if (!imageId) {
		console.log(`[cloudflare] ${items.length} object(s) under ${prefix}`);

		// Group: imageId -> [{key,size}]
		const grouped = new Map();

		for (const o of items) {
			const key = o.Key || "";
			const parts = key.split("/");
			// expected: container/imageId/...
			if (parts.length < 2) continue;
			if (parts[0] !== containerSlug) continue;

			const img = parts[1];
			if (!img) continue;

			if (!grouped.has(img)) grouped.set(img, []);
			grouped.get(img).push({
				key,
				size: o.Size,
			});
		}

		const imageIds = Array.from(grouped.keys()).sort();
		console.log(`[cloudflare] imageIds (${imageIds.length}):`);

		for (const img of imageIds) {
			console.log(`\n- ${img}`);
			const objs = grouped.get(img) || [];
			for (const it of objs) {
				const url = makePublicUrl(s3.publicBaseUrl, it.key);
				console.log(`  • ${it.key} (${it.size} bytes)`);
				console.log(
					`    url: ${url || "(no publicBaseUrl configured)"}`,
				);
			}
		}
		return;
	}

	// Listing one image folder -> print each object + url
	console.log(`[cloudflare] ${items.length} object(s) under ${prefix}`);
	for (const o of items) {
		const key = o.Key;
		const url = makePublicUrl(s3.publicBaseUrl, key);
		console.log(`- ${key} (${o.Size} bytes)`);
		console.log(`  url: ${url || "(no publicBaseUrl configured)"}`);
	}
}

// waw expects "cloudflare" export to be a FUNCTION
module.exports.cloudflare = async (waw) => {
	const sub = (waw?.argv?.[1] || "").toLowerCase();
	const containerId = waw?.argv?.[2];
	const imageId = waw?.argv?.[3];
	const localPath = waw?.argv?.[4];

	if (!sub || sub === "help" || sub === "-h" || sub === "--help") {
		usage();
		return;
	}

	if (sub === "upload") return upload(waw, containerId, imageId, localPath);
	if (sub === "list") return list(waw, containerId, imageId);

	usage();
};
