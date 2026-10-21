import pymupdf

from app.resume.layout import inspect_pdf


def _pdf(draw_table: bool) -> bytes:
    doc = pymupdf.open()
    page = doc.new_page()
    page.insert_text((72, 72), "Jane Doe · jane@example.com", fontsize=11)
    if draw_table:
        # A 3x3 ruled grid with text in each cell: what a "skills table" in a resume looks like.
        x0, y0, cw, rh = 72, 120, 150, 24
        for r in range(4):
            page.draw_line((x0, y0 + r * rh), (x0 + 3 * cw, y0 + r * rh))
        for c in range(4):
            page.draw_line((x0 + c * cw, y0), (x0 + c * cw, y0 + 3 * rh))
        for r in range(3):
            for c in range(3):
                page.insert_text((x0 + c * cw + 6, y0 + r * rh + 16), f"Skill {r}{c}", fontsize=10)
    data = doc.tobytes()
    doc.close()
    return data


def test_ruled_tables_are_still_detected():
    assert inspect_pdf(_pdf(draw_table=True)).tables == 1


def test_pages_without_drawings_report_no_tables():
    # Table detection is skipped on such pages (it costs ~120 MB); the answer must be the same.
    assert inspect_pdf(_pdf(draw_table=False)).tables == 0
