"""Layout facts read from the PDF itself: columns, tables, images and fonts.

These matter because many applicant tracking systems extract text line by line across the full page width: a
two-column layout can come out interleaved, and text inside tables or images may be lost.
"""

from dataclasses import asdict, dataclass

import pymupdf

from app.ingest.columns import find_gutter


@dataclass
class Layout:
    pages: int
    multi_column_pages: list[int]
    tables: int
    images: int
    fonts: int

    def to_dict(self) -> dict:
        return asdict(self)


def _is_multi_column(page: pymupdf.Page) -> bool:
    return find_gutter(page) is not None


def _segments(page: pymupdf.Page) -> tuple[list[tuple[float, float, float]], list[tuple[float, float, float]]]:
    """Horizontal (y, x0, x1) and vertical (x, y0, y1) ruling lines drawn on the page, including rectangle edges."""
    hs, vs = [], []

    def add(x0: float, y0: float, x1: float, y1: float) -> None:
        if abs(y1 - y0) < 1.5 and abs(x1 - x0) > 20:
            hs.append(((y0 + y1) / 2, min(x0, x1), max(x0, x1)))
        elif abs(x1 - x0) < 1.5 and abs(y1 - y0) > 8:
            vs.append(((x0 + x1) / 2, min(y0, y1), max(y0, y1)))

    for d in page.get_drawings():
        for item in d["items"]:
            if item[0] == "l":
                add(item[1].x, item[1].y, item[2].x, item[2].y)
            elif item[0] == "re":
                r = item[1]
                if r.height < 2:  # a rule drawn as a thin filled rectangle
                    add(r.x0, (r.y0 + r.y1) / 2, r.x1, (r.y0 + r.y1) / 2)
                elif r.width < 2:
                    add((r.x0 + r.x1) / 2, r.y0, (r.x0 + r.x1) / 2, r.y1)
                else:
                    add(r.x0, r.y0, r.x1, r.y0)
                    add(r.x0, r.y1, r.x1, r.y1)
                    add(r.x0, r.y0, r.x0, r.y1)
                    add(r.x1, r.y0, r.x1, r.y1)
    return hs, vs


def count_tables(page: pymupdf.Page, tol: float = 2.0) -> int:
    """Ruled tables: groups of crossing lines with at least 3 horizontal and 3 vertical (2 x 2 cells or more).

    Section rules under headings (horizontal only) and a single box around the page (2 + 2) don't count. This replaces
    PyMuPDF's find_tables(), which briefly allocated ~100 MB per page and crashed the 512 MB server on real resumes.
    """
    hs, vs = _segments(page)
    if len(hs) < 3 or len(vs) < 3:
        return 0
    n = len(hs) + len(vs)
    parent = list(range(n))

    def find(i: int) -> int:
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    for i, (y, hx0, hx1) in enumerate(hs):
        for j, (x, vy0, vy1) in enumerate(vs):
            if hx0 - tol <= x <= hx1 + tol and vy0 - tol <= y <= vy1 + tol:
                parent[find(i)] = find(len(hs) + j)
    groups: dict[int, list[int]] = {}
    for k in range(n):
        groups.setdefault(find(k), []).append(k)
    return sum(1 for g in groups.values() if sum(k < len(hs) for k in g) >= 3 and sum(k >= len(hs) for k in g) >= 3)


def inspect_pdf(data: bytes) -> Layout:
    with pymupdf.open(stream=data, filetype="pdf") as doc:
        multi, tables, images, fonts = [], 0, 0, set()
        for i, page in enumerate(doc, start=1):
            if _is_multi_column(page):
                multi.append(i)
            tables += count_tables(page)
            images += len(page.get_images(full=False))
            fonts.update(f[3] for f in page.get_fonts())
        return Layout(doc.page_count, multi, tables, images, len(fonts))


def no_layout(pages: int) -> Layout:
    """DOCX and text files: no geometry to inspect."""
    return Layout(pages, [], 0, 0, 0)
