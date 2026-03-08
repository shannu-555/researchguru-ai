import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user }, error: authError } = await anonClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) throw new Error("Unauthorized");

    const { documentId, textContent } = await req.json();
    if (!documentId || !textContent) throw new Error("Missing documentId or textContent");

    // Update status to analyzing
    await supabase.from("research_documents").update({ analysis_status: "analyzing" }).eq("id", documentId);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const truncatedContent = textContent.substring(0, 15000);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: "You are a market research analyst. Analyze the document and extract structured insights."
          },
          {
            role: "user",
            content: `Analyze this document and return structured data:\n\n${truncatedContent}`
          }
        ],
        tools: [{
          type: "function",
          function: {
            name: "extract_document_analysis",
            description: "Extract structured analysis from a document",
            parameters: {
              type: "object",
              properties: {
                summary: { type: "string", description: "2-3 sentence summary" },
                key_insights: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      insight: { type: "string" },
                      importance: { type: "string", enum: ["high", "medium", "low"] }
                    },
                    required: ["insight", "importance"]
                  }
                },
                competitor_mentions: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      context: { type: "string" }
                    },
                    required: ["name", "context"]
                  }
                },
                market_trends: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      trend: { type: "string" },
                      direction: { type: "string", enum: ["growing", "declining", "stable"] }
                    },
                    required: ["trend", "direction"]
                  }
                }
              },
              required: ["summary", "key_insights", "competitor_mentions", "market_trends"]
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "extract_document_analysis" } }
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI error:", response.status, errText);
      await supabase.from("research_documents").update({ analysis_status: "failed" }).eq("id", documentId);

      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required. Please add credits." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
      throw new Error("AI analysis failed");
    }

    const aiResult = await response.json();
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
    let analysis = { summary: "", key_insights: [], competitor_mentions: [], market_trends: [] };

    if (toolCall?.function?.arguments) {
      try {
        analysis = JSON.parse(toolCall.function.arguments);
      } catch { /* use defaults */ }
    }

    await supabase.from("research_documents").update({
      ai_summary: analysis.summary,
      ai_key_insights: analysis.key_insights,
      ai_competitor_mentions: analysis.competitor_mentions,
      ai_market_trends: analysis.market_trends,
      analysis_status: "completed",
      updated_at: new Date().toISOString()
    }).eq("id", documentId);

    return new Response(JSON.stringify({ success: true, analysis }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (e) {
    console.error("analyze-document error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
