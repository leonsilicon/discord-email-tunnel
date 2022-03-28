import * as process from 'node:process';
import * as path from 'node:path';
import * as util from 'node:util';
import { Buffer } from 'node:buffer';
import * as nodemailer from 'nodemailer';
import onetime from 'onetime';
import { google } from 'googleapis';
import type { Message } from '@google-cloud/pubsub';
import { PubSub } from '@google-cloud/pubsub';
import { getProjectDir } from 'lion-system';
import { getDiscordBot } from '~/utils/discord.js';

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

	const oauth2Client = new google.auth.OAuth2({
		clientId: process.env.GOOGLE_CLOUD_CLIENT_ID,
		clientSecret: process.env.GOOGLE_CLOUD_CLIENT_SECRET,
		redirectUri: 'https://developers.google.com/oauthplayground',
	});

	oauth2Client.setCredentials({
		refresh_token: process.env.GOOGLE_CLOUD_REFRESH_TOKEN,
	});

	const gmail = google.gmail({ auth: oauth2Client, version: 'v1' });

	const watchResponse = await gmail.users.watch({
		userId: 'admin@leonzalion.com',
		requestBody: { topicName: topic.name },
	});

	if (watchResponse.data.historyId === null) {
		throw new Error('watchResponse did not return a historyId.');
	}

	let lastHistoryId = watchResponse.data.historyId;

	subscription.on('message', async (message: Message) => {
		const payload = JSON.parse(message.data.toString()) as {
			emailAddress: string;
			historyId: number;
		};

		const startHistoryId = lastHistoryId;
		lastHistoryId = String(payload.historyId);

		// https://stackoverflow.com/questions/42090593/gmail-watch-user-inbox-history-getmessagesadded-is-not-returning-the-new-messag
		const historyResponse = await gmail.users.history.list({
			userId: payload.emailAddress,
			startHistoryId,
		});

		const messageId =
			historyResponse.data.history?.[0]?.messagesAdded?.[0]?.message?.id;

		if (messageId !== undefined && messageId !== null) {
			console.log(messageId);

			try {
				const message = await gmail.users.messages.get({
					userId: payload.emailAddress,
					id: messageId,
				});

				console.log(util.inspect(message, false, Number.POSITIVE_INFINITY, true));
				const messagePayload = message.data.payload;
				const data = messagePayload?.body?.data;
				if (data !== null && data !== undefined) {
					console.log('message:', Buffer.from(data, 'base64').toString());
				}
			} catch (error: unknown) {
				console.error(error);
			}
		}

		message.ack();
	});
}

async function onEmailSent() {
	const bot = getDiscordBot();
	const channel = await bot.channels.fetch('');
}
