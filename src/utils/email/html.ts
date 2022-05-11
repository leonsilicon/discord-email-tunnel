import type { gmail_v1 } from 'googleapis';
import { Buffer } from 'node:buffer';

export async function getEmailHtml(
	emailParts: gmail_v1.Schema$MessagePart[]
): Promise<string | undefined> {
	// First find email HTML
	function checkEmailPart(
		emailPart: gmail_v1.Schema$MessagePart
	): string | undefined {
		if (emailPart.mimeType === 'text/html') {
			const emailHtmlBase64 = emailPart?.body?.data ?? undefined;

			if (emailHtmlBase64 === undefined) {
				throw new Error('HTML part does not contain the email data.');
			}

			return Buffer.from(emailHtmlBase64, 'base64').toString();
		}

		for (const part of emailPart.parts ?? []) {
			const result = checkEmailPart(part);
			if (result !== undefined) return result;
		}
	}

	for (const emailPart of emailParts) {
		const result = checkEmailPart(emailPart);
		if (result !== undefined) return result;
	}

	// Email may not have an HTML part, so in the case that none is found, return undefined
	return undefined;
}
