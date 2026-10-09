
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Profile = {
  id: string;
  full_name: string | null;
  role: string;
  status: string;
  is_owner: boolean;
  created_at: string;
};

type DashboardCounts = {
  students: number;
  admins: number;
  pendingStudents: number;
  resources: number;
  pendingResources: number;
  reviews: number;
};

export default function OwnerPage() {
  const router = useRouter();

  const [ownerId, setOwnerId] = useState("");
  const [admins, setAdmins] = useState<Profile[]>([]);
  const [counts, setCounts] = useState<DashboardCounts>({
    students: 0,
    admins: 0,
    pendingStudents: 0,
    resources: 0,
    pendingResources: 0,
    reviews: 0,
  });

  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  const showMessage = (text: string, error = false) => {
    setMessage(text);
    setIsError(error);
  };

  const loadDashboard = useCallback(async () => {
    setLoading(true);

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        router.replace("/admin-login");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role, status, is_owner")
        .eq("id", user.id)
        .maybeSingle();

      if (
        profileError ||
        !profile ||
        profile.role !== "admin" ||
        profile.status !== "active" ||
        profile.is_owner !== true
      ) {
        router.replace(
          profile?.role === "admin" && profile?.status === "active"
            ? "/admin"
            : "/"
        );
        return;
      }

      setOwnerId(user.id);

      const [
        adminResult,
        studentResult,
        pendingStudentResult,
        resourceResult,
        pendingResourceResult,
        reviewResult,
      ] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, full_name, role, status, is_owner, created_at")
          .eq("role", "admin")
          .order("created_at", { ascending: false }),

        // Count student profiles except permanently rejected applications.
        supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("role", "student")
          .neq("status", "rejected"),

        supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("role", "student")
          .eq("status", "pending"),

        supabase
          .from("resources")
          .select("id", { count: "exact", head: true }),

        supabase
          .from("resources")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending"),

        supabase
          .from("reviews")
          .select("id", { count: "exact", head: true }),
      ]);

      if (adminResult.error) {
        showMessage(
          `Could not load administrators: ${adminResult.error.message}`,
          true
        );
        return;
      }

      const countError = [
        studentResult.error,
        pendingStudentResult.error,
        resourceResult.error,
        pendingResourceResult.error,
        reviewResult.error,
      ].find(Boolean);

      if (countError) {
        showMessage(
          `Some dashboard totals could not load: ${countError.message}`,
          true
        );
        return;
      }

      setAdmins(adminResult.data || []);

      setCounts({
        students: studentResult.count ?? 0,
        admins: adminResult.data?.length ?? 0,
        pendingStudents: pendingStudentResult.count ?? 0,
        resources: resourceResult.count ?? 0,
        pendingResources: pendingResourceResult.count ?? 0,
        reviews: reviewResult.count ?? 0,
      });
    } catch {
      showMessage("Something went wrong while loading the dashboard.", true);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  async function changeAdminAccess(admin: Profile) {
    if (admin.id === ownerId || admin.is_owner) {
      showMessage("You cannot change an owner's access.", true);
      return;
    }

    const promoting = admin.role !== "admin";

    const confirmed = window.confirm(
      promoting
        ? `Promote ${admin.full_name || "this account"} to administrator?`
        : `Remove administrator access from ${
            admin.full_name || "this account"
          }?`
    );

    if (!confirmed) return;

    setBusyId(admin.id);
    setMessage("");

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user || user.id !== ownerId) {
        showMessage("Please sign in again as the owner.", true);
        router.replace("/admin-login");
        return;
      }

      const { data: currentOwner, error: ownerError } = await supabase
        .from("profiles")
        .select("role, status, is_owner")
        .eq("id", user.id)
        .maybeSingle();

      if (
        ownerError ||
        !currentOwner ||
        currentOwner.role !== "admin" ||
        currentOwner.status !== "active" ||
        currentOwner.is_owner !== true
      ) {
        showMessage("Owner permission could not be verified.", true);
        router.replace("/admin");
        return;
      }

      const { data: updated, error } = await supabase
        .from("profiles")
        .update(
          promoting
            ? { role: "admin", status: "active" }
            : { role: "student", status: "inactive" }
        )
        .eq("id", admin.id)
        .eq("is_owner", false)
        .select("id")
        .maybeSingle();

      if (error) {
        showMessage(
          `Could not change access: ${error.message}. Check your Supabase owner UPDATE policy.`,
          true
        );
        return;
      }

      if (!updated) {
        showMessage(
          "No account was changed. It may be protected or your permissions may not allow this action.",
          true
        );
        return;
      }

      showMessage(
        promoting
          ? "Administrator access granted."
          : "Administrator access removed."
      );

      await loadDashboard();
    } catch {
      showMessage("Something went wrong while changing access.", true);
    } finally {
      setBusyId("");
    }
  }

  async function logOut() {
    await supabase.auth.signOut();
    router.replace("/admin-login");
    router.refresh();
  }

  const cards = [
    { label: "Students", value: counts.students },
    { label: "Administrators", value: counts.admins },
    { label: "Pending students", value: counts.pendingStudents },
    { label: "Total resources", value: counts.resources },
    { label: "Pending resources", value: counts.pendingResources },
    { label: "Reviews", value: counts.reviews },
  ];

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-5">
          <div>
            <h1 className="text-2xl font-bold">StudyShelf Owner</h1>
            <p className="mt-1 text-sm text-slate-500">
              Your central dashboard and administrator controls
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin"
              className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-slate-50"
            >
              Admin Dashboard
            </Link>

            <Link
              href="/"
              className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-slate-50"
            >
              View StudyShelf
            </Link>

            <button
              onClick={logOut}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
            >
              Log Out
            </button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-8 rounded-2xl border border-blue-100 bg-white p-6">
          <p className="text-sm font-semibold text-blue-700">OWNER ACCESS</p>
          <h2 className="mt-2 text-2xl font-bold">
            Welcome to your dashboard
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Monitor StudyShelf and control who has administrator access.
            Regular administrators should use the Admin Dashboard for
            day-to-day resource and review management.
          </p>
        </div>

        {message && (
          <div
            role="status"
            className={`mb-6 rounded-xl border px-4 py-3 text-sm ${
              isError
                ? "border-red-200 bg-red-50 text-red-800"
                : "border-green-200 bg-green-50 text-green-800"
            }`}
          >
            {message}
          </div>
        )}

        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold">StudyShelf Overview</h2>
            <p className="mt-1 text-sm text-slate-500">
              Current totals visible to your account.
            </p>
          </div>

          <button
            onClick={() => void loadDashboard()}
            disabled={loading}
            className="rounded-lg border bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50"
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="rounded-2xl border bg-white p-8 text-center text-slate-500">
            Loading your owner dashboard...
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {cards.map((card) => (
                <article
                  key={card.label}
                  className="rounded-2xl border bg-white p-5 shadow-sm"
                >
                  <p className="text-sm text-slate-500">{card.label}</p>
                  <p className="mt-2 text-3xl font-bold">{card.value}</p>
                </article>
              ))}
            </div>

            <section className="mt-12">
              <div className="mb-5">
                <h2 className="text-xl font-bold">
                  Administrator Management
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Grant or remove administrator access for other accounts.
                  Your owner account is protected.
                </p>
              </div>

              {admins.length === 0 ? (
                <div className="rounded-2xl border bg-white p-8 text-center text-slate-500">
                  No administrator accounts were returned.
                </div>
              ) : (
                <div className="overflow-hidden rounded-2xl border bg-white">
                  <div className="divide-y">
                    {admins.map((admin) => {
                      const isSelf = admin.id === ownerId;
                      const isProtected = isSelf || admin.is_owner;

                      return (
                        <article
                          key={admin.id}
                          className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="font-semibold">
                                {admin.full_name || "Unnamed account"}
                              </h3>

                              {isSelf && (
                                <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-800">
                                  YOU · OWNER
                                </span>
                              )}

                              {!isSelf && admin.is_owner && (
                                <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-800">
                                  OWNER
                                </span>
                              )}
                            </div>

                            <p className="mt-1 text-sm text-slate-500">
                              Role: {admin.role} · Status: {admin.status}
                            </p>

                            <p className="mt-1 break-all text-xs text-slate-400">
                              Account ID: {admin.id}
                            </p>
                          </div>

                          <div className="flex flex-wrap items-center gap-3">
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                admin.status === "active"
                                  ? "bg-green-100 text-green-800"
                                  : "bg-slate-100 text-slate-600"
                              }`}
                            >
                              {admin.status.toUpperCase()}
                            </span>

                            {isProtected ? (
                              <span className="text-sm font-medium text-slate-400">
                                Protected
                              </span>
                            ) : (
                              <button
                                onClick={() => void changeAdminAccess(admin)}
                                disabled={busyId === admin.id}
                                className={`rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 ${
                                  admin.role === "admin"
                                    ? "bg-red-600 hover:bg-red-700"
                                    : "bg-blue-600 hover:bg-blue-700"
                                }`}
                              >
                                {busyId === admin.id
                                  ? "Updating..."
                                  : admin.role === "admin"
                                  ? "Remove Admin Access"
                                  : "Restore Admin Access"}
                              </button>
                            )}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </div>
              )}
            </section>

            <div className="mt-8 rounded-2xl border bg-white p-5">
              <h2 className="font-bold">Important security note</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                These controls rely on Supabase Row Level Security (RLS)
                to authorize profile updates. Make sure only the active
                owner can change other accounts&apos; roles. This page
                alone cannot enforce that restriction.
              </p>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
