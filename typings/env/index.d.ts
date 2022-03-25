declare global {
	namespace NodeJS {
		interface ProcessEnv {
			NODE_ENV: 'production' | 'development';
			GMAIL_CLIENT_ID: string;
			GMAIL_CLIENT_SECRET: string;
			GMAIL_REFRESH_TOKEN: string;
		}
	}
}

export {};
