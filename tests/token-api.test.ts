import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import {
  decodeFunctionData,
  encodeFunctionResult,
  erc20Abi,
  multicall3Abi,
} from "viem";
import { mainnet } from "viem/chains";
import { POST } from "../apps/explorer/src/app/api/tokens/route";

function mockRpc(
  t: TestContext,
  proxy: string | undefined,
  failSymbol = false,
) {
  const previous = process.env.NEXT_PUBLIC_RPC_URL;
  if (proxy === undefined) delete process.env.NEXT_PUBLIC_RPC_URL;
  else process.env.NEXT_PUBLIC_RPC_URL = proxy;
  t.after(() => {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_RPC_URL;
    else process.env.NEXT_PUBLIC_RPC_URL = previous;
  });
  const urls: string[] = [];
  let symbolFails = failSymbol;
  t.mock.method(
    globalThis,
    "fetch",
    async (input: string, init: RequestInit) => {
      urls.push(input);
      if (input.startsWith("https://unavailable.example/"))
        return new Response("Unavailable", { status: 503 });
      const body = JSON.parse(init.body as string);
      const decoded = decodeFunctionData({
        abi: multicall3Abi,
        data: body.params[0].data,
      });
      assert.ok(decoded.functionName === "aggregate3");
      const result = encodeFunctionResult({
        abi: multicall3Abi,
        functionName: "aggregate3",
        result: decoded.args[0].map((call) => {
          const { functionName } = decodeFunctionData({
            abi: erc20Abi,
            data: call.callData,
          });
          if (functionName === "symbol" && symbolFails)
            return { success: false, returnData: "0x" as const };
          const returnData =
            functionName === "decimals"
              ? encodeFunctionResult({
                  abi: erc20Abi,
                  functionName: "decimals",
                  result: 6,
                })
              : encodeFunctionResult({
                  abi: erc20Abi,
                  functionName: "symbol",
                  result: "USDC",
                });
          return { success: true, returnData };
        }),
      });
      return Response.json({ jsonrpc: "2.0", id: body.id, result });
    },
  );
  return {
    urls,
    recover: () => {
      symbolFails = false;
    },
  };
}

const lookup = (address: string) =>
  POST(
    new Request("http://localhost/api/tokens", {
      method: "POST",
      body: JSON.stringify({ addresses: [address], chainId: 1 }),
    }),
  );

test("token API uses the chain RPC when deployment has no proxy configured", async (t) => {
  const rpc = mockRpc(t, undefined);
  // Deliberately mixed casing without a checksum must still resolve.
  const address = `0xaA${"a".repeat(38)}`;
  const response = await lookup(address);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), [
    {
      address: address.toLowerCase(),
      decimals: 6,
      name: "USDC",
      symbol: "USDC",
    },
  ]);
  assert.deepEqual(rpc.urls, [mainnet.rpcUrls.default.http[0] + "/"]);
});

test("an unavailable proxy falls back to the public chain RPC", async (t) => {
  const rpc = mockRpc(t, "https://unavailable.example/");
  const response = await lookup(`0x${"b".repeat(40)}`);
  assert.equal((await response.json())[0].symbol, "USDC");
  assert.equal(rpc.urls.length, 2);
  assert.match(rpc.urls[0], /unavailable.example\/rpc\?chainId=1/);
  assert.equal(rpc.urls[1], mainnet.rpcUrls.default.http[0] + "/");
});

test("the API retries partial metadata and caches only a resolved symbol", async (t) => {
  const rpc = mockRpc(t, "", true);
  const address = `0x${"c".repeat(40)}`;
  assert.equal((await (await lookup(address)).json())[0].symbol, "");
  rpc.recover();
  assert.equal((await (await lookup(address)).json())[0].symbol, "USDC");
  assert.equal(rpc.urls.length, 2);
  assert.equal((await (await lookup(address)).json())[0].symbol, "USDC");
  assert.equal(
    rpc.urls.length,
    2,
    "resolved metadata should reuse the server cache",
  );
});
