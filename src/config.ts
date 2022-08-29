import {readFile} from "fs/promises";
import path = require("path");

import * as defaultConfig from "./json/default-config.json";

export type Config = typeof defaultConfig;
export type PollerConfig = typeof defaultConfig.poller;
export type BotConfig = typeof defaultConfig.bot;

export interface ConfigProperties {
	[name: string]: ConfigProperties | string | number | boolean | null | Array<ConfigProperties | string | number | boolean | null>;
}

export type ConfigPropertyName = keyof ConfigProperties;
export type ConfigPropertyValue = ConfigProperties[ConfigPropertyName];

function isConfigProperties<T extends ConfigProperties>(value: ConfigPropertyValue | undefined): value is T {
	return value !== null && typeof value === "object";
}

function mergeConfigs<T extends ConfigProperties, K extends keyof T>(baseConfig: T, override: ConfigProperties): T {
	return Object.entries(baseConfig).reduce((result, [baseName, baseValue]) => {
		if (isConfigProperties(baseValue)) {
			const overrideValue = override[baseName];

			if (isConfigProperties(overrideValue)) {
				result[baseName as K] = mergeConfigs(baseValue, overrideValue) as T[K];
			} else {
				result[baseName as K] = baseValue as T[K];
			}
		} else {
			result[baseName as K] = (override[baseName] ?? baseValue) as T[K];
		}

		return result;
	}, {} as T);
}

const CONFIG_PATH = path.resolve(__dirname, "../config/config.json");

export async function getConfig(): Promise<Config> {
	const rawConfig = await readFile(CONFIG_PATH, {encoding: "utf8"});

	return mergeConfigs(defaultConfig, JSON.parse(rawConfig));
}
