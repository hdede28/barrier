"""One end-to-end happy path exercised through the real HTTP API:

upload two PDFs -> merge them -> download the result -> confirm the
returned bytes hash matches what was recorded in the append-only event log.
"""
from __future__ import annotations

import hashlib

from .factory import make_pdf


def _upload(client, path, title):
    with open(path, "rb") as f:
        resp = client.post(
            "/api/documents",
            files={"file": (path.name, f, "application/pdf")},
            data={"title": title},
        )
    assert resp.status_code == 201, resp.text
    return resp.json()


def test_upload_merge_download_happy_path(client, tmp_path):
    a_path = make_pdf(tmp_path / "a.pdf", num_pages=2)
    b_path = make_pdf(tmp_path / "b.pdf", num_pages=3)

    doc_a = _upload(client, a_path, "Document A")
    doc_b = _upload(client, b_path, "Document B")

    merge_resp = client.post(
        "/api/operations/merge",
        json={
            "title": "Merged Result",
            "items": [
                {"document_id": doc_a["id"], "version_id": doc_a["versions"][0]["id"]},
                {"document_id": doc_b["id"], "version_id": doc_b["versions"][0]["id"]},
            ],
        },
    )
    assert merge_resp.status_code == 201, merge_resp.text
    merged_version = merge_resp.json()

    merged_doc_id = None
    for doc in client.get("/api/documents").json():
        if doc["latest_operation"] == "merge":
            merged_doc_id = doc["id"]
    assert merged_doc_id is not None

    download_resp = client.get(
        f"/api/documents/{merged_doc_id}/versions/{merged_version['id']}/download"
    )
    assert download_resp.status_code == 200
    actual_hash = hashlib.sha256(download_resp.content).hexdigest()
    assert actual_hash == merged_version["sha256"]

    import pikepdf
    import io

    with pikepdf.open(io.BytesIO(download_resp.content)) as merged_pdf:
        assert len(merged_pdf.pages) == 5

    events = client.get("/api/events", params={"document_id": merged_doc_id}).json()
    event_types = {e["event_type"] for e in events}
    assert "document.created_by_merge" in event_types
    assert any(e["sha256"] == merged_version["sha256"] for e in events)

    download_events = client.get("/api/events", params={"document_id": merged_doc_id}).json()
    assert any(e["event_type"] == "document.download" for e in download_events)
