import 'dotenv/config.js';
import * as process from 'node:process';
import type { Message, PartialMessage } from 'discord.js';
import { Client, Intents } from 'discord.js';
import schedule from 'node-schedule';
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

	const emailContents = messages.map((message) => message.content).join('\n');

	const usernames = messages.map((message) => message.author);

	const smtpTransport = await getSmtpTransport();

	await smtpTransport.sendMail({
		from: 'discord@leonzalion.com',
		text: emailContents,
		subject: `New message from ${usernames.join(', ')}`,
		to: 'leon@leonzalion.com',
	});
}

client.on('messageCreate', async (message) => {
	if (message.channel.type === 'DM' || message.mentions.has(client.user!)) {
		queuedMessages.set(message.id, message);
	}
});

client.on('messageDelete', async (message) => {
	queuedMessages.delete(message.id);
});

client.on('messageUpdate', async (message) => {
	queuedMessages.set(message.id, message);
});

client.on('ready', () => {
	console.log(`Logged in as ${client.user?.tag ?? 'unknown'}!`);

	schedule.scheduleJob('5 * * * *', async () => {
		await sendEmailUpdate();
	});
});

await client.login(process.env.DISCORD_TOKEN);
