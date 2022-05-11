import { join } from 'desm';
import { execaSync } from 'execa';
import { getProjectDir } from 'lion-system';

const monorepoDir = getProjectDir(import.meta.url, { monorepoRoot: true });

const discordEmailTunnelDockerFilePath = join(
	import.meta.url,
	'../dockerfiles/Dockerfile'
);
execaSync(
	'docker',
	[
		'build',
		'--tag',
		'discord-email-tunnel',
		'.',
		'-f',
		discordEmailTunnelDockerFilePath,
	],
	{
		cwd: monorepoDir,
		stdio: 'inherit',
	}
);
