import sys
import os
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfgen import canvas

class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, page_count):
        self.saveState()
        self.setFont("Helvetica-Bold", 8)
        self.setFillColor(colors.HexColor("#64748B"))
        
        # Header (page > 1)
        if self._pageNumber > 1:
            self.drawString(36, 11 * inch - 26, "De Natura Aesthetics | Ad Agency Performance Report")
            self.setStrokeColor(colors.HexColor("#CBD5E1"))
            self.setLineWidth(0.5)
            self.line(36, 11 * inch - 30, 8.5 * inch - 36, 11 * inch - 30)

        # Footer (all pages)
        self.setStrokeColor(colors.HexColor("#CBD5E1"))
        self.setLineWidth(0.5)
        self.line(36, 36, 8.5 * inch - 36, 36)

        self.setFont("Helvetica", 8)
        self.drawString(36, 24, "Confidential — De Natura Aesthetics Campaign Analysis (July 7 - August 11, 2026)")
        page_text = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(8.5 * inch - 36, 24, page_text)
        self.restoreState()

def create_report(output_filename):
    doc = SimpleDocTemplate(
        output_filename,
        pagesize=letter,
        leftMargin=36,
        rightMargin=36,
        topMargin=36,
        bottomMargin=44
    )

    styles = getSampleStyleSheet()

    # Premium Palette
    PRIMARY = colors.HexColor("#0D9488")      # Teal
    PRIMARY_DARK = colors.HexColor("#0F766E") # Dark Teal
    DARK_TEXT = colors.HexColor("#0F172A")    # Slate
    MUTED_TEXT = colors.HexColor("#475569")   # Muted
    ACCENT_GOLD = colors.HexColor("#D97706")  # Amber Gold
    BG_LIGHT = colors.HexColor("#F8FAFC")     # Card BG
    BG_ACCENT = colors.HexColor("#F1F5F9")    # Table alt

    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=20,
        leading=23,
        textColor=PRIMARY_DARK,
        spaceAfter=2
    )

    subtitle_style = ParagraphStyle(
        'DocSubTitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9.5,
        leading=12,
        textColor=MUTED_TEXT,
        spaceAfter=10
    )

    h1_style = ParagraphStyle(
        'H1Style',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=11.5,
        leading=14,
        textColor=PRIMARY_DARK,
        spaceBefore=8,
        spaceAfter=4
    )

    body_style = ParagraphStyle(
        'BodyStyle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=11.5,
        textColor=DARK_TEXT,
        spaceAfter=4
    )

    body_bold = ParagraphStyle(
        'BodyBold',
        parent=body_style,
        fontName='Helvetica-Bold'
    )

    table_header = ParagraphStyle(
        'TableHeader',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8,
        leading=10,
        textColor=colors.white,
        alignment=0
    )

    table_cell = ParagraphStyle(
        'TableCell',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=7.5,
        leading=10,
        textColor=DARK_TEXT,
        alignment=0
    )

    table_cell_bold = ParagraphStyle(
        'TableCellBold',
        parent=table_cell,
        fontName='Helvetica-Bold'
    )

    table_cell_right = ParagraphStyle(
        'TableCellRight',
        parent=table_cell,
        alignment=2
    )

    table_cell_right_bold = ParagraphStyle(
        'TableCellRightBold',
        parent=table_cell_bold,
        alignment=2
    )

    callout_style = ParagraphStyle(
        'CalloutText',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8,
        leading=11,
        textColor=DARK_TEXT
    )

    story = []

    # Title Banner Block
    story.append(Paragraph("DE NATURA AESTHETICS", ParagraphStyle('PreTitle', fontName='Helvetica-Bold', fontSize=8.5, leading=10, textColor=ACCENT_GOLD, spaceAfter=1)))
    story.append(Paragraph("Ad Agency Performance Analysis Report", title_style))
    story.append(Paragraph("Meta Ads Campaign Audit  |  Period: July 7 – August 11, 2026  |  Trivandrum Clinic", subtitle_style))
    story.append(HRFlowable(width="100%", thickness=1.5, color=PRIMARY, spaceBefore=0, spaceAfter=8))

    # KPI Summary Cards Table
    kpi_data = [
        [
            Paragraph("<b>Total Unique Leads</b><br/><font size=13 color='#0F766E'><b>105 Leads</b></font><br/><font size=6.5 color='#64748B'>163 raw forms (-58 dups)</font>", body_style),
            Paragraph("<b>Total Expenditure</b><br/><font size=13 color='#0F766E'><b>₹55,500</b></font><br/><font size=6.5 color='#64748B'>₹26k ad + ₹29.5k agency</font>", body_style),
            Paragraph("<b>Realized Revenue</b><br/><font size=13 color='#D97706'><b>₹30,394</b></font><br/><font size=6.5 color='#64748B'>8 paying clients</font>", body_style),
            Paragraph("<b>Overall Deficit</b><br/><font size=13 color='#B91C1C'><b>-₹25,106</b></font><br/><font size=6.5 color='#64748B'>ROAS 116.9% (Ad spend only)</font>", body_style),
        ]
    ]
    kpi_table = Table(kpi_data, colWidths=[1.85*inch]*4)
    kpi_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), BG_LIGHT),
        ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor("#CBD5E1")),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor("#CBD5E1")),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
    ]))
    story.append(kpi_table)
    story.append(Spacer(1, 8))

    # Section 1: Executive Overview
    story.append(Paragraph("1. Executive Financial & Efficiency Performance", h1_style))
    exec_summary_text = (
        "During the 29 active campaign days, Meta ads generated <b>105 unique leads</b> (163 raw entries deduplicated). "
        "Total revenue collected across 8 converted paying clients is <b>₹30,394</b>. "
        "While the ad campaign itself was profitable on raw ad spend (116.9% ROAS), factoring in the agency's management fee of ₹29,500 (incl. GST) "
        "places the campaign at an overall net deficit of <b>-₹25,106</b>."
    )
    story.append(Paragraph(exec_summary_text, body_style))

    # Financial Comparison Table
    fin_headers = [Paragraph(h, table_header) for h in ["Performance Metric", "Ad Spend Only (Meta Ads)", "Total Outlay (Ad Spend + Agency Cost)"]]
    fin_data = [
        fin_headers,
        [Paragraph("Total Outlay / Cost", table_cell), Paragraph("₹26,000", table_cell_right), Paragraph("<b>₹55,500</b> (₹26k ad + ₹29.5k agency)", table_cell_right)],
        [Paragraph("Total Realized Revenue", table_cell), Paragraph("₹30,394", table_cell_right), Paragraph("₹30,394", table_cell_right)],
        [Paragraph("Net Profit / Loss", table_cell_bold), Paragraph("<font color='#0D9488'><b>+₹4,394 (Profit)</b></font>", table_cell_right_bold), Paragraph("<font color='#B91C1C'><b>-₹25,106 (Deficit)</b></font>", table_cell_right_bold)],
        [Paragraph("Return on Investment", table_cell), Paragraph("<b>116.9% ROAS</b> (1.17x)", table_cell_right), Paragraph("<b>-45.2% ROI</b>", table_cell_right)],
        [Paragraph("Cost Per Unique Lead (CPL)", table_cell), Paragraph("₹247.62", table_cell_right), Paragraph("₹528.57", table_cell_right)],
        [Paragraph("Cost Per Acquisition (CPA / Paying Client)", table_cell), Paragraph("₹3,250.00", table_cell_right), Paragraph("₹6,937.50", table_cell_right)],
        [Paragraph("Client Conversion Rate", table_cell), Paragraph("7.62% (8 / 105)", table_cell_right), Paragraph("7.62% (8 / 105)", table_cell_right)],
    ]

    fin_table = Table(fin_data, colWidths=[2.6*inch, 2.0*inch, 2.8*inch])
    fin_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), PRIMARY_DARK),
        ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor("#CBD5E1")),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor("#E2E8F0")),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, BG_ACCENT]),
    ]))
    story.append(fin_table)
    story.append(Spacer(1, 8))

    # Section 2: Realized Revenue Log
    story.append(Paragraph("2. Converted Clients & Revenue Realized (₹30,394 Total)", h1_style))

    conv_headers = [Paragraph(h, table_header) for h in ["Date", "Client Name", "Platform", "Service / Treatment", "Location", "Revenue (₹)"]]
    conv_rows = [
        conv_headers,
        [Paragraph("22-Jul", table_cell), Paragraph("Zeena Beegam", table_cell_bold), Paragraph("Facebook", table_cell), Paragraph("PRP / GFC Hair Treatment", table_cell), Paragraph("Thiruvananthapuram", table_cell), Paragraph("₹20,220", table_cell_right_bold)],
        [Paragraph("13-Jul", table_cell), Paragraph("Dr. Fathima Sameer", table_cell_bold), Paragraph("Facebook", table_cell), Paragraph("Glutathione IV Therapy", table_cell), Paragraph("Ernakulam", table_cell), Paragraph("₹5,300", table_cell_right_bold)],
        [Paragraph("30-Jul", table_cell), Paragraph("Cifin Kc", table_cell_bold), Paragraph("Facebook", table_cell), Paragraph("Hair Transplant Planning", table_cell), Paragraph("Thiruvananthapuram", table_cell), Paragraph("₹3,374", table_cell_right_bold)],
        [Paragraph("14-Jul", table_cell), Paragraph("Abhijithantony", table_cell), Paragraph("Instagram", table_cell), Paragraph("Acne Scars / Marks", table_cell), Paragraph("Trivandrum", table_cell), Paragraph("₹300", table_cell_right)],
        [Paragraph("13-Jul", table_cell), Paragraph("Nisam AR", table_cell), Paragraph("Facebook", table_cell), Paragraph("Hair Fall / Hair Thinning", table_cell), Paragraph("Trivandrum", table_cell), Paragraph("₹300", table_cell_right)],
        [Paragraph("10-Jul", table_cell), Paragraph("Vishnu S R", table_cell), Paragraph("Facebook", table_cell), Paragraph("Hair Fall / Hair Thinning", table_cell), Paragraph("Thiruvananthapuram", table_cell), Paragraph("₹300", table_cell_right)],
        [Paragraph("07-Jul", table_cell), Paragraph("Arun s Nair", table_cell), Paragraph("Facebook", table_cell), Paragraph("PRP / GFC Hair Treatment", table_cell), Paragraph("Thiruvananthapuram", table_cell), Paragraph("₹300", table_cell_right)],
        [Paragraph("04-Aug", table_cell), Paragraph("Prasanth GS", table_cell), Paragraph("Facebook", table_cell), Paragraph("PRP / GFC Hair Treatment", table_cell), Paragraph("Thiruvananthapuram", table_cell), Paragraph("₹300", table_cell_right)],
        [Paragraph("<b>TOTAL</b>", table_cell_bold), Paragraph("<b>8 Converted Clients</b>", table_cell_bold), Paragraph("", table_cell), Paragraph("", table_cell), Paragraph("", table_cell), Paragraph("<b>₹30,394</b>", table_cell_right_bold)],
    ]

    conv_table = Table(conv_rows, colWidths=[0.7*inch, 1.4*inch, 0.9*inch, 2.1*inch, 1.3*inch, 1.0*inch])
    conv_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), PRIMARY_DARK),
        ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor("#CBD5E1")),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor("#E2E8F0")),
        ('TOPPADDING', (0,0), (-1,-1), 3.5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 3.5),
        ('LEFTPADDING', (0,0), (-1,-1), 5),
        ('RIGHTPADDING', (0,0), (-1,-1), 5),
        ('BACKGROUND', (0,-1), (-1,-1), colors.HexColor("#FEF3C7")),
        ('ROWBACKGROUNDS', (0,1), (-1,-2), [colors.white, BG_ACCENT]),
    ]))
    story.append(conv_table)
    story.append(Spacer(1, 8))

    # Section 3: Lead Status Pipeline Breakdown
    story.append(Paragraph("3. Lead Status & Conversion Pipeline (105 Unique Leads)", h1_style))

    pipe_headers = [Paragraph(h, table_header) for h in ["Status Category", "Leads", "Share (%)", "Pipeline Assessment & Key Observations"]]
    pipe_rows = [
        pipe_headers,
        [Paragraph("<b>Converted / Paid</b>", table_cell), Paragraph("8", table_cell_right_bold), Paragraph("7.6%", table_cell_right), Paragraph("Realized ₹30,394 total revenue from paid consultations & procedures.", table_cell)],
        [Paragraph("<b>Warm Pipeline / Promised Visits</b>", table_cell), Paragraph("25", table_cell_right_bold), Paragraph("23.8%", table_cell), Paragraph("High potential. Scheduled or promised visits post-Onam / next week for Hair Transplant & GFC (e.g. Sreekanth SR, Sunil Lal, Chandu Nair, Arya Sundaresan).", table_cell)],
        [Paragraph("<b>Out of District / Location Mismatch</b>", table_cell), Paragraph("14", table_cell_right_bold), Paragraph("13.3%", table_cell), Paragraph("Leads from Palakkad, Alappuzha, Kottayam, Ernakulam, Wayanad who dropped due to travel distance.", table_cell)],
        [Paragraph("<b>Invalid / Ineligible</b>", table_cell), Paragraph("6", table_cell_right_bold), Paragraph("5.7%", table_cell), Paragraph("Inquiries for unoffered services (cheek fillers), thin donor area, diabetic/age limits.", table_cell)],
        [Paragraph("<b>Unresponsive / Call Dropped</b>", table_cell), Paragraph("52", table_cell_right_bold), Paragraph("49.5%", table_cell), Paragraph("Did not answer, call busy/rejected, or failed to reply to messages.", table_cell)],
        [Paragraph("<b>TOTAL UNIQUE LEADS</b>", table_cell_bold), Paragraph("<b>105</b>", table_cell_right_bold), Paragraph("<b>100.0%</b>", table_cell_right_bold), Paragraph("<b>163 raw form entries deduplicated into 105 unique lead records</b>", table_cell_bold)]
    ]

    pipe_table = Table(pipe_rows, colWidths=[2.1*inch, 0.6*inch, 0.7*inch, 4.0*inch])
    pipe_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), PRIMARY_DARK),
        ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor("#CBD5E1")),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor("#E2E8F0")),
        ('TOPPADDING', (0,0), (-1,-1), 3.5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 3.5),
        ('LEFTPADDING', (0,0), (-1,-1), 5),
        ('RIGHTPADDING', (0,0), (-1,-1), 5),
        ('ROWBACKGROUNDS', (0,1), (-1,-2), [colors.white, BG_ACCENT]),
        ('BACKGROUND', (0,-1), (-1,-1), colors.HexColor("#F1F5F9")),
    ]))
    story.append(pipe_table)
    story.append(Spacer(1, 8))

    # Section 4: Facebook vs Instagram Comparison
    story.append(Paragraph("4. Platform Performance: Facebook vs. Instagram", h1_style))

    plat_headers = [Paragraph(h, table_header) for h in ["Platform", "Unique Leads", "Lead Share", "Paying Clients", "Conv. Rate", "Revenue (₹)", "Revenue Share"]]
    plat_rows = [
        plat_headers,
        [Paragraph("<b>Facebook (FB)</b>", table_cell), Paragraph("61", table_cell_right), Paragraph("58.1%", table_cell), Paragraph("<b>7</b>", table_cell_right_bold), Paragraph("<b>11.48%</b>", table_cell_right_bold), Paragraph("<b>₹30,094</b>", table_cell_right_bold), Paragraph("<b>99.0%</b>", table_cell_right_bold)],
        [Paragraph("<b>Instagram (IG)</b>", table_cell), Paragraph("44", table_cell_right), Paragraph("41.9%", table_cell), Paragraph("1", table_cell_right), Paragraph("2.27%", table_cell_right), Paragraph("₹300", table_cell_right), Paragraph("1.0%", table_cell_right)],
        [Paragraph("<b>TOTAL</b>", table_cell_bold), Paragraph("<b>105</b>", table_cell_right_bold), Paragraph("<b>100.0%</b>", table_cell_right_bold), Paragraph("<b>8</b>", table_cell_right_bold), Paragraph("<b>7.62%</b>", table_cell_right_bold), Paragraph("<b>₹30,394</b>", table_cell_right_bold), Paragraph("<b>100.0%</b>", table_cell_right_bold)]
    ]

    plat_table = Table(plat_rows, colWidths=[1.5*inch, 1.0*inch, 0.9*inch, 1.0*inch, 0.9*inch, 1.1*inch, 1.0*inch])
    plat_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), PRIMARY_DARK),
        ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor("#CBD5E1")),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor("#E2E8F0")),
        ('TOPPADDING', (0,0), (-1,-1), 3.5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 3.5),
        ('LEFTPADDING', (0,0), (-1,-1), 5),
        ('RIGHTPADDING', (0,0), (-1,-1), 5),
        ('ROWBACKGROUNDS', (0,1), (-1,-2), [colors.white, BG_ACCENT]),
        ('BACKGROUND', (0,-1), (-1,-1), colors.HexColor("#F1F5F9")),
    ]))
    story.append(plat_table)
    story.append(Spacer(1, 8))

    # Section 5: Strategic Recommendations
    story.append(Paragraph("5. Strategic Recommendations for De Natura & Agency Evaluation", h1_style))

    recs = [
        "<b>1. Tighten Geo-Targeting (Save ~13.3% Wasted Budget):</b> 14 leads arrived from distant locations (Palakkad, Alappuzha, Kottayam, Wayanad). Restricting Meta ad radius strictly to <b>25 km around Trivandrum clinic</b> will prevent ad spend leakage.",
        "<b>2. Shift Budget to Facebook (75–80% Allocation):</b> Facebook delivered 99% of total revenue (₹30,094) with an 11.48% conversion rate. Ad spend should be heavily weighted towards Facebook high-ticket campaigns (PRP/GFC & Hair Transplant).",
        "<b>3. Intensive Follow-up on the 25 Warm Leads:</b> 25 warm leads have strong intent for Hair Transplant, GFC, and PRP treatments. Converting just <b>2–3 Hair Transplant / GFC procedures</b> will generate ₹40,000–₹80,000+ and bring the overall campaign into high net profitability.",
        "<b>4. Agency Performance Benchmarks:</b> While ad spend alone achieved 116.9% ROAS (+₹4,394 profit), the agency fee of ₹29,500 creates a net deficit of -₹25,106. Set a target monthly revenue benchmark of <b>₹60,000–₹75,000</b> for the agency to justify management costs."
    ]

    rec_cells = [[Paragraph(rec, callout_style)] for rec in recs]
    rec_table = Table(rec_cells, colWidths=[7.4*inch])
    rec_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#F0FDF4")),
        ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor("#86EFAC")),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor("#BBF7D0")),
        ('TOPPADDING', (0,0), (-1,-1), 4.5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4.5),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(rec_table)

    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"Optimized PDF generated successfully: {output_filename}")

if __name__ == "__main__":
    output_pdf = "/Users/chanthuvs/.gemini/antigravity/brain/ce5ba0a7-90cf-4be2-819d-7996d3fd9b70/De_Natura_Ad_Agency_Performance_Report.pdf"
    create_report(output_pdf)
