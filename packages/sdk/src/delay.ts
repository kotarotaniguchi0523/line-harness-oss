const MULTIPLIERS: Record<string, number> = {
	m: 1,
	h: 60,
	d: 1440,
	w: 10080,
};

const DELAY_FORMAT_PATTERN = /^(\d+)([mhdw])$/;

export function parseDelay(input: string): number {
	const match = input.match(DELAY_FORMAT_PATTERN);
	if (!match) {
		throw new Error(`Invalid delay format: "${input}". Use format like "30m", "1h", "1d", "1w".`);
	}
	return Number(match[1]) * MULTIPLIERS[match[2]];
}
