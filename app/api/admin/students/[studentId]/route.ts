import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type StudentAction = "approve" | "deactivate" | "reactivate" | "reject";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function fail(message: string, status: number, details?: string) {
  return NextResponse.json(
    { success: false, error: message, ...(details ? { details } : {}) },
    { status }
  );
}

export async function POST(
  request: Request,
  context: { params: Promise<{ studentId: string }> }
) {
  try {
    const { studentId } = await context.params;

    if (!uuidPattern.test(studentId)) {
      return fail("Invalid student ID.", 400);
    }

    const accessToken = request.headers
      .get("authorization")
      ?.match(/^Bearer\s+(.+)$/i)?.[1];

    if (!accessToken) {
      return fail("Please sign in again.", 401);
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const publishableKey =
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !publishableKey || !serviceRoleKey) {
      console.error("Student action: Supabase environment variables missing.");
      return fail("Server configuration is incomplete.", 500);
    }

    const authClient = createClient(supabaseUrl, publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser(accessToken);

    if (authError || !user) {
      return fail("Your session is invalid. Please sign in again.", 401);
    }

    const { data: callerProfile, error: callerError } = await adminClient
      .from("profiles")
      .select("role,status")
      .eq("id", user.id)
      .maybeSingle();

    if (callerError) {
      console.error("Admin profile lookup failed:", callerError.message);
      return fail("Could not verify admin access.", 500, callerError.message);
    }

    if (
      callerProfile?.role !== "admin" ||
      callerProfile?.status !== "active"
    ) {
      return fail("Active admin access is required.", 403);
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return fail("Request body must be valid JSON.", 400);
    }

    if (
      typeof body !== "object" ||
      body === null ||
      !("action" in body) ||
      typeof body.action !== "string"
    ) {
      return fail("Invalid action.", 400);
    }

    const action = body.action as StudentAction;

    if (!["approve", "deactivate", "reactivate", "reject"].includes(action)) {
      return fail("Unsupported action.", 400);
    }

    let rejectionReason = "";

    if (action === "reject") {
      if (!("reason" in body) || typeof body.reason !== "string") {
        return fail("A rejection reason is required.", 400);
      }

      rejectionReason = body.reason.trim();

      if (!rejectionReason) {
        return fail("Please enter a rejection reason.", 400);
      }

      if (rejectionReason.length > 2000) {
        return fail("The rejection reason must be 2000 characters or fewer.", 400);
      }
    }

    const { data: student, error: studentError } = await adminClient
      .from("profiles")
      .select("id,role,status,is_owner")
      .eq("id", studentId)
      .maybeSingle();

    if (studentError) {
      console.error("Student lookup failed:", studentError.message);
      return fail("Could not load the student profile.", 500, studentError.message);
    }

    if (!student || student.role !== "student" || student.is_owner === true) {
      return fail("Student profile not found in this Supabase project.", 404);
    }

    let expectedStatus: string;
    let newStatus: string;

    if (action === "reject") {
      expectedStatus = "pending";
      newStatus = "rejected";
    } else if (action === "approve") {
      expectedStatus = "pending";
      newStatus = "active";
    } else if (action === "deactivate") {
      expectedStatus = "active";
      newStatus = "inactive";
    } else {
      expectedStatus = "inactive";
      newStatus = "active";
    }

    const updateValues = {
      status: newStatus,
      ...(action === "reject"
        ? {
            application_rejection_reason: rejectionReason,
            application_reviewed_at: new Date().toISOString(),
          }
        : action === "approve"
          ? { application_reviewed_at: new Date().toISOString() }
          : {}),
    };

    const { data: updatedProfile, error: updateError } = await adminClient
      .from("profiles")
      .update(updateValues)
      .eq("id", studentId)
      .eq("role", "student")
      .eq("status", expectedStatus)
      .select("id,status")
      .maybeSingle();

    if (updateError) {
      console.error(
        `Student ${action} update failed for ${studentId}:`,
        updateError.message
      );
      return fail(
        `Could not ${action} the student.`,
        500,
        updateError.message
      );
    }

    if (!updatedProfile) {
      return fail(
        `No status change was made. The profile may no longer have status "${expectedStatus}". Refresh the dashboard and try again.`,
        409
      );
    }

    console.info(`Student action succeeded: ${action}, status=${newStatus}`);

    return NextResponse.json({
      success: true,
      status: updatedProfile.status,
      message:
        action === "reject"
          ? "Application rejected and reason saved. The profile was retained."
          : action === "approve"
            ? "Student approved."
            : action === "deactivate"
              ? "Student deactivated."
              : "Student reactivated.",
    });
  } catch (error) {
    const details =
      error instanceof Error ? error.message : "Unknown server error";

    console.error("Student action failed:", details);
    return fail("An unexpected server error occurred.", 500, details);
  }
}