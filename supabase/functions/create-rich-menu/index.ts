import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '' // Service role key is needed to read secure credentials
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Authentication failed');
    }

    const { richMenuData } = await req.json();
    if (!richMenuData) {
        throw new Error('richMenuData is required.');
    }
    if (!richMenuData.background_image_url) {
        throw new Error('A background image is required to create a rich menu on LINE.');
    }

    // Get LINE credentials
    const { data: credentials } = await supabase
      .from('secure_line_credentials')
      .select('encrypted_value')
      .eq('user_id', user.id)
      .eq('credential_type', 'channel_access_token')
      .single();

    if (!credentials?.encrypted_value) {
      throw new Error('LINE access token not found in the database.');
    }
    const accessToken = credentials.encrypted_value;

    // 1. Create rich menu on LINE API
    const richMenuResponse = await fetch('https://api.line.me/v2/bot/richmenu', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        size: {
          width: richMenuData.size === 'full' ? 2500 : 1200,
          height: richMenuData.size === 'full' ? 1686 : 810
        },
        selected: false,
        name: richMenuData.name,
        chatBarText: richMenuData.chat_bar_text,
        areas: richMenuData.areas || []
      })
    });

    if (!richMenuResponse.ok) {
      const errorText = await richMenuResponse.text();
      throw new Error(`LINE API error during menu creation: ${errorText}`);
    }

    const lineRichMenu = await richMenuResponse.json();
    const lineRichMenuId = lineRichMenu.richMenuId;

    // 2. Upload image to LINE API
    try {
      const imageResponse = await fetch(richMenuData.background_image_url);
      if (!imageResponse.ok) {
        throw new Error(`Failed to fetch image from URL: ${richMenuData.background_image_url}`);
      }
      
      const imageBuffer = await imageResponse.arrayBuffer();
      const uploadResponse = await fetch(`https://api-data.line.me/v2/bot/richmenu/${lineRichMenuId}/content`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'image/png',
        },
        body: imageBuffer
      });

      if (!uploadResponse.ok) {
        const uploadErrorText = await uploadResponse.text();
        throw new Error(`Image upload to LINE failed: ${uploadErrorText}`);
      }
    } catch (imageError) {
      throw new Error(`Image upload process failed: ${imageError.message}`);
    }

    // 3. Return the new LINE Rich Menu ID
    return new Response(JSON.stringify({ 
      success: true, 
      lineRichMenuId: lineRichMenuId 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    return new Response(JSON.stringify({ 
      success: false, 
      error: (error as Error)?.message || 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});