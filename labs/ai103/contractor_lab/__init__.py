"""AI-103 contractor pre-check lab: read-only agent, Nova drafts, email triage, media evidence and tracing.

Standard library only. Every exercise runs offline against fictional fixtures (mock), and the agent,
Nova and photo exercises can also run live against the local Docker stack. Azure adapters are opt-in
configuration only; nothing here calls a paid service unless explicitly enabled (see cloud.py).
"""
import os
from pathlib import Path

LAB_ROOT = Path(__file__).resolve().parents[1]
# Inside a throw-away container only labs/ai103 is mounted, so the repository root may not exist.
REPO_ROOT = LAB_ROOT.parents[1] if len(LAB_ROOT.parents) > 1 else LAB_ROOT
FIXTURES = LAB_ROOT / "fixtures"
DOSSIER = REPO_ROOT / "services/credit-api/src/main/resources/contractor-dossier"
OUTPUT = Path(os.environ.get("AI103_OUTPUT", REPO_ROOT / ".local/ai103"))
