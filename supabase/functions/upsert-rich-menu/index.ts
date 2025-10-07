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
    if (!authHeader) throw new Error('No authorization header');
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error('Authentication failed');

    const { menuData, tapAreas, isDefault } = await req.json();
    if (!menuData) throw new Error('menuData is required.');

    if (!menuData.background_image_url) {
      throw new Error('A background image is required for a new menu.');
    }

    const { data: credentials, error: credsError } = await supabase.from('secure_line_credentials').select('encrypted_value').eq('user_id', user.id).eq('credential_type', 'channel_access_token').single();
    if (credsError || !credentials) throw new Error('LINE access token not found.');
    const accessToken = credentials.encrypted_value;

    const lineMenuObject = {
      size: { width: 2500, height: menuData.size === 'full' ? 1686 : 843 },
      selected: menuData.selected || false,
      name: menuData.name,
      chatBarText: menuData.chat_bar_text,
      areas: tapAreas.map((a: any) => ({
        bounds: { x: Math.round((a.x_percent / 100) * 2500), y: Math.round((a.y_percent / 100) * (menuData.size === 'full' ? 1686 : 843)), width: Math.round((a.width_percent / 100) * 2500), height: Math.round((a.height_percent / 100) * (menuData.size === 'full' ? 1686 : 843)) },
        action: { type: a.action_type, uri: a.action_type === 'uri' ? a.action_value : undefined, text: a.action_type === 'message' ? a.action_value : undefined, richMenuAliasId: a.action_type === 'richmenuswitch' ? a.action_value : undefined }
      }))
    };
    const richMenuResponse = await fetch('https://api.line.me/v2/bot/richmenu', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(lineMenuObject)
    });
    if (!richMenuResponse.ok) throw new Error(`LINE API error (creation): ${await richMenuResponse.text()}`);
    const lineRichMenu = await richMenuResponse.json();
    const lineRichMenuId = lineRichMenu.richMenuId;

    const imageResponse = await fetch(menuData.background_image_url);
    if (!imageResponse.ok) throw new Error('Failed to fetch image from URL.');
    const imageBuffer = await imageResponse.arrayBuffer();
    const uploadResponse = await fetch(`https://api-data.line.me/v2/bot/richmenu/${lineRichMenuId}/content`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'image/png' },
      body: imageBuffer
    });
    if (!uploadResponse.ok) throw new Error(`LINE API error (image upload): ${await uploadResponse.text()}`);

    const { data: newMenu, error: insertError } = await supabase.from('rich_menus').insert({
      user_id: user.id,
      name: menuData.name,
      background_image_url: menuData.background_image_url,
      chat_bar_text: menuData.chat_bar_text,
      is_default: isDefault || false,
      selected: menuData.selected || false,
      is_active: menuData.is_active ?? true,
      size: menuData.size,
      line_rich_menu_id: lineRichMenuId
    }).select().single();
    if (insertError) throw new Error(`DB insert error: ${insertError.message}`);
    const dbId = newMenu.id;

    if (tapAreas && tapAreas.length > 0) {
      const { error: areaError } = await supabase.from('rich_menu_areas').insert(tapAreas.map((a: any) => ({ ...a, rich_menu_id: dbId })));
      if (areaError) throw new Error(`DB tap area insert error: ${areaError.message}`);
    }

    if (isDefault) {
      await supabase.from('rich_menus').update({ is_default: false }).neq('id', dbId);
      const setDefaultUrl = `https://api.line.me/v2/bot/user/all/richmenu/${lineRichMenuId}`;
      const setDefaultResponse = await fetch(setDefaultUrl, { method: 'POST', headers: { 'Authorization': `Bearer ${accessToken}` } });
      if (!setDefaultResponse.ok) {
        console.error(`Failed to set menu ${lineRichMenuId} as default on LINE: ${await setDefaultResponse.text()}`);
      }
    }

    return new Response(JSON.stringify({ success: true, id: dbId, lineRichMenuId: lineRichMenuId }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: (error as Error)?.message || 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});