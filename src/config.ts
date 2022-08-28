import {readFile} from "fs/promises";
import path = require("path");

const CONFIG_PATH = path.resolve(__dirname, "../config/config.json");

export interface PollerConfig {
	channelUrl: string;
	pollInterval: number;
}

export interface BotConfig {
	token: string;
	chatId: string;
}

export interface Config {
	poller: PollerConfig;
	bot: BotConfig;
}

export async function getConfig(): Promise<Config> {
	const rawConfig = await readFile(CONFIG_PATH, {encoding: "utf8"});
	const config: Config = JSON.parse(rawConfig);

	return config;
}
