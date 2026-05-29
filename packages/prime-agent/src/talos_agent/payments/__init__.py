"""Payment proxies for the Prime Agent (GOAT Network)."""

from talos_agent.payments.goat_kit import GoatKit
from talos_agent.payments.x402_signer import X402Signer

__all__ = ["GoatKit", "X402Signer"]
