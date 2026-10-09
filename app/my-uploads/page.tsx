"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Resource = {
  id: number;
  created_at: string;
  title: string;
  description: string | null;
  grade: string;
  subject: string;
  topic: string | null;
  type: string;
  status: string;
  file_url: string;
  uploader_name: string | null;
  rejection_reason: string | null;
};

export default function MyUploadsPage() {
  const router = useRouter();

  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadMyUploads() {
      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          router.replace("/student-login");
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("role, status")
          .eq("id", user.id)
          .maybeSingle();

        if (profileError || !profile) {
          await supabase.auth.signOut();
          router.replace("/student-login");
          return;
        }

        if (profile.role === "admin" && profile.status === "active") {
          router.replace("/admin");
          return;
        }

        if (profile.role !== "student" || profile.status !== "active") {
          await supabase.auth.signOut();
          router.replace("/student-login");
          return;
        }

        const { data, error } = await supabase
          .from("resources")
          .select(
            "id, created_at, title, description, grade, subject, topic, type, status, file_url, uploader_name, rejection_reason"
          )
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        if (error) {
          console.error("MY UPLOADS ERROR:", error);

          if (!cancelled) {
            setMessage("Could not load your uploads. Please try again.");
          }

          return;
        }

        if (!cancelled) {
          setResources((data || []) as Resource[]);
        }
      } catch (error) {
        console.error("MY UPLOADS ACCESS ERROR:", error);

        if (!cancelled) {
          setMessage("Something went wrong while loading your uploads.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadMyUploads();

    return () => {
      cancelled = true;
    };
  }, [router]);

  function statusLabel(status: string) {
    if (status === "approved") return "APPROVED";
    if (status === "rejected") return "REJECTED";
    if (status === "hidden") return "HIDDEN";
    return "PENDING";
  }

  function statusStyle(status: string) {
    if (status === "approved") {
      return "bg-green-100 text-green-700";
    }

    if (status === "rejected") {
      return "bg-red-100 text-red-700";
    }

    if (status === "hidden") {
      return "bg-slate-200 text-slate-700";
    }

    return "bg-yellow-100 text-yellow-700";
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 px-6 py-12">
        <div className="mx-auto max-w-4xl rounded-2xl bg-white p-8 text-center shadow-sm">
          Checking your student account...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8">
          <a
            href="/"
            className="text-sm font-medium text-blue-600 hover:underline"
          >
            ← Back to StudyShelf
          </a>

          <h1 className="mt-6 text-3xl font-bold text-gray-900 sm:text-4xl">
            My Uploads
          </h1>

          <p className="mt-2 text-gray-600">
            View the resources you have submitted and their status.
          </p>
        </div>

        {message && (
          <div
            role="alert"
            className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            {message}
          </div>
        )}

        {resources.length === 0 ? (
          <div className="rounded-2xl border bg-white p-8 text-center shadow-sm">
            <h2 className="font-semibold text-gray-900">
              You haven't uploaded anything yet.
            </h2>

            <p className="mt-2 text-sm text-gray-500">
              Your submitted resources will appear here.
            </p>

            <a
              href="/upload"
              className="mt-5 inline-block rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Upload a Resource
            </a>
          </div>
        ) : (
          <div className="space-y-4">
            {resources.map((resource) => (
              <article
                key={resource.id}
                className="rounded-2xl border bg-white p-6 shadow-sm"
              >
                <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="mb-3">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-bold ${statusStyle(
                          resource.status
                        )}`}
                      >
                        {statusLabel(resource.status)}
                      </span>
                    </div>

                    <h2 className="break-words text-xl font-bold text-gray-900">
                      {resource.title}
                    </h2>

                    <p className="mt-2 text-sm text-gray-600">
                      {resource.subject} • {resource.grade}
                      {resource.topic ? ` • ${resource.topic}` : ""}
                    </p>

                    <p className="mt-2 text-xs text-gray-400">
                      Type: {resource.type}
                    </p>

                    {resource.status === "rejected" && (
                      <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4">
                        <p className="text-sm font-bold text-red-800">
                          Rejection reason
                        </p>

                        <p className="mt-1 text-sm leading-6 text-red-700">
                          {resource.rejection_reason ||
                            "No reason was provided."}
                        </p>
                      </div>
                    )}

                    {resource.status === "pending" && (
                      <div className="mt-5 rounded-xl bg-yellow-50 p-4 text-sm text-yellow-800">
                        Your resource is waiting for admin approval.
                      </div>
                    )}

                    {resource.status === "approved" && (
                      <div className="mt-5 rounded-xl bg-green-50 p-4 text-sm text-green-800">
                        Your resource has been approved and is visible to
                        students.
                      </div>
                    )}

                    {resource.status === "hidden" && (
                      <div className="mt-5 rounded-xl bg-slate-100 p-4 text-sm text-slate-700">
                        Your resource is currently hidden.
                      </div>
                    )}
                  </div>

                  {resource.status === "approved" && (
                    <a
                      href={`/resource/${resource.id}`}
                      className="shrink-0 rounded-lg bg-blue-600 px-4 py-2 text-center text-sm font-semibold text-white hover:bg-blue-700"
                    >
                      View Resource
                    </a>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}