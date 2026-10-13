"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { builtInQuizzes } from "@/lib/quizzes";

type StudyTopic = {
  id: number;
  subject: string;
  topic: string;
  status: "not_started" | "in_progress" | "completed";
};

type QuizAttempt = {
  id: number;
  quiz_title: string;
  subject: string;
  score: number;
  total_questions: number;
  created_at: string;
};

const statusLabels: Record<StudyTopic["status"], string> = {
  not_started: "Not started",
  in_progress: "In progress",
  completed: "Completed",
};

const statusStyles: Record<StudyTopic["status"], string> = {
  not_started: "bg-slate-100 text-slate-600",
  in_progress: "bg-amber-50 text-amber-700",
  completed: "bg-emerald-50 text-emerald-700",
};

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Date unavailable";

  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function subjectColor(subject: string) {
  const value = subject.toLowerCase();

  if (value.includes("math")) return "bg-violet-100 text-violet-700";
  if (value.includes("biology") || value.includes("science"))
    return "bg-emerald-100 text-emerald-700";
  if (value.includes("english") || value.includes("language"))
    return "bg-sky-100 text-sky-700";
  if (value.includes("physics")) return "bg-amber-100 text-amber-700";
  if (value.includes("chemistry")) return "bg-rose-100 text-rose-700";

  return "bg-indigo-100 text-indigo-700";
}

