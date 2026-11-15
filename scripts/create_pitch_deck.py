from pathlib import Path

from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_CONNECTOR, MSO_SHAPE
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.util import Inches, Pt

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "PulseCart_HackBriven.pptx"

INK = RGBColor(23, 33, 28)
MOSS = RGBColor(40, 99, 75)
LIME = RGBColor(214, 243, 106)
PAPER = RGBColor(245, 246, 239)
WHITE = RGBColor(255, 255, 255)
MUTED = RGBColor(102, 117, 107)
LINE = RGBColor(220, 226, 214)


def add_box(slide, x, y, w, h, color, radius=True):
    kind = MSO_SHAPE.ROUNDED_RECTANGLE if radius else MSO_SHAPE.RECTANGLE
    shape = slide.shapes.add_shape(kind, Inches(x), Inches(y), Inches(w), Inches(h))
    shape.fill.solid()
    shape.fill.fore_color.rgb = color
    shape.line.fill.background()
    return shape


def add_text(
    slide,
    text,
    x,
    y,
    w,
    h,
    size=18,
    color=INK,
    bold=False,
    font="Aptos",
    align=PP_ALIGN.LEFT,
):
    shape = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    frame = shape.text_frame
    frame.clear()
    frame.word_wrap = True
    frame.margin_left = Inches(0.02)
    frame.margin_right = Inches(0.02)
    frame.margin_top = Inches(0.02)
    frame.margin_bottom = Inches(0.02)
    frame.vertical_anchor = MSO_ANCHOR.MIDDLE
    paragraph = frame.paragraphs[0]
    paragraph.alignment = align
    run = paragraph.add_run()
    run.text = text
    run.font.name = font
    run.font.size = Pt(size)
    run.font.bold = bold
    run.font.color.rgb = color
    return shape


def add_lines(slide, lines, x, y, w, h, size=15, color=INK, gap=8):
    shape = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    frame = shape.text_frame
    frame.clear()
    frame.word_wrap = True
    frame.margin_left = Inches(0.02)
    frame.margin_right = Inches(0.02)
    frame.margin_top = Inches(0.02)
    frame.margin_bottom = Inches(0.02)
    for index, text in enumerate(lines):
        paragraph = frame.paragraphs[0] if index == 0 else frame.add_paragraph()
        paragraph.space_after = Pt(gap)
        run = paragraph.add_run()
        run.text = text
        run.font.name = "Aptos"
        run.font.size = Pt(size)
        run.font.color.rgb = color
    return shape


def new_slide(presentation, eyebrow, title, number):
    slide = presentation.slides.add_slide(presentation.slide_layouts[6])
    background = slide.background.fill
    background.solid()
    background.fore_color.rgb = PAPER
    add_text(slide, eyebrow.upper(), 0.65, 0.35, 7.0, 0.3, 10, MOSS, True)
    add_text(slide, title, 0.65, 0.72, 12.0, 0.65, 28, INK, True)
    add_box(slide, 0.65, 1.48, 12.0, 0.015, LINE, False)
    add_text(slide, f"PULSECART  /  AIVEN HACKATHON                                      {number:02d}", 0.65, 7.08, 12.0, 0.2, 9, MUTED)
    return slide


def add_card(slide, x, y, w, h, label, title, body, accent=MOSS):
    add_box(slide, x, y, w, h, WHITE)
    add_box(slide, x + 0.22, y + 0.22, 0.12, 0.44, accent)
    add_text(slide, label.upper(), x + 0.48, y + 0.2, w - 0.7, 0.25, 9, MUTED, True)
    add_text(slide, title, x + 0.25, y + 0.72, w - 0.5, 0.55, 19, INK, True)
    add_text(slide, body, x + 0.25, y + 1.35, w - 0.5, h - 1.55, 13, MUTED)


