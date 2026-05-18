"""Text chunking service for document processing."""

from dataclasses import dataclass

import tiktoken
import structlog

from app.services.extraction import ExtractedDocument

logger = structlog.get_logger()


@dataclass
class Chunk:
    """A chunk of text with metadata."""

    content: str
    chunk_index: int
    page_number: int | None
    token_count: int
    document_title: str


class TextChunker:
    """Chunks extracted documents into overlapping text segments.

    Phase 1: sentence-boundary chunking with overlap.
    Phase 2 will upgrade to semantic/structure-aware chunking.
    """

    def __init__(self, max_chunk_tokens: int = 500, overlap_tokens: int = 50):
        self.max_chunk_tokens = max_chunk_tokens
        self.overlap_tokens = overlap_tokens
        self.tokenizer = tiktoken.get_encoding("cl100k_base")

    def chunk(self, document: ExtractedDocument) -> list[Chunk]:
        """Split an extracted document into chunks."""
        chunks = []
        chunk_index = 0

        for page in document.pages:
            if not page.text.strip():
                continue

            sentences = self._split_sentences(page.text)
            current_chunk: list[str] = []
            current_tokens = 0

            for sentence in sentences:
                sentence_tokens = len(self.tokenizer.encode(sentence))

                # If single sentence exceeds max, split it
                if sentence_tokens > self.max_chunk_tokens:
                    # Flush current chunk
                    if current_chunk:
                        chunk_text = " ".join(current_chunk)
                        chunks.append(
                            Chunk(
                                content=f"[{document.title}]\n{chunk_text}",
                                chunk_index=chunk_index,
                                page_number=page.page_number,
                                token_count=current_tokens,
                                document_title=document.title,
                            )
                        )
                        chunk_index += 1
                        current_chunk = []
                        current_tokens = 0

                    # Add the long sentence as its own chunk
                    chunks.append(
                        Chunk(
                            content=f"[{document.title}]\n{sentence}",
                            chunk_index=chunk_index,
                            page_number=page.page_number,
                            token_count=sentence_tokens,
                            document_title=document.title,
                        )
                    )
                    chunk_index += 1
                    continue

                if current_tokens + sentence_tokens > self.max_chunk_tokens:
                    # Flush current chunk
                    chunk_text = " ".join(current_chunk)
                    chunks.append(
                        Chunk(
                            content=f"[{document.title}]\n{chunk_text}",
                            chunk_index=chunk_index,
                            page_number=page.page_number,
                            token_count=current_tokens,
                            document_title=document.title,
                        )
                    )
                    chunk_index += 1

                    # Keep overlap — take last few sentences
                    overlap_chunk: list[str] = []
                    overlap_count = 0
                    for s in reversed(current_chunk):
                        s_tokens = len(self.tokenizer.encode(s))
                        if overlap_count + s_tokens > self.overlap_tokens:
                            break
                        overlap_chunk.insert(0, s)
                        overlap_count += s_tokens

                    current_chunk = overlap_chunk
                    current_tokens = overlap_count

                current_chunk.append(sentence)
                current_tokens += sentence_tokens

            # Flush remaining
            if current_chunk:
                chunk_text = " ".join(current_chunk)
                chunks.append(
                    Chunk(
                        content=f"[{document.title}]\n{chunk_text}",
                        chunk_index=chunk_index,
                        page_number=page.page_number,
                        token_count=current_tokens,
                        document_title=document.title,
                    )
                )
                chunk_index += 1

        logger.info(
            "document_chunked",
            title=document.title,
            total_chunks=len(chunks),
            avg_tokens=sum(c.token_count for c in chunks) // max(len(chunks), 1),
        )

        return chunks

    def _split_sentences(self, text: str) -> list[str]:
        """Split text into sentences on common boundaries."""
        import re

        # Split on sentence-ending punctuation followed by space/newline
        sentences = re.split(r"(?<=[.!?])\s+", text)
        # Also split on double newlines (paragraph breaks)
        result = []
        for sentence in sentences:
            parts = sentence.split("\n\n")
            result.extend(p.strip() for p in parts if p.strip())
        return result
