import { gmail_v1 } from 'googleapis';

export async function getEmailHtml(
	emailParts: gmail_v1.Schema$MessagePart[]
): Promise<string> {
	// First find email HTML
	async function checkEmailPart(
		emailPart: gmail_v1.Schema$MessagePart
	): Promise<string | undefined> {
		if (emailPart.mimeType === 'text/html') {
			const emailHtmlBase64 = emailPart?.body?.data ?? undefined;

			if (emailHtmlBase64 === undefined) {
				throw new Error('HTML part does not contain the email data.');
			}

			return Buffer.from(emailHtmlBase64, 'base64').toString();
		}

		for (const part of emailPart.parts ?? []) {
			const result = await checkEmailPart(part);
			if (result !== undefined) return result;
		}
	}

	for (const emailPart of emailParts) {
		const result = await checkEmailPart(emailPart);
		if (result !== undefined) return result;
	}

	throw new Error('Email HTML part not found.');
}
