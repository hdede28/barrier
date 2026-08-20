"""Focused tests for the core PDF transformations, exercised directly
against the pdf_ops functions (no HTTP layer)."""
from __future__ import annotations

import pikepdf
import pytest

from app.pdf_ops.compress import compress_pdf
from app.pdf_ops.merge import merge_pdfs
from app.pdf_ops.reorder import reorder_pdf
from app.pdf_ops.rotate import rotate_pdf
from app.pdf_ops.split import split_pdf

from .factory import make_pdf


def test_merge_concatenates_pages_in_order(tmp_path):
    a = make_pdf(tmp_path / "a.pdf", num_pages=2)
    b = make_pdf(tmp_path / "b.pdf", num_pages=3)
    out = tmp_path / "merged.pdf"

    result = merge_pdfs([a, b], out)

    with pikepdf.open(result.output_path) as merged:
        assert len(merged.pages) == 5


def test_merge_requires_at_least_two_inputs(tmp_path):
    a = make_pdf(tmp_path / "a.pdf", num_pages=1)
    with pytest.raises(ValueError):
        merge_pdfs([a], tmp_path / "out.pdf")


def test_split_produces_correct_page_ranges(tmp_path):
    src = make_pdf(tmp_path / "src.pdf", num_pages=6)
    out_dir = tmp_path / "out"
    out_dir.mkdir()

    outputs = split_pdf(src, [[1, 2], [3, 6]], out_dir, "part")

    assert len(outputs) == 2
    with pikepdf.open(outputs[0]) as p1:
        assert len(p1.pages) == 2
    with pikepdf.open(outputs[1]) as p2:
        assert len(p2.pages) == 4


def test_split_rejects_out_of_bounds_range(tmp_path):
    src = make_pdf(tmp_path / "src.pdf", num_pages=3)
    with pytest.raises(ValueError):
        split_pdf(src, [[1, 5]], tmp_path, "part")


def test_reorder_changes_page_order(tmp_path):
    src = tmp_path / "src.pdf"
    pdf = pikepdf.new()
    for i in range(3):
        page = pdf.add_blank_page(page_size=(200, 300))
        page.obj["/PdfToolkitTestTag"] = i + 1  # tag pages so we can tell them apart after reorder
    pdf.save(src)
    pdf.close()

    out = tmp_path / "reordered.pdf"
    reorder_pdf(src, [3, 1, 2], out)

    with pikepdf.open(out) as result:
        tags = [int(p.obj["/PdfToolkitTestTag"]) for p in result.pages]
        assert tags == [3, 1, 2]


def test_reorder_rejects_incomplete_permutation(tmp_path):
    src = make_pdf(tmp_path / "src.pdf", num_pages=3)
    with pytest.raises(ValueError):
        reorder_pdf(src, [1, 2], tmp_path / "out.pdf")


def test_rotate_all_pages(tmp_path):
    src = make_pdf(tmp_path / "src.pdf", num_pages=2)
    out = tmp_path / "rotated.pdf"

    rotate_pdf(src, 90, None, out)

    with pikepdf.open(out) as result:
        for page in result.pages:
            assert int(page.obj.get("/Rotate", 0)) % 360 == 90


def test_rotate_single_page_only(tmp_path):
    src = make_pdf(tmp_path / "src.pdf", num_pages=2)
    out = tmp_path / "rotated.pdf"

    rotate_pdf(src, 180, [1], out)

    with pikepdf.open(out) as result:
        assert int(result.pages[0].obj.get("/Rotate", 0)) % 360 == 180
        assert int(result.pages[1].obj.get("/Rotate", 0)) % 360 == 0


def test_rotate_rejects_invalid_angle(tmp_path):
    src = make_pdf(tmp_path / "src.pdf", num_pages=1)
    with pytest.raises(ValueError):
        rotate_pdf(src, 45, None, tmp_path / "out.pdf")


def test_compress_preserves_page_count(tmp_path):
    src = make_pdf(tmp_path / "src.pdf", num_pages=2)
    out = tmp_path / "compressed.pdf"

    result = compress_pdf(src, "low", out)

    with pikepdf.open(result.output_path) as compressed:
        assert len(compressed.pages) == 2
    assert any("recompressed" in w for w in result.warnings)
