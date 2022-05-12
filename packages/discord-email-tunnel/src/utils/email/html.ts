import * as cheerio from 'cheerio';
import type { gmail_v1 } from 'googleapis';
import { Buffer } from 'node:buffer';

import { debug } from '~/utils/debug.js';

export async function getOriginalEmailHtml(
	emailParts: gmail_v1.Schema$MessagePart[]
): Promise<string | undefined> {
	// First find email HTML
	function checkEmailPartHtml(
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
			const result = checkEmailPartHtml(part);
			if (result !== undefined) {
				return result;
			}
		}
	}

	function checkEmailPartPlainText(
		emailPart: gmail_v1.Schema$MessagePart
	): string | undefined {
		if (emailPart.mimeType === 'text/plain') {
			const emailTextBase64 = emailPart?.body?.data ?? undefined;

			if (emailTextBase64 === undefined) {
				throw new Error('Plain text part does not contain the email data.');
			}

			return Buffer.from(emailTextBase64, 'base64').toString();
		}

		for (const part of emailPart.parts ?? []) {
			const result = checkEmailPartPlainText(part);
			if (result !== undefined) {
				return result;
			}
		}
	}

	for (const emailPart of emailParts) {
		const htmlResult = checkEmailPartHtml(emailPart);
		if (htmlResult !== undefined) {
			return htmlResult;
		}
	}

	debug(
		() => `\`text/html\` part not found in email, using \`text/plain\` instead`
	);

	for (const emailPart of emailParts) {
		// If the html part is not found, check for a text/plain part as a fallback
		const plainTextResult = checkEmailPartPlainText(emailPart);
		if (plainTextResult !== undefined) {
			return plainTextResult;
		}
	}

	// Email may not have an HTML part, so in the case that none is found, return undefined
	return undefined;
}

export function cleanEmailHtml({
	originalEmailHtml,
}: {
	originalEmailHtml: string;
}): string {
	const $ = cheerio.load(originalEmailHtml);

	// TODO: find better way to remove ending blockquote

	// Remove quoted blockquote section from Gmail
	$('.gmail_attr + blockquote').remove();
	$('.gmail_attr').remove();

	// Remove quoted blockquote section from Apple Mail
	$('blockquote[type="cite"]').remove();

	// Remove all <br> elements from the message (Gmail quirk)
	$('br').remove();

	return $.html({ decodeEntities: false });
}
