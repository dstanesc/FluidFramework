/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */
export {
	createChildMonitoringContext,
	MonitoringContext,
	sessionStorageConfigProvider,
	mixinMonitoringContext,
	IConfigProvider,
	loggerToMonitoringContext,
} from "./config";
export {
	DataCorruptionError,
	DataProcessingError,
	extractSafePropertiesFromMessage,
	GenericError,
	UsageError,
} from "./error";
export {
	extractLogSafeErrorProperties,
	generateErrorWithStack,
	generateStack,
	getCircularReplacer,
	IFluidErrorAnnotations,
	isExternalError,
	isILoggingError,
	isTaggedTelemetryPropertyValue,
	LoggingError,
	NORMALIZED_ERROR_TYPE,
	normalizeError,
	overwriteStack,
	wrapError,
	wrapErrorAndLog,
} from "./errorLogging";
export { EventEmitterWithErrorHandling } from "./eventEmitterWithErrorHandling";
export {
	connectedEventName,
	disconnectedEventName,
	raiseConnectedEvent,
	safeRaiseEvent,
} from "./events";
export {
	hasErrorInstanceId,
	IFluidErrorBase,
	isFluidError,
	isValidLegacyError,
} from "./fluidErrorBase";
export {
	eventNamespaceSeparator,
	createChildLogger,
	createMultiSinkLogger,
	formatTick,
	IPerformanceEventMarkers,
	ITelemetryLoggerPropertyBag,
	ITelemetryLoggerPropertyBags,
	MultiSinkLoggerProperties,
	numberFromString,
	PerformanceEvent,
	TaggedLoggerAdapter,
	tagData,
	tagCodeArtifacts,
	TelemetryDataTag,
	TelemetryEventPropertyTypes,
	TelemetryNullLogger,
} from "./logger";
export { MockLogger } from "./mockLogger";
export { ThresholdCounter } from "./thresholdCounter";
export { SampledTelemetryHelper } from "./sampledTelemetryHelper";
export { logIfFalse, createSampledLogger, IEventSampler, ISampledTelemetryLogger } from "./utils";
export {
	TelemetryEventPropertyTypeExt,
	ITelemetryEventExt,
	ITelemetryGenericEventExt,
	ITelemetryErrorEventExt,
	ITelemetryPerformanceEventExt,
	ITelemetryLoggerExt,
	ITaggedTelemetryPropertyTypeExt,
	ITelemetryPropertiesExt,
	TelemetryEventCategory,
} from "./telemetryTypes";

/**
 * Types supported by {@link IConfigProviderBase}.
 * @deprecated Use ConfigTypes from fluidFramework/core-interfaces
 *
 * @internal
 */
export type ConfigTypes = string | number | boolean | number[] | string[] | boolean[] | undefined;

/**
 * Base interface for providing configurations to enable/disable/control features.
 *
 * @deprecated Use IConfigProviderBase from fluidFramework/core-interfaces
 *
 * @internal
 */
export interface IConfigProviderBase {
	getRawConfig(name: string): ConfigTypes;
}
