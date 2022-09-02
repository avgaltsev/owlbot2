import {launch, Browser} from "puppeteer";

export class Chromium {
	private browserPromise: Promise<Browser> | null = null;

	public getBrowser(): Promise<Browser> {
		if (this.browserPromise === null) {
			this.browserPromise = this.createBrowser();
		}

		return this.browserPromise;
	}

	private createBrowser(): Promise<Browser> {
		return launch({
			headless: true,
			args: ["--no-sandbox"],
		});
	}
}
