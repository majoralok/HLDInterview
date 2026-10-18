import { PracticeStudio } from "@/components/practice-studio";
import { problemBank } from "@/lib/problem-bank";

export default function Home() {
  return <PracticeStudio problems={problemBank} />;
}
