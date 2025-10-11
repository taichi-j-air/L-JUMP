import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

type GreetingType = "message" | "scenario"

type RequestPayload = {
  greetingType?: GreetingType
  greetingMessage?: string
  scenarioId?: string
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? ""
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""

    if (!supabaseUrl || !serviceKey) {
      console.error("Missing Supabase environment variables")
      return new Response(JSON.stringify({ error: "Configuration error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const authHeader = req.headers.get("Authorization")
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const token = authHeader.replace("Bearer ", "").trim()
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const body = (await req.json()) as RequestPayload
    const rawGreetingType = body.greetingType === "scenario" ? "scenario" : "message"
    const greetingType: GreetingType = rawGreetingType

    const trimmedMessage = (body.greetingMessage ?? "").trim()
    if (greetingType === "message" && !trimmedMessage) {
      return new Response(JSON.stringify({ error: "Greeting message is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    if (greetingType === "message" && trimmedMessage.length > 500) {
      return new Response(JSON.stringify({ error: "Greeting message must be 500 characters or less" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    let scenarioId: string | null = null
    let scenarioInviteCode: string | null = null

    if (greetingType === "scenario") {
      scenarioId = body.scenarioId ?? null
      if (!scenarioId) {
        return new Response(JSON.stringify({ error: "Scenario ID is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        })
      }

      const { data: scenario, error: scenarioError } = await supabase
        .from("step_scenarios")
        .select("id")
        .eq("id", scenarioId)
        .eq("user_id", user.id)
        .maybeSingle()

      if (scenarioError || !scenario) {
        return new Response(JSON.stringify({ error: "Scenario not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        })
      }

      // Try to reuse existing invite code if valid
      const { data: existingSetting } = await supabase
        .from("line_greeting_settings")
        .select("scenario_id, scenario_invite_code")
        .eq("user_id", user.id)
        .maybeSingle()

      if (existingSetting?.scenario_invite_code) {
        const { data: existingInvite } = await supabase
          .from("scenario_invite_codes")
          .select("invite_code, scenario_id, is_active")
          .eq("invite_code", existingSetting.scenario_invite_code)
          .maybeSingle()

        if (
          existingInvite &&
          existingInvite.scenario_id === scenarioId &&
          existingInvite.is_active
        ) {
          scenarioInviteCode = existingInvite.invite_code
        }
      }

      if (!scenarioInviteCode) {
        const { data: generatedCode, error: generateError } = await supabase.rpc("generate_invite_code")
        if (generateError || !generatedCode) {
          console.error("Failed to generate invite code", generateError)
          return new Response(JSON.stringify({ error: "Failed to prepare scenario invite" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          })
        }

        scenarioInviteCode = String(generatedCode)

        const { error: insertInviteError } = await supabase
          .from("scenario_invite_codes")
          .insert({
            user_id: user.id,
            scenario_id: scenarioId,
            invite_code: scenarioInviteCode,
            is_active: true,
            allow_re_registration: true,
            re_registration_action: "allow",
          })

        if (insertInviteError) {
          console.error("Failed to insert scenario invite code", insertInviteError)
          return new Response(JSON.stringify({ error: "Failed to store scenario invite" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          })
        }
      }
    }

    const upsertPayload = {
      user_id: user.id,
      greeting_type: greetingType,
      greeting_message: greetingType === "message" ? trimmedMessage : null,
      scenario_id: greetingType === "scenario" ? scenarioId : null,
      scenario_invite_code: greetingType === "scenario" ? scenarioInviteCode : null,
      updated_at: new Date().toISOString(),
    }

    const { error: upsertError } = await supabase
      .from("line_greeting_settings")
      .upsert(upsertPayload, { onConflict: "user_id" })

    if (upsertError) {
      console.error("Failed to upsert greeting settings", upsertError)
      return new Response(JSON.stringify({ error: "Failed to save greeting settings" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    return new Response(JSON.stringify({ success: true, data: upsertPayload }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (error) {
    console.error("update-line-settings error", error)
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})
