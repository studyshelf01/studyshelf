
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type StudentAction = "approve" | "deactivate" | "reactivate" | "reject";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(
  request: Request,
  context: { params: Promise<{ studentId: string }> }
) {
  try {
    const { studentId } = await context.params;

    if (!uuidPattern.test(studentId)) {
      return NextResponse.json(
        { error: "Invalid student ID." },
        { status: 400 }
      );
    }

    const authorization = request.headers.get("authorization");
    const accessToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];

    if (!accessToken) {
      return NextResponse.json(
        { error: "Please sign in again." },
        { status: 401 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !publishableKey || !serviceRoleKey) {
      console.error("Missing Supabase server environment variables.");
      return NextResponse.json(
        { error: "Server configuration is incomplete." },
        { status: 500 }
      );
    }

    const authClient = createClient(supabaseUrl, publishableKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser(accessToken);

    if (authError || !user) {
      return NextResponse.json(
        { error: "Your session is invalid. Please sign in again." },
        { status: 401 }
      );
    }

    const { data: callerProfile, error: callerError } =
      await adminClient
        .from("profiles")
        .select("role,status")
        .eq("id", user.id)
        .maybeSingle();

    if (
      callerError ||
      callerProfile?.role !== "admin" ||
      callerProfile?.status !== "active"
    ) {
      return NextResponse.json(
        { error: "Active admin access is required." },
        { status: 403 }
      );
    }

    const body: unknown = await request.json();

    if (
      typeof body !== "object" ||
      body === null ||
      !("action" in body) ||
      typeof body.action !== "string"
    ) {
      return NextResponse.json(
        { error: "Invalid action." },
        { status: 400 }
      );
    }

    const action = body.action as StudentAction;

    if (
      !["approve", "deactivate", "reactivate", "reject"].includes(action)
    ) {
      return NextResponse.json(
        { error: "Unsupported action." },
        { status: 400 }
      );
    }

    const { data: student, error: studentError } = await adminClient
      .from("profiles")
      .select("id,role,status,is_owner")
      .eq("id", studentId)
      .maybeSingle();

    if (studentError) {
      return NextResponse.json(
        { error: "Could not load the student profile." },
        { status: 500 }
      );
    }

    if (!student || student.role !== "student" || student.is_owner === true) {
      return NextResponse.json(
        { error: "Student profile not found." },
        { status: 404 }
      );
    }

    if (action === "reject") {
      if (student.status !== "pending") {
        return NextResponse.json(
          { error: "Only pending applications can be permanently rejected." },
          { status: 409 }
        );
      }

      const { data: deletedProfile, error: deleteProfileError } =
        await adminClient
          .from("profiles")
          .delete()
          .eq("id", studentId)
          .eq("role", "student")
          .eq("status", "pending")
          .select("id")
          .maybeSingle();

      if (deleteProfileError) {
        return NextResponse.json(
          { error: "Could not reject the application." },
          { status: 500 }
        );
      }

      if (!deletedProfile) {
        return NextResponse.json(
          { error: "The application changed. Refresh and try again." },
          { status: 409 }
        );
      }

      const { error: deleteUserError } =
        await adminClient.auth.admin.deleteUser(studentId);

      if (deleteUserError) {
        console.error("Auth user deletion failed:", deleteUserError.message);

        return NextResponse.json(
          {
            error:
              "The profile was removed, but account deletion failed. Contact the site owner before retrying.",
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: "Application rejected and account deleted.",
      });
    }

    let expectedStatus: string;
    let newStatus: string;

    if (action === "approve") {
      expectedStatus = "pending";
      newStatus = "active";
    } else if (action === "deactivate") {
      expectedStatus = "active";
      newStatus = "inactive";
    } else {
      expectedStatus = "inactive";
      newStatus = "active";
    }

    const { data: updatedProfile, error: updateError } = await adminClient
      .from("profiles")
      .update({ status: newStatus })
      .eq("id", studentId)
      .eq("role", "student")
      .eq("status", expectedStatus)
      .select("id,status")
      .maybeSingle();

    if (updateError) {
      return NextResponse.json(
        { error: "Could not update the student status." },
        { status: 500 }
      );
    }

    if (!updatedProfile) {
      return NextResponse.json(
        {
          error:
            "The student status has changed. Refresh the dashboard and try again.",
        },
        { status: 409 }
      );
    }

    return NextResponse.json({
      success: true,
      status: updatedProfile.status,
    });
  } catch (error) {
    console.error("Student action failed:", error);

    return NextResponse.json(
      { error: "An unexpected server error occurred." },
      { status: 500 }
    );
  }
}
