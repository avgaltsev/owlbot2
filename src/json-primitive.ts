import {isJsonObject} from "./json-object";
import {isJsonArray} from "./json-array";

import type {Json} from "./json";

export type JsonPrimitive = string | number | boolean | null;

export function isJsonPrimitive<T extends JsonPrimitive>(value: Json): value is T {
	return !isJsonObject(value) && !isJsonArray(value);
}
