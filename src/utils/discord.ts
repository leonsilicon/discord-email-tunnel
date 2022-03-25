import { Client, Intents } from 'discord.js';
import onetime from 'onetime';

export const getDiscordBot = onetime(() => {
	const bot = new Client({
		intents: [
			Intents.FLAGS.DIRECT_MESSAGES,
			Intents.FLAGS.DIRECT_MESSAGE_REACTIONS,
			Intents.FLAGS.GUILDS,
			Intents.FLAGS.GUILD_MESSAGES,
		],
		partials: ['CHANNEL'],
	});

	return bot;
});
