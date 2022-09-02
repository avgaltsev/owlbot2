import {isJsonArray} from "./json-array";
import {isJsonObject} from "./json-object";

import type {Json} from "./json";

export type JsonPrimitive = string | number | boolean | null;

export function isJsonPrimitive<T extends JsonPrimitive>(value: Json): value is T {
	return !isJsonArray(value) && !isJsonObject(value);
}
