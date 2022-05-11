import type { MessageOptions, MessagePayload } from 'discord.js';

import { getDiscordBot } from '~/utils/discord.js';

type MessageQueueEntry = {
	channelId: string;
	message: string | MessagePayload | MessageOptions;
};
const messageQueue: MessageQueueEntry[] = [];

async function sendQueueMessages() {
	const bot = getDiscordBot();

	for (const { message, channelId } of messageQueue) {
		// eslint-disable-next-line no-await-in-loop
		const channel = await bot.channels.fetch(channelId);

		if (channel === null) {
			throw new Error(`Channel with ID ${channelId} not found.`);
		}

		if (!channel.isText()) {
			throw new Error(`Channel with ID ${channelId} is not a text channel.`);
		}

		// eslint-disable-next-line no-await-in-loop
		await channel.send(message);
	}
}

let queueInterval: NodeJS.Timer | undefined;
/**
	Currently unused.
*/
export async function addMessageToQueue(entry: MessageQueueEntry) {
	messageQueue.push(entry);

	if (queueInterval === undefined) {
		queueInterval = setInterval(
			async () => {
				await sendQueueMessages();
			},
			// Only send messages every 2 minutes
			2 * 60 * 1000
		);
	}
}
