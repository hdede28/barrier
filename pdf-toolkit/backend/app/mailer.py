"""Optional SMTP delivery for signature invitations.

If SMTP is not configured, invitations still work: a local link is created
and the caller is expected to share it out-of-band. Every attempt -- sent,
skipped, or failed -- is recorded by the caller as an event with an explicit
delivery outcome so nothing about notification delivery is silent.
"""
from __future__ import annotations

import smtplib
from email.message import EmailMessage

from .config import get_settings

settings = get_settings()


def send_invite_email(to_email: str, subject: str, body: str) -> tuple[bool, str]:
    """Returns (sent, outcome_code)."""
    if not settings.smtp_host:
        return False, "smtp_not_configured"

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = settings.smtp_from
    msg["To"] = to_email
    msg.set_content(body)

    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as server:
            server.starttls()
            if settings.smtp_user and settings.smtp_password:
                server.login(settings.smtp_user, settings.smtp_password)
            server.send_message(msg)
        return True, "sent"
    except Exception:
        return False, "smtp_send_failed"
