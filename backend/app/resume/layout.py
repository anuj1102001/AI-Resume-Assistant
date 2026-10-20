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


def inspect_pdf(data: bytes) -> Layout:
    with pymupdf.open(stream=data, filetype="pdf") as doc:
        multi, tables, images, fonts = [], 0, 0, set()
        for i, page in enumerate(doc, start=1):
            if _is_multi_column(page):
                multi.append(i)
            try:
                tables += len(page.find_tables().tables)
            except Exception:  # table detection is best-effort
                pass
            images += len(page.get_images(full=False))
            fonts.update(f[3] for f in page.get_fonts())
        return Layout(doc.page_count, multi, tables, images, len(fonts))


def no_layout(pages: int) -> Layout:
    """DOCX and text files: no geometry to inspect."""
    return Layout(pages, [], 0, 0, 0)
