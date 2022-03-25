import 'dotenv/config.js';
import * as process from 'node:process';
import type { Message, PartialMessage, User } from 'discord.js';
import { Client, Intents } from 'discord.js';
import schedule from 'node-schedule';
import arrayUnique from 'array-uniq';
import { getSmtpTransport } from '~/utils/email.js';

const client = new Client({
	intents: [
		Intents.FLAGS.DIRECT_MESSAGES,
		Intents.FLAGS.DIRECT_MESSAGE_REACTIONS,
		Intents.FLAGS.GUILDS,
		Intents.FLAGS.GUILD_MESSAGES,
	],
	partials: ['CHANNEL'],
});

/**
 * Map of message ID to message
 */
const queuedMessages = new Map<string, Message | PartialMessage>();

// Only sends email updates about messages every 5 minutes
async function sendEmailUpdate() {
	const messages = [...queuedMessages.values()];
	queuedMessages.clear();

	if (messages.length === 0) return;

	const usersMap = Object.fromEntries(
		messages.map((message) => [message.author?.id, message.author])
	) as Record<string, User>;

	const userIds = arrayUnique(messages.map((message) => message.author!.id));

	const smtpTransport = await getSmtpTransport();
	await Promise.all(
		userIds.map(async (userId) => {
			const emailContents = messages
				.map((message) => message.content)
				.join('\n');

			await smtpTransport.sendMail({
				from: 'discord@leonzalion.com',
				text: emailContents,
				subject: `New message from ${usersMap[userId]!.username}`,
				to: 'leon@leonzalion.com',
			});
		})
	);
}

function addQueuedMessage(message: Message | PartialMessage) {
	console.log(`added message ${message.content!} to queue`);
	queuedMessages.set(message.id, message);
}

client.on('messageCreate', async (message) => {
	if (
		message.author.id === '553740418865561631' &&
		message.content === '!send'
	) {
		await sendEmailUpdate();
		await message.channel.send('Email update sent.');
		return;
	}

	if (message.channel.type === 'DM' || message.mentions.has(client.user!)) {
		addQueuedMessage(message);
	}
});

client.on('messageDelete', async (message) => {
	queuedMessages.delete(message.id);
});

client.on('messageUpdate', async (message) => {
	addQueuedMessage(message);
});

client.on('ready', async () => {
	console.log(`Logged in as ${client.user?.tag ?? 'unknown'}!`);

	await client.user!.setUsername('LeonS');

	schedule.scheduleJob('5 * * * *', async () => {
		await sendEmailUpdate();
	});
});

await client.login(process.env.DISCORD_TOKEN);
