from __future__ import annotations

import os
import shutil
from pathlib import Path

import pytest

TEST_DATA_DIR = Path(__file__).parent / "_test_data"

os.environ.setdefault(
    "DATABASE_URL", "postgresql+psycopg://pdftoolkit:pdftoolkit@localhost:5432/pdftoolkit_test"
)
os.environ["DATA_DIR"] = str(TEST_DATA_DIR)

from app.db import Base, engine  # noqa: E402
from app.main import app  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402


@pytest.fixture(autouse=True)
def _clean_state():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    if TEST_DATA_DIR.exists():
        shutil.rmtree(TEST_DATA_DIR, ignore_errors=True)
    TEST_DATA_DIR.mkdir(parents=True)
    yield
    shutil.rmtree(TEST_DATA_DIR, ignore_errors=True)


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture
def tmp_pdf_dir(tmp_path):
    return tmp_path
