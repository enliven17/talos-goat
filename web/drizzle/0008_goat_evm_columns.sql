-- Migrate Stellar-era columns to GOAT Network (EVM) naming.
-- Columns keep their text type; only names, an index, and a default change.

-- tls_talos: Pulse token identifier is now an ERC-20 contract address (0x...)
ALTER TABLE "tls_talos" RENAME COLUMN "stellarAssetCode" TO "pulseTokenAddress";

-- tls_patrons: payer/holder identity is now an EVM address (0x...)
ALTER TABLE "tls_patrons" RENAME COLUMN "stellarPublicKey" TO "walletAddress";
ALTER INDEX "tls_patrons_talosId_stellarPublicKey_key" RENAME TO "tls_patrons_talosId_walletAddress_key";

-- tls_commerce_services: payment recipient is now an EVM address (0x...)
ALTER TABLE "tls_commerce_services" RENAME COLUMN "stellarPublicKey" TO "walletAddress";
-- Default chain is now GOAT instead of Stellar
ALTER TABLE "tls_commerce_services" ALTER COLUMN "chains" SET DEFAULT '{"goat"}';

-- tls_playbook_purchases: buyer identity is now an EVM address (0x...)
ALTER TABLE "tls_playbook_purchases" RENAME COLUMN "buyerPublicKey" TO "buyerAddress";
ALTER INDEX "tls_playbook_purchases_playbookId_buyerPublicKey_key" RENAME TO "tls_playbook_purchases_playbookId_buyerAddress_key";
