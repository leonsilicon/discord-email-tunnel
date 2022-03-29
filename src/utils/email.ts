/* eslint-disable no-await-in-loop */

import * as process from 'node:process';
import * as path from 'node:path';
import { Buffer } from 'node:buffer';
import * as nodemailer from 'nodemailer';
import onetime from 'onetime';
import type { gmail_v1 } from 'googleapis';
import type { Message } from '@google-cloud/pubsub';
import { PubSub } from '@google-cloud/pubsub';
import { getProjectDir } from 'lion-system';
import * as cheerio from 'cheerio';
import { convert as convertHtmlToText } from 'html-to-text';
import { MessageAttachment } from 'discord.js';
import { getDiscordBot } from '~/utils/discord.js';
import { getGmailClient } from '~/utils/google.js';
import { logDebug } from '~/utils/log.js';

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
	const projectDir = getProjectDir(import.meta.url);

	const keyFile = path.join(projectDir, 'service-account-file.json');
	const pubsub = new PubSub({
		keyFile,
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

	const emailHtml = await getEmailHtml(emailParts);
	const $ = cheerio.load(emailHtml);
	$('.gmail_quote').remove();
	$('br').remove();
	const emailText = convertHtmlToText($.html({ decodeEntities: false }));
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

			if (imageId === undefined || emailHtml.includes(imageId)) {
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

	const channelMessage = await channel.messages.fetch(messageId);

	await channel.send({
		files: attachments,
		content: /^\s*$/.test(emailText) ? '[no message]' : emailText,
		reply: {
			messageReference: channelMessage,
		},
	});
}
