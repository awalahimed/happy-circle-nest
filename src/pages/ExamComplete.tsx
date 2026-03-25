import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { CheckCircle2, Home, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const ExamComplete = () => {
  const score = sessionStorage.getItem("exam_score") || "0";
  const total = sessionStorage.getItem("exam_total") || "0";
  const correct = sessionStorage.getItem("exam_correct") || "0";
  const totalQuestions = sessionStorage.getItem("exam_total_questions") || "0";
  const percentage = Number(total) > 0 ? Math.round((Number(score) / Number(total)) * 100) : 0;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5, type: "spring" }} className="w-full max-w-md text-center">
        <Card className="border-border/50 shadow-xl">
          <CardContent className="pt-10 pb-8">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              className="mx-auto mb-6 h-20 w-20 rounded-full bg-success/10 flex items-center justify-center"
            >
              <CheckCircle2 className="h-10 w-10 text-success" />
            </motion.div>
            <h1 className="text-2xl font-bold mb-2">Exam Submitted!</h1>
            <p className="text-muted-foreground mb-6">Your answers have been recorded successfully.</p>

            {/* Score card */}
            <div className="rounded-2xl bg-muted/50 p-6 mb-6">
              <div className="flex items-center justify-center gap-2 mb-3">
                <Trophy className="h-5 w-5 text-primary" />
                <span className="font-semibold">Your Score</span>
              </div>
              <p className="text-4xl font-extrabold gradient-text mb-1">{percentage}%</p>
              <p className="text-sm text-muted-foreground">{score} / {total} marks</p>
              <p className="text-xs text-muted-foreground mt-1">{correct} of {totalQuestions} questions correct</p>
            </div>

            <Button asChild variant="outline" className="gap-2">
              <Link to="/"><Home className="h-4 w-4" /> Back to Home</Link>
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default ExamComplete;
