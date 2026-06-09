"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useSendTransaction, useWriteContract, usePublicClient } from "wagmi";
import { getAddress, parseEther, parseUnits } from "viem";
import { useWallet } from "@/components/wallet-gate";
import { PAYMENT_TOKEN_ADDRESS, ERC20_ABI } from "@/lib/contracts";
import type { TalosDetail } from "@/lib/types";
import { type Tab } from "./_components/tabs";
import { AgentHeader } from "./_components/agent-header";
import { OverviewTab } from "./_components/overview-tab";
import { ServicesTab } from "./_components/services-tab";
import { ActivityTab } from "./_components/activity-tab";
import { PatronsTab } from "./_components/patrons-tab";
import { RevenueTab } from "./_components/revenue-tab";
import { GovernanceTab } from "./_components/governance-tab";
import { AgentTab } from "./_components/agent-tab";
import { BuyTokenModal } from "./_components/buy-token-modal";
import { ServiceRequestModal } from "./_components/service-request-modal";

export function TalosDetailClient({ talos }: { talos: TalosDetail }) {
  const [tab, setTab] = useState<Tab>("Overview");
  const [patronStatus, setPatronStatus] = useState<"none" | "loading" | "patron">("none");
  const { isConnected, connect, address } = useWallet();
  const { sendTransactionAsync } = useSendTransaction();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();

  // Treasury / operator EVM address that receives payments when an agent
  // hasn't set its own wallet address.
  const OPERATOR_ADDRESS =
    process.env.NEXT_PUBLIC_TALOS_OPERATOR_ADDRESS ??
    "0x0000000000000000000000000000000000000000";

  /**
   * Settle a USDC-denominated payment on GOAT and return the tx hash.
   * Uses the configured ERC-20 payment token when set; otherwise falls back
   * to a native BTC transfer (amount treated as a whole-unit value).
   */
  const payOnChain = useCallback(
    async (recipient: string, usdcAmount: number): Promise<string> => {
      if (!publicClient) throw new Error("RPC client unavailable");
      const to = getAddress(recipient);
      let hash: `0x${string}`;
      if (PAYMENT_TOKEN_ADDRESS) {
        hash = await writeContractAsync({
          address: getAddress(PAYMENT_TOKEN_ADDRESS),
          abi: ERC20_ABI,
          functionName: "transfer",
          // USDC uses 6 decimals.
          args: [to, parseUnits(usdcAmount.toFixed(6), 6)],
        });
      } else {
        hash = await sendTransactionAsync({
          to,
          value: parseEther(usdcAmount.toString()),
        });
      }
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") throw new Error("Payment transaction reverted");
      return hash;
    },
    [publicClient, writeContractAsync, sendTransactionAsync],
  );

  const minRequired = talos.minPatronPulse ?? Math.floor(talos.totalSupply * 0.001);

  const isPatron = talos.patrons.some(
    (p) => p.walletAddress === address && p.status === "active"
  );

  const [myPulseBalance, setPulseBalance] = useState(0);

  useEffect(() => {
    if (!address) return;
    // Look up patron pulse balance from DB data
    const dbAmount = talos.patrons.find((p) => p.walletAddress === address)?.pulseAmount ?? 0;
    setPulseBalance(dbAmount);
  }, [address, talos.patrons]);

  const meetsThreshold = myPulseBalance >= minRequired;

  const handleBecomePatron = useCallback(async () => {
    if (!address || isPatron) return;
    setPatronStatus("loading");
    try {
      const res = await fetch(`/api/talos/${talos.id}/patrons`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress: address, pulseAmount: myPulseBalance }),
      });
      if (res.ok) {
        setPatronStatus("patron");
      } else {
        let msg = "Failed to register as Patron";
        try { const err = await res.json(); msg = err.error || msg; } catch { /* non-JSON response */ }
        alert(msg);
        setPatronStatus("none");
      }
    } catch {
      alert("Network error. Please try again.");
      setPatronStatus("none");
    }
  }, [address, talos.id, isPatron, myPulseBalance]);

  // ─── Buy Token modal state ──────────────────────────
  const [buyOpen, setBuyOpen] = useState(false);
  const [buyAmount, setBuyAmount] = useState("");
  const [buyStatus, setBuyStatus] = useState<"idle" | "buying" | "success" | "error">("idle");
  const [buyResult, setBuyResult] = useState<{ txHash: string; message: string } | null>(null);
  const buyInputRef = useRef<HTMLInputElement>(null);

  // ─── Service Request modal state ─────────────────────
  const [serviceOpen, setServiceOpen] = useState(false);
  const [servicePayload, setServicePayload] = useState("");
  const [serviceStatus, setServiceStatus] = useState<"idle" | "paying" | "success" | "error">("idle");
  const [serviceResult, setServiceResult] = useState<{ jobId: string; txHash: string; result?: Record<string, unknown>; status?: string } | null>(null);

  const handleRequestService = useCallback(async () => {
    if (!address || !talos.service) return;
    setServiceStatus("paying");
    try {
      const recipient =
        talos.service.walletAddress || talos.agentWalletAddress || OPERATOR_ADDRESS;

      // Pay the service fee on-chain (GOAT), then submit the tx hash to the server.
      const txHash = await payOnChain(recipient, Number(talos.service.price));

      let payload: Record<string, unknown> = {};
      try { payload = servicePayload.trim() ? JSON.parse(servicePayload) : {}; } catch { payload = { request: servicePayload }; }

      // Server records the job against the on-chain payment hash.
      const res = await fetch(`/api/talos/${talos.id}/jobs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ buyerPublicKey: address, txHash, payload }),
      });
      const data = await res.json();
      if (res.ok) {
        setServiceResult({ jobId: data.jobId, txHash: data.txHash ?? txHash, result: data.result, status: data.status });
        setServiceStatus("success");
      } else {
        alert(data.error || "Job creation failed");
        setServiceStatus("error");
      }
    } catch (err: unknown) {
      console.error("[request-service]", err);
      const msg = err instanceof Error ? err.message : "Transaction failed";
      alert(msg);
      setServiceStatus("error");
    }
  }, [address, talos.id, talos.service, talos.agentWalletAddress, servicePayload, payOnChain, OPERATOR_ADDRESS]);

  // ─── Governance (approvals) state ────────────────────
  const [approvals, setApprovals] = useState<{
    id: string; type: string; title: string; description: string | null;
    amount: string | null; status: string; decidedBy: string | null;
    createdAt: string;
  }[]>([]);
  const [approvalsLoaded, setApprovalsLoaded] = useState(false);
  const [proposeOpen, setProposeOpen] = useState(false);
  const [proposeForm, setProposeForm] = useState({ type: "strategy", title: "", description: "", amount: "" });
  const [proposeLoading, setProposeLoading] = useState(false);

  const loadApprovals = useCallback(async () => {
    const res = await fetch(`/api/talos/${talos.id}/approvals`);
    if (res.ok) { setApprovals(await res.json()); setApprovalsLoaded(true); }
  }, [talos.id]);

  const handleVote = useCallback(async (approvalId: string, decision: "approved" | "rejected") => {
    if (!address) return;
    const res = await fetch(`/api/talos/${talos.id}/approvals/${approvalId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: decision, decidedBy: address }),
    });
    const data = await res.json();
    if (res.ok) {
      setApprovals(prev => prev.map(a => a.id === approvalId ? { ...a, status: decision, decidedBy: address } : a));
    } else {
      alert(data.error || "Vote failed");
    }
  }, [address, talos.id]);

  const handlePropose = useCallback(async () => {
    if (!address || !proposeForm.title) return;
    setProposeLoading(true);
    try {
      const res = await fetch(`/api/talos/${talos.id}/approvals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...proposeForm,
          amount: proposeForm.amount ? Number(proposeForm.amount) : undefined,
          proposerPublicKey: address,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setApprovals(prev => [data, ...prev]);
        setProposeOpen(false);
        setProposeForm({ type: "strategy", title: "", description: "", amount: "" });
      } else {
        alert(data.error || "Proposal failed");
      }
    } finally {
      setProposeLoading(false);
    }
  }, [address, talos.id, proposeForm]);

  // ─── Revenue distribution state ──────────────────────
  const [distLoading, setDistLoading] = useState(false);
  const [distPreview, setDistPreview] = useState<{
    totalRevenue: number;
    distributableAmount: number;
    investorSharePercent: number;
    breakdown: { walletAddress: string; pulseAmount: number; sharePercent: string; estimatedUsdc: string }[];
  } | null>(null);

  // ─── Buyback state ───────────────────────────────────
  const [buybackPreview, setBuybackPreview] = useState<{
    totalRevenue: number; treasuryBalance: number; treasurySharePercent: number;
    totalBuybackExecuted: number; operatorMitosBalance: number; circulatingSupply: number;
  } | null>(null);
  const [buybackLoading, setBuybackLoading] = useState(false);
  const [buybackForm, setBuybackForm] = useState({ usdcAmount: "", mitosAmount: "" });

  const loadBuybackPreview = useCallback(async () => {
    const res = await fetch(`/api/talos/${talos.id}/revenue/buyback`);
    if (res.ok) setBuybackPreview(await res.json());
  }, [talos.id]);

  const handleBuyback = useCallback(async () => {
    if (!address) return;
    setBuybackLoading(true);
    try {
      const res = await fetch(`/api/talos/${talos.id}/revenue/buyback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requesterPublicKey: address,
          usdcAmount: Number(buybackForm.usdcAmount),
          mitosAmount: Number(buybackForm.mitosAmount),
        }),
      });
      const data = await res.json();
      if (res.ok) { alert(data.message); loadBuybackPreview(); }
      else alert(data.error || "Buyback failed");
    } finally {
      setBuybackLoading(false);
    }
  }, [address, talos.id, buybackForm, loadBuybackPreview]);

  const loadDistPreview = useCallback(async () => {
    const res = await fetch(`/api/talos/${talos.id}/revenue/distribute`);
    if (res.ok) setDistPreview(await res.json());
  }, [talos.id]);

  const handleDistribute = useCallback(async () => {
    if (!address) return;
    setDistLoading(true);
    try {
      const res = await fetch(`/api/talos/${talos.id}/revenue/distribute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requesterPublicKey: address }),
      });
      const data = await res.json();
      if (res.ok) {
        alert(`Distributed! ${data.message}`);
        loadDistPreview();
      } else {
        alert(data.error || "Distribution failed");
      }
    } finally {
      setDistLoading(false);
    }
  }, [address, talos.id, loadDistPreview]);

  const priceNum = parseFloat(talos.pulsePrice.replace("$", "")) || 0;
  const buyQty = Math.max(0, parseInt(buyAmount, 10) || 0);
  const buyCost = Math.round(buyQty * priceNum * 100) / 100;

  const handleBuyToken = useCallback(async () => {
    if (!address || buyQty <= 0) return;
    setBuyStatus("buying");
    try {
      // Payment goes to the agent treasury (agentWalletAddress) or the operator.
      const recipient = talos.agentWalletAddress ?? OPERATOR_ADDRESS;

      // ── Pay the USDC cost on-chain (GOAT) ──────────────────────────
      const txHash = await payOnChain(recipient, buyCost);

      // ── Record in DB (server credits Mitos to the buyer) ───────────
      const res = await fetch(`/api/talos/${talos.id}/buy-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ buyerPublicKey: address, amount: buyQty, txHash }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setBuyResult({ txHash, message: data.message });
        setBuyStatus("success");
      } else {
        alert(data.error || "Purchase failed");
        setBuyStatus("error");
      }
    } catch (err: unknown) {
      console.error("[buy-token]", err);
      const msg = err instanceof Error ? err.message : "Transaction failed";
      alert(msg);
      setBuyStatus("error");
    }
  }, [address, buyQty, buyCost, talos.id, talos.agentWalletAddress, payOnChain, OPERATOR_ADDRESS]);

  const closeBuyModal = useCallback(() => {
    setBuyOpen(false);
    setBuyAmount("");
    setBuyStatus("idle");
    setBuyResult(null);
  }, []);

  const openBuyModal = () => { setBuyOpen(true); setTimeout(() => buyInputRef.current?.focus(), 100); };
  const openServiceModal = () => { setServiceOpen(true); setServiceStatus("idle"); setServiceResult(null); };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-12">
      <AgentHeader
        talos={talos}
        tab={tab}
        setTab={setTab}
        isConnected={isConnected}
        connect={connect}
        isPatron={isPatron}
        patronStatus={patronStatus}
        meetsThreshold={meetsThreshold}
        minRequired={minRequired}
        handleBecomePatron={handleBecomePatron}
        openBuyModal={openBuyModal}
      />

      {tab === "Overview" && (
        <OverviewTab talos={talos} setTab={setTab} minRequired={minRequired} />
      )}

      {tab === "Services" && (
        <ServicesTab talos={talos} isConnected={isConnected} connect={connect} openServiceModal={openServiceModal} />
      )}

      {tab === "Activity" && <ActivityTab talos={talos} />}

      {tab === "Patrons" && (
        <PatronsTab talos={talos} isConnected={isConnected} address={address} minRequired={minRequired} openBuyModal={openBuyModal} />
      )}

      {tab === "Revenue" && (
        <RevenueTab
          talos={talos}
          address={address}
          isConnected={isConnected}
          distPreview={distPreview}
          distLoading={distLoading}
          loadDistPreview={loadDistPreview}
          handleDistribute={handleDistribute}
        />
      )}

      {tab === "Governance" && (
        <GovernanceTab
          talos={talos}
          isConnected={isConnected}
          isPatron={isPatron}
          patronStatus={patronStatus}
          approvals={approvals}
          approvalsLoaded={approvalsLoaded}
          loadApprovals={loadApprovals}
          handleVote={handleVote}
          proposeOpen={proposeOpen}
          setProposeOpen={setProposeOpen}
          proposeForm={proposeForm}
          setProposeForm={setProposeForm}
          proposeLoading={proposeLoading}
          handlePropose={handlePropose}
          buybackPreview={buybackPreview}
          buybackLoading={buybackLoading}
          buybackForm={buybackForm}
          setBuybackForm={setBuybackForm}
          loadBuybackPreview={loadBuybackPreview}
          handleBuyback={handleBuyback}
        />
      )}

      {tab === "Agent" && <AgentTab talos={talos} />}

      {/* ─── Buy Token Modal ──────────────────────────────── */}
      {buyOpen && (
        <BuyTokenModal
          talos={talos}
          buyInputRef={buyInputRef}
          buyAmount={buyAmount}
          setBuyAmount={setBuyAmount}
          buyQty={buyQty}
          buyCost={buyCost}
          buyStatus={buyStatus}
          buyResult={buyResult}
          handleBuyToken={handleBuyToken}
          closeBuyModal={closeBuyModal}
        />
      )}

      {/* ─── Service Request Modal ────────────────────────── */}
      {serviceOpen && talos.service && (
        <ServiceRequestModal
          talos={talos}
          setServiceOpen={setServiceOpen}
          serviceStatus={serviceStatus}
          serviceResult={serviceResult}
          servicePayload={servicePayload}
          setServicePayload={setServicePayload}
          handleRequestService={handleRequestService}
        />
      )}
    </div>
  );
}
