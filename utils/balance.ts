import { createPublicClient, http, formatEther, formatUnits } from "viem";
import { mainnet, arbitrum } from "viem/chains";
import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { USDT_ADDRESSES } from "@/utils/payment";

// --- Singleton viem clients ---
const ethClient = createPublicClient({
  chain: mainnet,
  transport: http("https://eth.llamarpc.com"),
});

const arbClient = createPublicClient({
  chain: arbitrum,
  transport: http("https://arb1.arbitrum.io/rpc"),
});

const clientMap = {
  ethereum: ethClient,
  arbitrum: arbClient,
} as const;

// ERC-20 balanceOf ABI (minimal)
const ERC20_BALANCE_ABI = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

// --- EVM native balance (ETH) ---
export async function fetchEvmBalance(
  address: string,
  network: "ethereum" | "arbitrum"
): Promise<string> {
  try {
    const client = clientMap[network];
    const balance = await client.getBalance({
      address: address as `0x${string}`,
    });
    return formatEther(balance);
  } catch {
    return "0";
  }
}

// --- EVM USDT balance (ERC-20, 6 decimals) ---
export async function fetchEvmUsdtBalance(
  address: string,
  network: "ethereum" | "arbitrum"
): Promise<string> {
  try {
    const client = clientMap[network];
    const balance = await client.readContract({
      address: USDT_ADDRESSES[network] as `0x${string}`,
      abi: ERC20_BALANCE_ABI,
      functionName: "balanceOf",
      args: [address as `0x${string}`],
    });
    return formatUnits(balance as bigint, 6);
  } catch {
    return "0";
  }
}

// --- Solana SOL balance ---
export async function fetchSolBalance(address: string): Promise<string> {
  try {
    const connection = new Connection(
      "https://api.mainnet-beta.solana.com",
      "confirmed"
    );
    const pubkey = new PublicKey(address);
    const balance = await connection.getBalance(pubkey);
    return (balance / LAMPORTS_PER_SOL).toString();
  } catch {
    return "0";
  }
}

// --- Solana USDT balance (SPL Token via ATA) ---
export async function fetchSolanaUsdtBalance(
  address: string
): Promise<string> {
  try {
    const connection = new Connection(
      "https://api.mainnet-beta.solana.com",
      "confirmed"
    );
    const ownerPubkey = new PublicKey(address);
    const mintPubkey = new PublicKey(USDT_ADDRESSES.solana);
    const TOKEN_PROGRAM_ID = new PublicKey(
      "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
    );
    const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey(
      "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
    );

    // Derive ATA address
    const [ata] = PublicKey.findProgramAddressSync(
      [
        ownerPubkey.toBuffer(),
        TOKEN_PROGRAM_ID.toBuffer(),
        mintPubkey.toBuffer(),
      ],
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    const accountInfo = await connection.getAccountInfo(ata);
    if (!accountInfo || accountInfo.data.length < 72) return "0";

    // SPL Token account layout: offset 64 = amount (u64 LE)
    const amount = accountInfo.data.readBigUInt64LE(64);
    // USDT on Solana = 6 decimals
    const value = Number(amount) / 1e6;
    return value.toString();
  } catch {
    return "0";
  }
}
