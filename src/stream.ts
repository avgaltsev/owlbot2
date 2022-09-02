import {connect, Page} from "puppeteer";

// import Jimp = require("jimp/es");

import {StreamConfig} from "./config";

const STREAM_SELECTOR = "ytd-thumbnail-overlay-time-status-renderer[overlay-style=\"LIVE\"]";
const CHAT_BUTTON_SELECTOR = "ytd-live-chat-frame #show-hide-button";

export class Stream {
	private url: string;
	private pagePromise: Promise<Page | undefined>;

	public constructor(private config: StreamConfig) {
		this.url = `ws://${this.config.host}:${this.config.port}/devtools/browser/${this.config.token}`;

		this.pagePromise = connect({
			browserWSEndpoint: this.url,
			defaultViewport: {
				width: 600,
				height: 600,
			},
		}).then((browser) => browser.pages()).then((pages) => pages[0]);
	}

	private async getScreenshot(page: Page): Promise<Buffer> {
		const screenshot = await page.screenshot({
			// fullPage: true,
			clip: {
				x: 0,
				y: 0,
				width: 600,
				height: 600,
			},
		}) as Buffer;
		// const image = await Jimp.read(screenshot);

		// image.resize(800, Jimp.AUTO);

		return screenshot;
	}

	public async open(url: string): Promise<Array<Buffer>> {
		const page = await this.pagePromise;

		if (page === undefined) {
			return Promise.reject({
				message: "'Page' instance not found.",
			});
		}

		try {
			await page.goto(url);
			await page.waitForSelector(STREAM_SELECTOR);
			await page.click(STREAM_SELECTOR);
			// await page.waitForNavigation();
			await page.waitForTimeout(5000);
			await page.waitForSelector(CHAT_BUTTON_SELECTOR);
			await page.click(CHAT_BUTTON_SELECTOR);
			await page.evaluate("window.scrollTo(0, 0);");
			await page.waitForTimeout(5000);
		} catch (error) {
			const errorScreenshot = await this.getScreenshot(page);

			return Promise.reject({
				message: (error as Error).message,
				screenshot: errorScreenshot,
			});
		}

		const screenshot = await this.getScreenshot(page);

		return [screenshot];
	}

	public async ping(): Promise<Array<Buffer>> {
		const page = await this.pagePromise;

		if (page === undefined) {
			return Promise.reject({
				message: "'Page' instance not found.",
			});
		}

		const screenshot = await this.getScreenshot(page);

		return [screenshot];
	}

	public async close(): Promise<Array<Buffer>> {
		const page = await this.pagePromise;

		if (page === undefined) {
			return Promise.reject({
				message: "'Page' instance not found.",
			});
		}

		try {
			await page.goto("https://youtube.com");
			await page.waitForTimeout(5000);
		} catch (error) {
			const errorScreenshot = await this.getScreenshot(page);

			return Promise.reject({
				message: (error as Error).message,
				screenshot: errorScreenshot,
			});
		}

		const screenshot = await this.getScreenshot(page);

		return [screenshot];
	}
}

export interface StreamError {
	message: string;
	screenshot?: Buffer;
}

export function isStreamError(value: unknown): value is StreamError {
	if (
		typeof value === "object" &&
		value !== null &&
		typeof (value as StreamError).message === "string" &&
		(
			(value as StreamError).screenshot === undefined ||
			(value as StreamError).screenshot instanceof Buffer
		)
	) {
		return true;
	}

	return false;
}
