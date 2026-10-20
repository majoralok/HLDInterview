import type { DesignProblem } from "./problem-bank";
export class ReviewRequestError extends Error { status: number; }
export function readReviewRequest(request: Request, problems: DesignProblem[]): Promise<{problem: DesignProblem; answer: string}>;
