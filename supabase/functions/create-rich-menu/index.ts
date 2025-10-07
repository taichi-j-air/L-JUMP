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

    const { richMenuId, richMenuData } = await req.json();
    if (!richMenuId) {
      throw new Error('richMenuId (database ID) is required');
    }

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
      console.error('LINE API error during creation:', errorText);
      throw new Error(`LINE API error: ${richMenuResponse.status}`);
    }

    const lineRichMenu = await richMenuResponse.json();
    const lineRichMenuId = lineRichMenu.richMenuId;
    console.log('Rich menu created on LINE:', lineRichMenuId);

    // Save the returned line_rich_menu_id to our database
    const { error: updateError } = await supabase
      .from('rich_menus')
      .update({ line_rich_menu_id: lineRichMenuId })
      .eq('id', richMenuId);

    if (updateError) {
      console.error('Failed to save line_rich_menu_id to database:', updateError);
      throw new Error(`Failed to save line_rich_menu_id: ${updateError.message}`);
    }

    // Upload image if provided
    if (richMenuData.background_image_url) {
      try {
        const imageResponse = await fetch(richMenuData.background_image_url);
        if (imageResponse.ok) {
          const imageBuffer = await imageResponse.arrayBuffer();
          const uploadResponse = await fetch(`https://api.line.me/v2/bot/richmenu/${lineRichMenuId}/content`, {
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

    // If setAsDefault is true, set this rich menu as the default for all users
    if (richMenuData.setAsDefault) {
      const setDefaultUrl = `https://api.line.me/v2/bot/user/all/richmenu/${lineRichMenuId}`;
      const setDefaultResponse = await fetch(setDefaultUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!setDefaultResponse.ok) {
        const errorText = await setDefaultResponse.text();
        console.error('Failed to set default rich menu:', errorText);
      } else {
        console.log(`Successfully set rich menu ${lineRichMenuId} as default.`);
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      lineRichMenuId: lineRichMenuId 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in create-rich-menu:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: (error as Error)?.message || 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
