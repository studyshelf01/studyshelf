
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function QuizzesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function checkUser() {
      try {
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser();

        if (cancelled) return;

        if (error || !user) {
          router.replace("/student-login");
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("status")
          .eq("id", user.id)
          .maybeSingle();

        if (cancelled) return;

        if (profileError || !profile || profile.status !== "active") {
          setMessage(
            "Your account could not be verified. Please contact the site administrator."
          );
          setLoading(false);
          return;
        }

        setLoading(false);
      } catch (error) {
        console.error("Account verification failed:", error);

        if (!cancelled) {
          setMessage("Could not verify your account. Please refresh the page.");
          setLoading(false);
        }
      }
    }

    checkUser();

    return () => {
      cancelled = true;
    };
  }, [router]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-violet-100 border-t-violet-600" />
          <p className="mt-4 text-sm text-slate-600">
            Getting StudyShelf ready...
          </p>
        </div>
      </main>
    );
  }

  if (message) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-bold text-slate-900">
            Account access unavailable
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">{message}</p>
          <Link
            href="/"
            className="mt-6 inline-flex rounded-xl bg-violet-600 px-5 py-3 font-semibold text-white hover:bg-violet-700"
          >
            Return to StudyShelf
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link href="/" className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-600 text-lg font-black text-white">
              S
            </span>
            <span>
              <span className="block text-lg font-extrabold">StudyShelf</span>
              <span className="block text-xs text-slate-500">
                Your personal study space
              </span>
            </span>
          </Link>

          <nav className="flex flex-wrap items-center gap-2">
            <Link
              href="/dashboard"
              className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100"
            >
              Dashboard
            </Link>
            <Link
              href="/"
              className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100"
            >
              Resources
            </Link>
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-16">
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-violet-700 via-indigo-700 to-blue-700 px-6 py-10 text-white shadow-xl sm:px-12 sm:py-14">
          <div className="pointer-events-none absolute -right-12 -top-16 h-64 w-64 rounded-full border-[36px] border-white/10" />

          <div className="relative max-w-3xl">
            <span className="inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-violet-100">
              Smarter revision starts here
            </span>

            <h1 className="mt-6 text-3xl font-black tracking-tight sm:text-5xl">
              Your resources.
              <br />
              Your AI-generated quizzes.
            </h1>

            <p className="mt-5 max-w-2xl text-sm leading-7 text-indigo-100 sm:text-base">
              Turn your study notes into practice questions. Choose an
              approved resource, generate a quiz, test your understanding,
              and review the explanations to learn from your mistakes.
            </p>

            <Link
              href="/generate-quiz"
              className="mt-8 inline-flex items-center gap-3 rounded-2xl bg-white px-6 py-4 text-sm font-extrabold text-indigo-700 shadow-lg transition hover:-translate-y-0.5 hover:bg-indigo-50"
            >
              <span className="text-xl">✨</span>
              Generate an AI quiz
              <span aria-hidden="true">→</span>
            </Link>

            <p className="mt-4 text-xs text-indigo-200">
              Questions are generated from your selected study resource.
            </p>
          </div>
        </section>

        <section className="mt-8 grid gap-4 md:grid-cols-3">
          <article className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-100 text-xl">
              📚
            </div>
            <h2 className="mt-4 font-extrabold">1. Choose a resource</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Select an approved study PDF from StudyShelf.
            </p>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-100 text-xl">
              🧠
            </div>
            <h2 className="mt-4 font-extrabold">2. Generate questions</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Let AI create practice questions based on your notes.
            </p>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100 text-xl">
              🎯
            </div>
            <h2 className="mt-4 font-extrabold">3. Practise and improve</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Answer questions and use feedback to strengthen your understanding.
            </p>
          </article>
        </section>

        <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
          <h2 className="text-xl font-extrabold">Ready to study?</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Start with a resource you want to revise. You can return to your
            uploaded notes whenever you need them.
          </p>

          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/generate-quiz"
              className="rounded-xl bg-violet-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-violet-700"
            >
              Create my quiz
            </Link>
            <Link
              href="/"
              className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
            >
              Browse resources
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
