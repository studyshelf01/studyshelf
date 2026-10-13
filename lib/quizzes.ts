export type QuizQuestion = {
  question: string;
  options: string[];
  answer: number;
  explanation: string;
};

export type BuiltInQuiz = {
  id: string;
  title: string;
  subject: string;
  description: string;
  questions: QuizQuestion[];
};

export const builtInQuizzes: BuiltInQuiz[] = [
  {
    id: "math-foundations",
    title: "Math Foundations",
    subject: "Mathematics",
    description: "Practise fractions, percentages, and algebra.",
    questions: [
      {
        question: "What is 3/4 written as a percentage?",
        options: ["25%", "50%", "75%", "80%"],
        answer: 2,
        explanation: "3 ÷ 4 = 0.75, which is 75%.",
      },
      {
        question: "Solve: 2x + 6 = 16.",
        options: ["x = 4", "x = 5", "x = 6", "x = 11"],
        answer: 1,
        explanation: "Subtract 6 to get 2x = 10, then divide by 2.",
      },
      {
        question: "What is the area of a rectangle 7 cm long and 4 cm wide?",
        options: ["11 cm²", "22 cm²", "28 cm²", "32 cm²"],
        answer: 2,
        explanation: "Area = length × width = 7 × 4 = 28 cm².",
      },
      {
        question: "What is 15% of 200?",
        options: ["15", "20", "30", "35"],
        answer: 2,
        explanation: "0.15 × 200 = 30.",
      },
      {
        question: "Simplify: 3a + 2a.",
        options: ["5", "5a", "6a", "a⁵"],
        answer: 1,
        explanation: "Like terms combine: 3a + 2a = 5a.",
      },
    ],
  },
  {
    id: "biology-basics",
    title: "Biology Basics",
    subject: "Biology",
    description: "Review cells, photosynthesis, and body systems.",
    questions: [
      {
        question: "Which structure controls many activities of a cell?",
        options: ["Nucleus", "Cell wall", "Vacuole", "Cytoplasm"],
        answer: 0,
        explanation: "The nucleus contains genetic material and regulates many cell activities.",
      },
      {
        question: "Which gas do plants take in for photosynthesis?",
        options: ["Oxygen", "Nitrogen", "Carbon dioxide", "Hydrogen"],
        answer: 2,
        explanation: "Plants use carbon dioxide and water to make sugars using light energy.",
      },
      {
        question: "Which organ pumps blood around the human body?",
        options: ["Lung", "Heart", "Kidney", "Stomach"],
        answer: 1,
        explanation: "The heart pumps blood through the circulatory system.",
      },
      {
        question: "What is the basic unit of living organisms?",
        options: ["Organ", "Tissue", "Cell", "Organ system"],
        answer: 2,
        explanation: "The cell is the basic structural and functional unit of life.",
      },
      {
        question: "Which substance carries genetic information?",
        options: ["DNA", "Starch", "Water", "Glucose"],
        answer: 0,
        explanation: "DNA stores genetic instructions used by living organisms.",
      },
    ],
  },
  {
    id: "english-grammar",
    title: "English Grammar",
    subject: "English",
    description: "Practise verbs, punctuation, and sentence structure.",
    questions: [
      {
        question: "Choose the correct sentence.",
        options: [
          "She walk to school.",
          "She walks to school.",
          "She walking to school.",
          "She have walk to school.",
        ],
        answer: 1,
        explanation: "In the present simple, 'she' takes the verb form 'walks'.",
      },
      {
        question: "Which word is an adjective in 'The bright star shone'?",
        options: ["The", "bright", "star", "shone"],
        answer: 1,
        explanation: "'Bright' describes the noun 'star'.",
      },
      {
        question: "What punctuation usually ends a direct question?",
        options: ["Full stop", "Comma", "Question mark", "Colon"],
        answer: 2,
        explanation: "A direct question normally ends with a question mark.",
      },
      {
        question: "What is the past tense of 'go'?",
        options: ["Goed", "Gone", "Going", "Went"],
        answer: 3,
        explanation: "'Went' is the simple past tense of 'go'.",
      },
      {
        question: "Which word is a conjunction in 'I stayed because it rained'?",
        options: ["stayed", "because", "rained", "I"],
        answer: 1,
        explanation: "'Because' connects the main clause with the reason clause.",
      },
    ],
  },
];