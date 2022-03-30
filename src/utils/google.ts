import * as process from 'node:process';
import onetime from 'onetime';
import { google } from 'googleapis';
import type { OAuth2Client } from 'google-auth-library';

export const getOauth2Client = onetime((): OAuth2Client => {
	const oauth2Client = new google.auth.OAuth2({
		clientId: process.env.GOOGLE_CLOUD_CLIENT_ID,
		clientSecret: process.env.GOOGLE_CLOUD_CLIENT_SECRET,
		redirectUri: 'https://developers.google.com/oauthplayground',
	});

	oauth2Client.setCredentials({
		refresh_token: process.env.GOOGLE_CLOUD_REFRESH_TOKEN,
	});

	return oauth2Client;
});

export const getGmailClient = onetime(() => {
	const oauth2Client = getOauth2Client();

	const gmail = google.gmail({ auth: oauth2Client, version: 'v1' });

	return gmail;
});
