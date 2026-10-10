"use client";

import { useCallback, useEffect, useState } from "react";
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

type Review = {
  id: number;
  created_at: string;
  resource_id: number;
  reviewer_name: string | null;
  rating: number;
  review_text: string | null;
};

type ReviewWithResource = Review & {
  resource_title: string;
};

type StudentProfile = {
  id: string;
  full_name: string | null;
  role: string;
  status: string;
  grade: string | null;
  section: string | null;
  created_at: string;
};

type StudentAction = "approve" | "reject" | "deactivate" | "reactivate";

export default function AdminPage() {
  const router = useRouter();

  const [resources, setResources] = useState<Resource[]>([]);
  const [reviews, setReviews] = useState<ReviewWithResource[]>([]);
  const [students, setStudents] = useState<StudentProfile[]>([]);

  const [loading, setLoading] = useState(true);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [studentsLoading, setStudentsLoading] = useState(true);
  const [busyStudentId, setBusyStudentId] = useState<string | null>(null);
  const [busyResourceId, setBusyResourceId] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"error" | "success">("success");

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editGrade, setEditGrade] = useState("");
  const [editSubject, setEditSubject] = useState("");
  const [editTopic, setEditTopic] = useState("");
  const [editType, setEditType] = useState("");

  function showMessage(
    text: string,
    type: "error" | "success" = "success"
  ) {
    setMessage(text);
    setMessageType(type);
  }

  const loadResources = useCallback(async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("resources")
      .select("*")
      .in("status", ["pending", "approved", "hidden", "rejected"])
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Resource loading error:", error);
      showMessage(`Could not load resources: ${error.message}`, "error");
    } else {
      setResources((data || []) as Resource[]);
    }

    setLoading(false);
  }, []);

  const loadReviews = useCallback(async () => {
    setReviewsLoading(true);

    const { data: reviewData, error: reviewError } = await supabase
      .from("reviews")
      .select("*")
      .order("created_at", { ascending: false });

    if (reviewError) {
      console.error("Review loading error:", reviewError);
      showMessage(`Could not load reviews: ${reviewError.message}`, "error");
      setReviewsLoading(false);
      return;
    }

    if (!reviewData || reviewData.length === 0) {
      setReviews([]);
      setReviewsLoading(false);
      return;
    }

    const resourceIds = Array.from(
      new Set(reviewData.map((review) => review.resource_id))
    );

    const { data: resourceData, error: resourceError } = await supabase
      .from("resources")
      .select("id, title")
      .in("id", resourceIds);

    if (resourceError) {
      console.error("Review resource loading error:", resourceError);
      showMessage(
        `Could not load review resources: ${resourceError.message}`,
        "error"
      );
      setReviewsLoading(false);
      return;
    }

    const resourceTitleMap = new Map<number, string>();

    (resourceData || []).forEach((resource) => {
      resourceTitleMap.set(resource.id, resource.title);
    });

    setReviews(
      reviewData.map((review) => ({
        ...review,
        resource_title:
          resourceTitleMap.get(review.resource_id) ||
          `Resource #${review.resource_id}`,
      })) as ReviewWithResource[]
    );

    setReviewsLoading(false);
  }, []);

  const loadStudents = useCallback(async () => {
    setStudentsLoading(true);

    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, role, status, grade, section, created_at")
      .eq("role", "student")
      .in("status", ["pending", "active", "rejected", "inactive"])
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Student profile loading error:", error);
      showMessage(
        `Could not load student registrations: ${error.message}`,
        "error"
      );
      setStudents([]);
    } else {
      setStudents((data || []) as StudentProfile[]);
    }

    setStudentsLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function checkAdmin() {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (cancelled) return;

      if (authError || !user) {
        router.replace("/admin-login");
        return;
      }

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("role, status")
        .eq("id", user.id)
        .single();

      if (cancelled) return;

      if (error || !profile) {
        router.replace("/");
        return;
      }

      if (profile.role !== "admin" || profile.status !== "active") {
        router.replace("/");
        return;
      }

      await Promise.all([loadResources(), loadReviews(), loadStudents()]);
    }

    void checkAdmin();

    return () => {
      cancelled = true;
    };
  }, [router, loadResources, loadReviews, loadStudents]);

  async function updateStudentStatus(
    student: StudentProfile,
    newStatus: "active" | "rejected" | "inactive"
  ) {
    if (busyStudentId !== null) return;

    let action: StudentAction;
    let reason: string | undefined;

    if (newStatus === "rejected") {
      if (student.status !== "pending") {
        showMessage("Only pending applications can be rejected.", "error");
        return;
      }

      const enteredReason = window.prompt(
        `Why are you rejecting "${student.full_name || "this student"}"?\n\nEnter the reason the student should see:`
      );

      if (enteredReason === null) return;

      reason = enteredReason.trim();

      if (!reason) {
        showMessage("Please enter a rejection reason.", "error");
        return;
      }

      action = "reject";
    } else if (newStatus === "inactive") {
      if (student.status !== "active") {
        showMessage("Only active students can be deactivated.", "error");
        return;
      }

      action = "deactivate";
    } else if (student.status === "pending") {
      action = "approve";
    } else if (student.status === "inactive") {
      action = "reactivate";
    } else {
      showMessage(
        "Rejected applications must be resubmitted by the student before they can be approved.",
        "error"
      );
      return;
    }

    const actionLabel =
      action === "approve"
        ? "approve"
        : action === "reject"
          ? "reject"
          : action === "deactivate"
            ? "deactivate"
            : "reactivate";

    const confirmed = window.confirm(
      `Are you sure you want to ${actionLabel} ${student.full_name || "this student"}?`
    );

    if (!confirmed) return;

    setBusyStudentId(student.id);
    setMessage("");

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session) {
        router.replace("/admin-login");
        showMessage("Your session expired. Please sign in again.", "error");
        return;
      }

      const response = await fetch(
        `/api/admin/students/${encodeURIComponent(student.id)}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            action,
            ...(action === "reject" ? { reason } : {}),
          }),
        }
      );

      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.success) {
        console.error("Student action failed:", result);

        const details =
          typeof result?.details === "string" ? ` ${result.details}` : "";

        showMessage(
          `${result?.error || `Could not ${actionLabel} the student.`}${details}`,
          "error"
        );

        await loadStudents();
        return;
      }

      setStudents((current) =>
        current.map((item) =>
          item.id === student.id
            ? { ...item, status: result.status }
            : item
        )
      );

      showMessage(result.message || `Student ${actionLabel}d successfully.`);
    } catch (error) {
      console.error("Student action request error:", error);
      showMessage(
        "Could not reach the student approval API. Check that the development server is running, then try again.",
        "error"
      );
    } finally {
      setBusyStudentId(null);
    }
  }

  function startEditing(resource: Resource) {
    setEditingId(resource.id);
    setEditTitle(resource.title);
    setEditDescription(resource.description || "");
    setEditGrade(resource.grade);
    setEditSubject(resource.subject);
    setEditTopic(resource.topic || "");
    setEditType(resource.type);
    setMessage("");
  }

  function cancelEditing() {
    setEditingId(null);
    setEditTitle("");
    setEditDescription("");
    setEditGrade("");
    setEditSubject("");
    setEditTopic("");
    setEditType("");
  }

  async function saveChanges(resourceId: number) {
    if (!editTitle.trim() || !editGrade.trim() || !editSubject.trim()) {
      showMessage("Title, grade, and subject cannot be empty.", "error");
      return;
    }

    setMessage("");

    const { data, error } = await supabase
      .from("resources")
      .update({
        title: editTitle.trim(),
        description: editDescription.trim() || null,
        grade: editGrade.trim(),
        subject: editSubject.trim(),
        topic: editTopic.trim() || null,
        type: editType,
      })
      .eq("id", resourceId)
      .select()
      .single();

    if (error) {
      console.error("Resource update error:", error);
      showMessage(`Could not save changes: ${error.message}`, "error");
      return;
    }

    setResources((current) =>
      current.map((resource) =>
        resource.id === resourceId ? (data as Resource) : resource
      )
    );

    setEditingId(null);
    showMessage("Resource changes saved.");
  }

  async function permanentlyDeleteResource(
    resource: Resource,
    purpose: "rejection" | "removal"
  ) {
    if (busyResourceId !== null) return;

    setBusyResourceId(resource.id);
    setMessage("");

    try {
      const { data: deletedRows, error: databaseError } = await supabase
        .from("resources")
        .delete()
        .eq("id", resource.id)
        .select("id");

      if (databaseError) {
        console.error("Resource deletion error:", databaseError);
        showMessage(
          `Could not delete "${resource.title}" from the database: ${databaseError.message}. The uploaded file has not been removed.`,
          "error"
        );
        return;
      }

      if (!deletedRows || deletedRows.length === 0) {
        showMessage(
          `No database row was deleted for "${resource.title}". Check your Supabase DELETE policy and refresh the dashboard.`,
          "error"
        );
        await loadResources();
        return;
      }

      setResources((current) =>
        current.filter((item) => item.id !== resource.id)
      );

      let filePath: string | null = null;

      try {
        const fileUrl = new URL(resource.file_url);
        const configuredSupabaseUrl =
          process.env.NEXT_PUBLIC_SUPABASE_URL;

        if (!configuredSupabaseUrl) {
          throw new Error("NEXT_PUBLIC_SUPABASE_URL is not configured.");
        }

        const expectedHost = new URL(configuredSupabaseUrl).host;
        const marker = "/storage/v1/object/public/resources/";

        if (
          fileUrl.protocol === "https:" &&
          fileUrl.host === expectedHost &&
          fileUrl.pathname.includes(marker)
        ) {
          const markerIndex = fileUrl.pathname.indexOf(marker);
          filePath = decodeURIComponent(
            fileUrl.pathname.substring(markerIndex + marker.length)
          );

          if (!filePath || filePath.includes("..")) {
            filePath = null;
          }
        }
      } catch (error) {
        console.error("Could not parse resource storage URL:", error);
      }

      if (!filePath) {
        showMessage(
          `The database record for "${resource.title}" was deleted, but the uploaded file path could not be verified. Check the resources Storage bucket.`,
          "error"
        );
        await Promise.all([loadResources(), loadReviews()]);
        return;
      }

      const { error: storageError } = await supabase.storage
        .from("resources")
        .remove([filePath]);

      if (storageError) {
        console.error("Storage deletion error:", storageError);
        showMessage(
          `The database record for "${resource.title}" was deleted, but its uploaded file could not be removed: ${storageError.message}. Check the resources Storage bucket.`,
          "error"
        );
      } else {
        showMessage(
          purpose === "rejection"
            ? `Resource "${resource.title}" was rejected and permanently deleted, including its uploaded file.`
            : `Resource "${resource.title}" was permanently removed, including its uploaded file.`
        );
      }

      await Promise.all([loadResources(), loadReviews()]);
    } catch (error) {
      console.error("Unexpected resource deletion error:", error);
      showMessage(
        "Something went wrong while deleting the resource. Refresh the dashboard and check Supabase before trying again.",
        "error"
      );
    } finally {
      setBusyResourceId(null);
    }
  }

  async function updateStatus(
    resource: Resource,
    status: "approved" | "hidden"
  ) {
    setMessage("");

    const { error } = await supabase
      .from("resources")
      .update({
        status,
        rejection_reason: null,
      })
      .eq("id", resource.id);

    if (error) {
      console.error("Resource status update error:", error);
      showMessage(`Could not update resource: ${error.message}`, "error");
      return;
    }

    setResources((current) =>
      current.map((item) =>
        item.id === resource.id
          ? { ...item, status, rejection_reason: null }
          : item
      )
    );

    showMessage(
      status === "approved" ? "Resource approved." : "Resource hidden."
    );
  }

  async function rejectResource(resource: Resource) {
    const reason = window.prompt(
      `Why are you rejecting "${resource.title}"?\n\nEnter a reason for your records:`
    );

    if (reason === null) return;

    if (!reason.trim()) {
      showMessage("Please enter a rejection reason.", "error");
      return;
    }

    const confirmed = window.confirm(
      `Permanently delete "${resource.title}" and its uploaded file? This cannot be undone. The rejection reason will not be retained in the deleted resource record.`
    );

    if (!confirmed) return;

    await permanentlyDeleteResource(resource, "rejection");
  }

  async function removeResource(resource: Resource) {
    const confirmed = window.confirm(
      `Permanently remove "${resource.title}"? This cannot be undone.`
    );

    if (!confirmed) return;

    await permanentlyDeleteResource(resource, "removal");
  }

  async function removeReview(review: ReviewWithResource) {
    const confirmed = window.confirm(
      `Remove the review by "${review.reviewer_name || "Student"}" from "${review.resource_title}"? This cannot be undone.`
    );

    if (!confirmed) return;

    setMessage("");

    const { error } = await supabase
      .from("reviews")
      .delete()
      .eq("id", review.id);

    if (error) {
      console.error("Review deletion error:", error);
      showMessage(`Could not remove review: ${error.message}`, "error");
      return;
    }

    setReviews((current) =>
      current.filter((item) => item.id !== review.id)
    );

    showMessage("Review removed.");
  }

  function statusLabel(status: string) {
    if (status === "approved") return "APPROVED";
    if (status === "hidden") return "HIDDEN";
    if (status === "rejected") return "REJECTED";
    return "PENDING";
  }

  const pendingStudents = students.filter(
    (student) => student.status === "pending"
  );

  const otherStudents = students.filter(
    (student) => student.status !== "pending"
  );

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">StudyShelf Admin</h1>
            <p className="text-sm text-slate-500">
              Manage student registrations, resources, and reviews
            </p>
          </div>

          <a
            href="/"
            className="rounded-lg border px-4 py-2 text-center text-sm font-medium hover:bg-slate-50"
          >
            View StudyShelf
          </a>
        </div>
      </header>

      <section className="mx-auto max-w-6xl space-y-12 px-6 py-8">
        {message && (
          <div
            role="status"
            className={`rounded-xl border px-4 py-3 text-sm ${
              messageType === "error"
                ? "border-red-200 bg-red-50 text-red-800"
                : "border-green-200 bg-green-50 text-green-800"
            }`}
          >
            {message}
          </div>
        )}

        <section>
          <div className="mb-6">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-xl font-bold">Student Sign-up Approval</h2>
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
                {pendingStudents.length} pending
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Approve new student accounts or reject registrations that should
              not receive access.
            </p>
          </div>

          {studentsLoading ? (
            <div className="rounded-2xl border bg-white p-8 text-center text-slate-500">
              Loading student registrations...
            </div>
          ) : pendingStudents.length === 0 ? (
            <div className="rounded-2xl border bg-white p-8 text-center">
              <h3 className="font-semibold">No pending registrations</h3>
              <p className="mt-2 text-sm text-slate-500">
                New student sign-ups will appear here when their profiles have
                been created.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingStudents.map((student) => (
                <article
                  key={student.id}
                  className="rounded-2xl border bg-white p-6 shadow-sm"
                >
                  <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
                        PENDING APPROVAL
                      </span>

                      <h3 className="mt-3 text-lg font-bold">
                        {student.full_name || "Name not provided"}
                      </h3>

                      <p className="mt-2 text-sm text-slate-600">
                        Grade: {student.grade || "Not provided"}
                        {student.section
                          ? ` • Section: ${student.section}`
                          : ""}
                      </p>

                      <p className="mt-2 break-all text-xs text-slate-400">
                        Profile ID: {student.id}
                      </p>

                      <p className="mt-1 text-xs text-slate-400">
                        Registered:{" "}
                        {student.created_at
                          ? new Date(student.created_at).toLocaleString()
                          : "Unknown"}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => void updateStudentStatus(student, "active")}
                        disabled={busyStudentId !== null}
                        className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {busyStudentId === student.id
                          ? "Working..."
                          : "Approve Student"}
                      </button>

                      <button
                        onClick={() => void updateStudentStatus(student, "rejected")}
                        disabled={busyStudentId !== null}
                        className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {busyStudentId === student.id ? "Working..." : "Reject"}
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}

          {!studentsLoading && otherStudents.length > 0 && (
            <details className="mt-5 rounded-2xl border bg-white p-5">
              <summary className="cursor-pointer font-semibold">
                Previously processed student accounts ({otherStudents.length})
              </summary>

              <div className="mt-4 space-y-3">
                {otherStudents.map((student) => (
                  <div
                    key={student.id}
                    className="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-semibold">
                        {student.full_name || "Name not provided"}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        Grade: {student.grade || "Not provided"}
                        {student.section
                          ? ` • Section: ${student.section}`
                          : ""}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-bold ${
                          student.status === "active"
                            ? "bg-green-100 text-green-700"
                            : student.status === "rejected"
                              ? "bg-red-100 text-red-700"
                              : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {student.status.toUpperCase()}
                      </span>

                      {student.status === "inactive" && (
                        <button
                          onClick={() => void updateStudentStatus(student, "active")}
                          disabled={busyStudentId !== null}
                          className="rounded-lg border px-3 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
                        >
                          {busyStudentId === student.id
                            ? "Working..."
                            : "Reactivate"}
                        </button>
                      )}

                      {student.status === "active" && (
                        <button
                          onClick={() => void updateStudentStatus(student, "inactive")}
                          disabled={busyStudentId !== null}
                          className="rounded-lg border px-3 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
                        >
                          {busyStudentId === student.id
                            ? "Working..."
                            : "Deactivate"}
                        </button>
                      )}

                      {student.status === "rejected" && (
                        <p className="text-sm text-slate-500">
                          Waiting for the student to reapply
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </details>
          )}
        </section>

        <section>
          <div className="mb-6">
            <h2 className="text-xl font-bold">Resources</h2>
            <p className="mt-1 text-sm text-slate-500">
              Review, edit, approve, reject, hide, or remove resources.
            </p>
          </div>

          {loading ? (
            <div className="rounded-2xl border bg-white p-8 text-center text-slate-500">
              Loading resources...
            </div>
          ) : resources.length === 0 ? (
            <div className="rounded-2xl border bg-white p-8 text-center">
              <h3 className="font-semibold">No resources to manage</h3>
              <p className="mt-2 text-sm text-slate-500">
                New submissions will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {resources.map((resource) => (
                <article
                  key={resource.id}
                  className="rounded-2xl border bg-white p-6 shadow-sm"
                >
                  {editingId === resource.id ? (
                    <div>
                      <h3 className="mb-5 text-lg font-bold">Edit Resource</h3>

                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="md:col-span-2">
                          <label className="mb-1 block text-sm font-semibold">
                            Title
                          </label>
                          <input
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            className="w-full rounded-lg border px-3 py-2 outline-none focus:border-blue-500"
                          />
                        </div>

                        <div>
                          <label className="mb-1 block text-sm font-semibold">
                            Grade
                          </label>
                          <input
                            value={editGrade}
                            onChange={(e) => setEditGrade(e.target.value)}
                            className="w-full rounded-lg border px-3 py-2 outline-none focus:border-blue-500"
                          />
                        </div>

                        <div>
                          <label className="mb-1 block text-sm font-semibold">
                            Subject
                          </label>
                          <input
                            value={editSubject}
                            onChange={(e) => setEditSubject(e.target.value)}
                            className="w-full rounded-lg border px-3 py-2 outline-none focus:border-blue-500"
                          />
                        </div>

                        <div>
                          <label className="mb-1 block text-sm font-semibold">
                            Topic
                          </label>
                          <input
                            value={editTopic}
                            onChange={(e) => setEditTopic(e.target.value)}
                            className="w-full rounded-lg border px-3 py-2 outline-none focus:border-blue-500"
                          />
                        </div>

                        <div>
                          <label className="mb-1 block text-sm font-semibold">
                            Resource Type
                          </label>
                          <select
                            value={editType}
                            onChange={(e) => setEditType(e.target.value)}
                            className="w-full rounded-lg border px-3 py-2 outline-none focus:border-blue-500"
                          >
                            <option value="Notes">Notes</option>
                            <option value="Assignment">Assignment</option>
                            <option value="Practice">Practice</option>
                            <option value="Flashcards">Flashcards</option>
                            <option value="Other">Other</option>
                          </select>
                        </div>

                        <div className="md:col-span-2">
                          <label className="mb-1 block text-sm font-semibold">
                            Description
                          </label>
                          <textarea
                            value={editDescription}
                            onChange={(e) => setEditDescription(e.target.value)}
                            rows={4}
                            className="w-full rounded-lg border px-3 py-2 outline-none focus:border-blue-500"
                          />
                        </div>
                      </div>

                      <div className="mt-5 flex flex-wrap gap-2">
                        <button
                          onClick={() => void saveChanges(resource.id)}
                          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                        >
                          Save Changes
                        </button>

                        <button
                          onClick={cancelEditing}
                          className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-slate-50"
                        >
                          Cancel
                        </button>

                        <a
                          href={resource.file_url}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-slate-50"
                        >
                          Preview File
                        </a>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="mb-3 flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-bold ${
                              resource.status === "rejected"
                                ? "bg-red-100 text-red-700"
                                : resource.status === "approved"
                                  ? "bg-green-100 text-green-700"
                                  : resource.status === "hidden"
                                    ? "bg-slate-200 text-slate-700"
                                    : "bg-yellow-100 text-yellow-700"
                            }`}
                          >
                            {statusLabel(resource.status)}
                          </span>

                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                            {resource.type}
                          </span>
                        </div>

                        <h3 className="text-lg font-bold">{resource.title}</h3>

                        <p className="mt-2 text-sm text-slate-600">
                          {resource.subject} • {resource.grade}
                          {resource.topic ? ` • ${resource.topic}` : ""}
                        </p>

                        {resource.description && (
                          <p className="mt-3 text-sm text-slate-600">
                            {resource.description}
                          </p>
                        )}

                        <p className="mt-4 text-xs text-slate-500">
                          Uploaded by: {resource.uploader_name || "Anonymous"}
                        </p>

                        <p className="mt-1 text-xs text-slate-400">
                          ID: {resource.id}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <a
                          href={resource.file_url}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-slate-50"
                        >
                          Preview
                        </a>

                        {resource.status !== "rejected" && (
                          <button
                            onClick={() => startEditing(resource)}
                            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                          >
                            Edit
                          </button>
                        )}

                        {resource.status === "pending" && (
                          <>
                            <button
                              onClick={() => void updateStatus(resource, "approved")}
                              disabled={busyResourceId !== null}
                              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                            >
                              Approve
                            </button>

                            <button
                              onClick={() => void rejectResource(resource)}
                              disabled={busyResourceId !== null}
                              className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
                            >
                              Reject & Delete
                            </button>
                          </>
                        )}

                        {resource.status === "approved" && (
                          <button
                            onClick={() => void updateStatus(resource, "hidden")}
                            disabled={busyResourceId !== null}
                            className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                          >
                            Hide
                          </button>
                        )}

                        {resource.status === "hidden" && (
                          <button
                            onClick={() => void updateStatus(resource, "approved")}
                            disabled={busyResourceId !== null}
                            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                          >
                            Unhide
                          </button>
                        )}

                        <button
                          onClick={() => void removeResource(resource)}
                          disabled={busyResourceId !== null}
                          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                        >
                          {busyResourceId === resource.id
                            ? "Deleting..."
                            : resource.status === "rejected"
                              ? "Delete Rejected Resource"
                              : "Remove"}
                        </button>
                      </div>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>

        <section>
          <div className="mb-6">
            <h2 className="text-xl font-bold">Reviews</h2>
            <p className="mt-1 text-sm text-slate-500">
              Manage student reviews submitted on resources.
            </p>
          </div>

          {reviewsLoading ? (
            <div className="rounded-2xl border bg-white p-8 text-center text-slate-500">
              Loading reviews...
            </div>
          ) : reviews.length === 0 ? (
            <div className="rounded-2xl border bg-white p-8 text-center">
              <h3 className="font-semibold">No reviews yet</h3>
              <p className="mt-2 text-sm text-slate-500">
                Student reviews will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {reviews.map((review) => (
                <article
                  key={review.id}
                  className="rounded-2xl border bg-white p-6 shadow-sm"
                >
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Review for
                      </p>

                      <h3 className="mt-1 text-lg font-bold">
                        {review.resource_title}
                      </h3>

                      <div className="mt-3 flex flex-wrap items-center gap-3">
                        <span className="font-semibold">
                          {review.reviewer_name || "Anonymous"}
                        </span>

                        <span className="text-lg tracking-wide">
                          <span className="text-yellow-400">
                            {"★".repeat(
                              Math.max(0, Math.min(5, review.rating))
                            )}
                          </span>
                          <span className="text-slate-300">
                            {"★".repeat(
                              5 - Math.max(0, Math.min(5, review.rating))
                            )}
                          </span>
                        </span>

                        <span className="text-sm text-slate-500">
                          {review.rating}/5
                        </span>
                      </div>

                      {review.review_text && (
                        <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                          {review.review_text}
                        </p>
                      )}

                      <p className="mt-3 text-xs text-slate-400">
                        Review ID: {review.id} • Resource ID:{" "}
                        {review.resource_id}
                      </p>
                    </div>

                    <button
                      onClick={() => void removeReview(review)}
                      className="shrink-0 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
                    >
                      Remove Review
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}