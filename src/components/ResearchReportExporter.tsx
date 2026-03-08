import { useState } from "react";
import { FileText, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { toast } from "sonner";

interface ResearchReportExporterProps {
  projectId?: string;
}

interface ReportPayload {
  projectName: string;
  companyName?: string;
  agentResults: any[];
  insights: any[];
}

/* ------------------------------------------------------------------ */
/*  PDF helpers                                                        */
/* ------------------------------------------------------------------ */

const BLUE: [number, number, number] = [59, 130, 246];
const DARK: [number, number, number] = [30, 41, 59];
const MUTED: [number, number, number] = [100, 116, 139];

function addSectionHeader(doc: jsPDF, title: string, yPos: number): number {
  if (yPos > 250) {
    doc.addPage();
    yPos = 20;
  }
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...BLUE);
  doc.text(title, 20, yPos);
  doc.setTextColor(0, 0, 0);
  return yPos + 10;
}

function addWrappedText(doc: jsPDF, text: string, x: number, y: number, maxWidth = 165): number {
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  const lines = doc.splitTextToSize(text, maxWidth);
  if (y + lines.length * 5 > 275) {
    doc.addPage();
    y = 20;
  }
  doc.text(lines, x, y);
  return y + lines.length * 5 + 4;
}

function addBulletList(doc: jsPDF, items: string[], x: number, startY: number): number {
  let y = startY;
  items.forEach((item) => {
    y = addWrappedText(doc, `• ${item}`, x, y);
  });
  return y;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export const ResearchReportExporter = ({ projectId }: ResearchReportExporterProps) => {
  const [loading, setLoading] = useState(false);

  const fetchData = async (): Promise<ReportPayload | null> => {
    if (!projectId) {
      toast.error("Please select a project first");
      return null;
    }

    const [projectRes, agentsRes, insightsRes] = await Promise.all([
      supabase.from("research_projects").select("*").eq("id", projectId).single(),
      supabase.from("agent_results").select("*").eq("project_id", projectId).order("created_at", { ascending: false }),
      supabase.from("insights").select("*").eq("project_id", projectId).order("created_at", { ascending: false }),
    ]);

    if (projectRes.error || !projectRes.data) {
      toast.error("Could not load project data");
      return null;
    }

    return {
      projectName: projectRes.data.product_name,
      companyName: projectRes.data.company_name ?? undefined,
      agentResults: agentsRes.data ?? [],
      insights: insightsRes.data ?? [],
    };
  };

  /* ---------- helpers to extract insight arrays ---------- */

  const extractInsightItems = (insights: any[], type: string): string[] => {
    const match = insights.find((i) => i.insight_type === type);
    if (!match?.data) return [];
    const d = match.data as any;
    // data may be an array or an object with items/list
    if (Array.isArray(d)) return d.map((x: any) => (typeof x === "string" ? x : x.description ?? x.text ?? JSON.stringify(x)));
    if (Array.isArray(d.items)) return d.items.map((x: any) => (typeof x === "string" ? x : x.description ?? x.text ?? JSON.stringify(x)));
    if (Array.isArray(d.list)) return d.list.map((x: any) => (typeof x === "string" ? x : x.description ?? x.text ?? JSON.stringify(x)));
    return [];
  };

  /* ---------- PDF generation ---------- */

  const generatePDF = async () => {
    setLoading(true);
    try {
      const payload = await fetchData();
      if (!payload) return;

      const { projectName, companyName, agentResults, insights } = payload;
      const doc = new jsPDF();

      // --- Cover header ---
      doc.setFillColor(...BLUE);
      doc.rect(0, 0, 210, 45, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(22);
      doc.setFont("helvetica", "bold");
      doc.text("Market Research Report", 105, 18, { align: "center" });
      doc.setFontSize(13);
      doc.setFont("helvetica", "normal");
      doc.text(projectName, 105, 28, { align: "center" });
      doc.setFontSize(10);
      doc.text(`Generated: ${new Date().toLocaleString()}`, 105, 38, { align: "center" });

      let y = 55;
      doc.setTextColor(0, 0, 0);

      // ---- 1. Executive Summary ----
      y = addSectionHeader(doc, "1. EXECUTIVE SUMMARY", y);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      const completedAgents = agentResults.filter((r) => r.status === "completed").length;
      const summaryLines = [
        `Product: ${projectName}${companyName ? ` by ${companyName}` : ""}`,
        `Total analyses completed: ${completedAgents} of ${agentResults.length}`,
        `Insight modules available: ${insights.length}`,
        `Report date: ${new Date().toLocaleDateString()}`,
      ];
      summaryLines.forEach((line) => {
        y = addWrappedText(doc, line, 20, y);
      });
      y += 4;

      // ---- 2. Product Sentiment Analysis ----
      const sentimentResult = agentResults.find((r) => r.agent_type === "sentiment" && r.status === "completed");
      y = addSectionHeader(doc, "2. PRODUCT SENTIMENT ANALYSIS", y);
      if (sentimentResult?.results) {
        const s = sentimentResult.results as any;
        y = addWrappedText(doc, `Positive: ${s.positive ?? "N/A"}%  |  Neutral: ${s.neutral ?? "N/A"}%  |  Negative: ${s.negative ?? "N/A"}%`, 20, y);
        if (s.positiveThemes?.length) {
          doc.setFont("helvetica", "bold");
          doc.text("Positive Themes:", 20, y);
          y += 6;
          y = addBulletList(doc, s.positiveThemes.slice(0, 5).map((t: any) => (typeof t === "string" ? t : t.theme)), 25, y);
        }
        if (s.negativeThemes?.length) {
          doc.setFont("helvetica", "bold");
          doc.text("Negative Themes:", 20, y);
          y += 6;
          y = addBulletList(doc, s.negativeThemes.slice(0, 5).map((t: any) => (typeof t === "string" ? t : t.theme)), 25, y);
        }
      } else {
        y = addWrappedText(doc, "No sentiment data available for this project.", 20, y);
      }
      y += 4;

      // ---- 3. Competitor Overview ----
      const competitorResult = agentResults.find((r) => r.agent_type === "competitor" && r.status === "completed");
      y = addSectionHeader(doc, "3. COMPETITOR OVERVIEW", y);
      if (competitorResult?.results?.competitors?.length) {
        autoTable(doc, {
          startY: y,
          head: [["Product", "Company", "Price", "Rating"]],
          body: competitorResult.results.competitors.slice(0, 10).map((c: any) => [
            c.name ?? "N/A",
            c.company ?? "N/A",
            c.price ?? "N/A",
            c.rating ? `${c.rating}/5` : "N/A",
          ]),
          theme: "striped",
          styles: { fontSize: 9, cellPadding: 3 },
          headStyles: { fillColor: BLUE as any, textColor: 255, fontStyle: "bold" },
        });
        y = (doc as any).lastAutoTable.finalY + 10;
      } else {
        y = addWrappedText(doc, "No competitor data available for this project.", 20, y);
      }

      // ---- 4. Market Trends ----
      const trendResult = agentResults.find((r) => r.agent_type === "trend" && r.status === "completed");
      y = addSectionHeader(doc, "4. MARKET TRENDS", y);
      if (trendResult?.results) {
        const t = trendResult.results as any;
        y = addWrappedText(doc, `Trend Score: ${t.trendScore ?? "N/A"}  |  Growth Rate: ${t.growthRate ?? "N/A"}%  |  Demand: ${t.demandPattern ?? "N/A"}`, 20, y);
        if (t.keywords?.length) {
          y = addWrappedText(doc, `Keywords: ${t.keywords.slice(0, 10).join(", ")}`, 20, y);
        }
        if (t.emergingTopics?.length) {
          doc.setFont("helvetica", "bold");
          doc.text("Emerging Topics:", 20, y);
          y += 6;
          y = addBulletList(doc, t.emergingTopics.slice(0, 5), 25, y);
        }
      } else {
        y = addWrappedText(doc, "No trend data available for this project.", 20, y);
      }

      // ---- 5. Feature Gap Analysis ----
      y = addSectionHeader(doc, "5. FEATURE GAP ANALYSIS", y);
      const gapItems = extractInsightItems(insights, "feature_gap");
      if (gapItems.length) {
        y = addBulletList(doc, gapItems.slice(0, 10), 25, y);
      } else {
        y = addWrappedText(doc, "No feature gap insights available. Run the Feature Gap Analysis module first.", 20, y);
      }

      // ---- 6. Strategic Recommendations ----
      y = addSectionHeader(doc, "6. STRATEGIC RECOMMENDATIONS", y);
      const riskItems = extractInsightItems(insights, "risk_opportunity");
      const swotItems = extractInsightItems(insights, "strengths_weaknesses");
      const allRecs = [...riskItems, ...swotItems];
      if (allRecs.length) {
        y = addBulletList(doc, allRecs.slice(0, 10), 25, y);
      } else {
        y = addWrappedText(doc, "No strategic recommendation insights available. Run the insight modules first.", 20, y);
      }

      // --- Footer ---
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(...MUTED);
        doc.text(`Page ${i} of ${pageCount}  |  Market Research Platform  |  ${new Date().toLocaleString()}`, 105, 290, { align: "center" });
      }

      doc.save(`${projectName.replace(/\s+/g, "_")}_research_report.pdf`);
      toast.success("Research report PDF downloaded");
    } catch (err) {
      console.error("PDF export error:", err);
      toast.error("Failed to generate PDF report");
    } finally {
      setLoading(false);
    }
  };

  /* ---------- DOCX-style export (XLSX with structured sheets) ---------- */

  const generateDOCX = async () => {
    setLoading(true);
    try {
      const payload = await fetchData();
      if (!payload) return;

      const { projectName, companyName, agentResults, insights } = payload;
      const wb = XLSX.utils.book_new();

      // 1. Executive Summary
      const summaryRows = [
        ["MARKET RESEARCH REPORT"],
        [""],
        ["Product", projectName],
        ["Company", companyName || "N/A"],
        ["Generated", new Date().toLocaleString()],
        ["Completed Analyses", String(agentResults.filter((r) => r.status === "completed").length)],
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryRows), "Executive Summary");

      // 2. Sentiment
      const sentiment = agentResults.find((r) => r.agent_type === "sentiment")?.results as any;
      const sentRows: any[][] = [["SENTIMENT ANALYSIS"], [""], ["Positive", `${sentiment?.positive ?? "N/A"}%`], ["Neutral", `${sentiment?.neutral ?? "N/A"}%`], ["Negative", `${sentiment?.negative ?? "N/A"}%`]];
      if (sentiment?.positiveThemes?.length) {
        sentRows.push([""], ["Positive Themes"]);
        sentiment.positiveThemes.forEach((t: any) => sentRows.push([typeof t === "string" ? t : t.theme]));
      }
      if (sentiment?.negativeThemes?.length) {
        sentRows.push([""], ["Negative Themes"]);
        sentiment.negativeThemes.forEach((t: any) => sentRows.push([typeof t === "string" ? t : t.theme]));
      }
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sentRows), "Sentiment Analysis");

      // 3. Competitors
      const competitors = (agentResults.find((r) => r.agent_type === "competitor")?.results as any)?.competitors ?? [];
      if (competitors.length) {
        XLSX.utils.book_append_sheet(
          wb,
          XLSX.utils.json_to_sheet(competitors.map((c: any) => ({ Product: c.name, Company: c.company, Price: c.price, Rating: c.rating }))),
          "Competitor Overview"
        );
      }

      // 4. Trends
      const trend = agentResults.find((r) => r.agent_type === "trend")?.results as any;
      const trendRows: any[][] = [["MARKET TRENDS"], [""], ["Trend Score", trend?.trendScore ?? "N/A"], ["Growth Rate", `${trend?.growthRate ?? "N/A"}%`], ["Demand Pattern", trend?.demandPattern ?? "N/A"]];
      if (trend?.keywords?.length) {
        trendRows.push([""], ["Keywords"]);
        trend.keywords.forEach((k: string) => trendRows.push([k]));
      }
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(trendRows), "Market Trends");

      // 5. Feature Gaps
      const gapItems = extractInsightItems(insights, "feature_gap");
      if (gapItems.length) {
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["FEATURE GAP ANALYSIS"], [""], ...gapItems.map((g) => [g])]), "Feature Gaps");
      }

      // 6. Strategic Recommendations
      const recs = [...extractInsightItems(insights, "risk_opportunity"), ...extractInsightItems(insights, "strengths_weaknesses")];
      if (recs.length) {
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["STRATEGIC RECOMMENDATIONS"], [""], ...recs.map((r) => [r])]), "Recommendations");
      }

      XLSX.writeFile(wb, `${projectName.replace(/\s+/g, "_")}_research_report.xlsx`);
      toast.success("Research report XLSX downloaded");
    } catch (err) {
      console.error("XLSX export error:", err);
      toast.error("Failed to generate report");
    } finally {
      setLoading(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button disabled={!projectId || loading} className="gap-2">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
          Generate Research Report
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={generatePDF} className="gap-2">
          <Download className="h-4 w-4" />
          Export as PDF
        </DropdownMenuItem>
        <DropdownMenuItem onClick={generateDOCX} className="gap-2">
          <Download className="h-4 w-4" />
          Export as XLSX
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
