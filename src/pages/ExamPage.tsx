import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, ChevronLeft, ChevronRight, Send, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";

// Demo questions
const demoQuestions = [
  {
    id: 1,
    text: "What is the capital of France?",
    options: ["London", "Berlin", "Paris", "Madrid"],
    marks: 5,
  },
  {
    id: 2,
    text: "Which programming language is primarily used for web browsers?",
    options: ["Python", "JavaScript", "C++", "Java"],
    marks: 5,
  },
  {
    id: 3,
    text: "What is 2 + 2?",
    options: ["3", "4", "5", "6"],
    marks: 5,
  },
  {
    id: 4,
    text: "Who painted the Mona Lisa?",
    options: ["Van Gogh", "Picasso", "Da Vinci", "Monet"],
    marks: 5,
  },
  {
    id: 5,
    text: "What is the largest planet in our solar system?",
    options: ["Mars", "Saturn", "Jupiter", "Neptune"],
    marks: 5,
  },
];

const ExamPage = () => {
  const { accessCode } = useParams();
  const navigate = useNavigate();
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [timeLeft, setTimeLeft] = useState(30 * 60); // 30 minutes

  const questions = demoQuestions;
  const totalQuestions = questions.length;
  const progress = ((currentQuestion + 1) / totalQuestions) * 100;
  const answeredCount = Object.keys(answers).length;
  const allAnswered = answeredCount === totalQuestions;
  const isLastQuestion = currentQuestion === totalQuestions - 1;

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const handleSubmit = useCallback(() => {
    navigate(`/exam/${accessCode}/complete`);
  }, [navigate, accessCode]);

  useEffect(() => {
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
  }, [handleSubmit]);

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
          <div
            className={`flex items-center gap-2 font-mono text-lg font-bold ${
              isTimeLow ? "text-destructive animate-pulse" : "text-foreground"
            }`}
          >
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
                  <span className="text-xs font-medium text-primary bg-primary/10 px-2.5 py-1 rounded-full">
                    {questions[currentQuestion].marks} marks
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {answeredCount}/{totalQuestions} answered
                  </span>
                </div>
                <h2 className="text-xl font-semibold mb-6 mt-4">
                  {questions[currentQuestion].text}
                </h2>

                <RadioGroup
                  value={answers[questions[currentQuestion].id] || ""}
                  onValueChange={(value) =>
                    setAnswers((prev) => ({ ...prev, [questions[currentQuestion].id]: value }))
                  }
                  className="space-y-3"
                >
                  {questions[currentQuestion].options.map((option, i) => (
                    <motion.div
                      key={option}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                    >
                      <Label
                        htmlFor={`option-${i}`}
                        className={`flex items-center gap-3 rounded-xl border p-4 cursor-pointer transition-all hover:border-primary/30 hover:bg-primary/5 ${
                          answers[questions[currentQuestion].id] === option
                            ? "border-primary bg-primary/5 shadow-sm"
                            : "border-border"
                        }`}
                      >
                        <RadioGroupItem value={option} id={`option-${i}`} />
                        <span className="font-medium text-sm">{String.fromCharCode(65 + i)}.</span>
                        <span>{option}</span>
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
          <Button
            variant="outline"
            onClick={() => setCurrentQuestion((p) => Math.max(0, p - 1))}
            disabled={currentQuestion === 0}
            className="gap-2"
          >
            <ChevronLeft className="h-4 w-4" /> Previous
          </Button>

          {isLastQuestion ? (
            <Button
              onClick={handleSubmit}
              disabled={!allAnswered}
              className="gap-2 gradient-primary border-0 text-primary-foreground hover:opacity-90"
            >
              <Send className="h-4 w-4" /> Submit Exam
            </Button>
          ) : (
            <Button
              onClick={() => setCurrentQuestion((p) => Math.min(totalQuestions - 1, p + 1))}
              className="gap-2"
            >
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
          {questions.map((q, i) => (
            <button
              key={q.id}
              onClick={() => setCurrentQuestion(i)}
              className={`h-9 w-9 rounded-lg text-sm font-medium transition-all ${
                i === currentQuestion
                  ? "gradient-primary text-primary-foreground shadow-md"
                  : answers[q.id]
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
