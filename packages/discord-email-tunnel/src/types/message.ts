import type { Message, PartialMessage } from 'discord.js';

export type MessageContext = Omit<Message | PartialMessage, 'content'>;

export type MessageTransformPayload = {
	message: string;
	context: MessageContext;
};

export type MessageTransformer = (
	payload: MessageTransformPayload
) => string | Promise<string>;
