import * as path from "path";
import {readFile} from "fs/promises";

import {JsonObject, isJsonObject} from "./json-object";

import * as defaultConfig from "./json/default-config.json";

export type Config = typeof defaultConfig;
export type BotConfig = typeof defaultConfig.bot;
export type PollerConfig = typeof defaultConfig.poller;
export type StreamConfig = typeof defaultConfig.streams[0];

function mergeConfigs<T extends JsonObject, K extends keyof T>(baseConfig: T, overrideConfig: JsonObject): T {
	const properties = Object.keys(baseConfig) as Array<K>;

	return properties.reduce((result, property) => {
		// Typescript bug: baseValue infers correct type here (T[K], or Json),
		// but when I try use it somewhere it thinks it's Json | undefined.
		// If I specify the type explicitly, it works fine.
		const baseValue: T[K] = baseConfig[property];
		const overrideValue = overrideConfig[property as string];

		if (isJsonObject(baseValue)) {
			if (overrideValue === undefined) {
				result[property] = baseValue;
			} else if (isJsonObject(overrideValue)) {
				result[property] = mergeConfigs(baseValue, overrideValue);
			} else {
				result[property] = baseValue;
			}
		} else {
			if (typeof overrideValue === typeof result[property]) {
				result[property] = overrideValue as T[K];
			} else {
				result[property] = baseValue;
			}
		}

		return result;
	}, {...baseConfig});
}

const CONFIG_PATH = path.resolve(__dirname, "../config/config.json");

export async function getConfig(): Promise<Config> {
	const rawConfig = await readFile(CONFIG_PATH, {encoding: "utf8"});

	return mergeConfigs(defaultConfig, JSON.parse(rawConfig));
}
