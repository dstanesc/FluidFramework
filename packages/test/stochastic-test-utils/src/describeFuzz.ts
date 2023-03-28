/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

function createFuzzSuite(
	tests: (this: Mocha.Suite, args: FuzzSuiteArguments) => void,
	args: FuzzSuiteArguments,
) {
	return function (this: Mocha.Suite) {
		tests.bind(this)(args);
	};
}

export type DescribeFuzzSuite = (
	name: string,
	tests: (this: Mocha.Suite, args: FuzzSuiteArguments) => void,
) => Mocha.Suite | void;

export interface FuzzSuiteArguments {
	/**
	 * The number of tests this suite should produce up to a constant factor.
	 * It's up to the suite author to decide which parameters to vary in order to scale up the number of tests.
	 * This parameter can be interpreted liberally by the suite author--e.g. in a suite with 4 "classes" of fuzz
	 * tests due to differences in configuration, running `testCount` tests for each variation (for a total of
	 * `4 * testCount` tests) is fine.
	 */
	testCount: number;
	/**
	 * Whether the current run is a stress run.
	 */
	isStress: boolean;
}

export type DescribeFuzz = DescribeFuzzSuite & Record<"skip" | "only", DescribeFuzzSuite>;

export interface FuzzDescribeOptions {
	defaultTestCount?: number;
}

export const defaultOptions: Required<FuzzDescribeOptions> = {
	defaultTestCount: 1,
};

export function createFuzzDescribe(optionsArg?: FuzzDescribeOptions): DescribeFuzz {
	const options = { ...defaultOptions, ...optionsArg };
	const testCountFromEnv =
		process.env.FUZZ_TEST_COUNT !== undefined
			? Number.parseInt(process.env.FUZZ_TEST_COUNT, 10)
			: undefined;
	const testCount = testCountFromEnv ?? options.defaultTestCount;
	const isStress = process.env.FUZZ_STRESS_RUN !== undefined && !!process.env.FUZZ_STRESS_RUN;
	const args = { testCount, isStress };
	const d: DescribeFuzz = (name, tests) =>
		(isStress ? describe.only : describe)(name, createFuzzSuite(tests, args));
	d.skip = (name, tests) => describe.skip(name, createFuzzSuite(tests, args));
	d.only = (name, tests) => describe.only(name, createFuzzSuite(tests, args));
	return d;
}

/**
 * Like `Mocha.describe`, but enables injection of suite size at runtime.
 * The test creation callback receives a `testCount` parameter which it should use to support
 * this functionality.
 */
export const describeFuzz: DescribeFuzz = createFuzzDescribe();
