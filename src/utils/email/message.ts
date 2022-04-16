import { MessageTransformPayload } from '~/types/message.js';
import {
	formatPings,
	formatMarkdown,
	escapeMessage,
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
		newMessage = await messageTransformer({ message, context });
	}
	return newMessage;
}
