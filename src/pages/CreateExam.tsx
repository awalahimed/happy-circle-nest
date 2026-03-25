import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  BookOpen, ArrowLeft, ArrowRight, Check, Plus, Trash2, Copy, ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Question {
  id: string;
  text: string;
  options: string[];
  correctAnswer: string;
  marks: number;
}

const steps = ["Exam Details", "Add Questions", "Review & Publish"];

const CreateExam = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  // Step 1
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [duration, setDuration] = useState("30");
  const [accessCode, setAccessCode] = useState(() => Math.random().toString(36).slice(2, 8).toUpperCase());

  // Step 2
  const [questions, setQuestions] = useState<Question[]>([
    { id: "1", text: "", options: ["", "", "", ""], correctAnswer: "", marks: 5 },
  ]);

  // Check auth
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) navigate("/login");
    });
  }, [navigate]);

  const addQuestion = () => {
    setQuestions((prev) => [
      ...prev,
      { id: String(Date.now()), text: "", options: ["", "", "", ""], correctAnswer: "", marks: 5 },
    ]);
  };

  const removeQuestion = (id: string) => {
    if (questions.length > 1) setQuestions((prev) => prev.filter((q) => q.id !== id));
  };

  const updateQuestion = (id: string, field: string, value: any) => {
    setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, [field]: value } : q)));
  };

  const updateOption = (qId: string, optIndex: number, value: string) => {
    setQuestions((prev) =>
      prev.map((q) =>
        q.id === qId ? { ...q, options: q.options.map((o, i) => (i === optIndex ? value : o)) } : q
      )
    );
  };

  const handlePublish = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Validate
      if (!title.trim()) throw new Error("Exam title is required");
      if (questions.some((q) => !q.text.trim())) throw new Error("All questions must have text");
      if (questions.some((q) => !q.correctAnswer)) throw new Error("All questions must have a correct answer");
      if (questions.some((q) => q.options.some((o) => !o.trim()))) throw new Error("All options must be filled");

      // Create exam
      const { data: exam, error: examError } = await supabase
        .from("exams")
        .insert({
          teacher_id: user.id,
          title: title.trim(),
          subject: subject.trim(),
          duration_minutes: parseInt(duration) || 30,
          access_code: accessCode,
          status: "published",
        })
        .select()
        .single();

      if (examError) throw examError;

      // Create questions
      const questionsToInsert = questions.map((q, i) => ({
        exam_id: exam.id,
        question_text: q.text.trim(),
        option_a: q.options[0].trim(),
        option_b: q.options[1].trim(),
        option_c: q.options[2].trim(),
        option_d: q.options[3].trim(),
        correct_answer: q.correctAnswer,
        marks: q.marks,
        question_order: i,
      }));

      const { error: qError } = await supabase.from("questions").insert(questionsToInsert);
      if (qError) throw qError;

      toast({ title: "Exam Published!", description: "Students can now access the exam using the link." });
      navigate("/teacher");
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const examLink = `${window.location.origin}/exam/${accessCode}`;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 glass border-b border-border/50">
        <div className="container flex h-14 items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/teacher"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <h1 className="font-semibold">Create Exam</h1>
        </div>
      </header>

      <div className="container max-w-2xl py-8">
        {/* Stepper */}
        <div className="flex items-center justify-center mb-10">
          {steps.map((s, i) => (
            <div key={s} className="flex items-center">
              <div className="flex flex-col items-center">
                <div
                  className={`h-9 w-9 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                    i <= step ? "gradient-primary text-primary-foreground shadow-md" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {i < step ? <Check className="h-4 w-4" /> : i + 1}
                </div>
                <span className={`text-xs mt-2 font-medium ${i <= step ? "text-primary" : "text-muted-foreground"}`}>{s}</span>
              </div>
              {i < steps.length - 1 && (
                <div className={`w-16 md:w-24 h-0.5 mx-2 mt-[-16px] ${i < step ? "bg-primary" : "bg-border"}`} />
              )}
            </div>
          ))}
        </div>

        {/* Step 1 */}
        {step === 0 && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
            <Card className="border-border/50 shadow-xl">
              <CardHeader>
                <CardTitle>Exam Details</CardTitle>
                <CardDescription>Set up the basic information for your exam</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Exam Title</Label>
                  <Input placeholder="e.g. Mathematics Mid-term" value={title} onChange={(e) => setTitle(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Subject</Label>
                    <Input placeholder="e.g. Mathematics" value={subject} onChange={(e) => setSubject(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Duration (minutes)</Label>
                    <Input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Access Code</Label>
                  <Input value={accessCode} onChange={(e) => setAccessCode(e.target.value)} className="font-mono" />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Step 2 */}
        {step === 1 && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
            {questions.map((q, qi) => (
              <Card key={q.id} className="border-border/50 shadow-lg">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-base">Question {qi + 1}</CardTitle>
                  <Button variant="ghost" size="icon" onClick={() => removeQuestion(q.id)} disabled={questions.length <= 1}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Question Text</Label>
                    <Input placeholder="Enter the question" value={q.text} onChange={(e) => updateQuestion(q.id, "text", e.target.value)} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {q.options.map((opt, oi) => (
                      <div key={oi} className="space-y-1">
                        <Label className="text-xs">Option {String.fromCharCode(65 + oi)}</Label>
                        <Input placeholder={`Option ${String.fromCharCode(65 + oi)}`} value={opt} onChange={(e) => updateOption(q.id, oi, e.target.value)} />
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Correct Answer</Label>
                      <RadioGroup value={q.correctAnswer} onValueChange={(v) => updateQuestion(q.id, "correctAnswer", v)} className="flex gap-4">
                        {["A", "B", "C", "D"].map((l) => (
                          <div key={l} className="flex items-center gap-1.5">
                            <RadioGroupItem value={l} id={`${q.id}-${l}`} />
                            <Label htmlFor={`${q.id}-${l}`} className="text-sm">{l}</Label>
                          </div>
                        ))}
                      </RadioGroup>
                    </div>
                    <div className="space-y-2">
                      <Label>Marks</Label>
                      <Input type="number" value={q.marks} onChange={(e) => updateQuestion(q.id, "marks", Number(e.target.value))} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            <Button variant="outline" onClick={addQuestion} className="w-full gap-2 border-dashed">
              <Plus className="h-4 w-4" /> Add Question
            </Button>
          </motion.div>
        )}

        {/* Step 3 */}
        {step === 2 && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
            <Card className="border-border/50 shadow-xl">
              <CardHeader>
                <CardTitle>Review & Publish</CardTitle>
                <CardDescription>Review your exam before publishing</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><span className="text-muted-foreground">Title:</span> <strong>{title || "—"}</strong></div>
                  <div><span className="text-muted-foreground">Subject:</span> <strong>{subject || "—"}</strong></div>
                  <div><span className="text-muted-foreground">Duration:</span> <strong>{duration} min</strong></div>
                  <div><span className="text-muted-foreground">Questions:</span> <strong>{questions.length}</strong></div>
                  <div><span className="text-muted-foreground">Total Marks:</span> <strong>{questions.reduce((s, q) => s + q.marks, 0)}</strong></div>
                  <div><span className="text-muted-foreground">Access Code:</span> <strong className="font-mono">{accessCode}</strong></div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/50 shadow-xl">
              <CardHeader><CardTitle className="text-base">Share Exam Link</CardTitle></CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Input value={examLink} readOnly className="font-mono text-sm bg-muted" />
                  <Button variant="outline" size="icon" onClick={() => { navigator.clipboard.writeText(examLink); toast({ title: "Copied!" }); }}>
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" asChild>
                    <a href={examLink} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" /></a>
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Questions preview */}
            <Card className="border-border/50 shadow-xl">
              <CardHeader><CardTitle className="text-base">Questions Preview</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {questions.map((q, i) => (
                  <div key={q.id} className="p-3 rounded-lg bg-muted/50 text-sm">
                    <p className="font-medium">{i + 1}. {q.text || "—"}</p>
                    <div className="mt-1 grid grid-cols-2 gap-1 text-muted-foreground text-xs">
                      {q.options.map((o, oi) => (
                        <span key={oi} className={q.correctAnswer === String.fromCharCode(65 + oi) ? "text-success font-medium" : ""}>
                          {String.fromCharCode(65 + oi)}. {o || "—"}
                        </span>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Marks: {q.marks} · Correct: {q.correctAnswer || "—"}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Navigation */}
        <div className="flex justify-between mt-8">
          <Button variant="outline" onClick={() => setStep((s) => s - 1)} disabled={step === 0} className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          {step < 2 ? (
            <Button onClick={() => setStep((s) => s + 1)} className="gap-2 gradient-primary border-0 text-primary-foreground hover:opacity-90">
              Next <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={handlePublish} disabled={saving} className="gap-2 gradient-primary border-0 text-primary-foreground hover:opacity-90">
              {saving ? "Publishing..." : <><Check className="h-4 w-4" /> Publish Exam</>}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CreateExam;
