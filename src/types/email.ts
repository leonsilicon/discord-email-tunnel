import { gmail_v1 } from 'googleapis';

export type GmailWebhookCallbackProps = {
	emailAddress: string;
	message: gmail_v1.Schema$Message;
};
