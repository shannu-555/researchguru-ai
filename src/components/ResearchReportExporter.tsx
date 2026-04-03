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

const BLUE: [number, number, number] = [59, 130, 246];
const DARK: [number, number, number] = [30, 41, 59];
const MUTED: [number, number, number] = [100, 116, 139];
const GREEN: [number, number, number] = [34, 197, 94];
const RED: [number, number, number] = [239, 68, 68];
const AMBER: [number, number, number] = [245, 158, 11];

function ensureSpace(doc: jsPDF, needed: number, currentY: number): number {
  if (currentY + needed > 270) {
    doc.addPage();
    return 20;
  }
  return currentY;
}

function addSectionHeader(doc: jsPDF, title: string, yPos: number): number {
  yPos = ensureSpace(doc, 15, yPos);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...BLUE);
  doc.text(title, 20, yPos);
  doc.setDrawColor(...BLUE);
  doc.line(20, yPos + 2, 190, yPos + 2);
  doc.setTextColor(0, 0, 0);
  return yPos + 10;
}

function addWrappedText(doc: jsPDF, text: string, x: number, y: number, maxWidth = 165): number {
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  const lines = doc.splitTextToSize(text, maxWidth);
  y = ensureSpace(doc, lines.length * 4.5 + 2, y);
  doc.text(lines, x, y);
  return y + lines.length * 4.5 + 2;
}

function addBulletList(doc: jsPDF, items: string[], x: number, startY: number): number {
  let y = startY;
  items.forEach((item) => {
    y = addWrappedText(doc, `• ${item}`, x, y);
  });
  return y;
}

function addSubheading(doc: jsPDF, text: string, y: number): number {
  y = ensureSpace(doc, 10, y);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...DARK);
  doc.text(text, 20, y);
  doc.setTextColor(0, 0, 0);
  return y + 6;
}

function drawPieChart(doc: jsPDF, x: number, y: number, radius: number, segments: { value: number; color: [number, number, number]; label: string }[]) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  if (total === 0) return;
  let startAngle = -Math.PI / 2;
  
  segments.forEach(seg => {
    const sliceAngle = (seg.value / total) * 2 * Math.PI;
    const endAngle = startAngle + sliceAngle;
    
    doc.setFillColor(...seg.color);
    // Draw pie slice as filled triangle approximation
    const steps = Math.max(20, Math.ceil(sliceAngle / 0.1));
    const points: [number, number][] = [[x, y]];
    for (let i = 0; i <= steps; i++) {
      const angle = startAngle + (sliceAngle * i / steps);
      points.push([x + radius * Math.cos(angle), y + radius * Math.sin(angle)]);
    }
    
    // Draw using small triangles from center
    for (let i = 1; i < points.length - 1; i++) {
      doc.triangle(
        points[0][0], points[0][1],
        points[i][0], points[i][1],
        points[i + 1][0], points[i + 1][1],
        'F'
      );
    }
    
    startAngle = endAngle;
  });

  // Legend
  let legendY = y - radius;
  segments.forEach(seg => {
    doc.setFillColor(...seg.color);
    doc.rect(x + radius + 8, legendY - 2, 4, 4, 'F');
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);
    doc.text(`${seg.label}: ${seg.value}%`, x + radius + 14, legendY + 1);
    legendY += 7;
  });
}

function drawBarChart(doc: jsPDF, x: number, y: number, width: number, height: number, data: { label: string; value: number }[]) {
  if (!data.length) return;
  const maxVal = Math.max(...data.map(d => d.value), 1);
  const barWidth = Math.min(20, (width - 20) / data.length - 4);
  const chartX = x + 15;
  
  // Axes
  doc.setDrawColor(...MUTED);
  doc.setLineWidth(0.3);
  doc.line(chartX, y, chartX, y + height);
  doc.line(chartX, y + height, x + width, y + height);
  
  data.forEach((d, i) => {
    const barH = (d.value / maxVal) * (height - 5);
    const bx = chartX + 5 + i * (barWidth + 4);
    
    doc.setFillColor(...BLUE);
    doc.rect(bx, y + height - barH, barWidth, barH, 'F');
    
    doc.setFontSize(5);
    doc.setTextColor(0, 0, 0);
    const label = d.label.length > 10 ? d.label.substring(0, 9) + '..' : d.label;
    doc.text(label, bx + barWidth / 2, y + height + 4, { align: 'center' });
    doc.text(String(d.value), bx + barWidth / 2, y + height - barH - 2, { align: 'center' });
  });
}