def create_deck():
    presentation = Presentation()
    presentation.slide_width = Inches(13.333)
    presentation.slide_height = Inches(7.5)

    slide = presentation.slides.add_slide(presentation.slide_layouts[6])
    slide.background.fill.solid()
    slide.background.fill.fore_color.rgb = INK
    add_text(slide, "AIVEN HACKATHON  /  BUILD THE ONLINE STORE", 0.8, 0.6, 8.0, 0.35, 11, LIME, True)
    add_text(slide, "PulseCart", 0.8, 1.35, 7.0, 1.0, 54, WHITE, True)
    add_text(slide, "Good things, close to home.", 0.82, 2.45, 7.0, 0.6, 25, LIME, True)
    add_text(
        slide,
        "A real-time neighborhood store powered by PostgreSQL, Kafka, and OpenSearch.",
        0.82,
        3.25,
        6.2,
        1.0,
        19,
        WHITE,
    )
    add_text(slide, "Stock is decided in Postgres. Kafka spreads the news.", 0.82, 5.85, 7.4, 0.5, 16, WHITE, True)
    for index, (service, role) in enumerate(
        [
            ("PostgreSQL", "ORDER + STOCK"),
            ("Kafka", "EVENT STREAM"),
            ("OpenSearch", "FUZZY SEARCH"),
        ]
    ):
        y = 1.45 + index * 1.55
        add_box(slide, 8.45, y, 4.0, 1.12, MOSS if index != 1 else LIME)
        ink = WHITE if index != 1 else INK
        add_text(slide, service, 8.75, y + 0.16, 3.4, 0.4, 21, ink, True)
        add_text(slide, role, 8.77, y + 0.63, 3.2, 0.25, 10, ink, True)
        if index < 2:
            add_box(slide, 10.36, y + 1.12, 0.06, 0.42, LIME, False)
    add_text(slide, "01", 12.0, 6.8, 0.5, 0.3, 11, LIME, True, align=PP_ALIGN.RIGHT)

    slide = new_slide(presentation, "01 / The brief", "One store. Three Aiven services. Real work for each.", 2)
    add_text(slide, "Customers expect a simple shop. The engineering underneath must stay correct under pressure.", 0.7, 1.75, 11.7, 0.5, 17, MUTED)
    add_card(slide, 0.7, 2.55, 3.75, 3.25, "Source of truth", "PostgreSQL", "Per-city inventory, customers, orders, line items, and the transactional outbox.")
    add_card(slide, 4.8, 2.55, 3.75, 3.25, "Reliable change", "Kafka", "Order and inventory events fan out to independent consumers after commit.", LIME)
    add_card(slide, 8.9, 2.55, 3.75, 3.25, "Useful discovery", "OpenSearch", "Typo-tolerant catalog search with stock, city, category, and price filters.")
    add_text(slide, "A checkout never waits for search indexing or a notification to succeed.", 0.85, 6.15, 11.2, 0.45, 18, MOSS, True)

    slide = new_slide(presentation, "02 / Checkout", "Make the last unit impossible to oversell.", 3)
    add_text(slide, "One PostgreSQL transaction decides stock, creates the order, and records the events.", 0.7, 1.78, 11.8, 0.45, 17, MUTED)
    steps = [
        ("01", "Validate cart", "Normalize quantities and lock inventory rows in a stable order."),
        ("02", "Claim stock", "UPDATE ... WHERE stock >= qty; a loser gets no returned row."),
        ("03", "Write order", "Persist order header and line items with the final prices."),
        ("04", "Write outbox", "Persist order.placed and inventory.changed before commit."),
    ]
    for i, (n, title, body) in enumerate(steps):
        x = 0.7 + i * 3.1
        add_box(slide, x, 2.75, 2.8, 2.65, WHITE)
        add_text(slide, n, x + 0.22, 2.95, 0.6, 0.35, 13, MOSS, True)
        add_text(slide, title, x + 0.22, 3.45, 2.3, 0.5, 17, INK, True)
        add_text(slide, body, x + 0.22, 4.05, 2.32, 1.0, 12, MUTED)
        if i < 3:
            connector = slide.shapes.add_connector(
                MSO_CONNECTOR.STRAIGHT,
                Inches(x + 2.82),
                Inches(4.05),
                Inches(x + 3.02),
                Inches(4.05),
            )
            connector.line.color.rgb = MOSS
            connector.line.width = Pt(2)
    add_box(slide, 0.7, 5.85, 11.95, 0.65, INK)
    add_text(slide, "Only after the database commits does the relay publish the event.", 1.0, 5.95, 11.2, 0.4, 16, WHITE, True)

    slide = new_slide(presentation, "03 / Event flow", "The outbox makes the database commit the reliable boundary.", 4)
    add_box(slide, 0.8, 2.0, 3.0, 1.2, MOSS)
    add_text(slide, "PostgreSQL", 1.1, 2.2, 2.4, 0.4, 21, WHITE, True)
    add_text(slide, "orders + outbox rows", 1.1, 2.7, 2.4, 0.25, 11, WHITE)
    add_box(slide, 5.15, 2.0, 3.0, 1.2, LIME)
    add_text(slide, "Outbox relay", 5.45, 2.2, 2.4, 0.4, 21, INK, True)
    add_text(slide, "publish, then mark sent", 5.45, 2.7, 2.5, 0.25, 11, INK)
    add_box(slide, 9.5, 2.0, 3.0, 1.2, MOSS)
    add_text(slide, "Kafka", 9.8, 2.2, 2.4, 0.4, 21, WHITE, True)
    add_text(slide, "order + inventory topics", 9.8, 2.7, 2.5, 0.25, 11, WHITE)
    for x1, x2 in [(3.85, 5.05), (8.2, 9.4)]:
        line = slide.shapes.add_connector(MSO_CONNECTOR.STRAIGHT, Inches(x1), Inches(2.6), Inches(x2), Inches(2.6))
        line.line.color.rgb = MOSS
        line.line.width = Pt(2)
    add_card(slide, 1.1, 4.05, 4.8, 1.75, "Consumer A", "Search sync", "Indexes inventory changes into OpenSearch.")
    add_card(slide, 7.35, 4.05, 4.8, 1.75, "Consumer B", "Notification", "Logs a fake order confirmation once per event.", LIME)
    add_text(slide, "Both consumers track processed event IDs; retries are safe.", 2.0, 6.2, 9.3, 0.4, 17, MOSS, True, align=PP_ALIGN.CENTER)

    slide = new_slide(presentation, "04 / Search", "Search is live, fuzzy, and inventory-aware.", 5)
    add_text(slide, "Each searchable document represents one product in one city.", 0.7, 1.82, 11.8, 0.45, 17, MUTED)
    add_box(slide, 0.8, 2.55, 5.35, 3.55, WHITE)
    add_text(slide, "INDEX DOCUMENT", 1.1, 2.82, 4.5, 0.3, 10, MOSS, True)
    add_lines(slide, ["product_id: 42", "name: Bluetooth Headphones", "category: electronics", "price_paise: 8499", "city: Bengaluru", "stock: 1"], 1.1, 3.35, 4.55, 2.45, 16, INK, 10)
    add_box(slide, 6.8, 2.55, 5.35, 3.55, INK)
    add_text(slide, "QUERY", 7.1, 2.82, 4.5, 0.3, 10, LIME, True)
    add_lines(slide, ["Search \"bluetoth\"", "Fuzziness: AUTO", "Category: electronics", "City: Bengaluru", "Price: 0 - 20,000 paise", "Only in-stock results"], 7.1, 3.35, 4.55, 2.45, 16, WHITE, 10)
    add_text(slide, "One product can be found once across the catalog, or narrowed to a specific city.", 1.1, 6.35, 11.1, 0.35, 15, MOSS, True)

    slide = new_slide(presentation, "05 / Live demo", "Show the system, not just the storefront.", 6)
    add_card(slide, 0.8, 2.0, 3.75, 3.35, "Shopping", "Search + filters", "Try a typo, filter by city and price, then check availability by location.")
    add_card(slide, 4.8, 2.0, 3.75, 3.35, "Engineering", "Last-unit race", "Alice and Bob submit at the same time. One atomic update wins.", LIME)
    add_card(slide, 8.8, 2.0, 3.75, 3.35, "Operations", "Outbox dashboard", "Watch order events move from pending to published while workers process them.")
    add_box(slide, 0.8, 5.85, 11.75, 0.72, MOSS)
    add_text(slide, "The punchline: no oversell, reliable events, and real search results.", 1.1, 5.97, 11.1, 0.45, 18, WHITE, True, align=PP_ALIGN.CENTER)

    slide = new_slide(presentation, "06 / Run it", "One command for the local demo stack.", 7)
    add_text(slide, "Docker Compose brings up PostgreSQL, Kafka, OpenSearch, the API, workers, and storefront.", 0.8, 1.9, 11.5, 0.55, 17, MUTED)
    add_box(slide, 0.8, 2.75, 11.75, 1.05, INK)
    add_text(slide, "docker compose up --build", 1.15, 2.98, 10.9, 0.55, 23, LIME, True, font="Cascadia Code")
    add_card(slide, 0.8, 4.25, 3.75, 1.85, "01", "Browse", "http://localhost:3000")
    add_card(slide, 4.8, 4.25, 3.75, 1.85, "02", "Watch events", "http://localhost:3000/admin", LIME)
    add_card(slide, 8.8, 4.25, 3.75, 1.85, "03", "Run against Aiven", "Use local environment variables and ignored TLS certificate files.")
    add_text(slide, "Aiven credentials are not stored in the repository.", 0.9, 6.45, 11.2, 0.35, 14, MOSS, True)

    presentation.save(OUTPUT)
    print(f"Created {OUTPUT}")


if __name__ == "__main__":
    create_deck()
