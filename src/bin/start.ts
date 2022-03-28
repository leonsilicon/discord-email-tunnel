import 'dotenv/config.js';
import * as process from 'node:process';
import type { Message, PartialMessage } from 'discord.js';
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
				attachment.proxyURL
			}">${attachment.proxyURL}</a>
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

bot.on('messageCreate', async (message) => {
	if (message.author.id === '546885051334524949') return;
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
	const user = getBotUser();

	console.info(`Logged in as ${user.tag ?? 'unknown'}!`);

	await user.setUsername('LeonS');
});

await bot.login(process.env.DISCORD_TOKEN);
