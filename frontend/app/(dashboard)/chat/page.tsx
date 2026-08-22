import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function ChatPage() {
  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Chat</h2>
          <p className="text-sm text-muted-foreground">
            Ask questions about LiDAR annotation and documentation.
          </p>
        </div>
        <Badge variant="secondary">RAG Engine · Coming Soon</Badge>
      </div>

      {/* Placeholder chat area */}
      <Card className="flex flex-1 flex-col">
        <CardHeader className="border-b border-border pb-4">
          <CardTitle className="text-sm font-medium">Conversation</CardTitle>
          <CardDescription className="text-xs">
            The RAG pipeline and LLM integration will be wired here in the next
            phase.
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-1 items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3 text-center">
            <span className="text-4xl">💬</span>
            <p className="text-sm font-medium text-foreground">
              Chat interface coming soon
            </p>
            <p className="max-w-xs text-xs text-muted-foreground">
              The RAG engine, document ingestion pipeline, and LLM integration
              are scheduled for Phase 2.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
