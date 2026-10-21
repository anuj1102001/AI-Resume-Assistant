import pymupdf

from app.resume.layout import inspect_pdf


def _grid(page, x0: float, y0: float, cols: int = 3, rows: int = 3, cw: float = 150, rh: float = 24) -> None:
    for r in range(rows + 1):
        page.draw_line((x0, y0 + r * rh), (x0 + cols * cw, y0 + r * rh))
    for c in range(cols + 1):
        page.draw_line((x0 + c * cw, y0), (x0 + c * cw, y0 + rows * rh))
    for r in range(rows):
        for c in range(cols):
            page.insert_text((x0 + c * cw + 6, y0 + r * rh + 16), f"Skill {r}{c}", fontsize=10)


def _pdf(draw) -> bytes:
    doc = pymupdf.open()
    page = doc.new_page()
    page.insert_text((72, 72), "Jane Doe · jane@example.com", fontsize=11)
    draw(page)
    data = doc.tobytes()
    doc.close()
    return data


def test_ruled_tables_are_detected():
    assert inspect_pdf(_pdf(lambda p: _grid(p, 72, 120))).tables == 1
    assert inspect_pdf(_pdf(lambda p: (_grid(p, 72, 120), _grid(p, 72, 400, cols=2, rows=2)))).tables == 2
    # A table drawn as cell rectangles counts too.
    cells = lambda p: [p.draw_rect(pymupdf.Rect(72 + c * 100, 120 + r * 20, 172 + c * 100, 140 + r * 20)) for r in range(2) for c in range(2)]  # noqa: E731
    assert inspect_pdf(_pdf(cells)).tables == 1


def test_section_rules_and_page_borders_are_not_tables():
    # What most resumes draw: a horizontal rule under each heading, and sometimes a border around the page.
    def rules(p):
        for y in (100, 220, 340, 460):
            p.draw_line((60, y), (540, y), width=0.8)

    assert inspect_pdf(_pdf(rules)).tables == 0
    assert inspect_pdf(_pdf(lambda p: p.draw_rect(pymupdf.Rect(36, 36, 576, 756)))).tables == 0
    assert inspect_pdf(_pdf(lambda p: None)).tables == 0