export default function DashboardPage() {
  const router = useRouter();

  const [topics, setTopics] = useState<StudyTopic[]>([]);
  const [attempts, setAttempts] = useState<QuizAttempt[]>([]);
  const [subject, setSubject] = useState("");
  const [topic, setTopic] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyTopicId, setBusyTopicId] = useState<number | null>(null);
  const [message, setMessage] = useState("");

  const loadDashboard = useCallback(async (id: string) => {
    const [topicsResult, attemptsResult] = await Promise.all([
      supabase
        .from("study_topics")
        .select("id, subject, topic, status")
        .eq("user_id", id)
        .order("created_at", { ascending: false }),

      supabase
        .from("quiz_attempts")
        .select("id, quiz_title, subject, score, total_questions, created_at")
        .eq("user_id", id)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

    if (topicsResult.error || attemptsResult.error) {
      setMessage(
        topicsResult.error?.message ||
          attemptsResult.error?.message ||
          "Could not load your dashboard."
      );
      return;
    }

    setTopics((topicsResult.data || []) as StudyTopic[]);
    setAttempts((attemptsResult.data || []) as QuizAttempt[]);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function initialize() {
      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (cancelled) return;

        if (authError || !user) {
          router.replace("/student-login");
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("role, status")
          .eq("id", user.id)
          .maybeSingle();

        if (cancelled) return;

        if (profileError || !profile || profile.status !== "active") {
          setMessage(
            "Your profile could not be verified or is not active. Please contact the site administrator."
          );
          setLoading(false);
          return;
        }

        setUserId(user.id);
        await loadDashboard(user.id);

        if (!cancelled) setLoading(false);
      } catch (error) {
        console.error("Dashboard initialization error:", error);

        if (!cancelled) {
          setMessage("Could not load your dashboard. Please refresh the page.");
          setLoading(false);
        }
      }
    }

    initialize();

    return () => {
      cancelled = true;
    };
  }, [router, loadDashboard]);

  async function addTopic(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!userId || !subject.trim() || !topic.trim()) return;

    setSaving(true);
    setMessage("");

    try {
      const { data, error } = await supabase
        .from("study_topics")
        .insert({
          user_id: userId,
          subject: subject.trim(),
          topic: topic.trim(),
        })
        .select("id, subject, topic, status")
        .single();

      if (error) {
        setMessage(`Could not add topic: ${error.message}`);
      } else {
        setTopics((current) => [data as StudyTopic, ...current]);
        setSubject("");
        setTopic("");
        setMessage("Study goal added successfully.");
      }
    } catch (error) {
      console.error("Adding study goal failed:", error);
      setMessage("An unexpected error occurred while adding your study goal.");
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(
    item: StudyTopic,
    status: StudyTopic["status"]
  ) {
    if (!userId || busyTopicId !== null) return;

    setBusyTopicId(item.id);
    setMessage("");

    try {
      const { data, error } = await supabase
        .from("study_topics")
        .update({ status })
        .eq("id", item.id)
        .eq("user_id", userId)
        .select("id, subject, topic, status")
        .single();

      if (error) {
        setMessage(`Could not update topic: ${error.message}`);
        return;
      }

      setTopics((current) =>
        current.map((existing) =>
          existing.id === item.id ? (data as StudyTopic) : existing
        )
      );
    } catch (error) {
      console.error("Updating study goal failed:", error);
      setMessage("Could not update this goal. Please try again.");
    } finally {
      setBusyTopicId(null);
    }
  }

  async function deleteTopic(item: StudyTopic) {
    if (!userId) return;

    if (!window.confirm(`Delete the study goal "${item.topic}"?`)) return;

    setMessage("");

    const { error } = await supabase
      .from("study_topics")
      .delete()
      .eq("id", item.id)
      .eq("user_id", userId);

    if (error) {
      setMessage(`Could not delete topic: ${error.message}`);
      return;
    }

    setTopics((current) => current.filter((row) => row.id !== item.id));
    setMessage("Study goal deleted.");
  }

  async function logOut() {
    const { error } = await supabase.auth.signOut();

    if (error) {
      setMessage(`Could not log out: ${error.message}`);
      return;
    }

    router.replace("/student-login");
  }

  const completed = topics.filter(
    (item) => item.status === "completed"
  ).length;

  const inProgress = topics.filter(
    (item) => item.status === "in_progress"
  ).length;

  const notStarted = topics.filter(
    (item) => item.status === "not_started"
  ).length;

  const progress = topics.length
    ? Math.round((completed / topics.length) * 100)
    : 0;

  const subjectStats = useMemo(() => {
    const groups = new Map<
      string,
      { total: number; completed: number; inProgress: number }
    >();

    topics.forEach((item) => {
      const key = item.subject.trim() || "Other";
      const current = groups.get(key) || {
        total: 0,
        completed: 0,
        inProgress: 0,
      };

      current.total += 1;

      if (item.status === "completed") current.completed += 1;
      if (item.status === "in_progress") current.inProgress += 1;

      groups.set(key, current);
    });

    return Array.from(groups.entries()).sort(
      (a, b) => b[1].total - a[1].total
    );
  }, [topics]);

  const averageScore = attempts.length
    ? Math.round(
        attempts.reduce(
          (total, attempt) =>
            total +
            (attempt.total_questions > 0
              ? (attempt.score / attempt.total_questions) * 100
              : 0),
          0
        ) / attempts.length
      )
    : null;

  const firstName = "learner";

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-blue-100 border-t-blue-600" />
          <p className="mt-4 text-sm font-medium text-slate-600">
            Preparing your study space...
          </p>
        </div>
      </main>
    );
  }

  if (!userId) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-2xl">
            !
          </div>
          <h1 className="mt-4 text-xl font-bold">Dashboard unavailable</h1>
          <p className="mt-3 break-words text-sm leading-6 text-slate-600">
            {message || "Your account could not be verified."}
          </p>
          <Link
            href="/"
            className="mt-6 inline-flex rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-700"
          >
            Return to StudyShelf
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-lg font-black text-white">
              S
            </span>
            <span>
              <span className="block text-lg font-extrabold tracking-tight">
                StudyShelf
              </span>
              <span className="block text-xs text-slate-500">
                Your learning space
              </span>
            </span>
          </Link>

          <nav className="flex flex-wrap items-center gap-2">
            <Link
              href="/dashboard"
              className="rounded-xl bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-700"
            >
              Dashboard
            </Link>
            <Link
              href="/quizzes"
              className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
            >
              Quizzes
            </Link>
            <Link
              href="/"
              className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
            >
              Resources
            </Link>
            <button
              onClick={logOut}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700"
            >
              Log out
            </button>
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-700 p-6 text-white shadow-lg shadow-blue-900/10 sm:p-9">
          <div className="pointer-events-none absolute -right-12 -top-20 h-64 w-64 rounded-full border-[36px] border-white/10" />
          <div className="pointer-events-none absolute -bottom-24 right-1/4 h-52 w-52 rounded-full bg-cyan-300/10 blur-2xl" />

          <div className="relative grid gap-8 md:grid-cols-[1fr_auto] md:items-center">
            <div className="max-w-2xl">
              <span className="inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-blue-50">
                Your learning space
              </span>
              <h1 className="mt-5 text-3xl font-black tracking-tight sm:text-4xl">
                Welcome back, {firstName}!
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-blue-100 sm:text-base">
                Every topic you revise is progress. Keep your goals organised,
                practise with quizzes, and build a study routine that works for
                you.
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href="/quizzes"
                  className="inline-flex items-center justify-center rounded-xl bg-white px-5 py-3 text-sm font-bold text-blue-700 transition hover:bg-blue-50"
                >
                  Start a quiz <span className="ml-2">→</span>
                </Link>
                <Link
                  href="/"
                  className="inline-flex items-center justify-center rounded-xl border border-white/30 bg-white/10 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/20"
                >
                  Explore resources
                </Link>
              </div>
            </div>

            <div className="rounded-2xl border border-white/20 bg-white/10 p-5 backdrop-blur-sm md:min-w-48">
              <p className="text-sm font-medium text-blue-100">
                Study goals completed
              </p>
              <p className="mt-2 text-5xl font-black">{progress}%</p>
              <div
                className="mt-4 h-2 overflow-hidden rounded-full bg-blue-950/30"
                role="progressbar"
                aria-label="Study goals completed"
                aria-valuenow={progress}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className="h-full rounded-full bg-cyan-300 transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="mt-3 text-xs text-blue-100">
                {completed} of {topics.length} goals complete
              </p>
            </div>
          </div>
        </section>

        {message && (
          <div
            role="status"
            className="break-words rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900"
          >
            {message}
          </div>
        )}

        <section>
          <div className="mb-4">
            <h2 className="text-xl font-extrabold tracking-tight">
              Your overview
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              A quick look at your learning activity.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-500">
                  Study goals
                </span>
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-lg">
                  📚
                </span>
              </div>
              <p className="mt-4 text-3xl font-black">{topics.length}</p>
              <p className="mt-1 text-xs text-slate-500">
                Topics on your learning list
              </p>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-500">
                  Completed
                </span>
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-lg">
                  ✓
                </span>
              </div>
              <p className="mt-4 text-3xl font-black">{completed}</p>
              <p className="mt-1 text-xs text-slate-500">
                Goals marked as complete
              </p>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-500">
                  In progress
                </span>
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-lg">
                  ◷
                </span>
              </div>
              <p className="mt-4 text-3xl font-black">{inProgress}</p>
              <p className="mt-1 text-xs text-slate-500">
                Topics you are working on
              </p>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-500">
                  Quiz attempts
                </span>
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-lg">
                  ✎
                </span>
              </div>
              <p className="mt-4 text-3xl font-black">{attempts.length}</p>
              <p className="mt-1 text-xs text-slate-500">
                {averageScore === null
                  ? "Take a quiz to start your record"
                  : `${averageScore}% average across recent attempts`}
              </p>
            </article>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.15em] text-blue-700">
                  Stay organised
                </p>
                <h2 className="mt-2 text-xl font-extrabold tracking-tight">
                  My study goals
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Turn big subjects into smaller, manageable topics.
                </p>
              </div>
              <span className="rounded-xl bg-blue-50 px-3 py-2 text-sm font-bold text-blue-700">
                {notStarted} not started
              </span>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Completed goals
                </p>
                <p className="mt-2 text-2xl font-black">{completed}</p>
                <div className="mt-3 h-1.5 rounded-full bg-slate-200">
                  <div
                    className="h-1.5 rounded-full bg-emerald-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Still to work on
                </p>
                <p className="mt-2 text-2xl font-black">
                  {topics.length - completed}
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  In progress or not started
                </p>
              </div>
            </div>

            <form onSubmit={addTopic} className="mt-6 rounded-2xl border border-dashed border-slate-300 p-4 sm:p-5">
              <h3 className="font-bold">Add a new goal</h3>
              <p className="mt-1 text-sm text-slate-500">
                What would you like to revise next?
              </p>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="text-sm font-semibold text-slate-700">
                  Subject
                  <input
                    value={subject}
                    onChange={(event) => setSubject(event.target.value)}
                    placeholder="e.g. Biology"
                    maxLength={80}
                    required
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 font-normal outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  />
                </label>

                <label className="text-sm font-semibold text-slate-700">
                  Topic
                  <input
                    value={topic}
                    onChange={(event) => setTopic(event.target.value)}
                    placeholder="e.g. Cells"
                    maxLength={160}
                    required
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 font-normal outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  />
                </label>
              </div>

              <button
                disabled={saving}
                className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-blue-600 px-5 py-3 font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
              >
                {saving ? "Adding goal..." : "+ Add study goal"}
              </button>
            </form>

            <div className="mt-6">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="font-bold">Your topic list</h3>
                <span className="text-xs text-slate-500">
                  {topics.length} total
                </span>
              </div>

              {topics.length === 0 ? (
                <div className="rounded-2xl bg-slate-50 px-5 py-8 text-center">
                  <span className="text-3xl">📝</span>
                  <h4 className="mt-3 font-bold">Start with one small goal</h4>
                  <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-slate-500">
                    Add a subject and topic above. As you make progress, update
                    its status and watch your dashboard grow.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {topics.map((item) => (
                    <article
                      key={item.id}
                      className="rounded-2xl border border-slate-200 p-4 transition hover:border-blue-200 hover:bg-blue-50/30"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <span
                            className={`inline-flex rounded-lg px-2.5 py-1 text-xs font-bold ${subjectColor(item.subject)}`}
                          >
                            {item.subject}
                          </span>
                          <h4 className="mt-2 break-words font-bold">
                            {item.topic}
                          </h4>
                          <span
                            className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyles[item.status]}`}
                          >
                            {statusLabels[item.status]}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <select
                            aria-label={`Progress for ${item.topic}`}
                            value={item.status}
                            disabled={busyTopicId === item.id}
                            onChange={(event) =>
                              changeStatus(
                                item,
                                event.target.value as StudyTopic["status"]
                              )
                            }
                            className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 disabled:opacity-50"
                          >
                            {Object.entries(statusLabels).map(
                              ([value, label]) => (
                                <option key={value} value={value}>
                                  {label}
                                </option>
                              )
                            )}
                          </select>

                          <button
                            onClick={() => deleteTopic(item)}
                            className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700"
                            aria-label={`Delete ${item.topic}`}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </section>

          <div className="space-y-6">
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.15em] text-violet-700">
                    Build confidence
                  </p>
                  <h2 className="mt-2 text-xl font-extrabold">
                    Practice quizzes
                  </h2>
                  <p className="mt-1 text-sm leading-6 text-slate-500">
                    Test what you know and learn from each answer.
                  </p>
                </div>
                <span className="text-2xl">✦</span>
              </div>

              <div className="mt-5 space-y-3">
                {builtInQuizzes.map((quiz) => (
                  <Link
                    key={quiz.id}
                    href={`/quizzes?quiz=${encodeURIComponent(quiz.id)}`}
                    className="group flex items-center justify-between gap-3 rounded-2xl border border-slate-200 p-4 transition hover:border-blue-300 hover:bg-blue-50/60"
                  >
                    <div className="min-w-0">
                      <span
                        className={`inline-flex rounded-lg px-2 py-1 text-xs font-bold ${subjectColor(quiz.subject)}`}
                      >
                        {quiz.subject}
                      </span>
                      <h3 className="mt-2 font-bold group-hover:text-blue-700">
                        {quiz.title}
                      </h3>
                      <p className="mt-1 text-xs text-slate-500">
                        {quiz.questions.length} questions
                      </p>
                    </div>
                    <span className="text-xl text-slate-400 transition group-hover:translate-x-1 group-hover:text-blue-600">
                      →
                    </span>
                  </Link>
                ))}
              </div>

              <Link
                href="/quizzes"
                className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-violet-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-violet-700"
              >
                Explore all quizzes
              </Link>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-extrabold">Subjects overview</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Based on your study goals
                  </p>
                </div>
                <span className="text-xl">◈</span>
              </div>

              {subjectStats.length === 0 ? (
                <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-500">
                  Your subject breakdown will appear here after you add study
                  goals.
                </p>
              ) : (
                <div className="mt-5 space-y-4">
                  {subjectStats.slice(0, 5).map(([name, stats]) => {
                    const subjectProgress = Math.round(
                      (stats.completed / stats.total) * 100
                    );

                    return (
                      <div key={name}>
                        <div className="flex items-center justify-between gap-3 text-sm">
                          <span className="font-semibold">{name}</span>
                          <span className="text-slate-500">
                            {stats.completed}/{stats.total}
                          </span>
                        </div>
                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-blue-600 transition-all"
                            style={{ width: `${subjectProgress}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        </div>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.15em] text-emerald-700">
                Keep learning
              </p>
              <h2 className="mt-2 text-xl font-extrabold">
                Recent quiz attempts
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Your ten most recent saved results.
              </p>
            </div>
            <Link
              href="/quizzes"
              className="text-sm font-bold text-blue-700 transition hover:text-blue-900"
            >
              Take another quiz →
            </Link>
          </div>

          {attempts.length === 0 ? (
            <div className="mt-5 rounded-2xl bg-slate-50 px-5 py-9 text-center">
              <span className="text-3xl">🎯</span>
              <h3 className="mt-3 font-bold">Your results start here</h3>
              <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-slate-500">
                Complete a practice quiz and save your result to build your
                personal learning history.
              </p>
              <Link
                href="/quizzes"
                className="mt-4 inline-flex rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-700"
              >
                Choose your first quiz
              </Link>
            </div>
          ) : (
            <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
              <div className="hidden grid-cols-[1fr_150px_110px] gap-4 bg-slate-50 px-5 py-3 text-xs font-bold uppercase tracking-wide text-slate-500 sm:grid">
                <span>Quiz</span>
                <span>Date</span>
                <span className="text-right">Result</span>
              </div>

              <div className="divide-y divide-slate-100">
                {attempts.map((attempt) => {
                  const percentage =
                    attempt.total_questions > 0
                      ? Math.round(
                          (attempt.score / attempt.total_questions) * 100
                        )
                      : 0;

                  return (
                    <article
                      key={attempt.id}
                      className="grid gap-3 px-4 py-4 transition hover:bg-slate-50 sm:grid-cols-[1fr_150px_110px] sm:items-center sm:gap-4 sm:px-5"
                    >
                      <div className="min-w-0">
                        <span
                          className={`inline-flex rounded-lg px-2 py-1 text-xs font-bold ${subjectColor(attempt.subject)}`}
                        >
                          {attempt.subject}
                        </span>
                        <h3 className="mt-2 break-words font-bold">
                          {attempt.quiz_title}
                        </h3>
                        <p className="mt-1 text-xs text-slate-500 sm:hidden">
                          {formatDate(attempt.created_at)}
                        </p>
                      </div>

                      <p className="hidden text-sm text-slate-500 sm:block">
                        {formatDate(attempt.created_at)}
                      </p>

                      <div className="flex items-center justify-between gap-3 sm:justify-end">
                        <div className="h-2 w-20 overflow-hidden rounded-full bg-slate-100 sm:hidden">
                          <div
                            className="h-full rounded-full bg-blue-600"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                        <div className="text-right">
                          <p className="font-extrabold">
                            {attempt.score}/{attempt.total_questions}
                          </p>
                          <p
                            className={`text-xs font-semibold ${
                              percentage >= 80
                                ? "text-emerald-700"
                                : percentage >= 50
                                  ? "text-amber-700"
                                  : "text-slate-500"
                            }`}
                          >
                            {percentage}%
                          </p>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        <footer className="pb-4 text-center text-xs text-slate-400">
          StudyShelf · Small steps make progress.
        </footer>
      </div>
    </main>
  );
}