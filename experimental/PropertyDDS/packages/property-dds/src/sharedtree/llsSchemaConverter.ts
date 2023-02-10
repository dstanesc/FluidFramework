/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-explicit-any */
/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

// eslint-disable-next-line import/no-nodejs-modules
import { fail } from "assert";
import {
	brand,
	emptyField,
	EmptyKey,
	FieldKindIdentifier,
	FieldSchema,
	LocalFieldKey,
	rootFieldKey,
	SchemaData,
	TreeSchema,
	TreeSchemaIdentifier,
	ValueSchema,
	FullSchemaPolicy,
} from "@fluid-internal/tree";
import { PropertyFactory, PropertyTemplate } from "@fluid-experimental/property-properties";
import { TypeIdHelper } from "@fluid-experimental/property-changeset";

const booleanTypes = new Set(["Bool"]);
const numberTypes = new Set([
	"Int8",
	"Uint8",
	"Int16",
	"Uint16",
	"Int32",
	"Int64",
	"Uint64",
	"Uint32",
	"Float32",
	"Float64",
	"Enum",
]);
const primitiveTypes = new Set([
	"Bool",
	"String",
	"Int8",
	"Uint8",
	"Int16",
	"Uint16",
	"Int32",
	"Int64",
	"Uint64",
	"Uint32",
	"Float32",
	"Float64",
	"Enum",
]);

// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
type Context = {
	typeid: TreeSchemaIdentifier;
	context: string;
	types?: Set<TreeSchemaIdentifier>;
};

function isIgnoreNestedProperties(typeid: string): boolean {
	return typeid === "Enum";
}

