import {Bot} from "./bot";
import {getConfig} from "./config";
import {Poller} from "./poller";

export async function main(): Promise<void> {
	const config = await getConfig();

	const bot = new Bot(config.bot);
	const poller = new Poller(config.poller);

	poller.on("start", (parameters) => {
		console.log("Polling started", parameters);
		// bot.sendMessage("Polling started");
	});

	poller.on("poll", () => {
		console.log("Polling");
	});

	poller.on("pollSuccess", () => {
		console.log("Polling OK");
	});

	poller.on("pollFail", (parameters) => {
		console.log("Polling FAIL", parameters);
	});

	poller.on("liveStreamStart", (parameters) => {
		console.log("Live stream found", parameters);
		// bot.sendMessage(`Live stream found: ${parameters.liveStream.title}`);
	});

	poller.on("liveStreamSwitch", (parameters) => {
		console.log("Live stream switched", parameters);
		bot.sendMessage(`Live stream switched: from ${parameters.oldLiveStream.title} to ${parameters.newLiveStream.title}`);
	});

	poller.on("liveStreamEnd", (parameters) => {
		console.log("Live stream ended", parameters);
		bot.sendMessage(`Live stream ended: ${parameters.liveStream.title}`);
	});
}
