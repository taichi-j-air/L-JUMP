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
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
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

    const { richMenuData, imageFile } = await req.json();

    // Get LINE credentials
    const { data: credentials } = await supabase
      .from('secure_line_credentials')
      .select('encrypted_value')
      .eq('user_id', user.id)
      .eq('credential_type', 'channel_access_token')
      .single();

    if (!credentials?.encrypted_value) {
      throw new Error('LINE access token not found');
    }

    const accessToken = credentials.encrypted_value;

    // Create rich menu on LINE API
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
      console.error('LINE API error:', errorText);
      throw new Error(`LINE API error: ${richMenuResponse.status}`);
    }

    const lineRichMenu = await richMenuResponse.json();
    console.log('Rich menu created on LINE:', lineRichMenu.richMenuId);

    // Upload image if provided
    if (imageFile && richMenuData.background_image_url) {
      try {
        // Download image from Supabase storage
        const imageResponse = await fetch(richMenuData.background_image_url);
        if (imageResponse.ok) {
          const imageBuffer = await imageResponse.arrayBuffer();
          
          // Upload to LINE
          const uploadResponse = await fetch(`https://api.line.me/v2/bot/richmenu/${lineRichMenu.richMenuId}/content`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'image/png',
            },
            body: imageBuffer
          });

          if (!uploadResponse.ok) {
            console.error('Image upload failed:', await uploadResponse.text());
          } else {
            console.log('Image uploaded successfully');
          }
        }
      } catch (imageError) {
        console.error('Image upload error:', imageError);
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      lineRichMenuId: lineRichMenu.richMenuId 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in create-rich-menu:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});