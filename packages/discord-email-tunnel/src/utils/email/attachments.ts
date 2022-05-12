import { MessageAttachment } from 'discord.js';
import type { gmail_v1 } from 'googleapis';
import { Buffer } from 'node:buffer';

import { debug } from '~/utils/debug.js';
import { getGmailClient } from '~/utils/email/client.js';

export async function getAttachmentsFromEmailPart({
	messageId,
	emailPart,
	emailAddress,
}: {
	emailAddress: string;
	messageId: string;
	emailPart: gmail_v1.Schema$MessagePart;
}): Promise<MessageAttachment[] | undefined> {
	const attachments: MessageAttachment[] = [];
	const gmail = getGmailClient();

	const mimeType = emailPart.mimeType ?? undefined;
	if (mimeType === undefined) {
		return;
	}

	if (mimeType.startsWith('multipart/')) {
		if (emailPart.parts === undefined) {
			return;
		}

		for (const part of emailPart.parts) {
			// eslint-disable-next-line no-await-in-loop
			const partAttachments = await getAttachmentsFromEmailPart({
				emailPart: part,
				messageId,
				emailAddress,
			});
			if (partAttachments !== undefined) {
				attachments.push(...partAttachments);
			}
		}
	} else {
		const emailPartBody = emailPart.body ?? undefined;
		if (emailPartBody === undefined) {
			debug(() => `Email part body was undefined.`);
			return;
		}

		const filename = emailPart.filename ?? undefined;
		if (filename === undefined) {
			debug(() => `Filename was undefined.`);
			return;
		}

		const emailPartBodyAttachmentId = emailPartBody.attachmentId ?? undefined;
		if (emailPartBodyAttachmentId === undefined) {
			debug(() => `Email part body attachment ID was undefined.`);
			return;
		}

		const attachment = await gmail.users.messages.attachments.get({
			id: emailPartBodyAttachmentId,
			messageId,
			userId: emailAddress,
		});

		const attachmentBase64 = attachment.data.data ?? undefined;
		if (attachmentBase64 === undefined) {
			debug(() => `base64 of attachment data not found.`);
			return;
		}

		attachments.push(
			new MessageAttachment(Buffer.from(attachmentBase64, 'base64'), filename)
		);
	}

	return attachments;
}
