import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Plus, FileText, Users, BarChart3, LogOut,
  LayoutDashboard, Settings, Play, Loader2, Eye, Pencil, Trash2, X, Check, Mail,
} from "lucide-react";
import logo from "@/assets/logo.png";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Tables } from "@/integrations/supabase/types";

type Exam = Tables<"exams">;

type ActiveTab = "dashboard" | "exams" | "reports" | "settings";

interface StudentReport {
  sessionId: string;
  studentName: string;
  studentEmail: string;
  examTitle: string;
  examSubject: string;
  score: number | null;
  totalMarks: number | null;
  status: string;
  submittedAt: string | null;
  correct: number;
  incorrect: number;
  unanswered: number;
  totalQuestions: number;
}

const TeacherDashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<ActiveTab>("dashboard");
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [sessionCounts, setSessionCounts] = useState<Record<string, number>>({});
  const [userName, setUserName] = useState("Teacher");
  const [userId, setUserId] = useState("");

  // Reports state
  const [reports, setReports] = useState<StudentReport[]>([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);

  // Settings state
  const [profileName, setProfileName] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  // Edit/Delete state
  const [editingExam, setEditingExam] = useState<Exam | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editSubject, setEditSubject] = useState("");
  const [editDuration, setEditDuration] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [deletingExamId, setDeletingExamId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [sendingResultsExamId, setSendingResultsExamId] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate("/login"); return; }
      setUserId(session.user.id);

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("id", session.user.id)
        .single();
      if (profile) {
        setUserName(profile.full_name || profile.email || "Teacher");
        setProfileName(profile.full_name || "");
        setProfileEmail(profile.email || "");
      }

      const { data, error } = await supabase
        .from("exams")
        .select("*")
        .eq("teacher_id", session.user.id)
        .order("created_at", { ascending: false });

      if (error) {
        toast({ title: "Error loading exams", description: error.message, variant: "destructive" });
      } else {
        setExams(data || []);
        if (data && data.length > 0) {
          const counts: Record<string, number> = {};
          for (const exam of data) {
            const { count } = await supabase
              .from("exam_sessions")
              .select("*", { count: "exact", head: true })
              .eq("exam_id", exam.id);
            counts[exam.id] = count || 0;
          }
          setSessionCounts(counts);
        }
      }
      setLoading(false);
    };
    init();
  }, [navigate, toast]);

  // Load reports when tab switches
  useEffect(() => {
    if (activeTab === "reports" && exams.length > 0 && reports.length === 0) {
      loadReports();
    }
  }, [activeTab, exams]);

  const loadReports = async () => {
    setReportsLoading(true);
    try {
      const examIds = exams.map((e) => e.id);
      const { data: sessions } = await supabase
        .from("exam_sessions")
        .select("*")
        .in("exam_id", examIds);

      if (!sessions || sessions.length === 0) {
        setReports([]);
        setReportsLoading(false);
        return;
      }

      // Get all questions for these exams
      const { data: questions } = await supabase
        .from("questions")
        .select("*")
        .in("exam_id", examIds);

      // Get all answers for these sessions
      const sessionIds = sessions.map((s) => s.id);
      const { data: answers } = await supabase
        .from("student_answers")
        .select("*")
        .in("session_id", sessionIds);

      const examMap = Object.fromEntries(exams.map((e) => [e.id, e]));
      const questionsPerExam: Record<string, number> = {};
      (questions || []).forEach((q) => {
        questionsPerExam[q.exam_id] = (questionsPerExam[q.exam_id] || 0) + 1;
      });

      const studentReports: StudentReport[] = sessions.map((session) => {
        const sessionAnswers = (answers || []).filter((a) => a.session_id === session.id);
        const totalQ = questionsPerExam[session.exam_id] || 0;
        const correct = sessionAnswers.filter((a) => a.is_correct === true).length;
        const incorrect = sessionAnswers.filter((a) => a.is_correct === false).length;
        const answered = sessionAnswers.filter((a) => a.selected_answer).length;
        const unanswered = totalQ - answered;
        const exam = examMap[session.exam_id];

        return {
          sessionId: session.id,
          studentName: session.student_name,
          studentEmail: session.student_email,
          examTitle: exam?.title || "Unknown",
          examSubject: exam?.subject || "",
          score: session.score,
          totalMarks: session.total_marks,
          status: session.status,
          submittedAt: session.submitted_at,
          correct,
          incorrect,
          unanswered,
          totalQuestions: totalQ,
        };
      });

      setReports(studentReports);
    } catch (err: any) {
      toast({ title: "Error loading reports", description: err.message, variant: "destructive" });
    }
    setReportsLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  const handleStartExam = async (examId: string) => {
    const { error } = await supabase
      .from("exams")
      .update({ status: "active", started_at: new Date().toISOString() })
      .eq("id", examId);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setExams((prev) => prev.map((e) => e.id === examId ? { ...e, status: "active", started_at: new Date().toISOString() } : e));
      toast({ title: "Exam started!", description: "Students can now take the exam." });
    }
  };

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: profileName })
      .eq("id", userId);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setUserName(profileName);
      toast({ title: "Profile updated!" });
    }
    setSavingProfile(false);
  };

  const openEditExam = (exam: Exam) => {
    setEditingExam(exam);
    setEditTitle(exam.title);
    setEditSubject(exam.subject);
    setEditDuration(String(exam.duration_minutes));
  };

  const handleEditExam = async () => {
    if (!editingExam) return;
    setEditSaving(true);
    const { error } = await supabase
      .from("exams")
      .update({ title: editTitle.trim(), subject: editSubject.trim(), duration_minutes: parseInt(editDuration) || 30 })
      .eq("id", editingExam.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setExams((prev) => prev.map((e) => e.id === editingExam.id ? { ...e, title: editTitle.trim(), subject: editSubject.trim(), duration_minutes: parseInt(editDuration) || 30 } : e));
      toast({ title: "Exam updated!" });
      setEditingExam(null);
    }
    setEditSaving(false);
  };

  const handleDeleteExam = async () => {
    if (!deletingExamId) return;
    setDeleteLoading(true);
    try {
      // Delete related data first (answers → sessions → questions → exam)
      const { data: sessions } = await supabase.from("exam_sessions").select("id").eq("exam_id", deletingExamId);
      if (sessions && sessions.length > 0) {
        const sessionIds = sessions.map((s) => s.id);
        await supabase.from("student_answers").delete().in("session_id", sessionIds);
        await supabase.from("exam_sessions").delete().eq("exam_id", deletingExamId);
      }
      await supabase.from("questions").delete().eq("exam_id", deletingExamId);
      const { error } = await supabase.from("exams").delete().eq("id", deletingExamId);
      if (error) throw error;
      setExams((prev) => prev.filter((e) => e.id !== deletingExamId));
      toast({ title: "Exam deleted!" });
    } catch (err: any) {
      toast({ title: "Error deleting exam", description: err.message, variant: "destructive" });
    }
    setDeleteLoading(false);
    setDeletingExamId(null);
  };

  const handleSendResults = async (examId: string) => {
    setSendingResultsExamId(examId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast({ title: "Not authenticated", variant: "destructive" }); return; }

      const { data, error } = await supabase.functions.invoke("send-exam-results", {
        body: {
          examId,
          senderEmail: profileEmail || session.user.email,
          senderName: userName,
        },
      });

      if (error) throw error;
      if (data?.error && data.sent === undefined) throw new Error(data.error);

      toast({
        title: data.sent > 0 ? "Results sent!" : "No results to send",
        description: data.sent > 0
          ? `Successfully sent results to ${data.sent}/${data.total} students.${data.errors?.length ? ` ${data.errors.length} failed.` : ""}`
          : "No submitted sessions found for this exam.",
      });
    } catch (err: any) {
      toast({ title: "Error sending results", description: err.message, variant: "destructive" });
    }
    setSendingResultsExamId(null);
  };

  const totalStudents = Object.values(sessionCounts).reduce((a, b) => a + b, 0);
  const activeExams = exams.filter((e) => e.status === "active").length;

  const stats = [
    { label: "Total Exams", value: String(exams.length), icon: FileText, color: "text-primary" },
    { label: "Active Exams", value: String(activeExams), icon: BarChart3, color: "text-success" },
    { label: "Total Students", value: String(totalStudents), icon: Users, color: "text-accent" },
  ];

  const statusColors: Record<string, string> = {
    draft: "bg-muted text-muted-foreground",
    published: "bg-primary/10 text-primary",
    active: "bg-success/10 text-success",
    completed: "bg-muted text-muted-foreground",
  };

  const navItems: { icon: typeof LayoutDashboard; label: string; tab: ActiveTab }[] = [
    { icon: LayoutDashboard, label: "Dashboard", tab: "dashboard" },
    { icon: FileText, label: "My Exams", tab: "exams" },
    { icon: BarChart3, label: "Reports", tab: "reports" },
    { icon: Settings, label: "Settings", tab: "settings" },
  ];

  const getScoreColor = (score: number | null, total: number | null) => {
    if (score == null || total == null || total === 0) return "text-muted-foreground";
    const pct = (score / total) * 100;
    if (pct >= 70) return "text-success";
    if (pct >= 40) return "text-amber-500";
    return "text-destructive";
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar */}
      <aside className="hidden md:flex w-64 flex-col border-r border-border/50 bg-card">
        <div className="p-6 flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg gradient-primary flex items-center justify-center">
            <BookOpen className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-bold text-lg">Nejo Exam Prep</span>
        </div>
        <nav className="flex-1 px-3 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.label}
              onClick={() => setActiveTab(item.tab)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                activeTab === item.tab ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </button>
          ))}
        </nav>
        <div className="p-3">
          <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all">
            <LogOut className="h-4 w-4" /> Sign Out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">
        <header className="sticky top-0 z-40 glass border-b border-border/50 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold capitalize">{activeTab === "dashboard" ? "Dashboard" : activeTab === "exams" ? "My Exams" : activeTab === "reports" ? "Reports" : "Settings"}</h1>
              <p className="text-sm text-muted-foreground">Welcome back, {userName}</p>
            </div>
            {(activeTab === "dashboard" || activeTab === "exams") && (
              <Button asChild className="gap-2 gradient-primary border-0 text-primary-foreground hover:opacity-90">
                <Link to="/teacher/create"><Plus className="h-4 w-4" /> Create Exam</Link>
              </Button>
            )}
          </div>
        </header>

        <div className="p-6 space-y-6">
          {/* Dashboard Tab */}
          {activeTab === "dashboard" && (
            <>
              <div className="grid gap-4 md:grid-cols-3">
                {stats.map((stat, i) => (
                  <motion.div key={stat.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
                    <Card className="border-border/50 hover:shadow-md transition-shadow">
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-muted-foreground">{stat.label}</p>
                            <p className="text-3xl font-bold mt-1">{stat.value}</p>
                          </div>
                          <div className={`h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center ${stat.color}`}>
                            <stat.icon className="h-6 w-6" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>

              {/* Recent exams */}
              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle className="text-lg">Recent Exams</CardTitle>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : exams.length === 0 ? (
                    <EmptyExams />
                  ) : (
                    <ExamsList exams={exams.slice(0, 5)} sessionCounts={sessionCounts} statusColors={statusColors} onStart={handleStartExam} onEdit={openEditExam} onDelete={setDeletingExamId} onSendResults={handleSendResults} sendingResultsExamId={sendingResultsExamId} toast={toast} />
                  )}
                </CardContent>
              </Card>
            </>
          )}

          {/* My Exams Tab */}
          {activeTab === "exams" && (
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="text-lg">All Exams</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : exams.length === 0 ? (
                  <EmptyExams />
                ) : (
                  <ExamsList exams={exams} sessionCounts={sessionCounts} statusColors={statusColors} onStart={handleStartExam} onEdit={openEditExam} onDelete={setDeletingExamId} onSendResults={handleSendResults} sendingResultsExamId={sendingResultsExamId} toast={toast} />
                )}
              </CardContent>
            </Card>
          )}

          {/* Reports Tab */}
          {activeTab === "reports" && (
            <Card className="border-border/50">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Student Reports</CardTitle>
                  <Button variant="outline" size="sm" onClick={loadReports} disabled={reportsLoading}>
                    {reportsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Refresh"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {reportsLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : reports.length === 0 ? (
                  <div className="text-center py-12">
                    <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
                    <p className="text-muted-foreground">No student submissions yet.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Student</TableHead>
                          <TableHead>Exam</TableHead>
                          <TableHead className="text-center">Score</TableHead>
                          <TableHead className="text-center text-success">Correct</TableHead>
                          <TableHead className="text-center text-destructive">Incorrect</TableHead>
                          <TableHead className="text-center text-muted-foreground">Unanswered</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {reports.map((r) => (
                          <TableRow key={r.sessionId} className="group">
                            <TableCell>
                              <div>
                                <p className="font-medium">{r.studentName}</p>
                                <p className="text-xs text-muted-foreground">{r.studentEmail}</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div>
                                <p className="font-medium">{r.examTitle}</p>
                                <p className="text-xs text-muted-foreground">{r.examSubject}</p>
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <span className={`font-bold ${getScoreColor(r.score, r.totalMarks)}`}>
                                {r.score ?? "—"}/{r.totalMarks ?? "—"}
                              </span>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant="outline" className="border-success/30 text-success bg-success/5">
                                {r.correct}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant="outline" className="border-destructive/30 text-destructive bg-destructive/5">
                                {r.incorrect}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant="outline" className="border-border text-muted-foreground">
                                {r.unanswered}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <span className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize ${
                                r.status === "submitted" ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"
                              }`}>
                                {r.status}
                              </span>
                            </TableCell>
                            <TableCell>
                              <span className="text-xs text-muted-foreground">
                                {r.totalQuestions} Q
                              </span>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Settings Tab */}
          {activeTab === "settings" && (
            <div className="space-y-6 max-w-lg">
              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle className="text-lg">Profile Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Full Name</Label>
                    <Input value={profileName} onChange={(e) => setProfileName(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input value={profileEmail} disabled className="bg-muted" />
                    <p className="text-xs text-muted-foreground">Email cannot be changed.</p>
                  </div>
                  <Button onClick={handleSaveProfile} disabled={savingProfile} className="gradient-primary border-0 text-primary-foreground hover:opacity-90">
                    {savingProfile ? "Saving..." : "Save Changes"}
                  </Button>
                </CardContent>
              </Card>

              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle className="text-lg">Account</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Your account is managed by the administrator. Contact your admin for password resets or account changes.
                  </p>
                  <Button variant="outline" className="text-destructive border-destructive/20 hover:bg-destructive/10" onClick={handleLogout}>
                    <LogOut className="h-4 w-4 mr-2" /> Sign Out
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        {/* Edit Exam Dialog */}
        <Dialog open={!!editingExam} onOpenChange={(open) => !open && setEditingExam(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Exam</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Subject</Label>
                <Input value={editSubject} onChange={(e) => setEditSubject(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Duration (minutes)</Label>
                <Input type="number" value={editDuration} onChange={(e) => setEditDuration(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingExam(null)}>Cancel</Button>
              <Button onClick={handleEditExam} disabled={editSaving} className="gradient-primary border-0 text-primary-foreground hover:opacity-90">
                {editSaving ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Exam Confirmation */}
        <AlertDialog open={!!deletingExamId} onOpenChange={(open) => !open && setDeletingExamId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Exam</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete the exam, all its questions, student sessions, and answers. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleteLoading}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteExam} disabled={deleteLoading} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                {deleteLoading ? "Deleting..." : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
    </div>
  );
};

// --- Sub-components ---

const EmptyExams = () => (
  <div className="text-center py-12">
    <FileText className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
    <p className="text-muted-foreground">No exams yet. Create your first exam!</p>
    <Button asChild className="mt-4 gap-2 gradient-primary border-0 text-primary-foreground hover:opacity-90">
      <Link to="/teacher/create"><Plus className="h-4 w-4" /> Create Exam</Link>
    </Button>
  </div>
);

interface ExamsListProps {
  exams: Exam[];
  sessionCounts: Record<string, number>;
  statusColors: Record<string, string>;
  onStart: (id: string) => void;
  onEdit: (exam: Exam) => void;
  onDelete: (id: string) => void;
  onSendResults: (id: string) => void;
  sendingResultsExamId: string | null;
  toast: any;
}

const ExamsList = ({ exams, sessionCounts, statusColors, onStart, onEdit, onDelete, onSendResults, sendingResultsExamId, toast }: ExamsListProps) => (
  <div className="space-y-3">
    {exams.map((exam) => (
      <div key={exam.id} className="flex items-center justify-between p-4 rounded-xl border border-border/50 hover:bg-muted/50 transition-colors">
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <p className="font-medium">{exam.title}</p>
            <p className="text-sm text-muted-foreground">
              {exam.subject} · {sessionCounts[exam.id] || 0} students · {exam.duration_minutes} min
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize ${statusColors[exam.status] || statusColors.draft}`}>
            {exam.status}
          </span>
          {exam.status === "published" && (
            <Button size="sm" variant="outline" className="gap-1.5 text-success border-success/20 hover:bg-success/10" onClick={() => onStart(exam.id)}>
              <Play className="h-3.5 w-3.5" /> Start
            </Button>
          )}
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => onSendResults(exam.id)} disabled={sendingResultsExamId === exam.id}>
            {sendingResultsExamId === exam.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />} Send Results
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onEdit(exam)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => onDelete(exam.id)}>
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(`https://nejoexamprep.netlify.app/exam/${exam.access_code}`); toast({ title: "Link copied!" }); }}>
            <Eye className="h-4 w-4" />
          </Button>
        </div>
      </div>
    ))}
  </div>
);

export default TeacherDashboard;
