"""The privacy page and the App Privacy answers must say what the app records (activity logging spec §7)."""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PAGE = (ROOT / "site/public/privacy/index.html").read_text()
ASC = (ROOT / "docs/APP_STORE_CONNECT.md").read_text()


def test_privacy_page_mentions_usage_records():
    for phrase in ("Usage records", "180 days", "400 days", "14 days", "never your photos"):
        assert phrase in PAGE, phrase


def test_app_privacy_answers_declare_usage_data():
    assert "| Usage Data → Product Interaction | yes | yes | no | Analytics, App Functionality |" in ASC
    assert "| Diagnostics → Other Diagnostic Data | yes | yes | no | App Functionality |" in ASC
    assert "no analytics" not in ASC
