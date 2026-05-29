"""GOAT Network operations — delegates writes to Web API, reads via JSON-RPC.

The Prime Agent never holds private keys. All on-chain write operations
(token transfers, dividends) go through the Talos Web server, which holds
the server-side signing key and submits transactions to GOAT Network.

Read operations (native BTC balance, ERC-20 balances) are performed by the
agent directly against a public GOAT JSON-RPC endpoint (eth_getBalance /
eth_call) — these need no key and keep the proxy thin.

Addresses are EVM-style `0x...` (20 bytes / 40 hex chars). GOAT is an
EVM-compatible Bitcoin L2 whose native gas/value token is BTC.
"""

from __future__ import annotations

import os
from typing import Any

from rich.console import Console

# GOAT JSON-RPC endpoint (public, no key needed for reads).
_RPC_URL = os.getenv("GOAT_RPC_URL", "https://rpc.testnet3.goat.network")

# Native token on GOAT has 18 decimals (EVM wei convention).
_NATIVE_DECIMALS = 18

console = Console()


def _hex_to_int(value: str | int) -> int:
    """Parse an `eth_*` hex-quantity (e.g. '0x1a') into an int."""
    if isinstance(value, int):
        return value
    return int(value, 16)


class GoatKit:
    """Proxy for GOAT Network operations via Talos Web API + JSON-RPC.

    Read operations use a public GOAT JSON-RPC node (no key needed).
    Write operations are forwarded to Web, which handles signing.

    Balance-read approach: we call the standard EVM JSON-RPC methods
    directly (`eth_getBalance` for native BTC, `eth_call` of the ERC-20
    `balanceOf(address)` selector for tokens). This avoids adding a heavy
    web3 dependency — a single httpx POST is enough — and keeps the agent
    a thin proxy that never signs anything.
    """

    def __init__(self, api_client: Any):
        self._api = api_client
        self._initialized = False

    async def initialize(self) -> None:
        if self._initialized:
            return
        self._initialized = True
        console.print("[green]GOAT proxy ready (via Web API + JSON-RPC).[/green]")

    @property
    def available(self) -> bool:
        return self._initialized

    async def _rpc_call(self, method: str, params: list[Any]) -> Any:
        """Make a single JSON-RPC call against the GOAT node."""
        import httpx

        async with httpx.AsyncClient() as client:
            r = await client.post(
                _RPC_URL,
                json={"jsonrpc": "2.0", "id": 1, "method": method, "params": params},
                timeout=20.0,
            )
            if r.status_code != 200:
                raise RuntimeError(f"RPC HTTP {r.status_code}")
            data = r.json()
            if "error" in data:
                raise RuntimeError(data["error"].get("message", "RPC error"))
            return data.get("result")

    async def get_balance(self, address: str = "") -> dict[str, Any]:
        """Query native BTC balance via GOAT JSON-RPC (eth_getBalance)."""
        try:
            talos = await self._api.get_talos(self._api._talos_id)
            acct = address or (talos.get("walletAddress", "") if talos else "")
            if not acct:
                return {"error": "No GOAT wallet address configured"}
            result = await self._rpc_call("eth_getBalance", [acct, "latest"])
            wei = _hex_to_int(result)
            return {
                "balance_btc": wei / (10 ** _NATIVE_DECIMALS),
                "account": acct,
            }
        except Exception as e:
            return {"error": f"Balance query failed: {e}"}

    async def get_token_balance(self, address: str, token: str) -> dict[str, Any]:
        """Query an ERC-20 token balance via GOAT JSON-RPC (eth_call balanceOf).

        `token` is the ERC-20 contract address (0x...). Returns the raw
        integer balance (caller scales by the token's decimals).
        """
        try:
            acct = address.lower().replace("0x", "")
            if len(acct) != 40:
                return {"error": f"Invalid EVM address: {address}"}
            # balanceOf(address) selector = 0x70a08231, arg left-padded to 32 bytes.
            data = "0x70a08231" + acct.rjust(64, "0")
            result = await self._rpc_call(
                "eth_call", [{"to": token, "data": data}, "latest"]
            )
            balance = _hex_to_int(result) if result and result != "0x" else 0
            return {"balance": balance, "token": token, "account": address}
        except Exception as e:
            return {"error": f"Token balance query failed: {e}"}

    async def transfer_btc(self, to_address: str, amount: float) -> dict[str, Any]:
        """Request native BTC transfer via Web API (Web handles signing)."""
        try:
            result = await self._api.request_transfer(
                to_account=to_address, amount=amount, currency="BTC"
            )
            if result and "error" not in result:
                return {"status": "submitted", "to": to_address, "amount": amount}
            return result or {"error": "Transfer request failed"}
        except Exception as e:
            return {"error": f"Transfer failed: {e}"}
