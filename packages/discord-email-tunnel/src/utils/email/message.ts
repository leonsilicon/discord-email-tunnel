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
	for (const messageTransformer of messageTransformers) {
		// eslint-disable-next-line no-await-in-loop
		message = await messageTransformer({ message, context });
	}

	return message;
}
