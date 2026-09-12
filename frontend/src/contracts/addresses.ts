// VeloxSwap contract addresses on Arc Testnet
// Existing Mock USDC, ARCG and legacy pool remain unchanged.
export const CONTRACT_ADDRESSES = {
  // Existing Mock USDC (6 decimals)
  USDC: "0xf8f9e5ba0077a77b07d5c5a35473da74a09b885f" as `0x${string}`,

  // Existing Mock ARCG (18 decimals)
  ARCG: "0x19a5e533c6c27c382a9df2d52422d3f085647ed0" as `0x${string}`,

  // Existing Mock USDC / ARCG pool — unchanged
  POOL: "0xe9833bd6eae7597c6a070cfe39e1cd800b412370" as `0x${string}`,

  // Existing VXC reward token — unchanged
  VXC: "0xf542343b99f2fefee497686b971710d140b300d2" as `0x${string}`,

  // Existing vUSDC staking contract — unchanged
  STAKING: "0xf7b779109921c0f23e04c954f7a2893c8b8006a8" as `0x${string}`,

  // Official Arc Testnet tokens
  OFFICIAL_USDC: "0x3600000000000000000000000000000000000000" as `0x${string}`,
  EURC: "0x89b50855aa3be2f677cd6303cec089b5f319d72a" as `0x${string}`,
  CIRBTC: "0xf0c4a4ce82a5746abaad9425360ab04fbba432bf" as `0x${string}`,

  // Official token pair pools
  USDC_EURC_POOL: "0xf83bba46720c9ba165e85b73dd9f440859bc019a" as `0x${string}`,
 CIRBTC_USDC_POOL: "0x2f36d189cd6b1fcb2092351d8fa1b77c548ade10" as `0x${string}`,
} as const;
