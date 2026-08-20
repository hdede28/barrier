FROM python:3.12-slim-bookworm

# System dependencies:
#  - libreoffice: Office-to-PDF conversion (headless)
#  - tesseract-ocr(+eng): OCR text layer
#  - ghostscript: used by ocrmypdf for PDF/A and optimization steps
#  - qpdf: pikepdf's underlying library benefits from qpdf CLI for some workflows
RUN apt-get update && apt-get install -y --no-install-recommends \
        libreoffice \
        tesseract-ocr \
        tesseract-ocr-eng \
        ghostscript \
        qpdf \
        fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

RUN useradd --create-home --uid 1000 appuser \
    && mkdir -p /data/store /data/backups /data/tmp \
    && chown -R appuser:appuser /app /data

USER appuser
ENV DATA_DIR=/data

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
