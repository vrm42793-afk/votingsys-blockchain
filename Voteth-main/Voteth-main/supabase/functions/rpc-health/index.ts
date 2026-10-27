// @ts-ignore: Deno import
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
// @ts-ignore: Deno import
import { ethers } from "https://esm.sh/ethers@6.13.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
}

// @ts-ignore: Deno serve callback type
serve(async (req: Request) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Read RPC URL from environment variable
    // @ts-ignore: Deno namespace
    const ALCHEMY_RPC_URL = Deno.env.get('VITE_ALCHEMY_RPC_URL') || "https://rpc-amoy.polygon.technology"
    const provider = new ethers.JsonRpcProvider(ALCHEMY_RPC_URL)

    const startTime = Date.now()
    const blockNumber = await provider.getBlockNumber()
    const latency = Date.now() - startTime

    const network = await provider.getNetwork()
    const chainId = Number(network.chainId)

    const isHealthy = chainId === 80002

    return new Response(
      JSON.stringify({
        status: isHealthy ? 'healthy' : 'degraded',
        chainId,
        blockNumber,
        latency,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    const err = error as Error
    return new Response(
      JSON.stringify({
        status: 'critical',
        error: err.message,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})
