import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const authorization = request.headers.get("authorization");
    const token = authorization?.startsWith("Bearer ")
      ? authorization.slice(7)
      : null;

    if (!token) {
      return NextResponse.json(
        { error: "Please sign in again before reapplying." },
        { status: 401 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("Missing Supabase server environment variables.");
      return NextResponse.json(
        { error: "Server configuration is incomplete." },
        { status: 500 }
      );
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data: authData, error: authError } =
      await adminClient.auth.getUser(token);

    if (authError || !authData.user) {
      return NextResponse.json(
        { error: "Your session has expired. Please sign in again." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const full_name =
      typeof body.full_name === "string" ? body.full_name.trim() : "";
    const grade = typeof body.grade === "string" ? body.grade.trim() : "";
    const section =
      typeof body.section === "string" ? body.section.trim() : "";

    if (!full_name || !grade || !section) {
      return NextResponse.json(
        { error: "Please fill in your name, grade, and section." },
        { status: 400 }
      );
    }

    if (
      full_name.length > 100 ||
      grade.length > 50 ||
      section.length > 50
    ) {
      return NextResponse.json(
        { error: "One or more fields are too long." },
        { status: 400 }
      );
    }

    const { data, error } = await adminClient
      .from("profiles")
      .update({
        full_name,
        grade,
        section,
        status: "pending",
        application_rejection_reason: null,
        application_reviewed_at: null,
      })
      .eq("id", authData.user.id)
      .eq("role", "student")
      .eq("status", "rejected")
      .select("id, status")
      .maybeSingle();

    if (error) {
      console.error("Student reapplication error:", error);
      return NextResponse.json(
        { error: "Could not submit your reapplication. Please try again." },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        {
          error:
            "Your application could not be updated. Make sure your account is rejected before reapplying.",
        },
        { status: 409 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Your application has been resubmitted for review.",
      status: data.status,
    });
  } catch (error) {
    console.error("Reapplication route error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred. Please try again." },
      { status: 500 }
    );
  }
}