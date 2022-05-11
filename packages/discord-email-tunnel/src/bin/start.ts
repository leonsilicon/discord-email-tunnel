import 'dotenv/config.js';

import process from 'node:process';

import { getBotUser, getDiscordBot } from '~/utils/discord.js';
import { onEmailReply } from '~/utils/email/on-reply.js';
import { sendEmailAboutDiscordMessage } from '~/utils/email/send.js';
import { setupGmailWebhook } from '~/utils/email/webhook.js';

await setupGmailWebhook(onEmailReply);

const bot = getDiscordBot();

bot.on('interactionCreate', async (interaction) => {
	if (interaction.isCommand() && interaction.commandName === 'dm') {
		await interaction.user.send(
			"Hey! I'm an email tunnel for Leon; if you want to send something to his email through Discord, just send a message (optionally with attachments!) in this DM. When Leon replies, I'll notify you in this DM as well!"
		);

		await interaction.reply({
			ephemeral: true,
			content: 'Successfully sent DM!',
		});
	}
});

bot.on('messageCreate', async (message) => {
	// Automatically delete messages in the #bot-commands channel
	try {
		if (message.channelId === '958414884079566869') {
			await message.delete();
			return;
		}
	} catch {}

	const user = getBotUser();

	if (message.author.id === user.id) return;

	if (message.channel.type === 'DM' || message.mentions.has(getBotUser())) {
		await sendEmailAboutDiscordMessage({ message, type: 'create' });
	}
});

bot.on('messageDelete', async (message) => {
	if (message.channel.type === 'DM' || message.mentions.has(getBotUser())) {
		await sendEmailAboutDiscordMessage({ message, type: 'delete' });
	}
});

bot.on('messageUpdate', async (message) => {
	if (message.channel.type === 'DM' || message.mentions.has(getBotUser())) {
		await sendEmailAboutDiscordMessage({ message, type: 'update' });
	}
});

bot.on('ready', async () => {
	const application = bot.application ?? undefined;
	if (application === undefined) {
		throw new Error('Bot application is undefined.');
	}

	await application.commands.create({
		name: 'dm',
		description: 'Receive a DM from the bot.',
	});

	const user = getBotUser();

	console.info(`Logged in as ${user.tag ?? 'unknown'}!`);

	await user.setUsername('LeonS');
});

await bot.login(process.env.DISCORD_TOKEN);

// Prevent unhandled rejections from crashing the Discord bot
process.on('unhandledRejection', (error) => {
	console.error(error);
});

process.on('uncaughtException', (error) => {
	console.error(error);
});
