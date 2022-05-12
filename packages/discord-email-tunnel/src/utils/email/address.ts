import type { Message as DiscordMessage } from 'discord.js';

import { getDiscordBot } from '~/utils/discord.js';

export async function parseDiscordEmailTunnelEmailAddress({
	destinationEmailAddress,
}: {
	destinationEmailAddress: string;
}) {
	const bot = getDiscordBot();

	const plusAddressMatches =
		/\+(\w+)-(\w+)@/.exec(destinationEmailAddress) ?? undefined;

	if (plusAddressMatches === undefined) {
		throw new Error(
			`Email address \`${destinationEmailAddress}\` does not match expected regex.`
		);
	}

	const channelId = plusAddressMatches[1];
	const messageId = plusAddressMatches[2];

	if (channelId === undefined || messageId === undefined) {
		throw new Error(
			'Channel ID or message ID not found in destination email address.'
		);
	}

	const channel = await bot.channels.fetch(channelId);

	if (channel === null) {
		throw new Error(`Channel with ID ${channelId} not found.`);
	}

	if (!channel.isText()) {
		throw new Error(`Channel with ID ${channelId} is not a text channel.`);
	}

	let replyMessage: DiscordMessage | undefined;
	try {
		replyMessage = await channel.messages.fetch(messageId);
	} catch {
		replyMessage = undefined;
	}

	return { channel, replyMessage };
}
