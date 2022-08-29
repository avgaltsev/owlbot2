import {EventEmitter} from "stream";

import {launch, Browser} from "puppeteer";

import {PollerConfig} from "./config";
import {Json, JsonObject, isJsonObject, getJsonValue} from "./json";
import {requestJson} from "./request-json";

import * as settings from "./json/settings.json";

interface TemplateValues {
	[name: string]: string;
}

function expandTemplate(template: string, values: TemplateValues): string {
	return Object.entries(values).reduce((result, [name, value]) => {
		return result.replace(`%${name}`, value);
	}, template);
}

interface Session {
	apiKey: string;
	context: JsonObject;
	channelId: string;
}

const GET_SESSION = `
	(function () {
		return {
			apiKey: ytcfg.data_.INNERTUBE_API_KEY,
			context: ytcfg.data_.INNERTUBE_CONTEXT,
			channelId: ytInitialData.metadata.channelMetadataRenderer.externalId,
		};
	})();
`;

interface LiveStream {
	id: string;
	title: string;
	url: string;
}

interface PollerEvents {
	error: (parameters: {
		error: string;
	}) => void;

	start: (parameters: {
		settings: typeof settings;
		config: PollerConfig;
	}) => void;

	poll: () => void;

	pollSuccess: () => void;

	pollError: (parameters: {
		error: string;
	}) => void;

	liveStreamStart: (parameters: {
		liveStream: LiveStream;
	}) => void;

	liveStreamSwitch: (parameters: {
		oldLiveStream: LiveStream;
		newLiveStream: LiveStream;

	}) => void;

	liveStreamUpdate: (parameters: {
		oldLiveStream: LiveStream;
		newLiveStream: LiveStream;

	}) => void;

	liveStreamEnd: (parameters: {
		liveStream: LiveStream;
	}) => void;
}

interface PollerEventEmitter {
	addListener<T extends keyof PollerEvents>(eventName: T, listener: PollerEvents[T]): this;
	removeListener<T extends keyof PollerEvents>(eventName: T, listener: PollerEvents[T]): this;
	on<T extends keyof PollerEvents>(eventName: T, listener: PollerEvents[T]): this;
	once<T extends keyof PollerEvents>(eventName: T, listener: PollerEvents[T]): this;
	off<T extends keyof PollerEvents>(eventName: T, listener: PollerEvents[T]): this;
	emit<T extends keyof PollerEvents>(eventName: T, ...args: Parameters<PollerEvents[T]>): boolean;
}

class PollerEventEmitter extends EventEmitter {
}

export class Poller{
	private emitter = new PollerEventEmitter();

	private browserPromise: Promise<Browser> | null = null;
	private sessionPromise: Promise<Session> | null = null;

	private liveStream: LiveStream | null = null;

	public constructor(
		private config: PollerConfig,
	) {
		setImmediate(() => {
			this.start();
		});
	}

	public on<T extends keyof PollerEvents>(eventName: T, listener: PollerEvents[T]): void {
		this.emitter.on(eventName, listener);
	}

	private async start(): Promise<void> {
		this.emitter.emit("start", {
			settings,
			config: this.config,
		});

		setImmediate(() => {
			this.poll();
		});

		setInterval(() => {
			this.poll();
		}, this.config.pollInterval);
	}

	private getBrowser(): Promise<Browser> {
		if (this.browserPromise === null) {
			this.browserPromise = this.createBrowser();
		}

		return this.browserPromise;
	}

	private async createBrowser(): Promise<Browser> {
		return launch();
	}

	private getSession(): Promise<Session> {
		if (this.sessionPromise === null) {
			this.sessionPromise = this.createSession();
		}

		return this.sessionPromise;
	}

	private async createSession(): Promise<Session> {
		const browser = await this.getBrowser();
		const page = await browser.newPage();

		const url = expandTemplate(settings.channelUrl, {
			channelName: this.config.channelName,
		});

		await page.goto(url);

		const session = await page.evaluate(GET_SESSION) as Session;

		page.close();

		return session;
	}

	private async poll(): Promise<void> {
		this.emitter.emit("poll");

		let pollResponse: Json;

		try {
			pollResponse = await this.request();

			this.emitter.emit("pollSuccess");
		} catch(error) {
			this.emitter.emit("pollError", {
				error: error as string,
			});

			return;
		}

		const liveStreamData = this.extractLiveStreamData(pollResponse);

		if (isJsonObject(liveStreamData)) {
			const newLiveStream: LiveStream = {
				id: String(getJsonValue(liveStreamData, ["videoId"])),
				title: String(getJsonValue(liveStreamData, ["title", "runs", 0, "text"])),
				url: String(getJsonValue(liveStreamData, ["navigationEndpoint", "commandMetadata", "webCommandMetadata", "url"])),
			};

			if (this.liveStream !== null) {
				if (this.liveStream.id !== newLiveStream.id) {
					this.emitter.emit("liveStreamSwitch", {
						oldLiveStream: this.liveStream,
						newLiveStream: newLiveStream,
					});
				} else if (this.liveStream.title !== newLiveStream.title) {
					this.emitter.emit("liveStreamUpdate", {
						oldLiveStream: this.liveStream,
						newLiveStream: newLiveStream,
					});
				}
			} else {
				this.emitter.emit("liveStreamStart", {
					liveStream: newLiveStream,
				});
			}

			this.liveStream = newLiveStream;
		} else {
			if (this.liveStream !== null) {
				this.emitter.emit("liveStreamEnd", {
					liveStream: this.liveStream,
				});
			}

			this.liveStream = null;
		}
	}

	private async request(): Promise<Json> {
		const session = await this.getSession();

		const path = expandTemplate(settings.apiPath, {
			apiKey: session.apiKey,
		});

		const requestParameters = {
			host: settings.apiHost,
			path,
			method: "POST",
		};

		const requestPayload = {
			context: session.context,
			browseId: session.channelId,
			params: settings.apiParams,
		};

		return requestJson(requestParameters, requestPayload);
	}

	private extractLiveStreamData(pollResponse: Json): Json {
		const tabs = getJsonValue(pollResponse, ["contents", "twoColumnBrowseResultsRenderer", "tabs"]);

		const tab = (Array.isArray(tabs) ? tabs : []).find((tab) => { // lint shadowed variable
			const selected = getJsonValue(tab, ["tabRenderer", "selected"]);

			return selected !== null && selected !== undefined && selected;
		});

		const tabRenderer = getJsonValue(tab, ["tabRenderer"]);
		const sectionListRenderer = getJsonValue(tabRenderer, ["content", "sectionListRenderer"]);
		const itemSectionRenderer = getJsonValue(sectionListRenderer, ["contents", 0, "itemSectionRenderer"]);
		const gridRenderer = getJsonValue(itemSectionRenderer, ["contents", 0, "gridRenderer"]);
		const gridVideoRenderer = getJsonValue(gridRenderer, ["items", 0, "gridVideoRenderer"]);

		const thumbnailOverlays = getJsonValue(gridVideoRenderer, ["thumbnailOverlays"]);

		const liveOverlay = (Array.isArray(thumbnailOverlays) ? thumbnailOverlays : []).find((overlay) => {
			const style = getJsonValue(overlay, ["thumbnailOverlayTimeStatusRenderer", "style"]);

			return style === "LIVE";
		});

		if (liveOverlay !== undefined && gridVideoRenderer !== undefined) {
			return gridVideoRenderer;
		}

		return null;
	}
}
