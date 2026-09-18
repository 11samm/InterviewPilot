from io import BytesIO

import pytest
from fastapi import HTTPException
from pypdf import PdfWriter

from backend.services.resume import MAX_CHARS, MAX_FILE_BYTES, extract_resume_text

SAMPLE = (
    "Senior engineer at Aurora Labs. Led checkout latency work across payments "
    "and reduced p99 by forty percent for the storefront."
)


def _pdf_with_text(phrase: str) -> bytes:
    # Minimal single-page PDF with an embedded text stream PdfReader can extract.
    content = f"BT /F1 12 Tf 100 700 Td ({phrase}) Tj ET"
    length = len(content)
    return f"""%PDF-1.4
1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj
2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj
3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources<< /Font<< /F1 5 0 R >> >> >>endobj
4 0 obj<< /Length {length} >>stream
{content}
endstream
endobj
5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000266 00000 n 
0000000389 00000 n 
trailer<< /Size 6 /Root 1 0 R >>
startxref
466
%%EOF""".encode("latin-1")


def test_valid_txt_utf8():
    data = f"  {SAMPLE}  ".encode("utf-8")
    text = extract_resume_text(filename="resume.txt", content_type="text/plain", data=data)
    assert text == SAMPLE


def test_txt_with_nul_rejected():
    data = b"hello\x00world " + SAMPLE.encode()
    with pytest.raises(HTTPException) as exc:
        extract_resume_text(filename="resume.txt", content_type="text/plain", data=data)
    assert exc.value.status_code == 422
    assert exc.value.detail == "Upload a PDF or a .txt file, or paste the resume text."


@pytest.mark.parametrize("filename", ["resume.docx", "photo.png", "resume"])
def test_unsupported_types(filename):
    with pytest.raises(HTTPException) as exc:
        extract_resume_text(filename=filename, content_type="", data=SAMPLE.encode())
    assert exc.value.status_code == 422
    assert exc.value.detail == "Upload a PDF or a .txt file, or paste the resume text."


def test_empty_and_oversized():
    with pytest.raises(HTTPException) as exc:
        extract_resume_text(filename="a.txt", content_type="", data=b"")
    assert exc.value.detail == "Resume files must be a PDF or .txt file under 2 MB."
    with pytest.raises(HTTPException) as exc:
        extract_resume_text(
            filename="a.txt", content_type="", data=b"x" * (MAX_FILE_BYTES + 1)
        )
    assert exc.value.detail == "Resume files must be a PDF or .txt file under 2 MB."


def test_pdf_magic_mismatch():
    with pytest.raises(HTTPException) as exc:
        extract_resume_text(filename="resume.pdf", content_type="", data=SAMPLE.encode())
    assert exc.value.detail == "Upload a PDF or a .txt file, or paste the resume text."


def test_pdf_round_trip_extracts_phrase():
    phrase = (
        "Senior engineer at Aurora Labs. Led checkout latency work across payments "
        "and reduced p99 by forty percent."
    )
    text = extract_resume_text(
        filename="resume.pdf", content_type="application/pdf", data=_pdf_with_text(phrase)
    )
    assert "Aurora Labs" in text
    assert "checkout latency" in text


def test_too_many_pages():
    writer = PdfWriter()
    for _ in range(9):
        writer.add_blank_page(width=100, height=100)
    buf = BytesIO()
    writer.write(buf)
    with pytest.raises(HTTPException) as exc:
        extract_resume_text(filename="long.pdf", content_type="", data=buf.getvalue())
    assert exc.value.detail == "Resume PDFs can have at most 8 pages."


def test_too_little_text():
    with pytest.raises(HTTPException) as exc:
        extract_resume_text(filename="short.txt", content_type="", data=b"hi")
    assert "scanned PDF" in exc.value.detail


def test_truncation():
    body = ("word " * 8000).strip()
    assert len(body) > MAX_CHARS
    text = extract_resume_text(
        filename="long.txt", content_type="", data=body.encode("utf-8")
    )
    assert len(text) <= MAX_CHARS
