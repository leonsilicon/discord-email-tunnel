import type {
	Message as DiscordMessage,
	PartialMessage as DiscordPartialMessage,
} from 'discord.js';

export async function createEmailSubjectFromDiscordMessage(
	message: DiscordMessage | DiscordPartialMessage
): Promise<string> {
	const messageAuthor = message.author;

	const authorName = messageAuthor?.tag ?? 'Unknown User';

	const { channel } = message;

	let emailSubject: string;
	if (channel.type === 'GUILD_TEXT') {
		emailSubject = `New Discord message from ${authorName} in #${channel.name} of ${channel.guild.name}`;
	} else if (channel.type === 'DM') {
		emailSubject = `New Discord message from ${authorName} in DMs`;
	} else {
		emailSubject = `New Discord message from ${authorName}`;
	}

	return emailSubject;
}
