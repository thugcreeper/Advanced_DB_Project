"""Send one failure email via Gmail SMTP; never include database config or logs."""

from email.message import EmailMessage
import os
import smtplib
import ssl
import sys


def main():
    username = os.environ.get("SMTP_USERNAME", "").strip()
    password = os.environ.get("SMTP_PASSWORD", "")
    recipient = os.environ.get("NOTIFY_TO", "").strip()
    if not username or not password or not recipient:
        print("Failure email not sent: configure SMTP_USERNAME and SMTP_PASSWORD Secrets.", file=sys.stderr)
        return 1
    try:
        server_url = os.environ.get("GITHUB_SERVER_URL", "https://github.com").rstrip("/")
        repository = os.environ.get("GITHUB_REPOSITORY", "")
        run_id = os.environ.get("GITHUB_RUN_ID", "")
        run_url = f"{server_url}/{repository}/actions/runs/{run_id}"
        message = EmailMessage()
        message["Subject"] = "[AuraDB] Daily read check failed"
        message["From"] = username
        message["To"] = recipient
        message.set_content(
            "Aura daily read check failed.\n\n"
            "Check the workflow result, repository Secrets, and Aura Console status.\n"
            "A paused instance needs to be resumed separately.\n"
            "No database writes or automatic restore were performed.\n\n"
            f"Workflow run: {run_url}\n"
        )
        with smtplib.SMTP_SSL("smtp.gmail.com", 465, timeout=20, context=ssl.create_default_context()) as smtp:
            smtp.login(username, password)
            smtp.send_message(message)
        print("Failure notification email sent.")
        return 0
    except Exception:
        # Do not print authentication errors, server replies, or credentials.
        print("Failure email could not be sent. Check Gmail app password and SMTP access.", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
