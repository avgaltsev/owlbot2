import {Config} from "./config";
import {Chromium} from "./chromium";
import {Bot} from "./bot";
import {Poller} from "./poller";

export class OwlBot2 {
	private browser: Chromium;
	private bot: Bot;
	private poller: Poller;

	public constructor(
		private config: Config,
	) {
		this.browser = new Chromium();
		this.bot = new Bot(config.bot);
		this.poller = new Poller(config.poller, this.browser);

		// TODO: Add errors handling.
		this.poller.on("error", (parameters) => {
			this.logStatus("Poller error", parameters);
			this.reportStatus(`Poller error: ${parameters.error}`);
		});

		this.poller.on("start", (parameters) => {
			this.logStatus("Poller started", parameters);
			this.reportStatus("Poller started");
		});

		this.poller.on("poll", () => {
			this.logStatus("Polling");
		});

		this.poller.on("pollSuccess", () => {
			this.logStatus("Polling OK");
		});

		this.poller.on("pollError", (parameters) => {
			this.logStatus("Polling error", parameters);
			this.reportStatus(`Polling error: ${parameters.error}`);
		});

		this.poller.on("liveStreamStart", (parameters) => {
			this.logStatus("Live stream found", parameters);
			this.reportStatus(`Live stream found: ${parameters.liveStream.title}`);
		});

		this.poller.on("liveStreamSwitch", (parameters) => {
			this.logStatus("Live stream switched", parameters);
			this.reportStatus(`Live stream switched: from ${parameters.oldLiveStream.title} to ${parameters.newLiveStream.title}`);
		});

		this.poller.on("liveStreamUpdate", (parameters) => {
			this.logStatus("Live stream updated", parameters);
			this.reportStatus(`Live stream updated: from ${parameters.oldLiveStream.title} to ${parameters.newLiveStream.title}`);
		});

		this.poller.on("liveStreamEnd", (parameters) => {
			this.logStatus("Live stream ended", parameters);
			this.reportStatus(`Live stream ended: ${parameters.liveStream.title}`);
		});
	}

	private logStatus(message: string, ...args: Array<unknown>): void {
		console.log(new Date(), message, ...args);
	}

	private reportStatus(message: string): void {
		if (this.config.useBot) {
			this.bot.sendMessage(message);
		}
	}
}
