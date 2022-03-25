import * as process from 'node:process';
import * as nodemailer from 'nodemailer';
import onetime from 'onetime';
import { google } from 'googleapis';
import { PubSub } from '@google-cloud/pubsub';

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
	const oauth2Client = new google.auth.OAuth2(
		process.env.GOOGLE_CLOUD_CLIENT_ID,
		process.env.GOOGLE_CLOUD_CLIENT_SECRET,
		'https://developers.google.com/oauthplayground'
	);

	oauth2Client.setCredentials({
		refresh_token: process.env.GOOGLE_CLOUD_REFRESH_TOKEN,
	});

	const pubSubClient = new PubSub();

	const topicName = 'projects/discord-email-tunnel/topics/email-tunnel';
	const subscriptionName =
		'projects/discord-email-tunnel/subscriptions/email-received';

	const pubsub = google.pubsub({
		version: 'v1',
		auth: oauth2Client,
	});

	const response = await pubsub.projects.topics.list({
		project: 'projects/discord-email-tunnel',
	});

	if (!response.data.topics?.some((topic) => topic.name === topicName)) {
		await pubsub.projects.topics.create({
			name: topicName,
		});

		await pubsub.projects.subscriptions.create({
			name: subscriptionName,
			requestBody: {
				topic: topicName,
			},
		});
	}

	await google
		.gmail({
			version: 'v1',
			auth: oauth2Client,
		})
		.users.watch({
			userId: 'admin@leonzalion.com',
			requestBody: { topicName },
		});

	const subscription = pubSubClient.subscription(subscriptionName);
	subscription.on('message', (message) => {
		console.log(message);
	});
}
