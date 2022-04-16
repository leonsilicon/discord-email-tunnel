/* eslint-disable no-await-in-loop */

import { Buffer } from 'node:buffer';
import * as cheerio from 'cheerio';
import type {
	Message as DiscordMessage,
	PartialMessage as DiscordPartialMessage,
} from 'discord.js';
import { MessageAttachment } from 'discord.js';
import type { gmail_v1 } from 'googleapis';
import { convert as convertHtmlToText } from 'html-to-text';
import { getDiscordBot } from '~/utils/discord.js';
import { logDebug } from '~/utils/log.js';
