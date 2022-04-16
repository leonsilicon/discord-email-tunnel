import * as process from 'node:process';
import type { Message } from '@google-cloud/pubsub';
import { PubSub } from '@google-cloud/pubsub';
import { getGmailClient } from './client.js';
import { GmailWebhookCallbackProps } from '~/types/email.js';

export async function setupGmailWebhook(
	callback: (props: GmailWebhookCallbackProps) => Promise<void>
) {
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

					callback({
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