function drawLineChart(doc: jsPDF, x: number, y: number, width: number, height: number, data: { month: string; value: number }[]) {
  if (!data.length) return;
  const maxVal = Math.max(...data.map(d => d.value), 1);
  const minVal = Math.min(...data.map(d => d.value), 0);
  const range = maxVal - minVal || 1;
  const chartX = x + 12;
  const chartW = width - 15;
  
  // Axes
  doc.setDrawColor(...MUTED);
  doc.setLineWidth(0.3);
  doc.line(chartX, y, chartX, y + height);
  doc.line(chartX, y + height, x + width, y + height);
  
  // Line
  doc.setDrawColor(...BLUE);
  doc.setLineWidth(0.8);
  const points = data.map((d, i) => ({
    px: chartX + 3 + (i / (data.length - 1)) * (chartW - 6),
    py: y + height - ((d.value - minVal) / range) * (height - 5),
  }));
  
  for (let i = 0; i < points.length - 1; i++) {
    doc.line(points[i].px, points[i].py, points[i + 1].px, points[i + 1].py);
  }
  
  // Dots and labels
  points.forEach((p, i) => {
    doc.setFillColor(...BLUE);
    doc.circle(p.px, p.py, 1, 'F');
    if (i % 2 === 0 || data.length <= 6) {
      doc.setFontSize(5);
      doc.setTextColor(...MUTED);
      doc.text(data[i].month, p.px, y + height + 4, { align: 'center' });
    }
  });
}

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

  const extractInsightItems = (insights: any[], type: string): string[] => {
    const match = insights.find((i) => i.insight_type === type);
    if (!match?.data) return [];
    const d = match.data as any;
    if (Array.isArray(d)) return d.map((x: any) => (typeof x === "string" ? x : x.description ?? x.text ?? JSON.stringify(x)));
    if (Array.isArray(d.items)) return d.items.map((x: any) => (typeof x === "string" ? x : x.description ?? x.text ?? JSON.stringify(x)));
    if (Array.isArray(d.list)) return d.list.map((x: any) => (typeof x === "string" ? x : x.description ?? x.text ?? JSON.stringify(x)));
    return [];
  };

  const generatePDF = async () => {
    setLoading(true);
    try {
      const payload = await fetchData();
      if (!payload) return;

      const { projectName, companyName, agentResults, insights } = payload;
      const doc = new jsPDF();
      const sentimentResult = agentResults.find(r => r.agent_type === 'sentiment' && r.status === 'completed')?.results as any;
      const competitorResult = agentResults.find(r => r.agent_type === 'competitor' && r.status === 'completed')?.results as any;
      const trendResult = agentResults.find(r => r.agent_type === 'trend' && r.status === 'completed')?.results as any;

      // ===================== 1. COVER PAGE =====================
      doc.setFillColor(...BLUE);
      doc.rect(0, 0, 210, 297, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(28);
      doc.setFont("helvetica", "bold");
      doc.text("Market Research", 105, 100, { align: "center" });
      doc.text("Report", 105, 115, { align: "center" });
      doc.setFontSize(16);
      doc.setFont("helvetica", "normal");
      doc.text(projectName, 105, 140, { align: "center" });
      if (companyName) {
        doc.setFontSize(13);
        doc.text(`by ${companyName}`, 105, 152, { align: "center" });
      }
      doc.setFontSize(11);
      doc.text(new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }), 105, 175, { align: "center" });
      doc.setFontSize(9);
      doc.text("AI-Powered Market Research Platform", 105, 250, { align: "center" });

      // ===================== 2. EXECUTIVE SUMMARY =====================
      doc.addPage();
      let y = 20;
      doc.setTextColor(0, 0, 0);
      y = addSectionHeader(doc, "1. EXECUTIVE SUMMARY", y);
      
      const completedAgents = agentResults.filter(r => r.status === 'completed').length;
      y = addWrappedText(doc, `Product: ${projectName}${companyName ? ` by ${companyName}` : ''}`, 20, y);
      y = addWrappedText(doc, `Analyses completed: ${completedAgents} of ${agentResults.length} | Insight modules: ${insights.length}`, 20, y);
      y = addWrappedText(doc, `Report generated: ${new Date().toLocaleString()}`, 20, y);
      y += 3;
      
      // AI Summary
      if (sentimentResult && competitorResult && trendResult) {
        const sentimentSummary = sentimentResult.overallScore >= 70 ? 'positive' : sentimentResult.overallScore >= 40 ? 'mixed' : 'negative';
        const compCount = competitorResult.competitors?.length || 0;
        const demandStr = trendResult.demandPattern || 'stable';
        y = addWrappedText(doc, `Overall Assessment: Market sentiment is ${sentimentSummary} (score: ${sentimentResult.overallScore}/100). ${compCount} direct competitors identified. Market demand is ${demandStr} with a trend score of ${trendResult.trendScore || 'N/A'}/100 and growth rate of ${trendResult.growthRate || 'N/A'}%.`, 20, y);
        
        if (trendResult.predictions?.length) {
          y = addWrappedText(doc, `Key Prediction: ${trendResult.predictions[0]}`, 20, y);
        }
      }
      y += 4;

      // ===================== 3. SENTIMENT ANALYSIS =====================
      y = addSectionHeader(doc, "2. SENTIMENT ANALYSIS", y);
      if (sentimentResult) {
        y = addWrappedText(doc, `Overall Score: ${sentimentResult.overallScore}/100 | Confidence: ${sentimentResult.confidence || 'N/A'}% (${sentimentResult.confidenceLevel || 'N/A'})`, 20, y);
        y += 2;

        // Pie Chart
        y = ensureSpace(doc, 50, y);
        drawPieChart(doc, 55, y + 20, 18, [
          { value: sentimentResult.positive || 0, color: GREEN, label: 'Positive' },
          { value: sentimentResult.negative || 0, color: RED, label: 'Negative' },
          { value: sentimentResult.neutral || 0, color: MUTED, label: 'Neutral' },
        ]);
        y += 45;

        if (sentimentResult.positiveThemes?.length) {
          y = addSubheading(doc, "Positive Themes", y);
          y = addBulletList(doc, sentimentResult.positiveThemes.slice(0, 5).map((t: any) => typeof t === 'string' ? t : `${t.theme}${t.evidence ? ` — ${t.evidence}` : ''}`), 25, y);
        }
        if (sentimentResult.negativeThemes?.length) {
          y = addSubheading(doc, "Negative Themes", y);
          y = addBulletList(doc, sentimentResult.negativeThemes.slice(0, 5).map((t: any) => typeof t === 'string' ? t : `${t.theme}${t.evidence ? ` — ${t.evidence}` : ''}`), 25, y);
        }
      } else {
        y = addWrappedText(doc, "No sentiment data available.", 20, y);
      }
      y += 4;

      // ===================== 4. COMPETITOR ANALYSIS =====================
      y = addSectionHeader(doc, "3. COMPETITOR ANALYSIS", y);
      if (competitorResult?.competitors?.length) {
        autoTable(doc, {
          startY: y,
          head: [["Competitor", "Company", "Price", "Rating", "Market Position"]],
          body: competitorResult.competitors.slice(0, 10).map((c: any) => [
            c.name ?? "N/A",
            c.company ?? "N/A",
            c.price ?? "N/A",
            c.rating ? `${c.rating}/5` : "N/A",
            c.marketPosition ?? "N/A",
          ]),
          theme: "striped",
          styles: { fontSize: 8, cellPadding: 2.5 },
          headStyles: { fillColor: BLUE as any, textColor: 255, fontStyle: "bold", fontSize: 8 },
        });
        y = (doc as any).lastAutoTable.finalY + 6;

        // Bar chart - competitor ratings
        const ratingData = competitorResult.competitors.filter((c: any) => c.rating).slice(0, 8).map((c: any) => ({
          label: c.name || 'N/A',
          value: Math.round((c.rating || 0) * 20), // Convert 5-scale to 100
        }));
        if (ratingData.length > 1) {
          y = ensureSpace(doc, 55, y);
          y = addSubheading(doc, "Competitor Rating Comparison", y);
          drawBarChart(doc, 20, y, 170, 40, ratingData);
          y += 50;
        }

        // Comparison insights
        competitorResult.competitors.slice(0, 3).forEach((c: any) => {
          if (c.advantages?.length) {
            y = addWrappedText(doc, `${c.name} advantages: ${c.advantages.join('; ')}`, 25, y);
          }
        });
      } else {
        y = addWrappedText(doc, "No competitor data available.", 20, y);
      }
      y += 4;

      // ===================== 5. TREND ANALYSIS =====================
      y = addSectionHeader(doc, "4. TREND ANALYSIS", y);
      if (trendResult) {
        y = addWrappedText(doc, `Trend Score: ${trendResult.trendScore || 'N/A'}/100 | Growth Rate: ${trendResult.growthRate || 'N/A'}% | Demand: ${trendResult.demandPattern || 'N/A'}`, 20, y);
        
        if (trendResult.keywords?.length) {
          y = addSubheading(doc, "Trending Keywords", y);
          y = addWrappedText(doc, trendResult.keywords.slice(0, 10).join(', '), 25, y);
        }
        if (trendResult.popularHashtags?.length) {
          y = addSubheading(doc, "Popular Hashtags", y);
          y = addWrappedText(doc, trendResult.popularHashtags.slice(0, 8).join('  '), 25, y);
        }
        if (trendResult.trendingFeatures?.length) {
          y = addSubheading(doc, "Trending Features", y);
          y = addBulletList(doc, trendResult.trendingFeatures.slice(0, 6), 25, y);
        }
        if (trendResult.marketDemandSignals?.length) {
          y = addSubheading(doc, "Market Demand Signals", y);
          y = addBulletList(doc, trendResult.marketDemandSignals.slice(0, 5), 25, y);
        }

        // Line chart - monthly trend
        if (trendResult.monthlyData?.length) {
          y = ensureSpace(doc, 55, y);
          y = addSubheading(doc, "12-Month Trend Evolution", y);
          drawLineChart(doc, 20, y, 170, 40, trendResult.monthlyData);
          y += 50;
        }
      } else {
        y = addWrappedText(doc, "No trend data available.", 20, y);
      }
      y += 4;

      // ===================== 6. AI INSIGHTS (SWOT) =====================
      y = addSectionHeader(doc, "5. AI-POWERED INSIGHTS", y);
      const swotItems = extractInsightItems(insights, "strengths_weaknesses");
      const riskItems = extractInsightItems(insights, "risk_opportunity");
      
      if (swotItems.length) {
        y = addSubheading(doc, "Strengths & Weaknesses", y);
        y = addBulletList(doc, swotItems.slice(0, 8), 25, y);
      }
      if (riskItems.length) {
        y = addSubheading(doc, "Risks & Opportunities", y);
        y = addBulletList(doc, riskItems.slice(0, 8), 25, y);
      }
      if (!swotItems.length && !riskItems.length) {
        y = addWrappedText(doc, "Run Insight modules to generate AI analysis.", 20, y);
      }
      y += 4;

      // ===================== 7. FEATURE GAP ANALYSIS =====================
      y = addSectionHeader(doc, "6. FEATURE GAP ANALYSIS", y);
      const gapItems = extractInsightItems(insights, "feature_gap");
      if (gapItems.length) {
        autoTable(doc, {
          startY: y,
          head: [["Feature Gap"]],
          body: gapItems.slice(0, 10).map(g => [g]),
          theme: "striped",
          styles: { fontSize: 8, cellPadding: 2.5 },
          headStyles: { fillColor: AMBER as any, textColor: 255, fontStyle: "bold" },
        });
        y = (doc as any).lastAutoTable.finalY + 6;
      } else {
        y = addWrappedText(doc, "No feature gap data available. Run the Feature Gap module.", 20, y);
      }
      y += 4;

      // ===================== 8. CONSUMER PERSONAS =====================
      y = addSectionHeader(doc, "7. CONSUMER PERSONAS", y);
      const personaTypes = [
        { name: "Value Seeker", desc: "Price-conscious consumers looking for the best deal" },
        { name: "Tech Enthusiast", desc: "Early adopters who prioritize features and innovation" },
        { name: "Quality Focused", desc: "Users who value build quality and reliability" },
      ];
      personaTypes.forEach(p => {
        y = ensureSpace(doc, 12, y);
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.text(p.name, 25, y);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...MUTED);
        doc.text(` — ${p.desc}`, 25 + doc.getTextWidth(p.name) + 2, y);
        doc.setTextColor(0, 0, 0);
        y += 6;
      });
      y += 4;

      // ===================== 9. CHARTS SUMMARY =====================
      y = addSectionHeader(doc, "8. VISUAL ANALYTICS SUMMARY", y);
      
      // Radar-like positioning chart (simplified)
      if (competitorResult?.competitors?.length && sentimentResult) {
        y = addSubheading(doc, "Product Positioning Overview", y);
        const posData = [
          { label: 'Sentiment', value: sentimentResult.overallScore || 50 },
          { label: 'Trend', value: trendResult?.trendScore || 50 },
          { label: 'Competition', value: competitorResult.overallConfidence || 50 },
          { label: 'Growth', value: Math.min(100, Math.max(0, 50 + (trendResult?.growthRate || 0))) },
        ];
        drawBarChart(doc, 20, y, 170, 40, posData);
        y += 50;
      }
      y += 4;

      // ===================== 10. STRATEGIC RECOMMENDATIONS =====================
      y = addSectionHeader(doc, "9. STRATEGIC RECOMMENDATIONS", y);
      
      // Pricing
      y = addSubheading(doc, "Pricing Strategy", y);
      if (competitorResult?.competitors?.length) {
        const prices = competitorResult.competitors
          .map((c: any) => parseFloat(String(c.price).replace(/[^0-9.]/g, '')))
          .filter((p: number) => !isNaN(p) && p > 0);
        if (prices.length) {
          const avg = prices.reduce((s: number, p: number) => s + p, 0) / prices.length;
          y = addWrappedText(doc, `Average competitor price: $${avg.toFixed(2)}. Position competitively within ±15% of this range for optimal market penetration.`, 25, y);
        } else {
          y = addWrappedText(doc, "Analyze competitor pricing data for informed positioning.", 25, y);
        }
      } else {
        y = addWrappedText(doc, "Collect competitor data for pricing recommendations.", 25, y);
      }

      // Features
      y = addSubheading(doc, "Feature Improvements", y);
      if (trendResult?.trendingFeatures?.length) {
        y = addWrappedText(doc, `Focus on: ${trendResult.trendingFeatures.slice(0, 3).join(', ')}. These features show the highest consumer demand signals.`, 25, y);
      }
      if (sentimentResult?.negativeThemes?.length) {
        const topIssue = sentimentResult.negativeThemes[0];
        y = addWrappedText(doc, `Priority fix: Address "${typeof topIssue === 'string' ? topIssue : topIssue.theme}" — the most cited negative feedback.`, 25, y);
      }

      // Market positioning
      y = addSubheading(doc, "Market Positioning", y);
      const demandStr = trendResult?.demandPattern || 'stable';
      y = addWrappedText(doc, `Market demand is ${demandStr}. ${
        demandStr === 'rising' ? 'Capitalize on growth by expanding distribution and marketing investment.' :
        demandStr === 'declining' ? 'Differentiate aggressively and explore adjacent markets.' :
        'Maintain current position while innovating incrementally.'
      }`, 25, y);

      // ===================== FOOTER =====================
      const pageCount = doc.getNumberOfPages();
      for (let i = 2; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(7);
        doc.setTextColor(...MUTED);
        doc.text(`Page ${i - 1} of ${pageCount - 1}  |  ${projectName} — Market Research Report  |  ${new Date().toLocaleDateString()}`, 105, 290, { align: "center" });
      }

      doc.save(`${projectName.replace(/\s+/g, "_")}_research_report.pdf`);
      toast.success("Complete research report PDF downloaded");
    } catch (err) {
      console.error("PDF export error:", err);
      toast.error("Failed to generate PDF report");
    } finally {
      setLoading(false);
    }
  };

  const generateXLSX = async () => {
    setLoading(true);
    try {
      const payload = await fetchData();
      if (!payload) return;

      const { projectName, companyName, agentResults, insights } = payload;
      const wb = XLSX.utils.book_new();
      const sentiment = agentResults.find(r => r.agent_type === 'sentiment')?.results as any;
      const competitor = agentResults.find(r => r.agent_type === 'competitor')?.results as any;
      const trend = agentResults.find(r => r.agent_type === 'trend')?.results as any;

      // Executive Summary
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
        ["MARKET RESEARCH REPORT"], [""],
        ["Product", projectName],
        ["Company", companyName || "N/A"],
        ["Generated", new Date().toLocaleString()],
        ["Completed Analyses", String(agentResults.filter(r => r.status === 'completed').length)],
      ]), "Executive Summary");

      // Sentiment
      const sentRows: any[][] = [["SENTIMENT ANALYSIS"], [""],
        ["Overall Score", sentiment?.overallScore ?? "N/A"],
        ["Positive", `${sentiment?.positive ?? "N/A"}%`],
        ["Neutral", `${sentiment?.neutral ?? "N/A"}%`],
        ["Negative", `${sentiment?.negative ?? "N/A"}%`],
        ["Confidence", `${sentiment?.confidence ?? "N/A"}%`],
      ];
      if (sentiment?.positiveThemes?.length) {
        sentRows.push([""], ["Positive Themes"]);
        sentiment.positiveThemes.forEach((t: any) => sentRows.push([typeof t === 'string' ? t : t.theme]));
      }
      if (sentiment?.negativeThemes?.length) {
        sentRows.push([""], ["Negative Themes"]);
        sentiment.negativeThemes.forEach((t: any) => sentRows.push([typeof t === 'string' ? t : t.theme]));
      }
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sentRows), "Sentiment");

      // Competitors
      if (competitor?.competitors?.length) {
        XLSX.utils.book_append_sheet(wb,
          XLSX.utils.json_to_sheet(competitor.competitors.map((c: any) => ({
            Product: c.name, Company: c.company, Price: c.price, Rating: c.rating,
            Position: c.marketPosition, Advantages: c.advantages?.join('; '), Disadvantages: c.disadvantages?.join('; ')
          }))),
          "Competitors"
        );
      }

      // Trends
      const trendRows: any[][] = [["MARKET TRENDS"], [""],
        ["Trend Score", trend?.trendScore ?? "N/A"],
        ["Growth Rate", `${trend?.growthRate ?? "N/A"}%`],
        ["Demand", trend?.demandPattern ?? "N/A"],
      ];
      if (trend?.keywords?.length) { trendRows.push([""], ["Keywords"], ...trend.keywords.map((k: string) => [k])); }
      if (trend?.trendingFeatures?.length) { trendRows.push([""], ["Trending Features"], ...trend.trendingFeatures.map((f: string) => [f])); }
      if (trend?.marketDemandSignals?.length) { trendRows.push([""], ["Demand Signals"], ...trend.marketDemandSignals.map((s: string) => [s])); }
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(trendRows), "Trends");

      // Monthly Data
      if (trend?.monthlyData?.length) {
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(trend.monthlyData), "Monthly Trend Data");
      }

      // Feature Gaps
      const gapItems = extractInsightItems(insights, "feature_gap");
      if (gapItems.length) {
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Feature Gap Analysis"], [""], ...gapItems.map(g => [g])]), "Feature Gaps");
      }

      // Recommendations
      const recs = [...extractInsightItems(insights, "risk_opportunity"), ...extractInsightItems(insights, "strengths_weaknesses")];
      if (recs.length) {
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Strategic Recommendations"], [""], ...recs.map(r => [r])]), "Recommendations");
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
          Export as PDF (Full Report)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={generateXLSX} className="gap-2">
          <Download className="h-4 w-4" />
          Export as XLSX
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
