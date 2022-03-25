import 'dotenv/config.js';
import * as process from 'node:process';
import type { Message, PartialMessage } from 'discord.js';
import { Client, Intents } from 'discord.js';
import onetime from 'onetime';
import xmlEscape from 'xml-escape';
import { getSmtpTransport, setupGmailWebhook } from '~/utils/email.js';

await setupGmailWebhook();

const bot = new Client({
	intents: [
		Intents.FLAGS.DIRECT_MESSAGES,
		Intents.FLAGS.DIRECT_MESSAGE_REACTIONS,
		Intents.FLAGS.GUILDS,
		Intents.FLAGS.GUILD_MESSAGES,
	],
	partials: ['CHANNEL'],
});

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
		message.content?.replace(new RegExp(`^<@${getBotUser().id}>`), '') ??
			'[Empty message]'
	);

	if (message.attachments.size > 0) {
		emailContent += `
			<h1>Attachments</h1>
		`;

		for (const attachment of message.attachments.values()) {
			emailContent += `
				${xmlEscape(attachment.name ?? 'Unnamed attachment')}: <a href="${
				attachment.proxyURL
			}">${attachment.proxyURL}</a>
			`;
		}
	}

	if (type === 'create') {
		await smtpTransport.sendMail({
			from: 'admin@leonzalion.com',
			replyTo: 'discord@leonzalion.com',
			html: emailContent,
			subject: `New message from ${message.author!.username}`,
			to: 'leon@leonzalion.com',
		});
	}
}

bot.on('messageCreate', async (message) => {
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
	console.log(`Logged in as ${getBotUser().tag ?? 'unknown'}!`);

	await getBotUser().setUsername('LeonS');
});

await bot.login(process.env.DISCORD_TOKEN);
