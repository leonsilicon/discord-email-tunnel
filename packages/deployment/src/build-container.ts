import { join } from 'desm';
import { execaSync } from 'execa';
import { getProjectDir } from 'lion-system';
import * as fs from 'node:fs';
import * as path from 'node:path';

const monorepoDir = getProjectDir(import.meta.url, { monorepoRoot: true });
const discordEmailTunnelDir = path.join(
	monorepoDir,
	'packages/discord-email-tunnel'
);

const serverDockerFilePath = join(import.meta.url, '../dockerfiles/Dockerfile');
execaSync(
	'docker',
	['build', '--tag', 'discord-email-tunnel', '.', '-f', serverDockerFilePath],
	{
		cwd: monorepoDir,
		stdio: 'inherit',
	}
);
