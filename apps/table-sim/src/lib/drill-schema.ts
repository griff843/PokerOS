import {
  CanonicalDrillSchema,
  CanonicalDrillsFileSchema,
  type CanonicalDrill,
  type DrillAnswer,
  type DrillOption,
} from "../../../../packages/core/src/schemas";

export const TableSimDrillSchema = CanonicalDrillSchema;
export const TableSimDrillsFileSchema = CanonicalDrillsFileSchema;

export type TableSimDrill = CanonicalDrill;
export type TableSimAnswer = DrillAnswer;
export type TableSimOption = DrillOption;
