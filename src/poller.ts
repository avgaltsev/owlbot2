import {EventEmitter} from "stream";
import {launch, Browser} from "puppeteer";

import {PollerConfig} from "./config";
import {getResponseField, isResponseFields, requestJson, ResponseFields, ResponseFieldValue} from "./request-json";

import * as settings from "./json/settings.json";
import * as pollRequestPayload from "./json/poll-request-payload.json";

const INJECTED_CODE = `
	(function () {
		return {
			apiKey: ytcfg.data_.INNERTUBE_API_KEY,
			channelId: ytInitialData.metadata.channelMetadataRenderer.externalId,
		};
	})();
`;

interface TemplateValues {
	[name: string]: string;
}

function expandTemplate(template: string, values: TemplateValues): string {
	return Object.entries(values).reduce((result, [name, value]) => {
		return result.replace(`%${name}`, value);
	}, template);
}

interface Session extends TemplateValues {
	apiKey: string;
	channelId: string;
}

interface LiveStream {
	id: string;
	title: string;
	url: string;
}

interface PollerEvents {
	start: (parameters: {
		pollInterval: number;
	}) => void;

	poll: () => void;

	pollSuccess: () => void;

	pollFail: (parameters: {
		error: string;
	}) => void;

	liveStreamStart: (parameters: {
		liveStream: LiveStream;
	}) => void;

	liveStreamSwitch: (parameters: {
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
			pollInterval: this.config.pollInterval,
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

		const url = this.expandTemplateWithLocalValues(settings.channelUrl);

		await page.goto(url);

		const session = await page.evaluate(INJECTED_CODE) as Session;

		page.close();

		return session;
	}

	private async poll(): Promise<void> {
		this.emitter.emit("poll");

		let pollResponse: ResponseFields;

		try {
			pollResponse = await this.request();

			this.emitter.emit("pollSuccess");
		} catch(error) {
			this.emitter.emit("pollFail", {
				error: error as string,
			});

			return;
		}

		const liveStreamResponse = this.getLiveStreamResponse(pollResponse);

		if (liveStreamResponse !== null) {
			const newLiveStream: LiveStream = {
				id: String(getResponseField(liveStreamResponse, ["videoId"])),
				title: String(getResponseField(liveStreamResponse, ["title", "runs", 0, "text"])),
				url: String(getResponseField(liveStreamResponse, ["navigationEndpoint", "commandMetadata", "webCommandMetadata", "url"])),
			};

			if (this.liveStream !== null) {
				if (this.liveStream.id === newLiveStream.id) {
					return;
				}

				this.emitter.emit("liveStreamSwitch", {
					oldLiveStream: this.liveStream,
					newLiveStream: newLiveStream,
				});
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

	private async request(): Promise<ResponseFields> {
		const path = await this.expandTemplate(settings.apiPath);
		const requestPayload = await this.expandPollRequestPayload();

		return requestJson({
			host: settings.apiHost,
			path,
			method: "POST",
		}, requestPayload);
	}

	private getLiveStreamResponse(pollResponse: ResponseFields): ResponseFields | null {
		const tabs = getResponseField(pollResponse, ["contents", "twoColumnBrowseResultsRenderer", "tabs"]);

		const tab = (Array.isArray(tabs) ? tabs : []).find((tab) => { // lint shadowed variable
			const selected = getResponseField(tab, ["tabRenderer", "selected"]);

			return selected !== null && selected !== undefined && selected;
		});

		const tabRenderer = getResponseField(tab, ["tabRenderer"]);
		const sectionListRenderer = getResponseField(tabRenderer, ["content", "sectionListRenderer"]);
		const itemSectionRenderer = getResponseField(sectionListRenderer, ["contents", 0, "itemSectionRenderer"]);
		const gridRenderer = getResponseField(itemSectionRenderer, ["contents", 0, "gridRenderer"]);
		const gridVideoRenderer = getResponseField(gridRenderer, ["items", 0, "gridVideoRenderer"]);

		const thumbnailOverlays = getResponseField(gridVideoRenderer, ["thumbnailOverlays"]);

		const liveOverlay = (Array.isArray(thumbnailOverlays) ? thumbnailOverlays : []).find((overlay: ResponseFieldValue) => {
			const style = getResponseField(overlay, ["thumbnailOverlayTimeStatusRenderer", "style"]);

			return style === "LIVE";
		});

		if (liveOverlay !== undefined && isResponseFields(gridVideoRenderer)) {
			return gridVideoRenderer;
		}

		return null;
	}

	private async expandPollRequestPayload(): Promise<typeof pollRequestPayload> {
		const originalUrl = await this.expandTemplate(pollRequestPayload.context.client.originalUrl);
		const graftUrl = await this.expandTemplate(pollRequestPayload.context.client.mainAppWebInfo.graftUrl);
		const browseId = await this.expandTemplate(pollRequestPayload.browseId);
		const params = await this.expandTemplate(pollRequestPayload.params);

		return {
			...pollRequestPayload,
			context: {
				...pollRequestPayload.context,
				client: {
					...pollRequestPayload.context.client,
					originalUrl,
					mainAppWebInfo: {
						...pollRequestPayload.context.client.mainAppWebInfo,
						graftUrl,
					},
				},
			},
			browseId,
			params,
		};
	}

	private expandTemplateWithLocalValues(template: string): string {
		return expandTemplate(template, this.config.templateValues);
	}

	private async expandTemplate(template: string): Promise<string> {
		const session = await this.getSession();

		const templateWithLocalValues = this.expandTemplateWithLocalValues(template);

		return expandTemplate(templateWithLocalValues, session);
	}
}
