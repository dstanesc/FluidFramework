/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

import { strict as assert } from "assert";
import { MockFluidDataStoreRuntime } from "@fluidframework/test-runtime-utils";
import { AllowedUpdateType, FieldKey } from "../../../core";
import {
	ContextuallyTypedNodeData,
	getField,
	BindPath,
	BindingType,
	toDownPath,
	InsertBindingContext,
	DeleteBindingContext,
	BindingContext,
	FlushableDataBinder,
	BinderOptions,
	FlushableBinderOptions,
	createDataBinderBuffering,
	createFlushableBinderOptions,
	createDataBinderInvalidate,
	createDataBinderDirect,
	InvalidStateBindingContext,
	DataBinder,
	InvalidationBinderEvents,
	OperationBinderEvents,
	DownPath,
	BindingContextType,
	BatchBindingContext,
	comparePipeline,
	CompareFunction,
	compareBinderEventsDeleteFirst,
	createBinderOptions,
} from "../../../feature-libraries";
import { brand } from "../../../util";
import { ISharedTreeView, SharedTreeFactory, ViewEvents } from "../../../shared-tree";
import { fullSchemaData, personData } from "./mockData";

const fieldAddress: FieldKey = brand("address");
const fieldZip: FieldKey = brand("zip");
const fieldStreet: FieldKey = brand("street");
const fieldPhones: FieldKey = brand("phones");
const fieldSequencePhones: FieldKey = brand("sequencePhones");

