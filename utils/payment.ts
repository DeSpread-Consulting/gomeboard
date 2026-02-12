import { encodeFunctionData, parseUnits } from "viem";
import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";

// --- Network Types & Constants ---
export type PaymentNetwork = "ethereum" | "arbitrum" | "solana";

export const USDT_ADDRESSES: Record<PaymentNetwork, string> = {
  ethereum: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
  arbitrum: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
  solana: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenEuw",
};

export const CHAIN_IDS: Record<string, number> = {
  ethereum: 1,
  arbitrum: 42161,
};

export const EXPLORER_URLS: Record<PaymentNetwork, string> = {
  ethereum: "https://etherscan.io/tx/",
  arbitrum: "https://arbiscan.io/tx/",
  solana: "https://solscan.io/tx/",
};

export const NETWORK_LABELS: Record<PaymentNetwork, string> = {
  ethereum: "Ethereum",
  arbitrum: "Arbitrum",
  solana: "Solana",
};

// USDT decimals per network
const USDT_DECIMALS: Record<PaymentNetwork, number> = {
  ethereum: 6,
  arbitrum: 6,
  solana: 6,
};

// ERC-20 transfer ABI (minimal)
const ERC20_TRANSFER_ABI = [
  {
    name: "transfer",
    type: "function",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

// SPL Token Program ID
const TOKEN_PROGRAM_ID = new PublicKey(
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
);

// --- Address Validation ---
export function isEvmAddress(addr: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(addr);
}

export function isSolanaAddress(addr: string): boolean {
  if (addr.startsWith("0x")) return false;
  if (addr.length < 32 || addr.length > 44) return false;
  // Base58 character set check
  return /^[1-9A-HJ-NP-Za-km-z]+$/.test(addr);
}

export function getAvailableNetworks(addr: string): PaymentNetwork[] {
  if (!addr) return [];
  if (isEvmAddress(addr)) return ["ethereum", "arbitrum"];
  if (isSolanaAddress(addr)) return ["solana"];
  return [];
}

// --- EVM: ERC-20 Transfer Encoding ---
export function encodeERC20Transfer(
  to: string,
  amount: number
): `0x${string}` {
  const parsedAmount = parseUnits(amount.toString(), 6); // USDT = 6 decimals
  return encodeFunctionData({
    abi: ERC20_TRANSFER_ABI,
    functionName: "transfer",
    args: [to as `0x${string}`, parsedAmount],
  });
}

// --- Solana: SPL Token Transfer Transaction ---
export async function buildSolanaTransferTx(
  fromWalletAddress: string,
  toAddress: string,
  amount: number,
  rpcUrl: string = "https://api.mainnet-beta.solana.com"
): Promise<Uint8Array> {
  const connection = new Connection(rpcUrl, "confirmed");
  const fromPubkey = new PublicKey(fromWalletAddress);
  const toPubkey = new PublicKey(toAddress);
  const mintPubkey = new PublicKey(USDT_ADDRESSES.solana);

  // Derive associated token accounts
  const fromAta = await getAssociatedTokenAddress(mintPubkey, fromPubkey);
  const toAta = await getAssociatedTokenAddress(mintPubkey, toPubkey);

  const transaction = new Transaction();

  // Check if destination ATA exists; if not, create it
  const toAtaInfo = await connection.getAccountInfo(toAta);
  if (!toAtaInfo) {
    transaction.add(
      createAssociatedTokenAccountInstruction(
        fromPubkey, // payer
        toAta, // associated token account
        toPubkey, // owner
        mintPubkey // mint
      )
    );
  }

  // SPL Token transfer instruction
  const amountInSmallestUnit = BigInt(Math.round(amount * 1e6)); // 6 decimals
  transaction.add(
    createTransferInstruction(fromAta, toAta, fromPubkey, amountInSmallestUnit)
  );

  // Set recent blockhash
  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash("confirmed");
  transaction.recentBlockhash = blockhash;
  transaction.lastValidBlockHeight = lastValidBlockHeight;
  transaction.feePayer = fromPubkey;

  return transaction.serialize({ requireAllSignatures: false });
}

// --- SPL Token Helper Functions (inline to avoid extra deps) ---

const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey(
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
);

async function getAssociatedTokenAddress(
  mint: PublicKey,
  owner: PublicKey
): Promise<PublicKey> {
  const [address] = PublicKey.findProgramAddressSync(
    [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID
  );
  return address;
}

function createAssociatedTokenAccountInstruction(
  payer: PublicKey,
  associatedToken: PublicKey,
  owner: PublicKey,
  mint: PublicKey
): TransactionInstruction {
  return new TransactionInstruction({
    keys: [
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: associatedToken, isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: false, isWritable: false },
      { pubkey: mint, isSigner: false, isWritable: false },
      {
        pubkey: new PublicKey("11111111111111111111111111111111"),
        isSigner: false,
        isWritable: false,
      },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    programId: ASSOCIATED_TOKEN_PROGRAM_ID,
    data: Buffer.alloc(0),
  });
}

function createTransferInstruction(
  source: PublicKey,
  destination: PublicKey,
  owner: PublicKey,
  amount: bigint
): TransactionInstruction {
  // SPL Token Transfer instruction layout: instruction index (1 byte) = 3, amount (8 bytes LE)
  const data = Buffer.alloc(9);
  data.writeUInt8(3, 0); // Transfer instruction index
  data.writeBigUInt64LE(amount, 1);

  return new TransactionInstruction({
    keys: [
      { pubkey: source, isSigner: false, isWritable: true },
      { pubkey: destination, isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: true, isWritable: false },
    ],
    programId: TOKEN_PROGRAM_ID,
    data,
  });
}
