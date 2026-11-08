"""Token acquisition for Azure data-plane calls. Uses the official azure-identity library.

In Azure the expected credential is a user-assigned or system-assigned Managed Identity with a
resource-scoped role. Locally, DefaultAzureCredential may use a developer sign-in. No API key is read.
Tokens are returned to the caller and never logged here.
"""

from __future__ import annotations

from collections.abc import Callable


def default_token_provider(scope: str) -> Callable[[], str]:
    from azure.identity import DefaultAzureCredential  # imported lazily: mock mode does not need it

    credential = DefaultAzureCredential(exclude_interactive_browser_credential=True)

    def token() -> str:
        return credential.get_token(scope).token

    return token
