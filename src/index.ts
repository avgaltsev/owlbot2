import {getConfig} from "./config";
import {OwlBot2} from "./owlbot2";

export async function main(): Promise<void> {
	const config = await getConfig();

	new OwlBot2(config);
}
