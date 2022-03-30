/* eslint-disable no-await-in-loop */

import * as process from 'node:process';
import { Buffer } from 'node:buffer';
import * as nodemailer from 'nodemailer';
import onetime from 'onetime';
import type { gmail_v1 } from 'googleapis';
import type { Message } from '@google-cloud/pubsub';
import { PubSub } from '@google-cloud/pubsub';
import * as cheerio from 'cheerio';
import { convert as convertHtmlToText } from 'html-to-text';
import { MessageAttachment } from 'discord.js';
import type {
	PartialMessage as DiscordPartialMessage,
	Message as DiscordMessage,
} from 'discord.js';
import xmlEscape from 'xml-escape';
import { outdent } from 'outdent';
import { getGmailClient } from '~/utils/google.js';
import { logDebug } from '~/utils/log.js';
import { getBotUser, getDiscordBot } from '~/utils/discord.js';

// Map from channel IDs to a message ID.
// This map contains the channel ID that corresponds with a particular user so that the emails are sent in replies
export const discordChannelToMessageIdMap = new Map<string, string>();

async function getEmailHtml(
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

export const getSmtpTransport = onetime(async () =>
	nodemailer.createTransport({
		auth: {
			clientId: process.env.GOOGLE_CLOUD_CLIENT_ID,
			clientSecret: process.env.GOOGLE_CLOUD_CLIENT_SECRET,
			refreshToken: process.env.GOOGLE_CLOUD_REFRESH_TOKEN,
			type: 'OAUTH2',
			user: 'admin@leonzalion.com',
		},
		service: 'gmail',
	})
);

export async function setupGmailWebhook() {
	const pubsub = new PubSub({
		credentials: {
			client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
			private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY.replace(/\\n/g, '\n'),
		},
		projectId: 'discord-email-tunnel',
	});

	const [topics] = await pubsub.getTopics();
	let topic = topics.find(
		(topic) =>
			topic.name === 'projects/discord-email-tunnel/topics/email-tunnel'
	)!;
	if (topic === undefined) {
		[topic] = await pubsub.createTopic('email-tunnel');
	}

	const [subscriptions] = await topic.getSubscriptions();
	let subscription = subscriptions.find(
		(subscription) =>
			subscription.name ===
			'projects/discord-email-tunnel/subscriptions/email-received'
	)!;
	if (subscription === undefined) {
		[subscription] = await topic.createSubscription('email-received');
	}

	const gmail = getGmailClient();

	const watchResponse = await gmail.users.watch({
		userId: 'admin@leonzalion.com',
		requestBody: { topicName: topic.name },
	});

	if (watchResponse.data.historyId === null) {
		throw new Error('watchResponse did not return a historyId.');
	}

	let lastHistoryId = watchResponse.data.historyId;

	subscription.on('message', async (message: Message) => {
		message.ack();

		const messagePayload = JSON.parse(message.data.toString()) as {
			emailAddress: string;
			historyId: number;
		};

		const startHistoryId = lastHistoryId;
		lastHistoryId = String(messagePayload.historyId);

		// https://stackoverflow.com/questions/42090593/gmail-watch-user-inbox-history-getmessagesadded-is-not-returning-the-new-messag
		const historyResponse = await gmail.users.history.list({
			userId: messagePayload.emailAddress,
			startHistoryId,
		});

		for (const historyEntry of historyResponse.data.history ?? []) {
			for (const addedMessage of historyEntry.messagesAdded ?? []) {
				const labelIds = addedMessage.message?.labelIds ?? undefined;

				if (labelIds === undefined) {
					continue;
				}

				// TODO: find a better way to detect a sent email
				if (labelIds.length === 1 && labelIds.includes('SENT')) {
					if (addedMessage.message?.id === undefined) continue;

					onEmailReply({
						emailAddress: messagePayload.emailAddress,
						message: addedMessage.message,
					}).catch((error) => {
						console.error(error);
					});
				}
			}
		}
	});
}

type OnEmailReplyProps = {
	message: gmail_v1.Schema$Message;
	emailAddress: string;
};

async function onEmailReply({ message, emailAddress }: OnEmailReplyProps) {
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

	const emailParts = messageResponse.data.payload?.parts ?? undefined;

	if (emailParts === undefined) {
		throw new Error('Email parts not found.');
	} else if (emailParts.length === 0) {
		throw new Error('Email does not contain any parts.');
	}

	const initialEmailHtml = await getEmailHtml(emailParts);

	const $ = cheerio.load(initialEmailHtml);
	$('.gmail_attr + blockquote').remove();
	$('.gmail_attr').remove();
	$('br').remove();

	const emailHtml = $.html({ decodeEntities: false });

	const emailText = convertHtmlToText($.html({ decodeEntities: false }), {
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

			const imageId =
				emailPart.headers?.find((header) => header.name === 'X-Attachment-Id')
					?.value ?? undefined;

			logDebug(() => `Email HTML: ${emailHtml}`);

			if (imageId === undefined || !emailHtml.includes(imageId)) {
				logDebug(() => `Image ID not found in HTML.`);
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

type SendMessageEmailUpdateProps = {
	message: DiscordMessage | DiscordPartialMessage;
	type: 'create' | 'delete' | 'update';
};

export async function sendMessageEmailUpdate({
	message,
	type,
}: SendMessageEmailUpdateProps) {
	const smtpTransport = await getSmtpTransport();

	const messageAuthor = message.author;

	const authorName = messageAuthor?.tag ?? 'Unknown User';

	let emailContent = outdent`
		<strong>
			From ${authorName}:
		</strong>
		<br />
	`;

	emailContent += xmlEscape(
		message.content?.replace(new RegExp(`^<@!${getBotUser().id}>`), '') ??
			'[Missing message content]'
	);

	if (message.attachments.size > 0) {
		emailContent += `
			<h1>Attachments</h1>
		`;

		for (const attachment of message.attachments.values()) {
			emailContent += `
				${xmlEscape(attachment.name ?? 'Unnamed attachment')}: <a href="${
				attachment.url
			}">${attachment.url}</a>
			`;
		}
	}

	if (type === 'create') {
		const replyMessageId = discordChannelToMessageIdMap.get(message.channelId);

		const messageAuthor = message.author;

		const authorName = messageAuthor?.tag ?? 'Unknown User';

		const { channel } = message;

		let emailSubject: string;
		if (channel.type === 'GUILD_TEXT') {
			emailSubject = `New Discord message from ${authorName} in #${channel.name} of ${channel.guild.name}`;
		} else if (channel.type === 'DM') {
			emailSubject = `New Discord message from ${authorName} in DMs`;
		} else {
			emailSubject = `New Discord message from ${authorName}`;
		}

		const sentMessageInfo = await smtpTransport.sendMail({
			inReplyTo: replyMessageId,
			references: replyMessageId,
			from: 'admin@leonzalion.com',
			replyTo: `discord-email-tunnel+${message.channelId}-${message.id}@leonzalion.com`,
			html: emailContent,
			subject: emailSubject,
			to: 'leon@leonzalion.com',
		});

		discordChannelToMessageIdMap.set(
			message.channelId,
			sentMessageInfo.messageId
		);
	}
}
