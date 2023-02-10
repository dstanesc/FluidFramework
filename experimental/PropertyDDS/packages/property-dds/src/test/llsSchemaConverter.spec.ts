/* eslint-disable import/no-internal-modules */
/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

import { PropertyFactory } from "@fluid-experimental/property-properties";
import { defaultSchemaPolicy, FieldSchema, SchemaData } from "@fluid-internal/tree";
import { brand } from "@fluid-internal/tree/dist/util/brand";
import { expect } from "chai";
import { convertSchemaToSharedTreeLls } from "../sharedtree/llsSchemaConverter";

describe("LlsSchemaConverter", () => {
	let schemaData: SchemaData;
	it("Conversion", () => {
		register();
		const tableSdc: any = brand("Test:Table-1.0.0");
		const [, OptionalFieldKind] = defaultSchemaPolicy.fieldKinds.keys();

		function getRootFieldSchema(): FieldSchema {
			return {
				kind: OptionalFieldKind,
				types: new Set([tableSdc]),
			};
		}
		const fieldSchema: FieldSchema = getRootFieldSchema();
		schemaData = convertSchemaToSharedTreeLls(defaultSchemaPolicy, fieldSchema);
	});
	it("Missing Refs", () => {
		checkMissingRefs(schemaData);
	});
});

function register() {
	PropertyFactory.register({
		typeid: "Test:Cell-1.0.0",
		properties: [{ id: "value", typeid: "Uint64" }],
	});

	PropertyFactory.register({
		typeid: "Test:Importance-1.0.0",
		properties: [{ id: "value", typeid: "Uint64" }],
	});

	PropertyFactory.register({
		typeid: "Test:RowInfo-1.0.0",
		properties: [{ id: "value", typeid: "Uint64" }],
	});

	PropertyFactory.register({
		typeid: "Test:Row-1.0.0",
		properties: [{ id: "cells", typeid: "Test:Cell-1.0.0", context: "array" }],
	});

	PropertyFactory.register({
		typeid: "Test:ExtendedRow-1.0.0",
		properties: [
			{ id: "cells", typeid: "Test:Cell-1.0.0", context: "array" },
			{ id: "info", typeid: "Test:RowInfo-1.0.0", context: "map" },
			{ id: "importance", typeid: "Test:Importance-1.0.0", context: "map" },
		],
	});

	PropertyFactory.register({
		typeid: "Test:Table-1.0.0",
		properties: [
			{ id: "rows", typeid: "Test:Row-1.0.0", context: "array" },
			{ id: "width", typeid: "Uint8" },
			{ id: "extendedRows", typeid: "Test:ExtendedRow-1.0.0", context: "array" },
			{
				id: "encoding",
				typeid: "Enum",
				properties: [
					{
						id: "none",
						value: 1,
					},
					{
						id: "utf8",
						value: 2,
					},
					{
						id: "base64",
						value: 3,
					},
				],
			},
			{ id: "height", typeid: "Uint8" },
		],
	});
}

function checkMissingRefs(schemaData) {
	const schemaMap = schemaData.treeSchema;
	const schemaTypesSet = new Set<string>();
	let keysIter = schemaMap.keys();
	for (const key of keysIter) {
		schemaTypesSet.add(key);
	}
	keysIter = schemaMap.keys();
	for (const key of keysIter) {
		const value = schemaMap.get(key);
		value?.localFields.forEach((field) => {
			if (field.types) {
				field.types.forEach((type) => {
					if (!schemaTypesSet.has(type.toString())) {
						expect.fail(`Missing type ${type.toString()} in schema`);
					}
				});
			}
		});
	}
}
