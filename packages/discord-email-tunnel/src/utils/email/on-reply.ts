import type { MessageAttachment } from 'discord.js';

import type { GmailWebhookCallbackProps } from '~/types/email.js';
import { debug } from '~/utils/debug.js';
import { parseDiscordEmailTunnelEmailAddress } from '~/utils/email/address.js';
import { getAttachmentsFromEmailPart } from '~/utils/email/attachments.js';
import { getGmailClient } from '~/utils/email/client.js';
import { cleanEmailHtml, getOriginalEmailHtml } from '~/utils/email/html.js';
import { getEmailText } from '~/utils/email/text.js';

/**
	A cached set of email message IDs so that we prevent double-sending of messages
*/
const messageIdCache = new Set<string>();

/**
	Called when the user replies to an email that was sent by discord-email-tunnel
 */
export async function onEmailReply({
	message,
	emailAddress,
}: GmailWebhookCallbackProps) {
	if (message.id === null || message.id === undefined) {
		throw new Error(
			`Message ID not found in message ${JSON.stringify(message)}.`
		);
	}

	if (messageIdCache.has(message.id)) {
		console.error(
			`Message with ID ${message.id} has already been processed. Skipping.`
		);
		return;
	}

	debug(() => 'Handling mail reply...');

	const gmail = getGmailClient();

	const messageResponse = await gmail.users.messages.get({
		userId: emailAddress,
		id: message.id,
	});

	let emailParts = messageResponse.data.payload?.parts ?? undefined;

	/**
		If the email payload doesn't have multiple parts, it probably just only has one part that is represented by the `payload` property directly
	 */
	if (emailParts === undefined) {
		const emailPart = messageResponse.data.payload;
		if (emailPart === undefined) {
			throw new Error('Email parts not found.');
		}

		emailParts = [emailPart];
	} else if (emailParts.length === 0) {
		throw new Error('Email does not contain any parts.');
	}

	debug((f) => f`Email parts: ${emailParts}`);

	const originalEmailHtml = await getOriginalEmailHtml(emailParts);
	const cleanHtml =
		originalEmailHtml === undefined
			? undefined
			: cleanEmailHtml({ originalEmailHtml });
	const emailText = getEmailText({ cleanEmailHtml: cleanHtml });

	const attachments: MessageAttachment[] = [];

	for (const emailPart of emailParts) {
		// eslint-disable-next-line no-await-in-loop
		const partAttachments = await getAttachmentsFromEmailPart({
			emailAddress,
			emailPart,
			messageId: message.id,
		});
		if (partAttachments !== undefined) {
			attachments.push(...partAttachments);
		}
	}

	const destinationEmailAddress = messageResponse.data.payload?.headers?.find(
		(header) => header.name === 'To'
	)?.value;

	if (
		destinationEmailAddress === undefined ||
		destinationEmailAddress === null
	) {
		throw new Error('Destination email address not found.');
	}

	const { channel, replyMessage } = await parseDiscordEmailTunnelEmailAddress({
		destinationEmailAddress,
	});

	await channel.send({
		files: attachments,
		content: /^\s*$/.test(emailText) ? '[no message]' : emailText,
		reply:
			replyMessage === undefined
				? undefined
				: {
						messageReference: replyMessage,
				  },
	});
}
