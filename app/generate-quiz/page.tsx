"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Resource = {
  id: number;
  title: string;
  description: string | null;
  grade: string;
  subject: string;
  topic: string | null;
  file_url: string;
  status: string;
};

type Question = {
  question: string;
  options: string[];
  answer: number;
  explanation: string;
  difficulty: string;
};

type PromiseWithResolversSupport = PromiseConstructor & {
  withResolvers?: <T>() => {
    promise: Promise<T>;
    resolve: (value: T | PromiseLike<T>) => void;
    reject: (reason?: unknown) => void;
  };
};

function addPromiseWithResolversFallback() {
  const promiseConstructor =
    Promise as PromiseWithResolversSupport;

  if (typeof promiseConstructor.withResolvers !== "function") {
    promiseConstructor.withResolvers = function <T>() {
      let resolve!: (value: T | PromiseLike<T>) => void;
      let reject!: (reason?: unknown) => void;

      const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
      });

      return { promise, resolve, reject };
    };
  }
}

export default function GenerateQuizPage() {
  const router = useRouter();

  const [resources, setResources] = useState<Resource[]>([]);
  const [selectedResource, setSelectedResource] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [quizTitle, setQuizTitle] = useState("");
  const [quizSubject, setQuizSubject] = useState("");
  const [userId, setUserId] = useState("");
  const [loadingResources, setLoadingResources] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadResources() {
      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
          router.replace("/login");
          return;
        }

        const { data: profile, error: profileError } =
          await supabase
            .from("profiles")
            .select("role,status")
            .eq("id", user.id)
            .maybeSingle();

        if (profileError) {
          throw new Error(
            "Could not verify your account permissions."
          );
        }

        if (!profile || profile.status !== "active") {
          router.replace("/login");
          return;
        }

        if (cancelled) return;

        setUserId(user.id);

        const { data, error: resourcesError } =
          await supabase
            .from("resources")
            .select(
              "id,title,description,grade,subject,topic,file_url,status"
            )
            .eq("status", "approved")
            .order("created_at", { ascending: false });

        if (resourcesError) {
          throw new Error(
            "Could not load approved resources."
          );
        }

        if (!cancelled) {
          setResources((data ?? []) as Resource[]);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Something went wrong while loading resources."
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingResources(false);
        }
      }
    }

    loadResources();

    return () => {
      cancelled = true;
    };
  }, [router]);

  async function generateQuiz() {
    const resource = resources.find(
      (item) => String(item.id) === selectedResource
    );

    if (!resource) {
      setError("Please select a resource first.");
      return;
    }

    setGenerating(true);
    setError("");
    setMessage("");
    setQuestions([]);
    setAnswers({});
    setFinished(false);
    setCurrentQuestion(0);

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.access_token) {
        router.replace("/login");
        throw new Error(
          "Your session has expired. Please sign in again."
        );
      }

      setMessage("Reading your PDF...");

      // Keep the existing compatibility fallback.
      addPromiseWithResolversFallback();

      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.mjs";

      const response = await fetch(resource.file_url);

      if (!response.ok) {
        throw new Error(
          "Could not download this PDF. Please try another resource."
        );
      }

      const pdfData = await response.arrayBuffer();
      const pdf = await pdfjs.getDocument({
        data: pdfData,
      }).promise;

      const pageTexts: string[] = [];
      const pagesToRead = Math.min(pdf.numPages, 25);

      for (
        let pageNumber = 1;
        pageNumber <= pagesToRead;
        pageNumber++
      ) {
        const page = await pdf.getPage(pageNumber);

        // Read the text stream directly instead of calling
        // getTextContent(), which can fail in affected Safari
        // versions when ReadableStream lacks async iteration.
        const reader = page.streamTextContent().getReader();
        const textParts: string[] = [];

        try {
          while (true) {
            const { value, done } = await reader.read();

            if (done) break;

            for (const item of value.items) {
              if ("str" in item) {
                textParts.push(item.str);
              }
            }
          }
        } finally {
          reader.releaseLock();
        }

        const text = textParts.join(" ");

        if (text.trim()) {
          pageTexts.push(text);
        }
      }

      const extractedText = pageTexts.join("\n").trim();

      if (extractedText.length < 300) {
        throw new Error(
          "This PDF does not contain enough selectable text. Scanned pages that are just images may not work yet."
        );
      }

      setMessage("Asking the AI to build your quiz...");

      const aiResponse = await fetch("/api/generate-quiz", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          text: extractedText.slice(0, 45000),
          title: resource.title,
          subject: resource.subject,
        }),
      });

      const result = await aiResponse.json();

      if (!aiResponse.ok) {
        throw new Error(
          typeof result.error === "string"
            ? result.error
            : "The AI could not generate your quiz."
        );
      }

      if (
        !Array.isArray(result.questions) ||
        result.questions.length < 5
      ) {
        throw new Error(
          "The AI did not return enough valid questions. Please try again with another resource."
        );
      }

      setQuestions(result.questions as Question[]);
      setQuizTitle(`${resource.title} Quiz`);
      setQuizSubject(resource.subject);
      setMessage(
        `Your AI-generated quiz is ready with ${result.questions.length} questions. Review the explanations as you practise.`
      );
    } catch (err) {
      console.error("Quiz generation failed:", err);

      setMessage("");
      setError(
        err instanceof Error
          ? err.message
          : "Quiz generation failed. Please try again."
      );
    } finally {
      setGenerating(false);
    }
  }

  function chooseAnswer(optionIndex: number) {
    if (finished) return;

    setAnswers((previous) => ({
      ...previous,
      [currentQuestion]: optionIndex,
    }));
  }

  const score = questions.reduce(
    (total, question, index) =>
      total + (answers[index] === question.answer ? 1 : 0),
    0
  );

  function finishQuiz() {
    if (Object.keys(answers).length !== questions.length) {
      setError(
        "Please answer every question before finishing."
      );
      return;
    }

    setError("");
    setFinished(true);
  }

  function restartQuiz() {
    setAnswers({});
    setCurrentQuestion(0);
    setFinished(false);
    setError("");
    setMessage("");
  }

  async function saveAttempt() {
    if (!userId || !questions.length) {
      setError(
        "Your result could not be saved. Please sign in again."
      );
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const { error: saveError } = await supabase
        .from("quiz_attempts")
        .insert({
          user_id: userId,
          quiz_id: selectedResource,
          quiz_title: quizTitle,
          subject: quizSubject,
          score,
          total_questions: questions.length,
        });

      if (saveError) throw saveError;

      setMessage("Your quiz result was saved successfully.");
    } catch (err) {
      console.error("Saving quiz attempt failed:", err);

      setError(
        "Could not save your result. Check your quiz_attempts table permissions in Supabase, then try again."
      );
    } finally {
      setSaving(false);
    }
  }

  const activeQuestion = questions[currentQuestion];

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100 sm:px-6">
      <div className="mx-auto max-w-4xl">
        <header className="mb-8">
          <Link
            href="/"
            className="text-sm text-cyan-300 transition hover:text-cyan-200"
          >
            ← Back to StudyShelf
          </Link>

          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            AI Quiz Generator
          </h1>

          <p className="mt-2 text-slate-400">
            Turn your study resources into practice questions that test
            understanding, not just memorisation.
          </p>
        </header>

        {error && (
          <div
            role="alert"
            className="mb-5 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm leading-6 text-red-200"
          >
            {error}
          </div>
        )}

        {message && (
          <div
            role="status"
            className="mb-5 rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-4 text-sm leading-6 text-cyan-100"
          >
            {message}
          </div>
        )}

        <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl sm:p-7">
          <h2 className="text-xl font-semibold">
            Choose a study resource
          </h2>

          <p className="mt-2 text-sm leading-6 text-slate-400">
            Select an approved PDF. The AI will use its text to create
            multiple-choice questions with explanations and varied difficulty.
          </p>

          {loadingResources ? (
            <p className="mt-5 text-slate-400">
              Loading resources...
            </p>
          ) : resources.length === 0 ? (
            <p className="mt-5 rounded-xl bg-slate-800 p-4 text-sm text-slate-300">
              No approved resources are available yet.
            </p>
          ) : (
            <>
              <label
                htmlFor="resource"
                className="mt-5 block text-sm font-medium text-slate-300"
              >
                Resource
              </label>

              <select
                id="resource"
                value={selectedResource}
                onChange={(event) =>
                  setSelectedResource(event.target.value)
                }
                disabled={generating}
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 disabled:opacity-60"
              >
                <option value="">Select a resource...</option>

                {resources.map((resource) => (
                  <option
                    key={resource.id}
                    value={String(resource.id)}
                  >
                    {resource.grade} · {resource.subject} · {resource.title}
                  </option>
                ))}
              </select>

              {selectedResource && (
                <div className="mt-3 rounded-xl bg-slate-800/60 p-4 text-sm">
                  {(() => {
                    const resource = resources.find(
                      (item) => String(item.id) === selectedResource
                    );

                    if (!resource) return null;

                    return (
                      <>
                        <p className="font-medium">{resource.title}</p>
                        <p className="mt-1 text-slate-400">
                          {resource.grade} · {resource.subject}
                          {resource.topic ? ` · ${resource.topic}` : ""}
                        </p>

                        {resource.description && (
                          <p className="mt-2 leading-6 text-slate-400">
                            {resource.description}
                          </p>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}

              <button
                type="button"
                onClick={generateQuiz}
                disabled={!selectedResource || generating}
                className="mt-5 w-full rounded-xl bg-cyan-400 px-5 py-3.5 font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {generating
                  ? "Generating your AI quiz..."
                  : "Generate AI quiz"}
              </button>

              <p className="mt-3 text-xs leading-5 text-slate-500">
                AI-generated answers can still contain mistakes. Use the
                explanations to review your notes and verify anything that
                looks questionable.
              </p>
            </>
          )}
        </section>

        {questions.length > 0 && (
          <section className="mt-7 rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl sm:p-7">
            {!finished && activeQuestion ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm text-cyan-300">
                      {quizSubject}
                    </p>
                    <h2 className="mt-1 text-xl font-semibold">
                      {quizTitle}
                    </h2>
                  </div>

                  <p className="rounded-full bg-slate-800 px-3 py-1.5 text-sm text-slate-300">
                    Question {currentQuestion + 1} of {questions.length}
                  </p>
                </div>

                <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full bg-cyan-400 transition-all"
                    style={{
                      width: `${
                        ((currentQuestion + 1) / questions.length) * 100
                      }%`,
                    }}
                  />
                </div>

                <div className="mt-6">
                  <span className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-300">
                    {activeQuestion.difficulty}
                  </span>
                </div>

                <h3 className="mt-4 text-lg font-semibold leading-7">
                  {activeQuestion.question}
                </h3>

                <div className="mt-5 space-y-3">
                  {activeQuestion.options.map((option, index) => {
                    const selected = answers[currentQuestion] === index;

                    return (
                      <button
                        key={`${currentQuestion}-${index}`}
                        type="button"
                        onClick={() => chooseAnswer(index)}
                        className={`flex w-full items-start gap-3 rounded-xl border p-4 text-left transition ${
                          selected
                            ? "border-cyan-400 bg-cyan-400/10 text-white"
                            : "border-slate-700 bg-slate-950/60 text-slate-300 hover:border-slate-500 hover:bg-slate-800"
                        }`}
                      >
                        <span
                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-sm font-semibold ${
                            selected
                              ? "bg-cyan-400 text-slate-950"
                              : "bg-slate-800 text-slate-300"
                          }`}
                        >
                          {String.fromCharCode(65 + index)}
                        </span>

                        <span className="pt-0.5 leading-6">
                          {option}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-7 flex flex-wrap justify-between gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      setCurrentQuestion((previous) =>
                        Math.max(0, previous - 1)
                      )
                    }
                    disabled={currentQuestion === 0}
                    className="rounded-xl border border-slate-700 px-5 py-3 text-sm font-medium text-slate-300 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Previous
                  </button>

                  {currentQuestion < questions.length - 1 ? (
                    <button
                      type="button"
                      onClick={() =>
                        setCurrentQuestion((previous) =>
                          Math.min(questions.length - 1, previous + 1)
                        )
                      }
                      className="rounded-xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
                    >
                      Next question →
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={finishQuiz}
                      disabled={
                        Object.keys(answers).length !== questions.length
                      }
                      className="rounded-xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Finish quiz
                    </button>
                  )}
                </div>

                <p className="mt-3 text-right text-xs text-slate-500">
                  {Object.keys(answers).length} of {questions.length} answered
                </p>
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-cyan-300">
                  Quiz completed
                </p>

                <h2 className="mt-2 text-2xl font-bold">
                  {quizTitle}
                </h2>

                <div className="mt-5 rounded-2xl bg-slate-800/70 p-6 text-center">
                  <p className="text-sm text-slate-400">Your score</p>

                  <p className="mt-2 text-4xl font-bold">
                    {score}
                    <span className="text-2xl text-slate-400">
                      {" "}
                      / {questions.length}
                    </span>
                  </p>

                  <p className="mt-2 text-sm text-slate-400">
                    {Math.round((score / questions.length) * 100)}% correct
                  </p>
                </div>

                <div className="mt-7">
                  <h3 className="text-lg font-semibold">
                    Review your answers
                  </h3>

                  <div className="mt-4 space-y-4">
                    {questions.map((question, index) => {
                      const correct = answers[index] === question.answer;

                      return (
                        <article
                          key={`${index}-${question.question}`}
                          className="rounded-xl border border-slate-800 bg-slate-950/60 p-4"
                        >
                          <div className="flex items-start gap-3">
                            <span
                              className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${
                                correct
                                  ? "bg-emerald-400/15 text-emerald-300"
                                  : "bg-red-400/15 text-red-300"
                              }`}
                            >
                              {correct ? "✓" : "×"}
                            </span>

                            <div className="min-w-0">
                              <p className="font-medium leading-6">
                                {index + 1}. {question.question}
                              </p>

                              <p className="mt-2 text-sm text-slate-400">
                                Your answer:{" "}
                                {question.options[answers[index]] ??
                                  "No answer"}
                              </p>

                              <p className="mt-1 text-sm text-emerald-300">
                                Correct answer:{" "}
                                {question.options[question.answer]}
                              </p>

                              <p className="mt-3 text-sm leading-6 text-slate-300">
                                <span className="font-medium text-slate-200">
                                  Explanation:{" "}
                                </span>
                                {question.explanation}
                              </p>

                              <p className="mt-2 text-xs text-slate-500">
                                Difficulty: {question.difficulty}
                              </p>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-7 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={saveAttempt}
                    disabled={saving}
                    className="rounded-xl bg-cyan-400 px-5 py-3 font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:opacity-50"
                  >
                    {saving ? "Saving result..." : "Save result"}
                  </button>

                  <button
                    type="button"
                    onClick={restartQuiz}
                    className="rounded-xl border border-slate-700 px-5 py-3 font-medium text-slate-300 transition hover:bg-slate-800"
                  >
                    Try this quiz again
                  </button>
                </div>
              </>
            )}
          </section>
        )}
      </div>
    </main>
  );
}