describe("editable-tree: data binder", () => {
	describe("buffering data binder", () => {
		it("registers to root, enables autoFlush, matches paths incl. index", () => {
			const { tree, root, address } = retrieveNodes();
			const insertPaths: BindPath[] = [
				[
					{ field: fieldAddress, index: 0 },
					{ field: fieldZip, index: 1 },
				],
			];
			const deletePaths: BindPath[] = [
				[
					{ field: fieldAddress, index: 0 },
					{ field: fieldZip, index: 0 },
				],
			];
			const options: FlushableBinderOptions<ViewEvents> = createFlushableBinderOptions({
				autoFlushPolicy: "afterBatch",
			});
			const dataBinder: FlushableDataBinder<OperationBinderEvents> =
				createDataBinderBuffering(tree.events, options);
			const insertLog: DownPath[] = [];
			dataBinder.register(
				root,
				BindingType.Insert,
				insertPaths,
				({ path, content }: InsertBindingContext) => {
					const downPath: DownPath = toDownPath(path);
					insertLog.push(downPath);
				},
			);
			const deleteLog: DownPath[] = [];
			dataBinder.register(
				root,
				BindingType.Delete,
				deletePaths,
				({ path, count }: DeleteBindingContext) => {
					const downPath: DownPath = toDownPath(path);
					deleteLog.push(downPath);
				},
			);
			address.zip = "33428";
			assert.deepEqual(insertLog, [
				[
					{ field: fieldAddress, index: 0 },
					{ field: fieldZip, index: 1 },
				],
			]);
			assert.deepEqual(deleteLog, [
				[
					{ field: fieldAddress, index: 0 },
					{ field: fieldZip, index: 0 },
				],
			]);
			// unsubscribe all bindings
			insertLog.length = 0;
			deleteLog.length = 0;
			dataBinder.unregister();
			address.zip = "85521";
			assert.deepEqual(insertLog, []);
			assert.deepEqual(deleteLog, []);
		});

		it("registers to node other than root, enables autoFlush, matches paths incl. index", () => {
			const { tree, root, address } = retrieveNodes();
			const insertPaths: BindPath[] = [
				[
					{ field: fieldAddress, index: 0 },
					{ field: fieldZip, index: 1 },
				],
			];
			const options: FlushableBinderOptions<ViewEvents> = createFlushableBinderOptions({
				autoFlushPolicy: "afterBatch",
			});
			const dataBinder: FlushableDataBinder<OperationBinderEvents> =
				createDataBinderBuffering(tree.events, options);
			const insertLog: DownPath[] = [];
			dataBinder.register(
				address,
				BindingType.Insert,
				insertPaths,
				({ path, content }: InsertBindingContext) => {
					const downPath: DownPath = toDownPath(path);
					insertLog.push(downPath);
				},
			);
			address.zip = "33428";
			assert.deepEqual(insertLog, [
				[
					{ field: fieldAddress, index: 0 },
					{ field: fieldZip, index: 1 },
				],
			]);
			insertLog.length = 0;
			dataBinder.unregister();
			address.zip = "85521";
			assert.deepEqual(insertLog, []);
		});

		it("registers to root, enables autoFlush, matches paths with any index", () => {
			const { tree, root, address } = retrieveNodes();
			const insertPaths: BindPath[] = [[{ field: fieldAddress }, { field: fieldZip }]];
			const options: FlushableBinderOptions<ViewEvents> = createFlushableBinderOptions({
				autoFlushPolicy: "afterBatch",
			});
			const dataBinder: FlushableDataBinder<OperationBinderEvents> =
				createDataBinderBuffering(tree.events, options);
			const log: DownPath[] = [];
			dataBinder.register(
				root,
				BindingType.Insert,
				insertPaths,
				({ path, content }: InsertBindingContext) => {
					const downPath: DownPath = toDownPath(path);
					log.push(downPath);
				},
			);
			address.zip = "33428";
			assert.deepEqual(log, [
				[
					{ field: fieldAddress, index: 0 },
					{ field: fieldZip, index: 1 },
				],
			]);
			dataBinder.unregister();
			log.length = 0;
			address.zip = "92629";
			assert.deepEqual(log, []);
		});

		it("registers to root, matches paths with subtree policy and any index, sorts using a custom prescribed order. Native sort algorithm. Flush method called directly.", () => {
			const { tree, root, address } = retrieveNodes();
			const insertPaths: BindPath[] = [[{ field: fieldAddress }]];
			const prescribeOrder = [fieldZip, fieldStreet, fieldPhones, fieldSequencePhones];
			const options: FlushableBinderOptions<ViewEvents> = createFlushableBinderOptions({
				matchPolicy: "subtree",
				autoFlush: false,
				autoFlushPolicy: "afterBatch",
				sortFn: (a: BindingContext, b: BindingContext) => {
					const aIndex = prescribeOrder.indexOf(a.path.parentField);
					const bIndex = prescribeOrder.indexOf(b.path.parentField);
					return aIndex - bIndex;
				},
			});
			const dataBinder: FlushableDataBinder<OperationBinderEvents> =
				createDataBinderBuffering(tree.events, options);
			const log: DownPath[] = [];
			dataBinder.register(
				root,
				BindingType.Insert,
				insertPaths,
				(insertContext: InsertBindingContext) => {
					const downPath: DownPath = toDownPath(insertContext.path);
					log.push(downPath);
				},
			);
			address.phones = [111, 112];
			address.sequencePhones = ["111", "112"];
			address.zip = "33428";
			address.street = "street 1";
			// manual flush
			dataBinder.flush();
			const expectedLog = [
				[
					{
						field: fieldAddress,
						index: 0,
					},
					{ field: fieldZip, index: 1 },
				],
				[
					{
						field: fieldAddress,
						index: 0,
					},
					{ field: fieldStreet, index: 1 },
				],
				[
					{
						field: fieldAddress,
						index: 0,
					},
					{ field: fieldPhones, index: 1 },
				],
				[
					{
						field: fieldAddress,
						index: 0,
					},
					{ field: fieldSequencePhones, index: 0 },
				],
			];
			assert.deepEqual(log, expectedLog);
			dataBinder.unregister();
			log.length = 0;
			address.sequencePhones = ["114", "115"];
			assert.deepEqual(log, []);
		});

		it("registers to root, matches paths with subtree policy and any index, default sorting enabled (ie. deletes first). Native sort algorithm. Flush method called directly.", () => {
			const { tree, root, address } = retrieveNodes();
			const paths: BindPath[] = [[{ field: fieldAddress }]];
			const options: FlushableBinderOptions<ViewEvents> = createFlushableBinderOptions({
				matchPolicy: "subtree",
				autoFlush: false,
				autoFlushPolicy: "afterBatch",
			});
			const dataBinder: FlushableDataBinder<OperationBinderEvents> =
				createDataBinderBuffering(tree.events, options);
			const log: { type: BindingContextType }[] = [];
			dataBinder.register(
				root,
				BindingType.Insert,
				paths,
				(insertContext: InsertBindingContext) => {
					const downPath: DownPath = toDownPath(insertContext.path);
					log.push({ ...downPath, type: BindingType.Insert });
				},
			);
			dataBinder.register(
				root,
				BindingType.Delete,
				paths,
				(insertContext: DeleteBindingContext) => {
					const downPath: DownPath = toDownPath(insertContext.path);
					log.push({ ...downPath, type: BindingType.Delete });
				},
			);
			address.phones = [111, 112];
			address.sequencePhones = ["111", "112"];
			address.zip = "33428";
			address.street = "street 1";
			// manual flush
			dataBinder.flush();
			const expectedLog = [
				{
					"0": {
						field: "address",
						index: 0,
					},
					"1": {
						field: "phones",
						index: 0,
					},
					"type": "delete",
				},
				{
					"0": {
						field: "address",
						index: 0,
					},
					"1": {
						field: "sequencePhones",
						index: 0,
					},
					"type": "delete",
				},
				{
					"0": {
						field: "address",
						index: 0,
					},
					"1": {
						field: "zip",
						index: 0,
					},
					"type": "delete",
				},
				{
					"0": {
						field: "address",
						index: 0,
					},
					"1": {
						field: "street",
						index: 0,
					},
					"type": "delete",
				},
				{
					"0": {
						field: "address",
						index: 0,
					},
					"1": {
						field: "phones",
						index: 1,
					},
					"type": "insert",
				},
				{
					"0": {
						field: "address",
						index: 0,
					},
					"1": {
						field: "sequencePhones",
						index: 0,
					},
					"type": "insert",
				},
				{
					"0": {
						field: "address",
						index: 0,
					},
					"1": {
						field: "zip",
						index: 1,
					},
					"type": "insert",
				},
				{
					"0": {
						field: "address",
						index: 0,
					},
					"1": {
						field: "street",
						index: 1,
					},
					"type": "insert",
				},
			];
			assert.deepEqual(log, expectedLog);
			dataBinder.unregister();
			log.length = 0;
			address.sequencePhones = ["114", "115"];
			assert.deepEqual(log, []);
		});

		it("registers to root, matches paths with subtree policy and any index, stable sorting on a compare pipeline", () => {
			const { tree, root, address } = retrieveNodes();
			const paths: BindPath[] = [[{ field: fieldAddress }]];

			const compareBinderEventsCustom = (a: BindingContext, b: BindingContext): number => {
				const aField = String(a.path.parentField);
				const bField = String(b.path.parentField);
				return aField.localeCompare(bField, "en-US", { caseFirst: "lower" });
			};

			// stable sort, deletes first, then lexicographically by parent field (phones, sequencePhones, street, zip)
			const sortPipeline: CompareFunction<BindingContext> = comparePipeline(
				compareBinderEventsDeleteFirst,
				compareBinderEventsCustom,
			);

			// merge sort policy because javascript native is not stable
			const options: FlushableBinderOptions<ViewEvents> = createFlushableBinderOptions({
				matchPolicy: "subtree",
				autoFlush: false,
				autoFlushPolicy: "afterBatch",
				sortPolicy: "merge",
				sortFn: sortPipeline,
			});
			const dataBinder: FlushableDataBinder<OperationBinderEvents> =
				createDataBinderBuffering(tree.events, options);
			const log: { type: BindingContextType }[] = [];
			dataBinder.register(
				root,
				BindingType.Insert,
				paths,
				(insertContext: InsertBindingContext) => {
					const downPath: DownPath = toDownPath(insertContext.path);
					log.push({ ...downPath, type: BindingType.Insert });
				},
			);
			dataBinder.register(
				root,
				BindingType.Delete,
				paths,
				(insertContext: DeleteBindingContext) => {
					const downPath: DownPath = toDownPath(insertContext.path);
					log.push({ ...downPath, type: BindingType.Delete });
				},
			);
			// changes in random order
			address.zip = "33428";
			address.street = "street 1";
			address.phones = [111, 112];
			address.zip = "92629"; // zip twice
			address.sequencePhones = ["111", "112"];
			// manual flush
			dataBinder.flush();
			const expectedLog = [
				{
					"0": {
						field: "address",
						index: 0,
					},
					"1": {
						field: "phones",
						index: 0,
					},
					"type": "delete",
				},
				{
					"0": {
						field: "address",
						index: 0,
					},
					"1": {
						field: "sequencePhones",
						index: 0,
					},
					"type": "delete",
				},
				{
					"0": {
						field: "address",
						index: 0,
					},
					"1": {
						field: "street",
						index: 0,
					},
					"type": "delete",
				},
				{
					"0": {
						field: "address",
						index: 0,
					},
					"1": {
						field: "zip",
						index: 0,
					},
					"type": "delete",
				},
				{
					"0": {
						field: "address",
						index: 0,
					},
					"1": {
						field: "zip",
						index: 0,
					},
					"type": "delete",
				},
				{
					"0": {
						field: "address",
						index: 0,
					},
					"1": {
						field: "phones",
						index: 1,
					},
					"type": "insert",
				},
				{
					"0": {
						field: "address",
						index: 0,
					},
					"1": {
						field: "sequencePhones",
						index: 0,
					},
					"type": "insert",
				},
				{
					"0": {
						field: "address",
						index: 0,
					},
					"1": {
						field: "street",
						index: 1,
					},
					"type": "insert",
				},
				{
					"0": {
						field: "address",
						index: 0,
					},
					"1": {
						field: "zip",
						index: 1,
					},
					"type": "insert",
				},
				{
					"0": {
						field: "address",
						index: 0,
					},
					"1": {
						field: "zip",
						index: 1,
					},
					"type": "insert",
				},
			];
			assert.deepEqual(log, expectedLog);
			dataBinder.unregister();
			log.length = 0;
			address.sequencePhones = ["114", "115"];
			assert.deepEqual(log, []);
		});

		it("registers to root, matches paths with subtree policy and any index. Batch notification.", () => {
			const { tree, root, address } = retrieveNodes();
			const paths: BindPath[] = [[{ field: fieldAddress }]];
			const options: FlushableBinderOptions<ViewEvents> = createFlushableBinderOptions({
				matchPolicy: "subtree",
				autoFlush: false,
				autoFlushPolicy: "afterBatch",
			});
			const dataBinder: FlushableDataBinder<OperationBinderEvents> =
				createDataBinderBuffering(tree.events, options);
			const log: { type: BindingContextType }[][] = [];
			// the callback arg is optional, here used for testing
			dataBinder.register(
				root,
				BindingType.Insert,
				paths,
				(insertContext: InsertBindingContext) => {
					assert.fail("Should not be called");
				},
			);
			// the callback arg is optional, here used for testing
			dataBinder.register(
				root,
				BindingType.Delete,
				paths,
				(insertContext: DeleteBindingContext) => {
					assert.fail("Should not be called");
				},
			);
			// batch paths can be used to filter a subset of the events, here all events are batched
			dataBinder.register(
				root,
				BindingType.Batch,
				paths,
				(batchContext: BatchBindingContext) => {
					const batch: { type: BindingContextType }[] = [];
					for (const event of batchContext.events) {
						const downPath: DownPath = toDownPath(event.path);
						batch.push({ ...downPath, type: event.type });
					}
					log.push(batch);
				},
			);
			address.phones = [111, 112];
			address.sequencePhones = ["111", "112"];
			address.zip = "33428";
			address.street = "street 1";
			// manual flush
			dataBinder.flush();
			// only one large batch event expected
			assert.equal(log.length, 1);
			const expectedLog = [
				[
					{
						"0": {
							field: "address",
							index: 0,
						},
						"1": {
							field: "phones",
							index: 0,
						},
						"type": "delete",
					},
					{
						"0": {
							field: "address",
							index: 0,
						},
						"1": {
							field: "sequencePhones",
							index: 0,
						},
						"type": "delete",
					},
					{
						"0": {
							field: "address",
							index: 0,
						},
						"1": {
							field: "zip",
							index: 0,
						},
						"type": "delete",
					},
					{
						"0": {
							field: "address",
							index: 0,
						},
						"1": {
							field: "street",
							index: 0,
						},
						"type": "delete",
					},
					{
						"0": {
							field: "address",
							index: 0,
						},
						"1": {
							field: "phones",
							index: 1,
						},
						"type": "insert",
					},
					{
						"0": {
							field: "address",
							index: 0,
						},
						"1": {
							field: "sequencePhones",
							index: 0,
						},
						"type": "insert",
					},
					{
						"0": {
							field: "address",
							index: 0,
						},
						"1": {
							field: "zip",
							index: 1,
						},
						"type": "insert",
					},
					{
						"0": {
							field: "address",
							index: 0,
						},
						"1": {
							field: "street",
							index: 1,
						},
						"type": "insert",
					},
				],
			];
			assert.deepEqual(log, expectedLog);
			dataBinder.unregister();
			log.length = 0;
			address.sequencePhones = ["114", "115"];
			assert.deepEqual(log, []);
		});

		it("registers to root, matches paths with subtree policy and any index. Native (default) sorting. Combined batch and incremental notification", () => {
			const { tree, root, address } = retrieveNodes();
			const paths: BindPath[] = [[{ field: fieldAddress }]];
			const batchPaths: BindPath[] = [[{ field: fieldAddress }, { field: fieldZip }]];
			const options: FlushableBinderOptions<ViewEvents> = createFlushableBinderOptions({
				matchPolicy: "subtree",
				autoFlush: false,
				autoFlushPolicy: "afterBatch",
			});
			const dataBinder: FlushableDataBinder<OperationBinderEvents> =
				createDataBinderBuffering(tree.events, options);
			const incrLog: { type: BindingContextType }[] = [];
			dataBinder.register(
				root,
				BindingType.Insert,
				paths,
				(insertContext: InsertBindingContext) => {
					const downPath: DownPath = toDownPath(insertContext.path);
					incrLog.push({ ...downPath, type: BindingType.Insert });
				},
			);
			dataBinder.register(
				root,
				BindingType.Delete,
				paths,
				(insertContext: DeleteBindingContext) => {
					const downPath: DownPath = toDownPath(insertContext.path);
					incrLog.push({ ...downPath, type: BindingType.Delete });
				},
			);
			const batchLog: { type: BindingContextType }[][] = [];
			// batch paths can be used to filter a subset of the events, here only zip changes are batched
			// because of the `matchPolicy: "subtree"` option, would have been matched also changes on the zip node subtree if wouldn't be a terminal node
			dataBinder.register(
				root,
				BindingType.Batch,
				batchPaths,
				(batchContext: BatchBindingContext) => {
					const batch: { type: BindingContextType }[] = [];
					for (const event of batchContext.events) {
						const downPath: DownPath = toDownPath(event.path);
						batch.push({ ...downPath, type: event.type });
					}
					batchLog.push(batch);
				},
			);
			address.phones = [111, 112];
			address.sequencePhones = ["111", "112"];
			address.zip = "33428";
			address.street = "street 1";
			// manual flush
			dataBinder.flush();
			// only one selective batch event reflecting the batch selection paths
			// matching using global match policy
			// batch contents also sorted using the default sort policy (native) and compare function (deletes first)
			assert.equal(batchLog.length, 1);
			const expectedBatchLog = [
				[
					{
						"0": {
							field: "address",
							index: 0,
						},
						"1": {
							field: "zip",
							index: 0,
						},
						"type": "delete",
					},
					{
						"0": {
							field: "address",
							index: 0,
						},
						"1": {
							field: "zip",
							index: 1,
						},
						"type": "insert",
					},
				],
			];
			assert.deepEqual(batchLog, expectedBatchLog);
			// the incremental log should contain all other changes except the zip modifications
			assert.equal(incrLog.length, 6);
			const expectedIncrLog = [
				{
					"0": {
						field: "address",
						index: 0,
					},
					"1": {
						field: "phones",
						index: 0,
					},
					"type": "delete",
				},
				{
					"0": {
						field: "address",
						index: 0,
					},
					"1": {
						field: "sequencePhones",
						index: 0,
					},
					"type": "delete",
				},
				{
					"0": {
						field: "address",
						index: 0,
					},
					"1": {
						field: "street",
						index: 0,
					},
					"type": "delete",
				},
				{
					"0": {
						field: "address",
						index: 0,
					},
					"1": {
						field: "phones",
						index: 1,
					},
					"type": "insert",
				},
				{
					"0": {
						field: "address",
						index: 0,
					},
					"1": {
						field: "sequencePhones",
						index: 0,
					},
					"type": "insert",
				},
				{
					"0": {
						field: "address",
						index: 0,
					},
					"1": {
						field: "street",
						index: 1,
					},
					"type": "insert",
				},
			];
			assert.deepEqual(incrLog, expectedIncrLog);
			dataBinder.unregister();
			incrLog.length = 0;
			address.sequencePhones = ["114", "115"];
			assert.deepEqual(incrLog, []);
		});
	});

	describe("invalidating state data binder", () => {
		it("registers to root, enables autoFlush, matches paths with subtree policy and any index.", () => {
			const { tree, root, address } = retrieveNodes();
			const invalidPaths: BindPath[] = [[{ field: fieldAddress }]];
			const options: FlushableBinderOptions<ViewEvents> = createFlushableBinderOptions({
				autoFlushPolicy: "afterBatch",
				matchPolicy: "subtree",
			});
			const dataBinder: FlushableDataBinder<InvalidationBinderEvents> =
				createDataBinderInvalidate(tree.events, options);
			let invalidationCount = 0;
			dataBinder.register(
				root,
				BindingType.InvalidState,
				invalidPaths,
				(invalidStateContext: InvalidStateBindingContext) => {
					invalidationCount++;
				},
			);
			address.phones = [111, 112];
			assert.equal(invalidationCount, 1);
			dataBinder.unregister();
			invalidationCount = 0;
			address.phones = [113, 114];
			assert.equal(invalidationCount, 0);
		});
	});

	describe("direct data binder", () => {
		it("registers to root, enables autoFlush, matches paths with subtree policy and any index.", () => {
			const { tree, root, address } = retrieveNodes();
			const insertPaths: BindPath[] = [[{ field: fieldAddress }]];
			const options: BinderOptions = createBinderOptions({
				matchPolicy: "subtree",
				sortPolicy: "none",
			});
			const dataBinder: DataBinder<OperationBinderEvents> = createDataBinderDirect(
				tree.events,
				options,
			);
			const log: BindPath[] = [];
			dataBinder.register(
				root,
				BindingType.Insert,
				insertPaths,
				(insertContext: InsertBindingContext) => {
					const downPath: BindPath = toDownPath<BindPath>(insertContext.path);
					log.push(downPath);
				},
			);
			address.phones = [111, 112];
			assert.deepEqual(log, [
				[
					{ field: fieldAddress, index: 0 },
					{ field: fieldPhones, index: 1 },
				],
			]);
			dataBinder.unregister();
			log.length = 0;
			address.zip = "92629";
			assert.deepEqual(log, []);
		});
	});
});

function retrieveNodes() {
	const tree = treeView(personData);
	const root = tree.context.root.getNode(0);
	const address = root[getField](fieldAddress).getNode(0);
	const phones = address[getField](fieldSequencePhones);
	return { tree, root, address, phones };
}

function treeView(initialData: ContextuallyTypedNodeData): ISharedTreeView {
	const factory = new SharedTreeFactory();
	const tree = factory.create(new MockFluidDataStoreRuntime(), "test");
	return tree.schematize({
		allowedSchemaModifications: AllowedUpdateType.None,
		initialTree: initialData,
		schema: fullSchemaData,
	});
}
