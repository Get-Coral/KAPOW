import { createHash } from "node:crypto";
import { getRequest, getRequestHeader, getRequestIP } from "@tanstack/react-start/server";

export function getFingerprint() {
	const request = getRequest();
	const sessionId = getRequestHeader("x-kapow-session");
	const userAgent = request.headers.get("user-agent") ?? "unknown";
	const ip = getRequestIP({ xForwardedFor: true }) ?? "unknown";
	const source = sessionId ? `session:${sessionId}` : `ip:${ip}:${userAgent}`;

	return createHash("sha256").update(source).digest("hex");
}
