// import {readFile} from "fs/promises";
// import path = require("path");
// import {Scheduler} from "./scheduler";

// const CONFIG_PATH = path.resolve(__dirname, "../config/config.json");

// export function main(): void {
// 	readFile(CONFIG_PATH, {
// 		encoding: "utf8",
// 	}).then((value) => {
// 		const config = JSON.parse(value);

// 		new Scheduler(config.bot, config.streams, config.schedule);
// 	}).catch((reason) => {
// 		console.log(reason);
// 	});
// }

export function main(): void {
	console.log(1);
}
