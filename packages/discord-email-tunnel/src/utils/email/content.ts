import type {
	Message as DiscordMessage,
	PartialMessage as DiscordPartialMessage,
} from 'discord.js';
import { outdent } from 'outdent';
import xmlEscape from 'xml-escape';

import { debug } from '~/utils/debug.js';
import { transformMessageToHTML } from '~/utils/email/message.js';

export async function createEmailContentFromDiscordMessage(
	discordMessage: DiscordMessage | DiscordPartialMessage
) {
	const messageAuthor = discordMessage.author;

	const authorName = messageAuthor?.tag ?? 'Unknown User';

	let emailContent = outdent`
		<strong>
			From ${authorName}:
		</strong>
		<br />
	`;

	const message = await transformMessageToHTML({
		context: discordMessage,
		message: discordMessage.content ?? '[empty message]',
	});
	emailContent += message;

	let replyMessage: DiscordMessage | undefined;
	if (discordMessage.reference?.messageId !== undefined) {
		try {
			replyMessage = await discordMessage.channel.messages.fetch(
				discordMessage.reference.messageId
			);
		} catch {
			// reply not found
		}
	}

	if (replyMessage !== undefined) {
		emailContent += outdent`
			<br />
			<strong>Replied to <u>${xmlEscape(
				replyMessage.author.tag
			)}</u> who said: </strong>
			<br />
			${await transformMessageToHTML({
				context: replyMessage,
				message: replyMessage.content,
			})}
			<br />
		`;
	}

	if (discordMessage.attachments.size > 0) {
		emailContent += `
			<h1>Attachments</h1>
		`;

		for (const attachment of discordMessage.attachments.values()) {
			emailContent += `
				${xmlEscape(attachment.name ?? 'Unnamed attachment')}: <a href="${
				attachment.url
			}">${attachment.url}</a>
			`;
		}
	}

	debug((f) => f`Email content: ${emailContent}`);

	return emailContent;
}
