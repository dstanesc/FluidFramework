/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

/* eslint-disable prefer-template */
/* eslint-disable @typescript-eslint/restrict-plus-operands */
/* eslint-disable @typescript-eslint/no-unused-expressions */
/* eslint-disable import/no-internal-modules */

import { PropertyFactory } from "@fluid-experimental/property-properties";
import { defaultSchemaPolicy, FieldSchema, SchemaData, ValueSchema } from "@fluid-internal/tree";
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
	it("Enum", () => {
		checkEnum(schemaData);
	});
	it("Missing Refs", () => {
		checkMissingRefs(schemaData);
	});
	it("Check Structure", () => {
		checkStructure(schemaData);
	});
	it("Inheritance Translation", () => {
		checkInheritanceTranslation(schemaData);
	});
});

function register() {
	PropertyFactory.register({
		typeid: "Test:Cell-1.0.0",
		properties: [{ id: "value", typeid: "Uint64" }],
	});

	PropertyFactory.register({
		typeid: "Test:RowProperty-1.0.0",
		properties: [{ id: "value", typeid: "String" }],
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
		inherits: ["Test:Row-1.0.0"],
		properties: [
			{ id: "info", typeid: "Test:RowInfo-1.0.0", context: "map" },
			{ id: "props", typeid: "Test:RowProperty-1.0.0", context: "map" },
		],
	});

	PropertyFactory.register({
		typeid: "Test:OtherExtendedRow-1.0.0",
		inherits: ["Test:Row-1.0.0"],
		properties: [
			{ id: "info", typeid: "Test:RowInfo-1.0.0", context: "map" },
			{ id: "props", typeid: "Test:RowProperty-1.0.0", context: "map" },
		],
	});

	PropertyFactory.register({
		typeid: "Test:Table-1.0.0",
		properties: [
			{ id: "rows", typeid: "Test:Row-1.0.0", context: "array" },
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
		],
	});

    PropertyFactory.register({
		typeid: "Test:DescribedTable-1.0.0",
        inherits: ["Test:Table-1.0.0"],
		properties: [
			{ id: "description", typeid: "String"  },
        ]
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
						expect.fail(`Missing type ${type.toString()} in schema at the type ${key} field ${field.name}`);
					}
				});
			}
		});
	}
}

function checkInheritanceTranslation(schemaData) {
	const schemaMap = schemaData.treeSchema;
	const row = schemaMap.get("array<Test:Row-1.0.0>");
	expect(row).to.not.be.undefined;
	expect(row?.localFields).to.not.be.undefined;
	const field = row?.localFields.get("");
	expect(field).to.not.be.undefined;
	expect(field?.types).to.not.be.undefined;
	// expect.fail(" : " + Array.from(rows?.types) + " : " + Array.from(rows?.types).length);
    const types = field?.types;
	expect(types?.has("Test:Row-1.0.0")).to.be.true;
	expect(types?.has("Test:ExtendedRow-1.0.0")).to.be.true;
	expect(types?.has("Test:OtherExtendedRow-1.0.0")).to.be.true;

	//	expect.fail(mapToObject(schemaMap));
}

function checkEnum(schemaData) {
	const schemaMap = schemaData.treeSchema;
	const table = schemaMap.get("Test:Table-1.0.0");
	expect(table).to.not.be.undefined;
	expect(table?.localFields).to.not.be.undefined;
	const encoding = table?.localFields.get("encoding");
	expect(encoding).to.not.be.undefined;
	expect(encoding?.types).to.not.be.undefined;
	expect(encoding?.types?.has("Enum")).to.be.true;
}

function checkStructure(schemaData) {
	const schemaMap = schemaData.treeSchema;
	const table = schemaMap.get("Test:Table-1.0.0");
	checkTable(schemaData, table);
}

function checkTable(schemaData, table) {
	expect(table).to.not.be.undefined;
	expect(table?.localFields).to.not.be.undefined;
	const extendedRows = table?.localFields.get("extendedRows");
	checkExtendedRows(schemaData, extendedRows);
}

function checkExtendedRows(schemaData, extendedRows) {
	expect(extendedRows).to.not.be.undefined;
	expect(extendedRows?.types).to.not.be.undefined;
	expect(extendedRows?.types?.has("array<Test:ExtendedRow-1.0.0>")).to.be.true;
	const info = schemaData.treeSchema.get("Test:ExtendedRow-1.0.0")?.localFields.get("info");
	checkInfo(schemaData, info);
}

function checkInfo(schemaData, info) {
	expect(info).to.not.be.undefined;
	expect(info?.types).to.not.be.undefined;
	expect(info?.types?.has("map<Test:RowInfo-1.0.0>")).to.be.true;
	const infoType = schemaData.treeSchema.get("Test:RowInfo-1.0.0");
	expect(infoType).to.not.be.undefined;
	expect(infoType?.localFields).to.not.be.undefined;
	const uint64 = schemaData.treeSchema.get("Test:RowInfo-1.0.0");
	checkUint64(schemaData, uint64);
}

function checkUint64(schemaData, uint64) {
	expect(uint64).to.not.be.undefined;
	const uint64Type = schemaData.treeSchema.get("Uint64");
	expect(uint64Type.value === ValueSchema.Number).to.be.true;
}
