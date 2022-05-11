import type {
	Message as DiscordMessage,
	PartialMessage as DiscordPartialMessage,
} from 'discord.js';

import { createEmailContentFromDiscordMessage } from '~/utils/email/content.js';
import { getSmtpTransport } from '~/utils/email/smtp.js';
import { createEmailSubjectFromDiscordMessage } from '~/utils/email/subject.js';

// Map from channel IDs to a message ID.
// This map contains the channel ID that corresponds with a particular user so that the emails are sent in replies
export const discordChannelToMessageIdMap = new Map<string, string>();

type SendMessageEmailUpdateProps = {
	message: DiscordMessage | DiscordPartialMessage;
	type: 'create' | 'delete' | 'update';
};

export async function sendEmailAboutDiscordMessage({
	message,
	type,
}: SendMessageEmailUpdateProps) {
	const smtpTransport = await getSmtpTransport();

	if (type === 'create') {
		const replyMessageId = discordChannelToMessageIdMap.get(message.channelId);

		const emailContent = await createEmailContentFromDiscordMessage(message);
		const emailSubject = await createEmailSubjectFromDiscordMessage(message);

		const sentMessageInfo = await smtpTransport.sendMail({
			inReplyTo: replyMessageId,
			references: replyMessageId,
			from: 'admin@leonzalion.com',
			replyTo: `discord-email-tunnel+${message.channelId}-${message.id}@leonzalion.com`,
			html: emailContent,
			subject: emailSubject,
			to: 'leon@leonzalion.com',
		});

		discordChannelToMessageIdMap.set(
			message.channelId,
			sentMessageInfo.messageId
		);
	}
}
