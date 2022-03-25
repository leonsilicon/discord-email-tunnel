import 'dotenv/config.js';
import * as process from 'node:process';
import { Client, Intents } from 'discord.js';
import { getSmtpTransport } from '~/utils/email.js';

const client = new Client({
	intents: [
		Intents.FLAGS.DIRECT_MESSAGES,
		Intents.FLAGS.DIRECT_MESSAGE_REACTIONS,
		Intents.FLAGS.GUILDS,
		Intents.FLAGS.GUILD_MESSAGES,
	],
});

client.on('messageCreate', async (message) => {
	const smtpTransport = await getSmtpTransport();

	await smtpTransport.sendMail({
		from: 'discord@leonzalion.com',
		text: message.content,
		subject: `New message from ${message.author.username}`,
		to: 'leon@leonzalion.com',
	});
});

client.on('ready', () => {
	console.log(`Logged in as ${client.user.tag}!`);
});

await client.login(process.env.DISCORD_TOKEN);
