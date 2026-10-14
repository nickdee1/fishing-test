import raw from "@/data/questions.json";

export type Topic = { id: number; name: string; short: string; ru: string };
export type Question = {
  id: string;
  topic: number;
  n: number;
  q: string;
  options: string[];
  correct: number;
  img?: string;
};

export const topics: Topic[] = raw.topics;
export const questions: Question[] = raw.questions;
export const byId: Record<string, Question> = Object.fromEntries(questions.map((q) => [q.id, q]));

export function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
