import {getConfig} from "./config";
import {Bot} from "./bot";
import {Poller} from "./poller";

export async function main(): Promise<void> {
	const config = await getConfig();

	const bot = new Bot(config.bot);
	const poller = new Poller(config.poller);

	function logStatus(message: string, ...args: Array<unknown>): void {
		console.log(message, ...args);
	}

	function reportStatus(message: string): void {
		if (config.useBot) {
			bot.sendMessage(message);
		}
	}

	// TODO: Add errors handling.
	poller.on("error", (parameters) => {
		logStatus("Poller error", parameters);
		reportStatus(`Poller error: ${parameters.error}`);
	});

	poller.on("start", (parameters) => {
		logStatus("Poller started", parameters);
		reportStatus("Poller started");
	});

	poller.on("poll", () => {
		logStatus("Polling");
	});

	poller.on("pollSuccess", () => {
		logStatus("Polling OK");
	});

	poller.on("pollError", (parameters) => {
		logStatus("Polling error", parameters);
		reportStatus(`Polling error: ${parameters.error}`);
	});

	poller.on("liveStreamStart", (parameters) => {
		logStatus("Live stream found", parameters);
		reportStatus(`Live stream found: ${parameters.liveStream.title}`);
	});

	poller.on("liveStreamSwitch", (parameters) => {
		logStatus("Live stream switched", parameters);
		reportStatus(`Live stream switched: from ${parameters.oldLiveStream.title} to ${parameters.newLiveStream.title}`);
	});

	poller.on("liveStreamUpdate", (parameters) => {
		logStatus("Live stream updated", parameters);
		reportStatus(`Live stream updated: from ${parameters.oldLiveStream.title} to ${parameters.newLiveStream.title}`);
	});

	poller.on("liveStreamEnd", (parameters) => {
		logStatus("Live stream ended", parameters);
		reportStatus(`Live stream ended: ${parameters.liveStream.title}`);
	});
}
