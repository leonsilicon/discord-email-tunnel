import { Client, Message } from 'discord.js';

// @ts-expect-error Message constructor is private
export class MockMessage extends Message {
	constructor() {
		super(new Client({ intents: [] }), {} as any);
	}
}
