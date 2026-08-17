import crypto from "node:crypto";
import https from "node:https";

function hmacSha256(key, data) {
	return crypto.createHmac("sha256", key).update(data, "utf8").digest();
}

function sha256Hex(data) {
	return crypto.createHash("sha256").update(data).digest("hex");
}

function getSignatureKey(key, dateStamp, regionName, serviceName) {
	const kDate = hmacSha256("AWS4" + key, dateStamp);
	const kRegion = hmacSha256(kDate, regionName);
	const kService = hmacSha256(kRegion, serviceName);
	return hmacSha256(kService, "aws4_request");
}

/**
 * Upload image buffer to Cloudflare R2 and return the public URL
 */
export async function uploadImageToR2(config, data, mimeType, altText) {
	const accountId = (config.accountId || "").trim();
	const accessKeyId = (config.accessKeyId || "").trim();
	const secretAccessKey = (config.secretAccessKey || "").trim();
	const bucket = (config.bucket || "").trim();
	let publicDomain = (config.publicDomain || "").trim();
	const pathPrefix = (config.pathPrefix || "").trim().replace(/^\/+|\/+$/g, "");

	if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
		throw new Error("Missing R2 credentials: accountId, accessKeyId, secretAccessKey, and bucket are required");
	}

	const extMap = {
		"image/png": ".png",
		"image/jpeg": ".jpg",
		"image/jpg": ".jpg",
		"image/gif": ".gif",
		"image/webp": ".webp",
		"image/svg+xml": ".svg",
		"image/bmp": ".bmp",
	};
	const ext = extMap[mimeType] || ".png";
	const md5Hash = crypto.createHash("md5").update(data).digest("hex").slice(0, 10);
	const filename = `${md5Hash}${ext}`;
	const objectKey = pathPrefix ? `${pathPrefix}/${filename}` : filename;

	// S3 SigV4 variables
	const host = `${bucket}.${accountId}.r2.cloudflarestorage.com`;
	const region = "auto";
	const service = "s3";
	const now = new Date();
	const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
	const dateStamp = amzDate.slice(0, 8);

	const canonicalUri = "/" + encodeURI(objectKey).replace(/#/g, "%23");
	const canonicalQueryString = "";
	const payloadHash = sha256Hex(data);

	const canonicalHeaders = `host:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
	const signedHeaders = "host;x-amz-content-sha256;x-amz-date";

	const canonicalRequest = ["PUT", canonicalUri, canonicalQueryString, canonicalHeaders, signedHeaders, payloadHash].join("\n");

	const algorithm = "AWS4-HMAC-SHA256";
	const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
	const stringToSign = [algorithm, amzDate, credentialScope, sha256Hex(canonicalRequest)].join("\n");

	const signingKey = getSignatureKey(secretAccessKey, dateStamp, region, service);
	const signature = hmacSha256(signingKey, stringToSign).toString("hex");

	const authorizationHeader = `${algorithm} Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

	await new Promise((resolve, reject) => {
		const req = https.request(
			{
				hostname: host,
				path: canonicalUri,
				method: "PUT",
				headers: {
					Host: host,
					"Content-Type": mimeType,
					"Content-Length": data.byteLength,
					"x-amz-date": amzDate,
					"x-amz-content-sha256": payloadHash,
					Authorization: authorizationHeader,
				},
				timeout: 30000,
			},
			(res) => {
				let responseBody = "";
				res.on("data", (chunk) => (responseBody += chunk));
				res.on("end", () => {
					if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
						resolve();
					} else {
						reject(new Error(`R2 Upload failed HTTP ${res.statusCode}: ${responseBody.slice(0, 200)}`));
					}
				});
			},
		);

		req.on("error", (err) => reject(new Error(`R2 Network Error: ${err.message}`)));
		req.on("timeout", () => {
			req.destroy();
			reject(new Error("R2 Upload timed out (30s)"));
		});

		req.write(Buffer.from(data));
		req.end();
	});

	if (publicDomain) {
		if (!publicDomain.startsWith("http://") && !publicDomain.startsWith("https://")) {
			publicDomain = "https://" + publicDomain;
		}
		publicDomain = publicDomain.replace(/\/+$/, "");
		return `${publicDomain}/${objectKey}`;
	}

	return `https://${bucket}.${accountId}.r2.cloudflarestorage.com/${objectKey}`;
}
