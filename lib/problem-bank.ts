import problems from "@/data/problems.json";

export type Difficulty = "Foundation" | "Intermediate" | "Advanced";
export type Category =
  | "Core patterns"
  | "Data intensive"
  | "Real time"
  | "Infrastructure"
  | "AI systems";

export type DesignProblem = {
  id: string;
  order: number;
  title: string;
  shortTitle: string;
  summary: string;
  difficulty: Difficulty;
  category: Category;
  minutes: number;
  focus: string[];
  scale: string;
  requirements: string[];
  constraints: string[];
  checkpoints: string[];
  interviewerPush: string;
};

export const problemBank = problems as DesignProblem[];

export const categories = [...new Set(problemBank.map((problem) => problem.category))];
