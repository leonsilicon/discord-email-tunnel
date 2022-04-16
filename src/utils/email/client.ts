import onetime from 'onetime';
import { google } from 'googleapis';
import { getOauth2Client } from '~/utils/google.js';

export const getGmailClient = onetime(() => {
	const oauth2Client = getOauth2Client();

	const gmail = google.gmail({ auth: oauth2Client, version: 'v1' });

	return gmail;
});
