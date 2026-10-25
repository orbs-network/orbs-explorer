import { arbitrum, base, bsc, linea, mainnet, sonic } from "viem/chains";
import { Partners } from "../types";


export const LIQUIDITY_HUB_PARTNER_CHAINS = {
  [Partners.SwapX]: [sonic.id],
  [Partners.Quickswap]: [mainnet.id, base.id],
  [Partners.Spookyswap]: [sonic.id],
  [Partners.Lynex]: [linea.id],
  [Partners.Thena]: [bsc.id],
  [Partners.Arbidex]: [arbitrum.id],
  [Partners.Baseswap]: [base.id],
};