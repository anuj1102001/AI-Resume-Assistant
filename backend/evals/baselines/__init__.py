"""The v1 implementation (copied unchanged from the main branch, except for one import), kept to measure v2 against.

v1 used LangChain's Document class for a page_content + metadata pair; a minimal stand-in keeps the baseline runnable
without installing LangChain.
"""

from dataclasses import dataclass, field


@dataclass
class Document:
    page_content: str
    metadata: dict = field(default_factory=dict)