export function convertSchemaToSharedTreeLls(
	policy: FullSchemaPolicy,
	rootFieldSchema: FieldSchema,
): SchemaData {
	const [ValueFieldKind, OptionalFieldKind, SequenceFieldKind] = policy.fieldKinds.keys();
	const treeSchema = new Map();
	const rootTypes = rootFieldSchema.types ?? fail("Expected root types");

	// Extract all referenced typeids for the schema
	const unprocessedTypeIds: string[] = [...rootTypes];
	const referencedTypeIDs = new Map<TreeSchemaIdentifier, Context>();

	while (unprocessedTypeIds.length > 0) {
		const unprocessedTypeID = unprocessedTypeIds.pop() ?? fail("fail");

		const context: Context = {
			typeid: brand(unprocessedTypeID),
			context: "single",
		};
		referencedTypeIDs.set(brand(unprocessedTypeID), context);

		const schemaTemplate = PropertyFactory.getTemplate(unprocessedTypeID);
		if (schemaTemplate === undefined) {
			throw new Error(`Unknown typeid: ${unprocessedTypeID}`);
		}
		const dependencies = PropertyTemplate.extractDependencies(
			schemaTemplate,
		) as TreeSchemaIdentifier[];
		for (const dependencyTypeId of dependencies) {
			if (!referencedTypeIDs.has(dependencyTypeId)) {
				unprocessedTypeIds.push(dependencyTypeId);
			}
		}

		// Extract context information (i.e. array, map and set types)
		const extractContexts = (properties: any[]): void => {
			for (const property of properties || []) {
				if (property.properties) {
					// We have a nested set of properties
					// TODO: We have to create a corresponding nested type
					extractContexts(property.properties);
				}
				if (property.context !== undefined && property.context !== "single") {
					referencedTypeIDs.set(brand(`${property.context}<${property.typeid}>`), {
						typeid: property.typeid,
						context: property.context,
					});
				}
				if (TypeIdHelper.isPrimitiveType(property.typeid)) {
					referencedTypeIDs.set(property.typeid, {
						typeid: property.typeid,
						context: "single",
					});
				}
			}
		};
		extractContexts(schemaTemplate.properties);
	}

	for (const type of primitiveTypes) {
		const typeid: TreeSchemaIdentifier = brand(type);
		if (!referencedTypeIDs.has(typeid)) {
			referencedTypeIDs.set(typeid, {
				typeid,
				context: "single",
			});
		}
	}

	// Now we create the actual schemas, since we are now able to reference the dependent types
	for (const [referencedTypeId, context] of referencedTypeIDs) {
		if (treeSchema.get(referencedTypeId) !== undefined) {
			continue;
		}
		let typeSchema: TreeSchema | undefined;

		if (context.context === "single") {
			if (TypeIdHelper.isPrimitiveType(referencedTypeId)) {
				// if (context.typeid === "String") {
				//     // String is a special case, we actually have to represent it as a sequence
				//     typeSchema = {
				//         localFields: new Map<LocalFieldKey, FieldSchema>([
				//             [
				//                 EmptyKey,
				//                 {
				//                     kind: fieldKinds.sequence,
				//                     types: new Set([
				//                         // TODO: Which type do we use for characters?
				//                     ]),
				//                 },
				//             ],
				//         ]),
				//         globalFields: new Set(),
				//         extraLocalFields: emptyField,
				//         extraGlobalFields: false,
				//         value: ValueSchema.Nothing,
				//     };
				// } else {
				let valueType: ValueSchema;
				// if (context.isEnum) {
				//     valueType = ValueSchema.Number;
				if (context.typeid.startsWith("Reference<")) {
					valueType = ValueSchema.String;
				} else if (booleanTypes.has(context.typeid)) {
					valueType = ValueSchema.Boolean;
				} else if (numberTypes.has(context.typeid)) {
					valueType = ValueSchema.Number;
				} else if (context.typeid === "String") {
					valueType = ValueSchema.String;
				} else if (context.typeid === "Enum") {
					valueType = ValueSchema.Number;
				} else {
					throw new Error(`Unknown primitive typeid: ${context.typeid}`);
				}

				typeSchema = {
					localFields: new Map(),
					globalFields: new Set(),
					extraLocalFields: emptyField,
					extraGlobalFields: false,
					value: valueType,
				};
				// }
			} else {
				if (context.typeid === "NodeProperty") {
					typeSchema = {
						localFields: new Map(),
						globalFields: new Set(),
						extraLocalFields: {
							kind: OptionalFieldKind,
						},
						extraGlobalFields: false,
						value: ValueSchema.Nothing,
					};
				} else {
					const localFields = new Map<LocalFieldKey, FieldSchema>();
					const inheritanceChain = PropertyFactory.getAllParentsForTemplate(
						context.typeid,
					);
					inheritanceChain.push(context.typeid);

					for (const typeIdInInheritanceChain of inheritanceChain) {
						if (typeIdInInheritanceChain === "NodeProperty") {
							continue;
						}

						const schema = PropertyFactory.getTemplate(typeIdInInheritanceChain);
						if (schema === undefined) {
							throw new Error(
								`Unknown typeid referenced: ${typeIdInInheritanceChain}`,
							);
						}
						for (const property of schema.properties) {
							if (property.properties && !isIgnoreNestedProperties(property.typeid)) {
								// TODO: Handle nested properties
							} else {
								let currentTypeid = property.typeid;
								if (property.context && property.context !== "single") {
									currentTypeid = `${property.context}<${property.typeid || ""}>`;
								}
								const fieldKey: LocalFieldKey = brand(property.id);
								if (!localFields.has(fieldKey)) {
									localFields.set(fieldKey, {
										kind: property.optional
											? OptionalFieldKind
											: ValueFieldKind,
										types: new Set([currentTypeid]),
									});
								} else {
									const types = localFields.get(fieldKey)?.types ?? fail("never");
									localFields.set(fieldKey, {
										kind: property.optional
											? OptionalFieldKind
											: ValueFieldKind,
										types: new Set([...types, currentTypeid]),
									});
								}
							}
						}
					}

					typeSchema = {
						localFields,
						globalFields: new Set(),
						extraLocalFields: PropertyFactory.inheritsFrom(
							context.typeid,
							"NodeProperty",
						)
							? { kind: OptionalFieldKind }
							: emptyField,
						extraGlobalFields: false,
						value: ValueSchema.Nothing,
					};
				}
			}
		} else {
			const kind: FieldKindIdentifier =
				context.context === "array" ? SequenceFieldKind : OptionalFieldKind;

			const fieldType = {
				kind,
				types: context.types ?? new Set([context.typeid]),
			};
			switch (context.context) {
				case "map":
				case "set":
					typeSchema = {
						localFields: new Map(),
						globalFields: new Set(),
						extraLocalFields: fieldType,
						extraGlobalFields: false,
						value: ValueSchema.Serializable,
					};

					break;
				case "array":
					typeSchema = {
						localFields: new Map<LocalFieldKey, FieldSchema>([[EmptyKey, fieldType]]),
						globalFields: new Set(),
						extraLocalFields: emptyField,
						extraGlobalFields: false,
						value: ValueSchema.Nothing,
					};
					break;
				default:
					throw new Error(`Unknown context in typeid: ${context.context}`);
			}
		}

		treeSchema.set(referencedTypeId, typeSchema);
	}
	const fullSchemaData: SchemaData = {
		treeSchema,
		globalFieldSchema: new Map([[rootFieldKey, rootFieldSchema]]),
	};
	return fullSchemaData;
}

// Concepts currently not mapped / represented in the compiled schema:
//
// * Annotations
// * Length constraints for arrays / strings
// * Constants
// * Values for enums
// * Default values
