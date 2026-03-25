import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, ChevronLeft, ChevronRight, Send, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Question {
  id: string;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  marks: number;
  question_order: number;
}

const ExamPage = () => {
  const { accessCode } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [examId, setExamId] = useState("");
  const [sessionId, setSessionId] = useState("");

  const totalQuestions = questions.length;
  const progress = totalQuestions > 0 ? ((currentQuestion + 1) / totalQuestions) * 100 : 0;
  const answeredCount = Object.keys(answers).length;
  const allAnswered = answeredCount === totalQuestions;
  const isLastQuestion = currentQuestion === totalQuestions - 1;

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const handleSubmit = useCallback(async () => {
    if (submitting) return;
    setSubmitting(true);

    try {
      const sid = sessionStorage.getItem("session_id") || sessionId;
      if (!sid) throw new Error("Session not found");

      // Save all answers with correctness
      const { data: dbQuestions } = await supabase
        .from("questions")
        .select("id, correct_answer")
        .eq("exam_id", examId);

      const correctMap = new Map((dbQuestions || []).map((q) => [q.id, q.correct_answer]));

      // Upsert all answers
      const answersToUpsert = Object.entries(answers).map(([questionId, selectedAnswer]) => ({
        session_id: sid,
        question_id: questionId,
        selected_answer: selectedAnswer,
        is_correct: correctMap.get(questionId) === selectedAnswer,
      }));

      if (answersToUpsert.length > 0) {
        const { error: ansError } = await supabase.from("student_answers").upsert(answersToUpsert, { onConflict: "session_id,question_id" });
        if (ansError) throw ansError;
      }

      // Calculate score
      const score = answersToUpsert.filter((a) => a.is_correct).length;
      const totalMarks = questions.reduce((s, q) => s + q.marks, 0);
      const earnedMarks = answersToUpsert
        .filter((a) => a.is_correct)
        .reduce((s, a) => {
          const q = questions.find((q) => q.id === a.question_id);
          return s + (q?.marks || 0);
        }, 0);

      // Update session
      const { error: sessionError } = await supabase
        .from("exam_sessions")
        .update({
          status: "submitted",
          submitted_at: new Date().toISOString(),
          score: earnedMarks,
          total_marks: totalMarks,
        })
        .eq("id", sid);

      if (sessionError) throw sessionError;

      sessionStorage.setItem("exam_score", String(earnedMarks));
      sessionStorage.setItem("exam_total", String(totalMarks));
      sessionStorage.setItem("exam_correct", String(score));
      sessionStorage.setItem("exam_total_questions", String(totalQuestions));

      navigate(`/exam/${accessCode}/complete`);
    } catch (error: any) {
      toast({ title: "Error submitting", description: error.message, variant: "destructive" });
      setSubmitting(false);
    }
  }, [submitting, sessionId, examId, answers, questions, navigate, accessCode, toast, totalQuestions]);

  // Load exam and questions
  useEffect(() => {
    const sid = sessionStorage.getItem("session_id");
    if (!sid) { navigate(`/exam/${accessCode}`); return; }
    setSessionId(sid);

    const loadExam = async () => {
      const { data: exam } = await supabase
        .from("exams")
        .select("id, duration_minutes, started_at, status")
        .eq("access_code", accessCode || "")
        .single();

      if (!exam || exam.status !== "active") {
        navigate(`/exam/${accessCode}`);
        return;
      }

      setExamId(exam.id);

      // Calculate remaining time
      const startedAt = exam.started_at ? new Date(exam.started_at).getTime() : Date.now();
      const endTime = startedAt + exam.duration_minutes * 60 * 1000;
      const remaining = Math.max(0, Math.floor((endTime - Date.now()) / 1000));
      setTimeLeft(remaining);

      // Load questions
      const { data: qs } = await supabase
        .from("questions")
        .select("id, question_text, option_a, option_b, option_c, option_d, marks, question_order")
        .eq("exam_id", exam.id)
        .order("question_order");

      setQuestions(qs || []);

      // Load existing answers
      const { data: existingAnswers } = await supabase
        .from("student_answers")
        .select("question_id, selected_answer")
        .eq("session_id", sid);

      if (existingAnswers) {
        const ansMap: Record<string, string> = {};
        existingAnswers.forEach((a) => { if (a.selected_answer) ansMap[a.question_id] = a.selected_answer; });
        setAnswers(ansMap);
      }

      setLoading(false);
    };
    loadExam();
  }, [accessCode, navigate]);

  // Timer
  useEffect(() => {
    if (loading || timeLeft <= 0) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [loading, handleSubmit, timeLeft]);

  // Auto-save answer
  const saveAnswer = async (questionId: string, selectedAnswer: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: selectedAnswer }));

    const sid = sessionStorage.getItem("session_id");
    if (!sid) return;

    await supabase.from("student_answers").upsert(
      { session_id: sid, question_id: questionId, selected_answer: selectedAnswer },
      { onConflict: "session_id,question_id" }
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <Card className="w-full max-w-md"><CardContent className="pt-8 pb-6 text-center">
          <AlertCircle className="h-12 w-12 mx-auto text-destructive mb-4" />
          <h2 className="text-xl font-bold mb-2">No Questions</h2>
          <p className="text-muted-foreground">This exam has no questions yet.</p>
        </CardContent></Card>
      </div>
    );
  }

  const q = questions[currentQuestion];
  const options = [
    { key: "A", text: q.option_a },
    { key: "B", text: q.option_b },
    { key: "C", text: q.option_c },
    { key: "D", text: q.option_d },
  ];
  const isTimeLow = timeLeft < 300;

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <div className="sticky top-0 z-50 glass border-b border-border/50">
        <div className="container flex h-14 items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-muted-foreground">
              Question {currentQuestion + 1} of {totalQuestions}
            </span>
            <Progress value={progress} className="w-32 h-2" />
          </div>
          <div className={`flex items-center gap-2 font-mono text-lg font-bold ${isTimeLow ? "text-destructive animate-pulse" : "text-foreground"}`}>
            <Clock className="h-4 w-4" />
            {formatTime(timeLeft)}
          </div>
        </div>
      </div>

      {/* Question */}
      <div className="container max-w-2xl py-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentQuestion}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="border-border/50 shadow-xl">
              <CardContent className="pt-8 pb-6">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-medium text-primary bg-primary/10 px-2.5 py-1 rounded-full">{q.marks} marks</span>
                  <span className="text-xs text-muted-foreground">{answeredCount}/{totalQuestions} answered</span>
                </div>
                <h2 className="text-xl font-semibold mb-6 mt-4">{q.question_text}</h2>

                <RadioGroup
                  value={answers[q.id] || ""}
                  onValueChange={(value) => saveAnswer(q.id, value)}
                  className="space-y-3"
                >
                  {options.map((opt, i) => (
                    <motion.div key={opt.key} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                      <Label
                        htmlFor={`option-${opt.key}`}
                        className={`flex items-center gap-3 rounded-xl border p-4 cursor-pointer transition-all hover:border-primary/30 hover:bg-primary/5 ${
                          answers[q.id] === opt.key ? "border-primary bg-primary/5 shadow-sm" : "border-border"
                        }`}
                      >
                        <RadioGroupItem value={opt.key} id={`option-${opt.key}`} />
                        <span className="font-medium text-sm">{opt.key}.</span>
                        <span>{opt.text}</span>
                      </Label>
                    </motion.div>
                  ))}
                </RadioGroup>
              </CardContent>
            </Card>
          </motion.div>
        </AnimatePresence>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-6">
          <Button variant="outline" onClick={() => setCurrentQuestion((p) => Math.max(0, p - 1))} disabled={currentQuestion === 0} className="gap-2">
            <ChevronLeft className="h-4 w-4" /> Previous
          </Button>
          {isLastQuestion ? (
            <Button onClick={handleSubmit} disabled={!allAnswered || submitting} className="gap-2 gradient-primary border-0 text-primary-foreground hover:opacity-90">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {submitting ? "Submitting..." : "Submit Exam"}
            </Button>
          ) : (
            <Button onClick={() => setCurrentQuestion((p) => Math.min(totalQuestions - 1, p + 1))} className="gap-2">
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>

        {!allAnswered && isLastQuestion && (
          <div className="mt-4 flex items-center gap-2 text-sm text-amber-600 bg-amber-50 p-3 rounded-xl border border-amber-200">
            <AlertCircle className="h-4 w-4 shrink-0" />
            Please answer all questions before submitting.
          </div>
        )}

        {/* Question indicators */}
        <div className="mt-8 flex flex-wrap gap-2 justify-center">
          {questions.map((qu, i) => (
            <button
              key={qu.id}
              onClick={() => setCurrentQuestion(i)}
              className={`h-9 w-9 rounded-lg text-sm font-medium transition-all ${
                i === currentQuestion
                  ? "gradient-primary text-primary-foreground shadow-md"
                  : answers[qu.id]
                  ? "bg-success/10 text-success border border-success/20"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {i + 1}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ExamPage;
