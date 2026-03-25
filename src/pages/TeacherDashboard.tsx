import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  BookOpen, Plus, FileText, Users, BarChart3, LogOut,
  LayoutDashboard, Settings, ChevronRight, Play, Loader2, Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Tables } from "@/integrations/supabase/types";

type Exam = Tables<"exams">;

const TeacherDashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [sessionCounts, setSessionCounts] = useState<Record<string, number>>({});
  const [userName, setUserName] = useState("Teacher");

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate("/login"); return; }

      // Load profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("id", session.user.id)
        .single();
      if (profile) setUserName(profile.full_name || profile.email || "Teacher");

      // Load exams
      const { data, error } = await supabase
        .from("exams")
        .select("*")
        .eq("teacher_id", session.user.id)
        .order("created_at", { ascending: false });

      if (error) {
        toast({ title: "Error loading exams", description: error.message, variant: "destructive" });
      } else {
        setExams(data || []);
        // Fetch student counts per exam
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

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar */}
      <aside className="hidden md:flex w-64 flex-col border-r border-border/50 bg-card">
        <div className="p-6 flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg gradient-primary flex items-center justify-center">
            <BookOpen className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-bold text-lg">ExamFlow</span>
        </div>
        <nav className="flex-1 px-3 space-y-1">
          {[
            { icon: LayoutDashboard, label: "Dashboard", active: true },
            { icon: FileText, label: "My Exams" },
            { icon: BarChart3, label: "Reports" },
            { icon: Settings, label: "Settings" },
          ].map((item) => (
            <button
              key={item.label}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                item.active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
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
              <h1 className="text-2xl font-bold">Dashboard</h1>
              <p className="text-sm text-muted-foreground">Welcome back, {userName}</p>
            </div>
            <Button asChild className="gap-2 gradient-primary border-0 text-primary-foreground hover:opacity-90">
              <Link to="/teacher/create"><Plus className="h-4 w-4" /> Create Exam</Link>
            </Button>
          </div>
        </header>

        <div className="p-6 space-y-6">
          {/* Stats */}
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

          {/* Exams List */}
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-lg">Your Exams</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : exams.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
                  <p className="text-muted-foreground">No exams yet. Create your first exam!</p>
                  <Button asChild className="mt-4 gap-2 gradient-primary border-0 text-primary-foreground hover:opacity-90">
                    <Link to="/teacher/create"><Plus className="h-4 w-4" /> Create Exam</Link>
                  </Button>
                </div>
              ) : (
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
                          <Button size="sm" variant="outline" className="gap-1.5 text-success border-success/20 hover:bg-success/10" onClick={() => handleStartExam(exam.id)}>
                            <Play className="h-3.5 w-3.5" /> Start
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/exam/${exam.access_code}`); toast({ title: "Link copied!" }); }}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default TeacherDashboard;
