import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY");
    if (!BREVO_API_KEY) {
      throw new Error("BREVO_API_KEY is not configured");
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    // Use service role client for data access
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    
    // Verify user with anon client
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = user.id;

    const { examId, senderEmail, senderName } = await req.json();
    if (!examId) {
      return new Response(JSON.stringify({ error: "examId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify teacher owns this exam
    const { data: exam, error: examError } = await supabaseAdmin
      .from("exams")
      .select("*")
      .eq("id", examId)
      .eq("teacher_id", userId)
      .single();

    if (examError || !exam) {
      return new Response(JSON.stringify({ error: "Exam not found or unauthorized" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get all submitted sessions
    const { data: sessions } = await supabaseAdmin
      .from("exam_sessions")
      .select("*")
      .eq("exam_id", examId)
      .eq("status", "submitted");

    if (!sessions || sessions.length === 0) {
      return new Response(JSON.stringify({ error: "No submitted sessions found", sent: 0 }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get questions for this exam
    const { data: questions } = await supabaseAdmin
      .from("questions")
      .select("*")
      .eq("exam_id", examId);

    const totalQuestions = questions?.length || 0;

    // Get all answers
    const sessionIds = sessions.map((s: any) => s.id);
    const { data: answers } = await supabaseAdmin
      .from("student_answers")
      .select("*")
      .in("session_id", sessionIds);

    let sentCount = 0;
    const errors: string[] = [];

    for (const session of sessions) {
      const sessionAnswers = (answers || []).filter((a: any) => a.session_id === session.id);
      const correct = sessionAnswers.filter((a: any) => a.is_correct === true).length;
      const incorrect = sessionAnswers.filter((a: any) => a.is_correct === false).length;
      const answered = sessionAnswers.filter((a: any) => a.selected_answer).length;
      const unanswered = totalQuestions - answered;
      const score = session.score ?? correct;
      const totalMarks = session.total_marks ?? totalQuestions;
      const percentage = totalMarks > 0 ? Math.round((score / totalMarks) * 100) : 0;

      const htmlContent = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; background: #f4f4f7; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
    <div style="background: #4f46e5; padding: 24px 32px;">
      <h1 style="color: #ffffff; margin: 0; font-size: 22px;">📝 Exam Results</h1>
    </div>
    <div style="padding: 32px;">
      <p style="font-size: 16px; color: #333;">Dear <strong>${session.student_name}</strong>,</p>
      <p style="font-size: 14px; color: #555;">Here are your results for the exam <strong>"${exam.title}"</strong> (${exam.subject}):</p>
      
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <tr style="background: #f9fafb;">
          <td style="padding: 12px 16px; border: 1px solid #e5e7eb; font-weight: 600; color: #374151;">Score</td>
          <td style="padding: 12px 16px; border: 1px solid #e5e7eb; font-size: 18px; font-weight: bold; color: ${percentage >= 70 ? '#16a34a' : percentage >= 40 ? '#d97706' : '#dc2626'};">${score} / ${totalMarks} (${percentage}%)</td>
        </tr>
        <tr>
          <td style="padding: 12px 16px; border: 1px solid #e5e7eb; font-weight: 600; color: #374151;">Total Questions</td>
          <td style="padding: 12px 16px; border: 1px solid #e5e7eb;">${totalQuestions}</td>
        </tr>
        <tr style="background: #f0fdf4;">
          <td style="padding: 12px 16px; border: 1px solid #e5e7eb; font-weight: 600; color: #16a34a;">✅ Correct</td>
          <td style="padding: 12px 16px; border: 1px solid #e5e7eb; color: #16a34a; font-weight: bold;">${correct}</td>
        </tr>
        <tr style="background: #fef2f2;">
          <td style="padding: 12px 16px; border: 1px solid #e5e7eb; font-weight: 600; color: #dc2626;">❌ Incorrect</td>
          <td style="padding: 12px 16px; border: 1px solid #e5e7eb; color: #dc2626; font-weight: bold;">${incorrect}</td>
        </tr>
        <tr style="background: #f9fafb;">
          <td style="padding: 12px 16px; border: 1px solid #e5e7eb; font-weight: 600; color: #6b7280;">⏭️ Unanswered</td>
          <td style="padding: 12px 16px; border: 1px solid #e5e7eb; color: #6b7280; font-weight: bold;">${unanswered}</td>
        </tr>
      </table>

      <p style="font-size: 13px; color: #9ca3af; margin-top: 24px;">
        ${session.submitted_at ? `Submitted on: ${new Date(session.submitted_at).toLocaleString()}` : ''}
      </p>
    </div>
    <div style="background: #f9fafb; padding: 16px 32px; text-align: center;">
      <p style="font-size: 12px; color: #9ca3af; margin: 0;">Nejo Exam Prep — Online Examination Platform</p>
    </div>
  </div>
</body>
</html>`;

      try {
        const response = await fetch(BREVO_API_URL, {
          method: "POST",
          headers: {
            accept: "application/json",
            "api-key": BREVO_API_KEY,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            sender: {
              name: senderName || "Nejo Exam Prep",
              email: senderEmail || "noreply@nejoexamprep.com",
            },
            to: [{ email: session.student_email, name: session.student_name }],
            subject: `Your Exam Results: ${exam.title}`,
            htmlContent,
          }),
        });

        if (!response.ok) {
          const errBody = await response.text();
          errors.push(`Failed for ${session.student_email}: [${response.status}] ${errBody}`);
        } else {
          await response.text();
          sentCount++;
        }
      } catch (e: any) {
        errors.push(`Failed for ${session.student_email}: ${e.message}`);
      }
    }

    return new Response(
      JSON.stringify({ sent: sentCount, total: sessions.length, errors }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in send-exam-results:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
