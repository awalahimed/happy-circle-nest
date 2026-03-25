import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { BookOpen, Clock, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const rules = [
  "Do not switch tabs or leave the exam window.",
  "Each question must be answered before moving forward.",
  "The exam will auto-submit when the timer runs out.",
  "You cannot go back once the exam is submitted.",
  "Ensure a stable internet connection throughout the exam.",
];

const ExamReady = () => {
  const { accessCode } = useParams();
  const navigate = useNavigate();
  const [waiting, setWaiting] = useState(true);

  // Simulated wait — in production this would listen to Supabase Realtime
  useEffect(() => {
    const timer = setTimeout(() => setWaiting(false), 5000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-lg"
      >
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-2xl gradient-primary flex items-center justify-center">
            <BookOpen className="h-6 w-6 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold">Exam Instructions</h1>
          <p className="text-muted-foreground mt-1">Please read carefully before the exam begins</p>
        </div>

        <Card className="border-border/50 shadow-xl mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Exam Rules
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {rules.map((rule, i) => (
                <motion.li
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="flex items-start gap-3 text-sm"
                >
                  <CheckCircle2 className="h-4 w-4 text-success mt-0.5 shrink-0" />
                  <span>{rule}</span>
                </motion.li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-xl">
          <CardContent className="pt-6">
            {waiting ? (
              <div className="flex flex-col items-center gap-4 py-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <div className="text-center">
                  <p className="font-semibold">Waiting for the exam to start...</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    The teacher will start the exam shortly. Please stay on this page.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4 py-4">
                <div className="h-12 w-12 rounded-full bg-success/10 flex items-center justify-center">
                  <CheckCircle2 className="h-6 w-6 text-success" />
                </div>
                <div className="text-center">
                  <p className="font-semibold text-success">Exam is starting!</p>
                  <p className="text-sm text-muted-foreground mt-1">Redirecting you to the exam...</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default ExamReady;
