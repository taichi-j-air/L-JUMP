import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// Generate LINE-compliant alias ID (lowercase alphanumeric + hyphen only)
const makeAliasId = () => 'richmenualias-' + crypto.randomUUID().replace(/[^a-z0-9]/g, '');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type TapAreaPayload = {
  action_type: 'uri' | 'message' | 'richmenuswitch';
  action_value: string;
  x_percent: number;
  y_percent: number;
  width_percent: number;
  height_percent: number;
  id?: string;
  [key: string]: unknown;
};

type UserRichMenuRecord = {
  id: string;
  line_rich_menu_id: string | null;
  line_rich_menu_alias_id: string | null;
};

async function normalizeTapAreasForSwitch(
  tapAreas: TapAreaPayload[] | undefined,
  supabase: SupabaseClient,
  userId: string,
  accessToken: string,
): Promise<TapAreaPayload[]> {
  if (!Array.isArray(tapAreas) || tapAreas.length === 0) {
    return tapAreas ?? [];
  }

  const switchAreas = tapAreas.filter((area) => area?.action_type === 'richmenuswitch');
  if (switchAreas.length === 0) {
    return tapAreas;
  }

  const { data: userMenusData, error: userMenusError } = await supabase
    .from('rich_menus')
    .select('id, line_rich_menu_id, line_rich_menu_alias_id')
    .eq('user_id', userId);

  if (userMenusError) {
    throw new Error(`Failed to load rich menus for switch actions: ${userMenusError.message}`);
  }

  const aliasCache = new Map<string, string>();
  const normalizedAreas: TapAreaPayload[] = [];
  const userMenus: UserRichMenuRecord[] = (userMenusData ?? []) as UserRichMenuRecord[];

  for (const area of tapAreas) {
    if (!area || area.action_type !== 'richmenuswitch') {
      normalizedAreas.push(area);
      continue;
    }

    if (!area.action_value) {
      throw new Error('Rich menu switch actions require a target rich menu.');
    }

    const targetMenu = userMenus.find(
      (menu) =>
        menu.id === area.action_value ||
        menu.line_rich_menu_alias_id === area.action_value,
    );

    if (!targetMenu) {
      normalizedAreas.push(area);
      continue;
    }

    let aliasId: string | null = targetMenu.line_rich_menu_alias_id;

    if (!aliasId) {
      if (!targetMenu.line_rich_menu_id) {
        throw new Error('切り替え先のリッチメニューがLINEに同期されていません。対象のリッチメニューを保存してから再度お試しください。');
      }

      if (aliasCache.has(targetMenu.id)) {
        aliasId = aliasCache.get(targetMenu.id) ?? null;
      } else {
        aliasId = makeAliasId();
        console.log('Creating alias', { aliasId, for: 'switch-target', richMenuId: targetMenu.id });

        const aliasResponse = await fetch('https://api.line.me/v2/bot/richmenu/alias', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            richMenuAliasId: aliasId,
            richMenuId: targetMenu.line_rich_menu_id,
          }),
        });

        if (!aliasResponse.ok) {
          throw new Error(`LINE API error (alias creation for switch target): ${await aliasResponse.text()}`);
        }

        const { error: updateAliasError } = await supabase
          .from('rich_menus')
          .update({ line_rich_menu_alias_id: aliasId })
          .eq('id', targetMenu.id);

        if (updateAliasError) {
          throw new Error(`DB error updating alias for target rich menu: ${updateAliasError.message}`);
        }

        aliasCache.set(targetMenu.id, aliasId);

        const menuIndex = userMenus.findIndex((menu) => menu.id === targetMenu.id);
        if (menuIndex !== -1) {
          userMenus[menuIndex].line_rich_menu_alias_id = aliasId;
        }
      }
    }

    normalizedAreas.push({
      ...area,
      action_value: aliasId ?? area.action_value,
    });
  }

  return normalizedAreas;
}

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

    const { dbId, lineId, lineAliasId, menuData, tapAreas, isDefault } = await req.json();
    if (!menuData) throw new Error('menuData is required.');

    // Step 1: Get LINE Access Token with fallback
    let accessToken: string | null = null;

    // Try RPC function first
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc('get_line_credentials_for_user', { 
        p_user_id: user.id 
      });
      if (!rpcError && rpcData?.channel_access_token) {
        accessToken = rpcData.channel_access_token;
        console.log('✓ Access token retrieved via RPC');
      }
    } catch (rpcErr) {
      console.log('RPC token retrieval failed, trying direct query:', rpcErr);
    }

    // Fallback: Try secure_line_credentials with conditional decryption
    if (!accessToken) {
      const { data: credentials, error: credsError } = await supabase
        .from('secure_line_credentials')
        .select('encrypted_value')
        .eq('user_id', user.id)
        .eq('credential_type', 'channel_access_token')
        .maybeSingle();

      if (!credsError && credentials?.encrypted_value) {
        const value = credentials.encrypted_value;
        
        if (value.startsWith('enc:')) {
          // Encrypted token - needs decryption
          try {
            const { data: decryptData, error: decryptError } = await supabase.functions.invoke(
              'decrypt-credential',
              { body: { encryptedValue: value } }
            );
            if (!decryptError && decryptData?.decryptedValue) {
              accessToken = decryptData.decryptedValue;
              console.log('✓ Access token decrypted from secure_line_credentials');
            }
          } catch (decryptErr) {
            console.error('Decryption failed:', decryptErr);
          }
        } else {
          // Plain text token
          accessToken = value;
          console.log('✓ Access token retrieved as plaintext from secure_line_credentials');
        }
      }
    }

    // Final fallback: Try profiles table (legacy)
    if (!accessToken) {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('line_channel_access_token')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (profileData?.line_channel_access_token) {
        accessToken = profileData.line_channel_access_token;
        console.log('✓ Access token retrieved from profiles (legacy)');
      }
    }

    if (!accessToken) {
      throw new Error('LINE access token not found. Please configure your LINE credentials.');
    }

    // --- Handle Update (Delete old menu and alias from LINE) ---
    let currentLineAliasId = lineAliasId; // Use existing alias if available
    if (dbId && lineId) { // If updating an existing menu
      // Delete old rich menu from LINE
      const deleteMenuUrl = `https://api.line.me/v2/bot/richmenu/${lineId}`;
      const deleteMenuResponse = await fetch(deleteMenuUrl, { method: 'DELETE', headers: { 'Authorization': `Bearer ${accessToken}` } });
      if (!deleteMenuResponse.ok && deleteMenuResponse.status !== 404) {
        console.warn(`Failed to delete old rich menu ${lineId} from LINE: ${await deleteMenuResponse.text()}`);
      }

      // Delete old rich menu alias from LINE (if it exists)
      if (currentLineAliasId) {
        const deleteAliasUrl = `https://api.line.me/v2/bot/richmenu/alias/${currentLineAliasId}`;
        const deleteAliasResponse = await fetch(deleteAliasUrl, { method: 'DELETE', headers: { 'Authorization': `Bearer ${accessToken}` } });
        if (!deleteAliasResponse.ok && deleteAliasResponse.status !== 404) {
          console.warn(`Failed to delete old rich menu alias ${currentLineAliasId} from LINE: ${await deleteAliasResponse.text()}`);
        }
      }
    }

    const normalizedTapAreas = await normalizeTapAreasForSwitch(
      Array.isArray(tapAreas) ? tapAreas : [],
      supabase,
      user.id,
      accessToken,
    );

    // --- Create New Menu on LINE (for both new and updated menus) ---
    if (!menuData.background_image_url) throw new Error('A background image is required.');

    const lineMenuObject = {
      size: { width: 2500, height: menuData.size === 'full' ? 1686 : 843 },
      selected: menuData.selected || false,
      name: menuData.name,
      chatBarText: menuData.chat_bar_text,
      areas: normalizedTapAreas.map((a) => ({
        bounds: { x: Math.round((a.x_percent / 100) * 2500), y: Math.round((a.y_percent / 100) * (menuData.size === 'full' ? 1686 : 843)), width: Math.round((a.width_percent / 100) * 2500), height: Math.round((a.height_percent / 100) * (menuData.size === 'full' ? 1686 : 843)) },
        action: { type: a.action_type, uri: a.action_type === 'uri' ? a.action_value : undefined, text: a.action_type === 'message' ? a.action_value : undefined, richMenuAliasId: a.action_type === 'richmenuswitch' ? a.action_value : undefined }
      }))
    };
    const richMenuResponse = await fetch('https://api.line.me/v2/bot/richmenu', { method: 'POST', headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify(lineMenuObject) });
    if (!richMenuResponse.ok) throw new Error(`LINE API error (menu creation): ${await richMenuResponse.text()}`);
    const lineRichMenu = await richMenuResponse.json();
    const newLineRichMenuId = lineRichMenu.richMenuId;

    // --- Upload Image to LINE ---
    const imageResponse = await fetch(menuData.background_image_url);
    if (!imageResponse.ok) throw new Error('Failed to fetch image from URL.');
    const imageBuffer = await imageResponse.arrayBuffer();
    // Determine Content-Type dynamically from response headers or URL extension
    const headerType = imageResponse.headers.get('content-type')?.toLowerCase() ?? '';
    let contentType = headerType.includes('jpeg') || headerType.includes('jpg')
      ? 'image/jpeg'
      : headerType.includes('png')
        ? 'image/png'
        : '';
    if (!contentType) {
      const lowerUrl = (menuData.background_image_url || '').toLowerCase();
      if (lowerUrl.endsWith('.jpg') || lowerUrl.endsWith('.jpeg')) contentType = 'image/jpeg';
      else if (lowerUrl.endsWith('.png')) contentType = 'image/png';
      else contentType = 'image/png';
    }
    const uploadResponse = await fetch(`https://api-data.line.me/v2/bot/richmenu/${newLineRichMenuId}/content`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': contentType },
      body: imageBuffer
    });
    if (!uploadResponse.ok) throw new Error(`LINE API error (image upload): ${await uploadResponse.text()}`);

    // --- Generate/Use Alias ID and Register with LINE ---
    if (!currentLineAliasId) {
      currentLineAliasId = makeAliasId();
    }
    console.log('Creating alias', { aliasId: currentLineAliasId, for: 'main', richMenuId: newLineRichMenuId });
    const aliasResponse = await fetch('https://api.line.me/v2/bot/richmenu/alias', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ richMenuAliasId: currentLineAliasId, richMenuId: newLineRichMenuId })
    });
    if (!aliasResponse.ok) throw new Error(`LINE API error (alias creation): ${await aliasResponse.text()}`);

    // --- DATABASE UPSERT --- 
    const recordToUpsert = {
      user_id: user.id,
      name: menuData.name,
      background_image_url: menuData.background_image_url,
      chat_bar_text: menuData.chat_bar_text,
      is_default: isDefault || false,
      selected: menuData.selected || false,
      is_active: menuData.is_active ?? true,
      size: menuData.size,
      line_rich_menu_id: newLineRichMenuId,
      line_rich_menu_alias_id: currentLineAliasId // Save the alias ID
    };

    const { data: upsertedMenu, error: upsertError } = await supabase.from('rich_menus').upsert(dbId ? { ...recordToUpsert, id: dbId } : recordToUpsert).select().single();
    if (upsertError) throw new Error(`DB upsert error: ${upsertError.message}`);
    const newDbId = upsertedMenu.id;

    // --- Save Tap Areas --- 
    await supabase.from('rich_menu_areas').delete().eq('rich_menu_id', newDbId);
    if (normalizedTapAreas.length > 0) {
      const { error: areaError } = await supabase
        .from('rich_menu_areas')
        .insert(normalizedTapAreas.map((a) => ({ ...a, rich_menu_id: newDbId })));
      if (areaError) throw new Error(`DB tap area insert error: ${areaError.message}`);
    }

    // --- Set as default if requested --- 
    if (isDefault) {
      await supabase.from('rich_menus').update({ is_default: false }).neq('id', newDbId);
      const setDefaultUrl = `https://api.line.me/v2/bot/user/all/richmenu/${newLineRichMenuId}`;
      const setDefaultResponse = await fetch(setDefaultUrl, { method: 'POST', headers: { 'Authorization': `Bearer ${accessToken}` } });
      if (!setDefaultResponse.ok) console.error(`Failed to set menu ${newLineRichMenuId} as default on LINE: ${await setDefaultResponse.text()}`);
    }

    return new Response(JSON.stringify({ success: true, id: newDbId, lineRichMenuId: newLineRichMenuId, lineRichMenuAliasId: currentLineAliasId }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('upsert-rich-menu error', error);
    return new Response(JSON.stringify({ success: false, error: (error as Error)?.message || 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
