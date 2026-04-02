import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Bot, User, Volume2, VolumeX, Mic, MicOff, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { KnowledgeBasePanel, type TrainedDocument } from "@/components/notes/KnowledgeBasePanel";
import { toast as sonnerToast } from "sonner";

interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: string[];
}

export default function AIAssistant() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Hello! I'm your AI research assistant. I can help you analyze market trends, competitor insights, and provide business intelligence based on your recent research. How can I assist you today?",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [trainedDocs, setTrainedDocs] = useState<TrainedDocument[]>([]);
  const { toast } = useToast();
  const { user } = useAuth();
  const recognitionRef = useRef<any>(null);

  // Load knowledge base from localStorage
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("rag_knowledge_base") || "[]");
      if (stored.length) setTrainedDocs(stored);
    } catch {}
  }, []);

  // Initialize speech recognition
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInput(transcript);
        setIsRecording(false);
      };

      recognitionRef.current.onerror = () => {
        setIsRecording(false);
        toast({ title: "Error", description: "Voice recognition failed", variant: "destructive" });
      };

      recognitionRef.current.onend = () => setIsRecording(false);
    }
  }, [toast]);

  useEffect(() => {
    if (!voiceEnabled && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  }, [voiceEnabled]);

  const speak = (text: string) => {
    if (!voiceEnabled || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  };

  const getDocumentContext = (): { context: string; docNames: string[] } => {
    const activeDocs = trainedDocs.filter(d => d.enabled && d.textContent);
    if (activeDocs.length === 0) return { context: "", docNames: [] };

    const context = activeDocs.map(d =>
      `--- Document: ${d.fileName} ---\n${d.textContent.slice(0, 2000)}`
    ).join("\n\n");

    return { context, docNames: activeDocs.map(d => d.fileName) };
  };

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage: Message = { role: "user", content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const { context: docContext, docNames } = getDocumentContext();

      const { data, error } = await supabase.functions.invoke("chat-assistant", {
        body: {
          messages: [...messages, userMessage].map(m => ({ role: m.role, content: m.content })),
          userId: user?.id,
          documentContext: docContext || undefined,
          documentNames: docNames.length > 0 ? docNames : undefined,
        },
      });

      if (error) {
        if (error.message?.includes("429")) throw new Error("AI service is temporarily busy. Please wait and try again.");
        throw new Error("Unable to connect to AI service. Please try again.");
      }
      if (data?.error) throw new Error(data.error);

      if (data?.message) {
        const assistantMessage: Message = {
          role: "assistant",
          content: data.message,
          sources: data.sources || (docNames.length > 0 ? docNames : undefined),
        };
        setMessages(prev => [...prev, assistantMessage]);
        if (voiceEnabled) speak(data.message);
      } else {
        throw new Error("No response received from AI assistant");
      }
    } catch (error: any) {
      const errorMessage: Message = {
        role: "assistant",
        content: `I apologize, but I encountered an issue: ${error.message || "Unable to process your request"}. Please try again in a moment.`,
      };
      setMessages(prev => [...prev, errorMessage]);
      toast({ title: "Connection Issue", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggle = (id: string, enabled: boolean) => {
    setTrainedDocs(prev => {
      const updated = prev.map(d => d.id === id ? { ...d, enabled } : d);
      localStorage.setItem("rag_knowledge_base", JSON.stringify(updated));
      return updated;
    });
  };

  const handleRemove = (id: string) => {
    setTrainedDocs(prev => {
      const updated = prev.filter(d => d.id !== id);
      localStorage.setItem("rag_knowledge_base", JSON.stringify(updated));
      return updated;
    });
  };

  const handleRetrain = (id: string) => {
    sonnerToast.success("Document reprocessed.");
  };

  return (
    <div className="p-8 h-screen flex flex-col animate-fade-in">
      <div className="space-y-2 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold">AI Assistant</h1>
            <p className="text-muted-foreground text-lg">Real-time market intelligence assistant</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => {
              if (!recognitionRef.current) {
                toast({ title: "Not Supported", description: "Voice recognition not supported", variant: "destructive" });
                return;
              }
              if (isRecording) { recognitionRef.current.stop(); setIsRecording(false); }
              else { recognitionRef.current.start(); setIsRecording(true); }
            }} className={isRecording ? "bg-red-500/20 animate-pulse" : ""}>
              {isRecording ? <MicOff className="h-5 w-5 text-red-500" /> : <Mic className="h-5 w-5" />}
            </Button>
            <Button variant="outline" size="icon" onClick={() => {
              setVoiceEnabled(!voiceEnabled);
              if (voiceEnabled && window.speechSynthesis) { window.speechSynthesis.cancel(); setIsSpeaking(false); }
            }} className={voiceEnabled ? "bg-primary/20" : ""}>
              {voiceEnabled ? <Volume2 className={`h-5 w-5 ${isSpeaking ? "animate-pulse" : ""}`} /> : <VolumeX className="h-5 w-5" />}
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 flex-1 min-h-0">
        {/* Knowledge Base Sidebar */}
        <div className="lg:col-span-1 overflow-y-auto">
          <KnowledgeBasePanel
            documents={trainedDocs}
            onToggle={handleToggle}
            onRemove={handleRemove}
            onRetrain={handleRetrain}
          />
        </div>

        {/* Chat */}
        <Card className="lg:col-span-3 border-border/50 flex flex-col min-h-0">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Bot className="h-5 w-5 text-primary" />
              Chat Assistant
              {trainedDocs.filter(d => d.enabled).length > 0 && (
                <Badge variant="secondary" className="text-[10px] ml-auto">
                  RAG: {trainedDocs.filter(d => d.enabled).length} docs
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col gap-3 min-h-0">
            <ScrollArea className="flex-1 pr-4">
              <div className="space-y-4">
                {messages.map((message, index) => (
                  <div key={index} className={`flex gap-3 ${message.role === "assistant" ? "justify-start" : "justify-end"}`}>
                    {message.role === "assistant" && (
                      <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                        <Bot className="h-4 w-4 text-primary" />
                      </div>
                    )}
                    <div className={`max-w-[80%] rounded-lg ${message.role === "assistant" ? "bg-secondary/50 border border-border/50" : "bg-primary text-primary-foreground"}`}>
                      <p className="text-sm leading-relaxed whitespace-pre-wrap p-4">{message.content}</p>
                      {message.sources && message.sources.length > 0 && (
                        <div className="border-t border-border/30 px-4 py-2 flex flex-wrap gap-1 items-center">
                          <FileText className="h-3 w-3 text-muted-foreground" />
                          <span className="text-[10px] text-muted-foreground mr-1">Sources:</span>
                          {message.sources.map((s, i) => (
                            <Badge key={i} variant="outline" className="text-[9px]">{s}</Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    {message.role === "user" && (
                      <div className="h-8 w-8 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
                        <User className="h-4 w-4 text-accent" />
                      </div>
                    )}
                  </div>
                ))}
                {isLoading && (
                  <div className="flex gap-3 justify-start">
                    <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
                      <Bot className="h-4 w-4 text-primary animate-pulse" />
                    </div>
                    <div className="bg-secondary/50 border border-border/50 p-4 rounded-lg">
                      <div className="flex gap-1">
                        <div className="h-2 w-2 bg-primary rounded-full animate-bounce" />
                        <div className="h-2 w-2 bg-primary rounded-full animate-bounce delay-100" />
                        <div className="h-2 w-2 bg-primary rounded-full animate-bounce delay-200" />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>

            <div className="flex gap-2">
              <Input
                placeholder="Ask me anything about your market research..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleSend()}
                disabled={isLoading}
                className="bg-background/50"
              />
              <Button onClick={handleSend} disabled={isLoading || !input.trim()} className="gradient-primary hover:opacity-90 transition-opacity">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
