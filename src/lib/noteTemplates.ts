import type { LineAttributes, RichDelta, RichOp } from "./richText";

export interface NoteTemplate {
  id: string;
  label: string;
  description: string;
  title: string;
  delta: RichDelta;
}

type Line = string | [string, LineAttributes];

function lines(...items: Line[]): RichDelta {
  const ops: RichOp[] = [];
  for (const item of items) {
    const [text, attributes] = typeof item === "string" ? [item, undefined] : item;
    if (text) ops.push({ insert: text });
    ops.push(attributes ? { insert: "\n", attributes } : { insert: "\n" });
  }
  return { ops };
}

const h2 = (text: string): Line => [text, { header: 2 }];
const task = (text: string): Line => [text, { list: "unchecked" }];
const bullet = (text: string): Line => [text, { list: "bullet" }];

export const NOTE_TEMPLATES: NoteTemplate[] = [
  { id: "blank", label: "Blank", description: "Start from an empty page", title: "", delta: lines("") },
  {
    id: "meeting",
    label: "Meeting notes",
    description: "Agenda, notes and action items",
    title: "Meeting notes",
    delta: lines("Date: ", "Attendees: ", h2("Agenda"), bullet(""), h2("Notes"), "", h2("Action items"), task("")),
  },
  {
    id: "diary",
    label: "Diary",
    description: "Reflect on your day",
    title: "Diary",
    delta: lines(h2("How I feel today"), "", h2("What happened"), "", h2("Grateful for"), bullet(""), h2("Tomorrow I want to"), task("")),
  },
  {
    id: "todo",
    label: "To-do list",
    description: "A checklist to tick off",
    title: "To-do",
    delta: lines(task(""), task(""), task("")),
  },
  {
    id: "project",
    label: "Project plan",
    description: "Goal, milestones and risks",
    title: "Project plan",
    delta: lines(h2("Goal"), "", h2("Milestones"), task(""), task(""), h2("Risks"), bullet(""), h2("Next steps"), task("")),
  },
  {
    id: "study",
    label: "Study notes",
    description: "Key points and questions",
    title: "Study notes",
    delta: lines("Topic: ", h2("Key points"), bullet(""), h2("Questions"), bullet(""), h2("Summary"), ""),
  },
];
