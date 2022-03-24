import 'dotenv/config.js';
import * as process from 'node:process';
import { Client, Intents } from 'discord.js';

const client = new Client({
	intents: [
		Intents.FLAGS.DIRECT_MESSAGES,
		Intents.FLAGS.DIRECT_MESSAGE_REACTIONS,
		Intents.FLAGS.GUILDS,
		Intents.FLAGS.GUILD_MESSAGES,
	],
});

client.on('messageCreate', (message) => {
	console.log(message.content);
});

client.on('ready', () => {
	console.log(`Logged in as ${client.user.tag}!`);
});

await client.login(process.env.DISCORD_TOKEN);
