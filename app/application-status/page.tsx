"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type StudentProfile = {
  id: string;
  full_name: string | null;
  role: string;
  status: string;
  grade: string | null;
  section: string | null;
  application_rejection_reason: string | null;
  application_reviewed_at: string | null;
};

export default function ApplicationStatusPage() {
  const router = useRouter();

  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [fullName, setFullName] = useState("");
  const [grade, setGrade] = useState("");
  const [section, setSection] = useState("");
  const [showReapplyForm, setShowReapplyForm] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadApplication() {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (cancelled) return;

      if (authError || !user) {
        router.replace("/student-login");
        return;
      }

      const { data, error: profileError } = await supabase
        .from("profiles")
        .select(
          "id,full_name,role,status,grade,section,application_rejection_reason,application_reviewed_at"
        )
        .eq("id", user.id)
        .maybeSingle();

      if (cancelled) return;

      if (profileError || !data || data.role !== "student") {
        setError(
          "We couldn't find your student application. Please contact an administrator."
        );
        setLoading(false);
        return;
      }

      const student = data as StudentProfile;

      setProfile(student);
      setFullName(student.full_name || "");
      setGrade(student.grade || "");
      setSection(student.section || "");
      setLoading(false);

      if (student.status === "active") {
        router.replace("/");
      }
    }

    loadApplication();

    return () => {
      cancelled = true;
    };
  }, [router]);

  async function submitReapplication(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!fullName.trim() || !grade.trim()) {
      setError("Please enter your name and grade.");
      return;
    }

    setBusy(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.replace("/student-login");
        return;
      }

      const response = await fetch("/api/student/reapply", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          full_name: fullName.trim(),
          grade: grade.trim(),
          section: section.trim(),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "Could not resubmit your application.");
        return;
      }

      setProfile((current) =>
        current
          ? {
              ...current,
              full_name: fullName.trim(),
              grade: grade.trim(),
              section: section.trim() || null,
              status: "pending",
              application_rejection_reason: null,
              application_reviewed_at: null,
            }
          : current
      );

      setShowReapplyForm(false);
      setSuccess("Your application has been resubmitted for admin review.");
    } catch {
      setError("A connection error occurred. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <p className="text-slate-600">Loading your application...</p>
      </main>
    );
  }

  const rejected = profile?.status === "rejected";
  const pending = profile?.status === "pending";

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-12 text-slate-900">
      <div className="mx-auto max-w-xl">
        <a href="/" className="text-sm font-semibold text-blue-700">
          StudyShelf
        </a>

        <div className="mt-5 rounded-2xl border bg-white p-6 shadow-sm sm:p-8">
          <h1 className="text-2xl font-bold">Application status</h1>
          <p className="mt-2 text-sm text-slate-600">
            Hi {profile?.full_name || "there"}, you can check your student
            registration here.
          </p>

          {error && (
            <div
              role="alert"
              className="mt-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
            >
              {error}
            </div>
          )}

          {success && (
            <div
              role="status"
              className="mt-5 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800"
            >
              {success}
            </div>
          )}

          {pending && (
            <section className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-5">
              <p className="font-bold text-amber-900">
                Application pending review
              </p>
              <p className="mt-2 text-sm leading-6 text-amber-900">
                Your application has been received. An administrator will
                review it. You can return to this page later to check for
                updates.
              </p>
            </section>
          )}

          {rejected && (
            <section className="mt-6 rounded-xl border border-red-200 bg-red-50 p-5">
              <p className="font-bold text-red-900">
                Your application was not approved
              </p>
              <p className="mt-2 text-sm leading-6 text-red-900">
                {profile?.application_rejection_reason ||
                  "No reason was provided. You can contact an administrator for clarification."}
              </p>
            </section>
          )}

          {!pending && !rejected && profile?.status !== "active" && (
            <section className="mt-6 rounded-xl border bg-slate-50 p-5">
              <p className="font-bold">Status: {profile?.status}</p>
              <p className="mt-2 text-sm text-slate-600">
                Please contact an administrator if you need help with your
                application.
              </p>
            </section>
          )}

          {rejected && !showReapplyForm && (
            <section className="mt-6">
              <h2 className="font-bold">Want another chance?</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Update your details and send your application to the admin for
                another review. Your account will be kept.
              </p>
              <button
                onClick={() => setShowReapplyForm(true)}
                className="mt-4 w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700"
              >
                Reapply
              </button>
            </section>
          )}

          {rejected && showReapplyForm && (
            <form onSubmit={submitReapplication} className="mt-6 space-y-4">
              <h2 className="text-lg font-bold">Update your application</h2>

              <div>
                <label
                  htmlFor="fullName"
                  className="mb-1 block text-sm font-medium"
                >
                  Full name
                </label>
                <input
                  id="fullName"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  required
                  maxLength={120}
                  className="w-full rounded-lg border px-3 py-2 outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label
                  htmlFor="grade"
                  className="mb-1 block text-sm font-medium"
                >
                  Grade
                </label>
                <input
                  id="grade"
                  value={grade}
                  onChange={(event) => setGrade(event.target.value)}
                  required
                  maxLength={50}
                  className="w-full rounded-lg border px-3 py-2 outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label
                  htmlFor="section"
                  className="mb-1 block text-sm font-medium"
                >
                  Section (optional)
                </label>
                <input
                  id="section"
                  value={section}
                  onChange={(event) => setSection(event.target.value)}
                  maxLength={50}
                  className="w-full rounded-lg border px-3 py-2 outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={busy}
                  className="flex-1 rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {busy ? "Submitting..." : "Submit reapplication"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowReapplyForm(false)}
                  disabled={busy}
                  className="rounded-lg border px-4 py-3 font-medium hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          <button
            onClick={() => window.location.reload()}
            className="mt-6 w-full rounded-lg border px-4 py-3 text-sm font-medium hover:bg-slate-50"
          >
            Refresh status
          </button>

          <button
            onClick={async () => {
              await supabase.auth.signOut();
              router.replace("/student-login");
            }}
            className="mt-3 w-full px-4 py-2 text-sm text-slate-500 hover:text-slate-800"
          >
            Sign out
          </button>
        </div>
      </div>
    </main>
  );
}
