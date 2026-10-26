import type { Diagram } from "./architecture-core.js";
export type ProgressEntry = {
  status: "todo" | "in_progress" | "done";
  bookmarked: boolean;
  attempts: number;
  score?: number;
  draft?: string;
  diagram?: Diagram;
  lastPracticed?: string;
};
export type Finding = { severity: string; dimension: string; title: string; evidence: string; recommendation: string };
export type Feedback = { score: number; summary: string; strengths: string[]; improvements: string[]; followUp: string; findings?: Finding[] };
export const MAX_ANSWER: number;
export const MAX_IMPORT_BYTES: number;
export function parseProgress(value: unknown, ids: string[]): Record<string, ProgressEntry>;
export function parseImport(text: string, ids: string[]): Record<string, ProgressEntry>;
export function writtenAnswer(answer: string, template: string): string;
export function localAssessment(answer: string, problem: {interviewerPush: string}, template: string, diagram?: Diagram): Feedback;
export function isFeedback(value: unknown): value is Feedback;
