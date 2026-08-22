import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const features = [
  {
    icon: "🔴",
    title: "LiDAR Knowledge Base",
    description:
      "Ask questions about 3D LiDAR annotation tools, formats, and workflows.",
  },
  {
    icon: "🤖",
    title: "AI-Powered Answers",
    description:
      "Retrieval-Augmented Generation ensures accurate, source-cited responses.",
  },
  {
    icon: "📄",
    title: "Document Ingestion",
    description:
      "Upload technical manuals, specs, and FAQs to build your knowledge base.",
  },
];

export default function HomePage() {
  return (
    <div className="flex min-h-full flex-col">
      {/* Nav */}
      <header className="border-b border-border bg-card px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">🔴</span>
            <span className="text-sm font-semibold tracking-wide">ARIA</span>
          </div>
          <Badge variant="outline" className="text-xs">
            v0.1.0 · Foundation
          </Badge>
        </div>
      </header>

      {/* Hero */}
      <main className="flex flex-1 flex-col items-center justify-center gap-8 px-6 py-20">
        <div className="flex flex-col items-center gap-4 text-center">
          <Badge className="text-xs" variant="secondary">
            🚧 RAG Engine Coming Soon
          </Badge>

          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            ARIA
            <br />
            <span className="text-muted-foreground text-2xl sm:text-3xl font-medium">
              Annotation RAG Intelligence Assistant
            </span>
          </h1>

          <p className="max-w-xl text-base text-muted-foreground">
            Ask anything about your LiDAR annotation workflows, tools, and
            documentation. Powered by RAG and grounded in your technical
            knowledge base.
          </p>

          <div className="flex gap-3">
            <Link href="/chat">
              <Button size="lg">Open Chat →</Button>
            </Link>
            <a
              href="http://localhost:8000/docs"
              target="_blank"
              rel="noreferrer"
            >
              <Button variant="outline" size="lg">
                API Docs
              </Button>
            </a>
          </div>
        </div>

        {/* Feature cards */}
        <div className="grid w-full max-w-3xl grid-cols-1 gap-4 sm:grid-cols-3">
          {features.map((f) => (
            <Card key={f.title} className="bg-card">
              <CardHeader className="pb-2">
                <span className="text-2xl">{f.icon}</span>
                <CardTitle className="text-sm font-semibold">{f.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-xs leading-relaxed">
                  {f.description}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
