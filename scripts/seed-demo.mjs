// Seed demo data for the kinetic-canvas guest experience.
// Uses the publishable (anon) Supabase key from .env so it runs without
// auth. Quiz + questions insert via the draft RLS policies; the invitation
// inserts via the "Anyone can create invitations for active quizzes" policy
// (created by supabase/seed_demo.sql — run that once in the SQL Editor).
//
//   bun run seed:demo
//
// Each run creates a fresh quiz + invitation and prints the guest link.
// For a stable, known link, run supabase/seed_demo.sql in the
// Supabase SQL Editor instead.

import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(here, "..", ".env");

const env = readFileSync(envPath, "utf8")
  .split("\n")
  .reduce((acc, line) => {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) acc[match[1]] = match[2].trim().replace(/^["']|["']$/g, "");
    return acc;
  }, {});

const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  console.error("Missing VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY in .env");
  process.exit(1);
}

const supabase = createClient(url, key);

const QUIZ_ID = randomUUID();
const INVITATION_ID = randomUUID();
const CODE = "DEMO" + Math.floor(100 + Math.random() * 900); // 6 chars

const questions = [
  { category: "food", text: "What is my go-to comfort food after a long day?", correct: "A bowl of noodles", distractors: ["Sushi", "A rich chocolate cake", "Something spicy"] },
  { category: "travel", text: "Which trip would I book again in a heartbeat?", correct: "A quiet cabin in the woods", distractors: ["A packed city tour", "A resort with a crowd", "A road trip with no plan"] },
  { category: "entertainment", text: "Pick the movie night I would never say no to.", correct: "A cozy rom-com", distractors: ["A scary thriller", "A loud action film", "A slow documentary"] },
  { category: "leisure", text: "My idea of the perfect Sunday involves...", correct: "Sleeping in and a slow breakfast", distractors: ["A big hike", "Running errands", "A full social calendar"] },
  { category: "emotion", text: "When I am stressed, I recharge by...", correct: "A long walk with music", distractors: ["Venting to a friend", "Scrolling for hours", "Cleaning the whole place"] },
  { category: "growth", text: "Our shared goal I care most about is...", correct: "Learning something new together", distractors: ["Saving for a big trip", "Getting fit", "Less screen time"] },
];

async function main() {
  const { error: quizError } = await supabase.from("quizzes").insert({
    id: QUIZ_ID,
    user_id: null,
    title: "Getting to Know Us",
    is_open: false,
    is_active: true,
    max_questions: 10,
    language: "en",
  });
  if (quizError) throw quizError;

  const { error: qError } = await supabase.from("quiz_questions").insert(
    questions.map((q, i) => ({
      id: randomUUID(),
      quiz_id: QUIZ_ID,
      question_ref_id: i + 1,
      category: q.category,
      question_text: q.text,
      order_number: i + 1,
      correct_answers: [q.correct],
      distractor_answers: q.distractors,
      is_custom: false,
    })),
  );
  if (qError) throw qError;

  const { error: invError } = await supabase.from("invitations").insert({
    id: INVITATION_ID,
    quiz_id: QUIZ_ID,
    code: CODE,
    label: "Demo Guest",
    is_used: false,
  });
  if (invError) {
    console.warn("\nWarning: could not insert the invitation via the anon key:", invError.message);
    console.warn("Run supabase/seed_demo.sql in the Supabase SQL Editor once (it creates the needed RLS policy).");
    console.warn("The quiz + questions are seeded; the guest link just needs a valid invitation code.");
  }

  console.log("Demo data seeded.");
  console.log(`Open: /quiz/${QUIZ_ID}?code=${CODE}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
