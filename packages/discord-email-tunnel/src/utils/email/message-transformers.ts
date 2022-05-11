import DOMPurify from 'isomorphic-dompurify';
import Markdown from 'markdown-it';
import emoji from 'node-emoji';
import { outdent } from 'outdent';
import xmlEscape from 'xml-escape';

import type {
	MessageTransformer,
	MessageTransformPayload,
} from '~/types/message.js';

/**
	Takes a Discord message and replaces the pings with HTML pings
	@returns A new string representing the message formatted with pings
*/
export const formatPings: MessageTransformer = async ({
	message,
	context,
}: MessageTransformPayload) => {
	let newMessage = message;

	const pingMatches = newMessage.matchAll(/<@!(\d+)>/g);

	const membersMap: Record<string, string> = {};
	await Promise.all(
		[...pingMatches].map(async (pingMatch) => {
			const memberId = pingMatch[1]!;
			const pingedMember = await context.guild?.members.fetch(memberId);
			membersMap[memberId] = pingedMember?.user.tag ?? '[Unknown User]';
		})
	);

	newMessage = newMessage.replaceAll(
		/<@!(\d+)>/g,
		(_substring, pingMatch: string) =>
			outdent`
				<span style='background-color: hsl(235, 85.6%, 64.7%); border-radius: 5px; color: white; padding: 2px;'>@${xmlEscape(
					membersMap[pingMatch]!
				)}</span>
			`
	);

	return newMessage;
};

/**
	Filters out malicious HTML tags from the message (e.g. <script>) using DOMPurify
	@returns The message with all malicious HTML tags filtered out.
*/
export const escapeMessage: MessageTransformer = ({
	message,
}: MessageTransformPayload) => DOMPurify.sanitize(message);

const md = new Markdown();
/**
	Takes a string and formats markdown using markdown-it
*/
export const formatMarkdown: MessageTransformer = ({
	message,
}: MessageTransformPayload) => md.render(message);

/**
	Takes a string and emojifys it with node-emoji
*/
export const transformEmojis: MessageTransformer = ({
	message,
}: MessageTransformPayload) => emoji.emojify(message);
