import type { MessageTransformPayload } from '~/types/message.js';

import {
	escapeMessage,
	formatMarkdown,
	formatPings,
} from './message-transformers.js';

const messageTransformers = [
	formatPings,
	formatMarkdown,
	escapeMessage, // should be last
];

export async function transformMessageToHTML({
	context,
	message,
}: MessageTransformPayload) {
	let newMessage = message;
	for (const messageTransformer of messageTransformers) {
		// eslint-disable-next-line no-await-in-loop
		newMessage = await messageTransformer({ message, context });
	}

	return newMessage;
}
