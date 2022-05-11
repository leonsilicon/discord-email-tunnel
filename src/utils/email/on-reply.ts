import * as cheerio from 'cheerio';
import type { Message as DiscordMessage } from 'discord.js';
import { MessageAttachment } from 'discord.js';
import type { gmail_v1 } from 'googleapis';
import { convert as convertHtmlToText } from 'html-to-text';
import { Buffer } from 'node:buffer';

import type { GmailWebhookCallbackProps } from '~/types/email.js';
import { getDiscordBot } from '~/utils/discord.js';
import { getGmailClient } from '~/utils/email/client.js';
import { getEmailHtml } from '~/utils/email/html.js';
import { logDebug } from '~/utils/log.js';

/**
	Called when the user replies to an email that was sent by discord-email-tunnel
 */
export async function onEmailReply({
	message,
	emailAddress,
}: GmailWebhookCallbackProps) {
	logDebug(() => 'Handling mail reply...');

	const bot = getDiscordBot();
	const gmail = getGmailClient();

	if (message.id === undefined || message.id === null) {
		throw new Error(
			`Message ID not found in message ${JSON.stringify(message)}`
		);
	}

	const messageResponse = await gmail.users.messages.get({
		userId: emailAddress,
		id: message.id,
	});

	let emailParts = messageResponse.data.payload?.parts ?? undefined;

	if (emailParts === undefined) {
		const emailPart = messageResponse.data.payload;
		if (emailPart === undefined) {
			throw new Error('Email parts not found.');
		}

		emailParts = [emailPart];
	} else if (emailParts.length === 0) {
		throw new Error('Email does not contain any parts.');
	}

	// `emailParts` may be circular
	logDebug(() => `Email parts: ${JSON.stringify(emailParts)}`);

	let emailHtml = await getEmailHtml(emailParts);

	let emailText: string;
	if (emailHtml === undefined) {
		emailText = '';
	} else {
		const $ = cheerio.load(emailHtml);

		// TODO: find better way to remove ending blockquote

		// Remove quoted blockquote section from Gmail
		$('.gmail_attr + blockquote').remove();
		$('.gmail_attr').remove();

		// Remove quoted blockquote section from Apple Mail
		$('blockquote[type="cite"]').remove();

		// Remove all <br> elements from the message (Gmail quirk)
		$('br').remove();

		emailHtml = $.html({ decodeEntities: false });

		logDebug(() => `Email HTML: ${emailHtml!}`);

		emailText = convertHtmlToText($.html({ decodeEntities: false }), {
			selectors: [
				{
					selector: 'blockquote',
					options: {
						leadingLineBreaks: 1,
						trailingLineBreaks: 1,
					},
				},
			],
		});
	}

	const attachments: MessageAttachment[] = [];

	async function handleEmailPart({
		messageId,
		emailPart,
		emailAddress,
	}: {
		emailAddress: string;
		messageId: string;
		emailPart: gmail_v1.Schema$MessagePart;
	}) {
		const mimeType = emailPart.mimeType ?? undefined;
		if (mimeType === undefined) return;

		if (mimeType === 'multipart/alternative') {
			if (emailPart.parts === undefined) return;
			for (const part of emailPart.parts) {
				// eslint-disable-next-line no-await-in-loop
				await handleEmailPart({ emailPart: part, messageId, emailAddress });
			}
		} else {
			const emailPartBody = emailPart.body ?? undefined;
			if (emailPartBody === undefined) {
				logDebug(() => `Email part body was undefined.`);
				return;
			}

			const filename = emailPart.filename ?? undefined;
			if (filename === undefined) {
				logDebug(() => `Filename was undefined.`);
				return;
			}

			const emailPartBodyAttachmentId = emailPartBody.attachmentId ?? undefined;
			if (emailPartBodyAttachmentId === undefined) {
				logDebug(() => `Email part body attachment ID was undefined.`);
				return;
			}

			const attachment = await gmail.users.messages.attachments.get({
				id: emailPartBodyAttachmentId,
				messageId,
				userId: emailAddress,
			});

			const attachmentBase64 = attachment.data.data ?? undefined;
			if (attachmentBase64 === undefined) {
				logDebug(() => `base64 of attachment data not found.`);
				return;
			}

			attachments.push(
				new MessageAttachment(Buffer.from(attachmentBase64, 'base64'), filename)
			);
		}
	}

	for (const emailPart of emailParts) {
		// eslint-disable-next-line no-await-in-loop
		await handleEmailPart({ emailAddress, emailPart, messageId: message.id });
	}

	const destinationEmailAddress = messageResponse.data.payload?.headers?.find(
		(header) => header.name === 'To'
	)?.value;

	if (destinationEmailAddress === undefined) {
		throw new Error('Destination email address not found.');
	}

	const plusAddressMatches =
		destinationEmailAddress?.match(/\+(\w+)-(\w+)@/) ?? undefined;

	if (plusAddressMatches === undefined) {
		throw new Error('Email address does not match expected regex.');
	}

	const channelId = plusAddressMatches[1];
	const messageId = plusAddressMatches[2];

	if (channelId === undefined || messageId === undefined) {
		throw new Error(
			'Channel ID or message ID not found in destination email address.'
		);
	}

	const channel = await bot.channels.fetch(channelId);

	if (channel === null) {
		throw new Error(`Channel with ID ${channelId} not found.`);
	}

	if (!channel.isText()) {
		throw new Error(`Channel with ID ${channelId} is not a text channel.`);
	}

	let channelMessage: DiscordMessage | undefined;
	try {
		channelMessage = await channel.messages.fetch(messageId);
	} catch {
		channelMessage = undefined;
	}

	await channel.send({
		files: attachments,
		content: /^\s*$/.test(emailText) ? '[no message]' : emailText,
		reply:
			channelMessage === undefined
				? undefined
				: {
						messageReference: channelMessage,
				  },
	});
}
