import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Users, ShieldCheck, ArrowRight, Sparkles, Zap, BarChart3, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import logo from "@/assets/logo.png";

const features = [
  {
    icon: BookOpen,
    title: "Create Exams Easily",
    description: "Build exams with multiple choice questions, set time limits, and publish with one click.",
  },
  {
    icon: Users,
    title: "Seamless Student Access",
    description: "Students join via unique access codes. No registration required — just enter and go.",
  },
  {
    icon: Zap,
    title: "Real-time Sync",
    description: "All students start simultaneously when the teacher begins the exam. Live progress tracking.",
  },
  {
    icon: ShieldCheck,
    title: "Secure & Reliable",
    description: "Auto-save answers, countdown timers, and anti-cheat measures built in.",
  },
  {
    icon: BarChart3,
    title: "Instant Analytics",
    description: "View detailed results, performance charts, and export reports instantly.",
  },
  {
    icon: Sparkles,
    title: "Beautiful Experience",
    description: "Modern, distraction-free interface designed for focus and clarity.",
  },
];

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 glass border-b border-border/50">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src={logo} alt="Nejo Ifa Boru Logo" className="h-10 w-10 rounded-full object-cover" />
            <span className="text-lg font-bold">NejoExamPrep</span>
          </Link>
          <div className="flex items-center gap-3">
            <Button variant="ghost" asChild>
              <Link to="/login">Sign In</Link>
            </Button>
            <Button asChild className="gradient-primary border-0 text-primary-foreground hover:opacity-90">
              <Link to="/login">Get Started</Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="container py-24 md:py-32">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mx-auto max-w-3xl text-center"
        >
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm font-medium text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            Nejo Ifa Boru Special Boarding Secondary School
          </div>
          <h1 className="mb-6 text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl">
            Exams made{" "}
            <span className="gradient-text">simple, fast</span>
            {" "}& beautiful
          </h1>
          <p className="mb-10 text-lg text-muted-foreground max-w-2xl mx-auto">
            A secure online examination platform designed for Nejo Ifa Boru Special Boarding Secondary School.
            Students take mock exams, teachers and admins manage exams efficiently.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="lg" asChild className="gradient-primary border-0 text-primary-foreground hover:opacity-90 h-12 px-8 text-base">
              <Link to="/login">
                Start Creating Exams
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild className="h-12 px-8 text-base">
              <Link to="/exam/demo">Try as Student</Link>
            </Button>
          </div>
        </motion.div>
      </section>

      {/* Features */}
      <section className="container pb-24">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
              className="group rounded-2xl border border-border/50 bg-card p-6 transition-all hover:shadow-lg hover:border-primary/20"
            >
              <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <feature.icon className="h-5 w-5" />
              </div>
              <h3 className="mb-2 font-semibold text-lg">{feature.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-8">
        <div className="container text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} NejoExamPrep — Nejo Ifa Boru Special Boarding Secondary School.
        </div>
      </footer>
    </div>
  );
};

export default Index;
