import type { Message, PartialMessage } from 'discord.js';
import 'dotenv/config.js';
import * as process from 'node:process';
import onetime from 'onetime';
import xmlEscape from 'xml-escape';
import { getDiscordBot } from '~/utils/discord.js';
import { getSmtpTransport, setupGmailWebhook } from '~/utils/email.js';

await setupGmailWebhook();
const bot = getDiscordBot();

const getBotUser = onetime(() => {
	if (bot.user === null) {
		throw new Error('Bot has not been initialized.');
	}

	return bot.user;
});

type SendMessageEmailUpdateProps = {
	message: Message | PartialMessage;
	type: 'create' | 'delete' | 'update';
};

async function sendMessageEmailUpdate({
	message,
	type,
}: SendMessageEmailUpdateProps) {
	const smtpTransport = await getSmtpTransport();

	let emailContent = xmlEscape(
		message.content?.replace(new RegExp(`^<@!${getBotUser().id}>`), '') ??
			'[Empty message]'
	);

	if (message.attachments.size > 0) {
		emailContent += `
			<h1>Attachments</h1>
		`;

		for (const attachment of message.attachments.values()) {
			emailContent += `
				${xmlEscape(attachment.name ?? 'Unnamed attachment')}: <a href="${
				attachment.url
			}">${attachment.url}</a>
			`;
		}
	}

	if (type === 'create') {
		await smtpTransport.sendMail({
			from: 'admin@leonzalion.com',
			replyTo: `discord-email-tunnel+${message.channelId}-${message.id}@leonzalion.com`,
			html: emailContent,
			subject: `New message from ${message.author!.username}`,
			to: 'leon@leonzalion.com',
		});
	}
}

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
	const user = getBotUser();
	if (message.author.id === user.id) return;

	if (message.channel.type === 'DM' || message.mentions.has(getBotUser())) {
		await sendMessageEmailUpdate({ message, type: 'create' });
	}
});

bot.on('messageDelete', async (message) => {
	if (message.channel.type === 'DM' || message.mentions.has(getBotUser())) {
		await sendMessageEmailUpdate({ message, type: 'delete' });
	}
});

bot.on('messageUpdate', async (message) => {
	if (message.channel.type === 'DM' || message.mentions.has(getBotUser())) {
		await sendMessageEmailUpdate({ message, type: 'update' });
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
