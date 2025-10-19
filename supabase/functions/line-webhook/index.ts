import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { 
  validateLineUserId, 
  validateInviteCode, 
  sanitizeTextInput,
  rateLimiter,
  createSecureHeaders,
  createErrorResponse
} from '../_shared/security.ts'

const corsHeaders = createSecureHeaders({
  'x-line-signature': 'x-line-signature'
})

interface LineMessage {
  id: string
  type: string
  text?: string
  timestamp: number
}

interface LineEvent {
  type: string
  message?: LineMessage
  replyToken: string
  source: {
    userId: string
    type: string
  }
  timestamp: number
}

interface LineWebhookBody {
  destination: string
  events: LineEvent[]
}

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
const botOwnerCache = new Map<string, string>();

function normalizeBotIdentifier(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.startsWith('@') ? value.substring(1) : value;
}

function expandBotIdentifiers(value: string | null | undefined): string[] {
  const normalized = normalizeBotIdentifier(value);
  const candidates = new Set<string>();
  if (value) candidates.add(value);
  if (normalized) candidates.add(normalized);
  return Array.from(candidates);
}

async function decryptBotCredential(encryptedValue: string, userId: string): Promise<string | null> {
  if (!encryptedValue.startsWith('enc:')) {
    return encryptedValue;
  }

  try {
    const encoded = encryptedValue.substring(4);
    const binary = atob(encoded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    const iv = bytes.slice(0, 12);
    const cipherText = bytes.slice(12);
    const keyMaterial = textEncoder.encode(userId.substring(0, 32).padEnd(32, '0'));
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyMaterial,
      { name: 'AES-GCM' },
      false,
      ['encrypt', 'decrypt']
    );

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      cryptoKey,
      cipherText
    );

    return textDecoder.decode(decrypted);
  } catch (error) {
    console.error('Failed to decrypt bot credential for user', userId, error);
    return null;
  }
}

async function resolveAppUserIdForBot(supabase: any, botUserId: string): Promise<string | null> {
  if (botOwnerCache.has(botUserId)) {
    return botOwnerCache.get(botUserId)!;
  }

  try {
    const { data: directBotMatch, error: directBotError } = await supabase
      .from('secure_line_credentials')
      .select('user_id')
      .eq('credential_type', 'bot_id')
      .eq('encrypted_value', botUserId)
      .maybeSingle();

    if (directBotError && directBotError.code && directBotError.code !== 'PGRST116') {
      console.error('Error during plaintext bot_id lookup:', directBotError);
    }

    if (directBotMatch?.user_id) {
      console.log('Matched bot via plaintext bot_id credential');
      botOwnerCache.set(botUserId, directBotMatch.user_id);
      return directBotMatch.user_id;
    }
  } catch (error) {
    console.error('resolveAppUserIdForBot bot_id lookup exception:', error);
  }

  try {
    const { data: legacyChannelMatch, error: legacyChannelError } = await supabase
      .from('secure_line_credentials')
      .select('user_id')
      .eq('credential_type', 'channel_id')
      .eq('encrypted_value', botUserId)
      .maybeSingle();

    if (legacyChannelError && legacyChannelError.code && legacyChannelError.code !== 'PGRST116') {
      console.error('Error during legacy channel_id lookup:', legacyChannelError);
    }

    if (legacyChannelMatch?.user_id) {
      console.log('Matched bot via legacy channel_id credential');
      botOwnerCache.set(botUserId, legacyChannelMatch.user_id);
      return legacyChannelMatch.user_id;
    }
  } catch (error) {
    console.error('resolveAppUserIdForBot channel_id lookup exception:', error);
  }

  const { data: botCredentials, error: credentialsError } = await supabase
    .from('secure_line_credentials')
    .select('user_id, encrypted_value')
    .eq('credential_type', 'bot_id')
    .not('encrypted_value', 'is', null);

  if (credentialsError) {
    console.error('Error loading bot_id credentials for matching:', credentialsError);
    return null;
  }

  for (const credential of botCredentials ?? []) {
    const userId = credential.user_id;
    const storedValue = credential.encrypted_value;
    if (!storedValue) continue;

    if (!storedValue.startsWith('enc:')) {
      for (const candidate of expandBotIdentifiers(storedValue)) {
        if (candidate === botUserId) {
          console.log('Matched bot via stored plaintext bot_id credential');
          botOwnerCache.set(botUserId, userId);
          return userId;
        }
      }
      continue;
    }

    const decryptedValue = await decryptBotCredential(storedValue, userId);
    if (!decryptedValue) continue;

    for (const candidate of expandBotIdentifiers(decryptedValue)) {
      if (candidate === botUserId) {
        console.log('Matched bot via decrypted bot_id credential');
        botOwnerCache.set(botUserId, userId);
        return userId;
      }
    }
  }

  const { data: profileCandidates, error: profileError } = await supabase
    .from('profiles')
    .select('user_id, line_channel_access_token, line_bot_id')
    .not('line_channel_access_token', 'is', null)
    .not('line_bot_id', 'is', null);

  if (profileError) {
    console.error('Error loading profiles for bot lookup fallback:', profileError);
  } else {
    for (const profile of profileCandidates ?? []) {
      const accessToken = profile.line_channel_access_token;
      if (!accessToken) continue;

      try {
        const botInfoResponse = await fetch('https://api.line.me/v2/bot/info', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        });

        if (!botInfoResponse.ok) {
          continue;
        }

        const botInfo = await botInfoResponse.json();
        if (botInfo?.userId === botUserId) {
          console.log('Matched bot via LINE API lookup for user', profile.user_id);
          botOwnerCache.set(botUserId, profile.user_id);
          return profile.user_id;
        }
      } catch (error) {
        console.error('Failed to resolve bot via LINE API lookup for user', profile.user_id, error);
      }
    }
  }

  console.warn('No user mapping found for bot destination:', botUserId);
  return null;
}

serve(async (req) => {
  console.log('=== LINE Webhook Function Called ===')
  console.log('Method:', req.method)
  console.log('URL:', req.url)
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('CORS preflight request received')
    return new Response(null, { headers: corsHeaders })
  }

  // Rate limiting check
  const clientIP = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
  const rateAllowed = await rateLimiter.isAllowed(`webhook:${clientIP}`, 100, 60000); // 100 requests per minute
  
  if (!rateAllowed) {
    console.warn('Rate limit exceeded for IP:', clientIP);
    return createErrorResponse('Rate limit exceeded', 429);
  }

  // LINEの検証リクエストに対する簡単なレスポンス
  if (req.method === 'GET') {
    console.log('GET request received - possibly LINE verification')
    return new Response('LINE Webhook is working!', { 
      status: 200, 
      headers: corsHeaders 
    })
  }

  // Validate request method
  if (req.method !== 'POST') {
    return createErrorResponse('Method not allowed', 405);
  }

  try {
    console.log('Processing POST request from LINE')
    
    // Validate content type
    const contentType = req.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      return createErrorResponse('Invalid content type', 400);
    }

    const body = await req.text()
    console.log('Raw body received:', body)
    console.log('Body length:', body.length)

    if (!body || body.length === 0) {
      return createErrorResponse('Empty request body', 400);
    }

    let webhookData: LineWebhookBody;
    try {
      webhookData = JSON.parse(body);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      return createErrorResponse('Invalid JSON format', 400);
    }

    // Validate webhook payload structure
    if (!webhookData || !Array.isArray(webhookData.events)) {
      return createErrorResponse('Invalid webhook payload structure', 400);
    }
    
    // Verify LINE signature (basic validation)
    const signature = req.headers.get('x-line-signature')
    if (!signature) {
      console.error('No LINE signature found')
      return new Response('No signature', { 
        status: 400, 
        headers: corsHeaders 
      })
    }

    // Initialize Supabase client
    const supabaseUrl = "https://rtjxurmuaawyzjcdkqxt.supabase.co"
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    if (!supabaseServiceKey) {
      console.error('Missing Supabase service key')
      return new Response('Server configuration error', { 
        status: 500, 
        headers: corsHeaders 
      })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get the bot's user ID from the destination
    const botUserId = webhookData.destination;
    if (!botUserId) {
      return createErrorResponse('Missing destination in webhook payload', 400);
    }

    // Find the app user associated with this LINE bot
    const appUserId = await resolveAppUserIdForBot(supabase, botUserId);

    if (!appUserId) {
      console.error('Could not find a user for bot ID:', botUserId);
      // 200 OKを返してLINEプラットフォームからの再送を防ぐ
      return new Response('OK (User not found for bot)', { status: 200, headers: corsHeaders });
    }

    console.log(`Webhook received for bot ${botUserId}, mapped to app user ${appUserId}`);

    // Process each event with validation
    for (const event of webhookData.events) {
      console.log('Processing event:', event.type)
      
      // Validate event structure
      if (!event || !event.type || !event.source?.userId) {
        console.warn('Invalid event structure, skipping:', event);
        continue;
      }

      // Validate LINE user ID format
      if (!validateLineUserId(event.source.userId)) {
        console.warn('Invalid LINE user ID format:', event.source.userId);
        continue;
      }
      
      if (event.type === 'message' && event.message) {
        await handleMessage(event, supabase, req, appUserId)
      } else if (event.type === 'follow') {
        await handleFollow(event, supabase, req, appUserId)
      } else if (event.type === 'unfollow') {
        await handleUnfollow(event, supabase, req, appUserId)
      } else if (event.type === 'postback') {
        await handlePostback(event, supabase, req, appUserId)
      } else {
        console.log('Unhandled event type:', event.type)
      }
    }

    return new Response('OK', { 
      status: 200, 
      headers: corsHeaders 
    })

  } catch (error) {
    console.error('Webhook error:', error)
    return new Response('Internal server error', { 
      status: 500, 
      headers: corsHeaders 
    })
  }
})

async function handleMessage(event: LineEvent, supabase: any, req: Request, appUserId: string) {
  try {
    const { message, replyToken, source } = event
    
    if (!message) {
      console.log('No message to process')
      return
    }

    console.log(`Message from ${source.userId}:`, message.type)

    // Handle different message types
    let messageText: string;
    let mediaInfo: any = {};

    if (message.type === 'text' && message.text) {
      // Sanitize message text to prevent XSS
      const sanitizedText = sanitizeTextInput(message.text);
      if (!sanitizedText) {
        console.warn('Message text failed sanitization, skipping');
        return;
      }
      messageText = sanitizedText;
    } else if (message.type === 'image') {
      messageText = '[画像]';
      mediaInfo = {
        media_kind: 'image',
        content_type: 'image/jpeg',
        line_message_id: message.id
      };
      // Download and store image
      const mediaResult = await downloadLineMedia(message.id, source.userId, supabase, appUserId)
      if (mediaResult.success) {
        mediaInfo.media_url = mediaResult.public_url
        mediaInfo.thumbnail_url = mediaResult.public_url
        messageText = '' // Clear placeholder text since we have the actual image
      }
    } else if (message.type === 'video') {
      messageText = '[動画]';
      mediaInfo = {
        media_kind: 'video',
        content_type: 'video/mp4',
        line_message_id: message.id
      };
      // Download and store video
      const mediaResult = await downloadLineMedia(message.id, source.userId, supabase, appUserId)
      if (mediaResult.success) {
        mediaInfo.media_url = mediaResult.public_url
        messageText = '' // Clear placeholder text
      }
    } else if (message.type === 'audio') {
      messageText = '[音声]';
      mediaInfo = {
        media_kind: 'audio',
        content_type: 'audio/m4a',
        line_message_id: message.id
      };
      // Download and store audio
      const mediaResult = await downloadLineMedia(message.id, source.userId, supabase, appUserId)
      if (mediaResult.success) {
        mediaInfo.media_url = mediaResult.public_url
        mediaInfo.file_name = `audio_${message.id}.m4a`
        messageText = '' // Clear placeholder text
      }
    } else if (message.type === 'file') {
      messageText = '[ファイル]';
      mediaInfo = {
        media_kind: 'file',
        file_name: (message as any).fileName || 'ファイル',
        file_size: (message as any).fileSize,
        line_message_id: message.id
      };
      // Download and store file
      const mediaResult = await downloadLineMedia(message.id, source.userId, supabase, appUserId)
      if (mediaResult.success) {
        mediaInfo.media_url = mediaResult.public_url
        messageText = '' // Clear placeholder text
      }
    } else if (message.type === 'sticker') {
      messageText = '[スタンプ]';
      mediaInfo = {
        media_kind: 'sticker',
        sticker_id: (message as any).stickerId,
        sticker_package_id: (message as any).packageId
      };
      // Get sticker image URL
      const stickerResult = await getStickerImageUrl((message as any).packageId, (message as any).stickerId)
      if (stickerResult.success) {
        mediaInfo.media_url = stickerResult.image_url
        messageText = '' // Clear placeholder text
      }
    } else {
      console.log(`Unsupported message type: ${message.type}`);
      messageText = `[${message.type}メッセージ]`;
    }

    console.log(`Processed message: ${messageText}`)

    // INVITE コマンドの判定: #INVITE <code> (text messages only)
    if (message.type === 'text') {
      const inviteMatch = messageText.match(/^#INVITE\s+([A-Za-z0-9]{8,32})/i)
      if (inviteMatch) {
      const inviteCode = inviteMatch[1]
      if (!validateInviteCode(inviteCode)) {
        await sendReplyMessage(replyToken, '招待コードの形式が正しくありません。', supabase, appUserId)
        return
      }

      // 友だち情報を確実に作成
      await ensureFriendExists(source.userId, supabase, appUserId)

      // LINEプロフィール取得
      const userProfile = await getLineUserProfile(source.userId, supabase, appUserId)

      try {
        const { data: reg, error: regErr } = await supabase.rpc('register_friend_to_scenario', {
          p_line_user_id: source.userId,
          p_invite_code : inviteCode,
          p_display_name: userProfile?.displayName ?? null,
          p_picture_url : userProfile?.pictureUrl ?? null,
          p_registration_source: 'invite_link',
          p_scenario_id: null,
          p_user_id: appUserId // Pass the user ID to the RPC function
        })

        if (regErr || !reg?.success) {
          console.error('register_friend_to_scenario failed:', regErr, reg)
          await sendReplyMessage(replyToken, 'シナリオ登録に失敗しました。時間をおいて再度お試しください。', supabase, appUserId)
          return
        }

        console.log('INVITE registration result:', reg)
        await sendReplyMessage(replyToken, 'ご登録ありがとうございます。ステップ配信を開始します。', supabase, appUserId)

        // 即時配信をサーバ側で開始
        await startStepDelivery(supabase, reg.scenario_id, reg.friend_id, appUserId)
        return

      } catch (e) {
        console.error('INVITE processing error:', e)
        await sendReplyMessage(replyToken, '処理中にエラーが発生しました。', supabase, appUserId)
        return
      }
      }
    }

    // 通常メッセージ処理
    await ensureFriendExists(source.userId, supabase, appUserId)
    await saveIncomingMessage(source.userId, messageText, mediaInfo, supabase, appUserId)
    
    // Reply only to text messages 
    if (message.type === 'text') {
      await sendReplyMessage(replyToken, `受信しました: ${messageText}`, supabase, appUserId)
    }

  } catch (error) {
    console.error('Error handling message:', error)
  }
}

async function saveIncomingMessage(userId: string, messageText: string, mediaInfo: any, supabase: any, appUserId: string) {
  try {
    // Find the friend record directly without complex joins
    const { data: friend, error: friendError } = await supabase
      .from('line_friends')
      .select('id, user_id')
      .eq('line_user_id', userId)
      .eq('user_id', appUserId) // RLS-like security
      .single()

    if (friendError || !friend) {
      console.error('Friend not found for message saving:', friendError)
      return
    }

    console.log('Found friend for message saving:', friend.id, 'user:', friend.user_id)

    // Save the message with media info
    const { error: messageError } = await supabase
      .from('chat_messages')
      .insert({
        user_id: appUserId,
        friend_id: friend.id,
        message_text: messageText,
        message_type: 'incoming',
        sent_at: new Date().toISOString(),
        ...mediaInfo
      })

    if (messageError) {
      console.error('Error saving incoming message:', messageError)
    } else {
      console.log('Incoming message saved successfully for user:', appUserId)
    }

  } catch (error) {
    console.error('Error in saveIncomingMessage:', error)
  }
}

async function sendReplyMessage(replyToken: string, text: string, supabase: any, appUserId: string) {
  try {
    // Get credentials for the specific user
    const { data: secureCredentials, error: secureError } = await supabase
      .from('secure_line_credentials')
      .select('encrypted_value')
      .eq('credential_type', 'channel_access_token')
      .eq('user_id', appUserId) // RLS-like security
      .not('encrypted_value', 'is', null)
      .single()

    if (secureError || !secureCredentials) {
      console.error('No LINE access token found for user:', appUserId, secureError)
      return
    }

    const accessToken = secureCredentials.encrypted_value

    const replyData = {
      replyToken: replyToken,
      messages: [
        {
          type: 'text',
          text: text
        }
      ]
    }

    const response = await fetch('https://api.line.me/v2/bot/message/reply', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify(replyData)
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('LINE API error:', response.status, errorText)
      return
    }

    console.log('Reply sent successfully')

  } catch (error) {
    console.error('Error sending reply:', error)
  }
}

async function sendPushMessages(userId: string, messages: any[], supabase: any, appUserId: string) {
  if (!messages || messages.length === 0) {
    console.warn('sendPushMessages called with empty message array')
    return
  }

  try {
    const { data: secureCredentials, error: secureError } = await supabase
      .from('secure_line_credentials')
      .select('encrypted_value')
      .eq('credential_type', 'channel_access_token')
      .eq('user_id', appUserId) // RLS-like security
      .not('encrypted_value', 'is', null)
      .single()

    if (secureError || !secureCredentials) {
      console.error('No LINE access token found for user:', appUserId, secureError)
      return
    }

    const accessToken = secureCredentials.encrypted_value

    const pushData = {
      to: userId,
      messages
    }

    const response = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify(pushData)
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('LINE API push error:', response.status, errorText)
      return
    }

    console.log('Push message sent successfully')

  } catch (error) {
    console.error('Error sending push message:', error)
  }
}

async function sendPushMessage(userId: string, text: string, supabase: any, appUserId: string) {
  return sendPushMessages(userId, [
    {
      type: 'text',
      text
    }
  ], supabase, appUserId)
}

function buildGreetingImageMessage(config: any): any | null {
  if (!config || typeof config !== 'object') {
    return null
  }

  const mode = typeof config.mode === 'string' ? config.mode : 'none'
  if (mode === 'none') {
    return null
  }

  const imageUrl = typeof config.imageUrl === 'string' ? config.imageUrl.trim() : ''
  if (!imageUrl) {
    return null
  }

  const aspectRatio =
    typeof config.aspectRatio === 'string' && config.aspectRatio.trim()
      ? config.aspectRatio.trim()
      : '1:1'

  const baseImage: Record<string, any> = {
    type: 'image',
    url: imageUrl,
    size: 'full',
    aspectMode: 'fit',
    aspectRatio,
    gravity: 'center'
  }

  const actionLabel =
    typeof config.actionLabel === 'string' && config.actionLabel.trim()
      ? config.actionLabel.trim()
      : undefined

  if (mode === 'link') {
    const linkUrl = typeof config.linkUrl === 'string' ? config.linkUrl.trim() : ''
    if (!linkUrl) {
      return null
    }

    baseImage.action = {
      type: 'uri',
      label: actionLabel || 'open',
      uri: linkUrl
    }
  } else if (mode === 'postback') {
    const postback = typeof config.postback === 'object' && config.postback !== null ? config.postback : {}
    const dataPayload: Record<string, unknown> = {
      action: 'trigger_scenario',
      source: 'greeting_image',
      once: postback.once !== false
    }

    if (typeof postback.scenarioId === 'string' && postback.scenarioId.trim()) {
      dataPayload.scenario_id = postback.scenarioId.trim()
    }

    if (typeof postback.token === 'string' && postback.token.trim()) {
      dataPayload.token = postback.token.trim()
    }

    const postbackAction: Record<string, any> = {
      type: 'postback',
      label:
        actionLabel ||
        (typeof postback.label === 'string' && postback.label.trim()
          ? postback.label.trim()
          : 'action'),
      data: JSON.stringify(dataPayload)
    }

    if (typeof postback.displayText === 'string' && postback.displayText.trim()) {
      postbackAction.displayText = postback.displayText.trim()
    }

    baseImage.action = postbackAction
  } else {
    return null
  }

  const altText =
    typeof config.altText === 'string' && config.altText.trim()
      ? config.altText.trim()
      : 'Greeting image'

  return {
    type: 'flex',
    altText,
    contents: {
      type: 'bubble',
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [baseImage],
        paddingAll: '0px'
      }
    }
  }
}

async function handleFollow(event: LineEvent, supabase: any, req: Request, appUserId: string) {
  console.log('--- handleFollow: START ---');
  try {
    const { source } = event
    console.log(`User ${source.userId} followed the bot`)

    // Extract invite code from various sources
    const url = new URL(req.url)
    let inviteCode = url.searchParams.get('state') || url.searchParams.get('invite')
    
    // Also check headers and URL path for invite code
    if (!inviteCode) {
      inviteCode = req.headers.get('x-invite-code')
    }
    
    // Check for recent invite clicks if no direct invite code
    if (!inviteCode) {
      await findRecentInviteCode(source.userId, supabase).then(code => {
        if (code) {
          inviteCode = code
          console.log('Found invite code from recent clicks:', inviteCode)
        }
      })
    }
    
    console.log('Invite code from follow event:', inviteCode)

    // Get user profile using LINE Messaging API
    const userProfile = await getLineUserProfile(source.userId, supabase, appUserId)
    
    // プロフィール取得失敗でも処理を継続（display_name/picture_url は null 許容）
    if (!userProfile) {
      console.warn('⚠ LINE プロフィール取得に失敗しましたが、友だち登録・挨拶送信は続行します')
    } else {
      console.log('✓ 友だち追加処理を開始:', userProfile.displayName)
    }
    
    // Check if invite code is provided - use scenario registration function
    if (inviteCode) {
      console.log('友達追加を招待コード経由で処理します:', inviteCode)
      
      try {
        // Use the new scenario registration function
        const { data: registrationResult, error: registrationError } = await supabase
          .rpc('register_friend_to_scenario', {
            p_line_user_id: source.userId,
            p_invite_code: inviteCode,
            p_display_name: userProfile?.displayName || null,
            p_picture_url: userProfile?.pictureUrl || null,
            p_registration_source: 'invite_link',
            p_scenario_id: null,
            p_user_id: appUserId // Pass the user ID to the RPC function
          })
        
        if (registrationError) {
          console.error('シナリオ登録エラー:', registrationError)
        } else {
          console.log('シナリオ登録結果:', registrationResult)
          
          if (registrationResult && registrationResult.success) {
            console.log('友達をシナリオに正常に登録しました')
            
            // Start step delivery process in background
            // EdgeRuntime.waitUntil(
            //   startStepDelivery(supabase, registrationResult.scenario_id, registrationResult.friend_id)
            // )
          } else {
            console.error('シナリオ登録に失敗:', registrationResult?.error)
          }
        }
      } catch (error) {
        console.error('招待コード処理中にエラー:', error)
      }
    } else {
      // Regular friend addition without invite code
      console.log('通常の友達追加を処理します（招待コードなし）')
      
      // Get the profile for the current app user
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('user_id, friends_count')
        .eq('user_id', appUserId) // RLS-like security
        .single()

      if (profileError || !profile) {
        console.error('No profile found for this LINE bot owner:', appUserId, profileError)
        return
      }
      console.log('✓ Bot owner profile found:', profile.user_id)

      // Check if friend already exists (e.g., after unblock)
      const { data: existingFriend } = await supabase
        .from('line_friends')
        .select('id')
        .eq('user_id', appUserId) // RLS-like security
        .eq('line_user_id', source.userId)
        .maybeSingle()

      console.log('--- handleFollow: existingFriend check ---', { existingFriend });

      let friendData
      if (!existingFriend) {
        // New friend - insert (allow null for display_name/picture_url)
        const { data: newFriend, error: insertError } = await supabase
          .from('line_friends')
          .insert({
            user_id: appUserId,
            line_user_id: source.userId,
            display_name: userProfile?.displayName || null,
            picture_url: userProfile?.pictureUrl || null,
            added_at: new Date().toISOString()
          })
          .select()
          .single()

        if (insertError) {
          console.error('Error inserting friend:', insertError)
          return
        }

        friendData = newFriend

        // Update friends count for new friend only
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ 
            friends_count: (profile.friends_count || 0) + 1 
          })
          .eq('user_id', appUserId)

        if (updateError) {
          console.error('Error updating friends count:', updateError)
        }

        console.log('✓ 新規友達追加が完了しました:', userProfile?.displayName || source.userId)
      } else {
        // Existing friend (e.g., after unblock) - update (allow null for display_name/picture_url)
        const { data: updatedFriend, error: updateError } = await supabase
          .from('line_friends')
          .update({
            display_name: userProfile?.displayName || null,
            picture_url: userProfile?.pictureUrl || null,
            is_blocked: false,
            added_at: new Date().toISOString()
          })
          .eq('id', existingFriend.id)
          .select()
          .single()

        if (updateError) {
          console.error('Error updating existing friend:', updateError)
          return
        }

        friendData = updatedFriend
        console.log('✓ 既存友達の情報を更新しました（ブロック解除）:', userProfile?.displayName || source.userId)
      }

      // Check for greeting message settings
      const { data: greetingSettings, error: greetingError } = await supabase
        .from('line_greeting_settings')
        .select('*')
        .eq('user_id', appUserId) // RLS-like security
        .maybeSingle()

      console.log('--- handleFollow: greetingSettings check ---', { greetingSettings, greetingError });

      if (!greetingError && greetingSettings) {
        console.log('✓ あいさつメッセージ設定が見つかりました:', greetingSettings.greeting_type)

        if (greetingSettings.greeting_type === 'message' && greetingSettings.greeting_message) {
          // Send greeting message with token replacement
          try {
            // Get friend information for token replacement
            const { data: friendDataForToken } = await supabase
              .from('line_friends')
              .select('short_uid, display_name')
              .eq('line_user_id', source.userId)
              .eq('user_id', appUserId) // RLS-like security
              .maybeSingle()

            // Replace tokens in greeting message
            let message = greetingSettings.greeting_message
            console.log('トークン変換前のメッセージ:', greetingSettings.greeting_message)
            
            if (friendDataForToken) {
              const uid = friendDataForToken.short_uid || null
              const lineName = friendDataForToken.display_name || userProfile?.displayName || null
              const lineNameSan = lineName ? lineName.replace(/[<>\"\']/g, '') + 'さん' : null

              console.log('friendData:', JSON.stringify(friendDataForToken))
              console.log('uid:', uid, 'lineName:', lineName, 'lineNameSan:', lineNameSan)

              // 長いトークンから順に置換（部分一致を防ぐ）
              if (lineNameSan) {
                message = message.split('[LINE_NAME_SAN]').join(lineNameSan)
              }
              if (lineName) {
                message = message.split('[LINE_NAME]').join(lineName)
              }
              if (uid) {
                message = message.split('[UID]').join(uid)
              }

              console.log('トークン変換後のメッセージ:', message)
            }

            console.log('--- handleFollow: Sending greeting message ---', { userId: source.userId, message })

            const greetingMessages: any[] = [
              {
                type: 'text',
                text: message
              }
            ]

            const greetingImageMessage = buildGreetingImageMessage(greetingSettings.greeting_image_config)
            if (greetingImageMessage) {
              greetingMessages.push(greetingImageMessage)
              console.log('--- handleFollow: Added greeting image message ---', greetingImageMessage)
            }

            await sendPushMessages(source.userId, greetingMessages, supabase, appUserId)
            console.log('✓ あいさつメッセージを送信しました（トークン変換済み + 画像設定）')
          } catch (error) {
            console.error('✗ あいさつメッセージ送信エラー:', error)
          }
        } else if (greetingSettings.greeting_type === 'scenario' && greetingSettings.scenario_id) {
          // Register to scenario
          console.log('→ あいさつシナリオに登録します:', greetingSettings.scenario_id)
          
          try {
            const { data: registrationResult, error: registrationError } = await supabase
              .rpc('register_friend_to_scenario', {
                p_line_user_id: source.userId,
                p_invite_code: null,
                p_display_name: userProfile?.displayName || null,
                p_picture_url: userProfile?.pictureUrl || null,
                p_registration_source: 'greeting_message',
                p_scenario_id: greetingSettings.scenario_id,
                p_user_id: appUserId // Pass the user ID to the RPC function
              })

            if (registrationError) {
              console.error('✗ シナリオ登録エラー:', registrationError)
            } else if (registrationResult && registrationResult.success) {
              console.log('✓ あいさつシナリオに登録しました - ステップ配信は scheduled function が処理します')
            } else {
              console.error('✗ シナリオ登録失敗:', registrationResult?.error || '不明なエラー')
            }
          } catch (error) {
            console.error('✗ あいさつシナリオ登録エラー:', error)
          }
        } else {
          console.log('⚠ あいさつ設定はありますが、有効な message/scenario が未設定です')
        }
      } else {
        console.log('⚠ あいさつメッセージ設定が見つかりません')
      }
    }
  } catch (error) {
    console.error('Error handling follow:', error)
  }
}

// Step delivery process for scenario-based friend additions
async function startStepDelivery(supabase: any, scenarioId: string, friendId: string, appUserId: string) {
  try {
    console.log('ステップ配信プロセスを開始:', { scenarioId, friendId, appUserId })
    
    // Get steps that are ready for immediate delivery (scheduled time has passed or is immediate)
    const { data: readySteps, error: stepsError } = await supabase
      .from('step_delivery_tracking')
      .select(`
        *,
        steps!inner (
          id, step_order, delivery_type, delivery_seconds, delivery_minutes, delivery_hours, delivery_days,
          step_messages (
            id, content, message_type, media_url, message_order,
            flex_messages (content)
          )
        ),
        line_friends!inner(user_id)
      `)
      .eq('scenario_id', scenarioId)
      .eq('friend_id', friendId)
      .eq('status', 'ready')
      // Ensure the friend belongs to the correct user to prevent data leaks
      .eq('line_friends.user_id', appUserId) 
      .order('step_order', { foreignTable: 'steps', ascending: true })
      .limit(1)
    
    if (stepsError) {
      console.error('配信準備完了ステップの取得エラー:', stepsError)
      return
    }
    
    if (!readySteps || readySteps.length === 0) {
      console.log('即座に配信可能なステップが見つかりません（スケジュール配信システムが処理します）')
      return
    }
    
    const firstStep = readySteps[0]
    console.log('即座に配信するステップ:', firstStep.steps.step_order)
    
    // Deliver immediately eligible steps
    await deliverStepMessages(supabase, firstStep, appUserId)
    
  } catch (error) {
    console.error('ステップ配信プロセスエラー:', error)
  }
}

// Deliver messages for a specific step
async function deliverStepMessages(supabase: any, stepTracking: any, appUserId: string) {
  try {
    console.log('ステップメッセージを配信中:', stepTracking.step_id)
    
    const messages = stepTracking.steps.step_messages || []
    if (messages.length === 0) {
      console.log('配信するメッセージがありません')
      
      // Mark as delivered even without messages
      await markStepAsDelivered(
        supabase,
        stepTracking.id,
        stepTracking.scenario_id,
        stepTracking.friend_id,
        stepTracking.step_id,
        stepTracking.steps.step_order,
        appUserId
      )
      return
    }
    
    // Sort messages by order
    const sortedMessages = messages.sort((a: any, b: any) => a.message_order - b.message_order)
    
    // Get LINE user ID and access token for sending
    const { data: friendInfo, error: friendError } = await supabase
      .from('line_friends')
      .select('line_user_id')
      .eq('id', stepTracking.friend_id)
      .eq('user_id', appUserId) // RLS-like security
      .single()
    
    if (friendError || !friendInfo) {
      console.error('友達情報の取得に失敗:', friendError)
      return
    }
    
    const lineUserId = friendInfo.line_user_id
    
    // Get secure LINE credentials
    const { data: credentials, error: credError } = await supabase
      .rpc('get_line_credentials_for_user', { p_user_id: appUserId });
    
    if (credError || !credentials?.channel_access_token) {
      console.error('LINE アクセストークンが見つかりません:', credError)
      return
    }
    
    const accessToken = credentials.channel_access_token
    
    // Send each message
    for (const message of sortedMessages) {
      try {
        await sendLineMessage(accessToken, lineUserId, message)
        console.log('メッセージ送信完了:', message.id)
        
        // Add small delay between messages to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500))
      } catch (error) {
        console.error('メッセージ送信エラー:', message.id, error)
      }
    }
    
    // Mark step as delivered and prepare next step
    await markStepAsDelivered(
      supabase,
      stepTracking.id,
      stepTracking.scenario_id,
      stepTracking.friend_id,
      stepTracking.step_id,
      stepTracking.steps.step_order,
      appUserId
    )
    
  } catch (error) {
    console.error('ステップメッセージ配信エラー:', error)
  }
}

// Send a single message via LINE API
async function sendLineMessage(accessToken: string, userId: string, message: any) {
  try {
    let lineMessage: any
    
    switch (message.message_type) {
      case 'text':
        lineMessage = {
          type: 'text',
          text: message.content
        }
        break
        
      case 'media':
        // Handle media messages
        if (message.media_url) {
          // For images
          if (message.media_url.match(/\.(jpg|jpeg|png|gif)$/i)) {
            lineMessage = {
              type: 'image',
              originalContentUrl: message.media_url,
              previewImageUrl: message.media_url
            }
          } else {
            // For other media, send as text with URL
            lineMessage = {
              type: 'text',
              text: `メディア: ${message.media_url}`
            }
          }
        } else {
          lineMessage = {
            type: 'text',
            text: message.content
          }
        }
        break
        
      case 'flex':
        lineMessage = {
          type: 'flex',
          altText: 'フレックスメッセージ',
          contents: message.flex_messages?.content || JSON.parse(message.content || '{}')
        }
        break
        
      default:
        lineMessage = {
          type: 'text',
          text: message.content
        }
    }
    
    const response = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        to: userId,
        messages: [lineMessage]
      })
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('LINE API エラー:', response.status, errorText)
      throw new Error(`LINE API error: ${response.status}`)
    }
    
    console.log('LINE メッセージ送信成功')
    
  } catch (error) {
    console.error('LINE メッセージ送信エラー:', error)
    throw error
  }
}

// Mark step as delivered and prepare the next step
async function syncStepDeliveryTimers(
  supabase: any,
  params: { scenarioId: string; stepId: string; friendId: string; deliveredAt: string }
) {
  const { scenarioId, stepId, friendId, deliveredAt } = params

  if (!scenarioId || !stepId || !friendId) {
    console.warn('[line-webhook syncStepDeliveryTimers] skipped (missing identifiers)', {
      scenarioId,
      stepId,
      friendId,
    })
    return
  }

  console.log('[line-webhook syncStepDeliveryTimers] start', {
    scenarioId,
    stepId,
    friendId,
    deliveredAt,
  })

  try {
    const { data: pages, error: pageError } = await supabase
      .from('cms_pages')
      .select('share_code, user_id, timer_duration_seconds')
      .eq('timer_enabled', true)
      .eq('timer_mode', 'step_delivery')
      .eq('timer_scenario_id', scenarioId)
      .eq('timer_step_id', stepId)

    if (pageError) {
      console.error('[line-webhook syncStepDeliveryTimers] page fetch error', pageError)
      return
    }

    if (!pages || pages.length === 0) {
      console.log('[line-webhook syncStepDeliveryTimers] no pages found')
      return
    }

    console.log('[line-webhook syncStepDeliveryTimers] pages matched', pages.map((p: any) => p.share_code))

    const updateTimestamp = new Date().toISOString()
    for (const page of pages) {
      const duration = page.timer_duration_seconds ?? 0
      let timerEndAt: string | null = null
      if (duration > 0) {
        const startDate = new Date(deliveredAt)
        timerEndAt = new Date(startDate.getTime() + duration * 1000).toISOString()
      }

      const payload = {
        user_id: page.user_id,
        friend_id: friendId,
        page_share_code: page.share_code,
        scenario_id: scenarioId,
        step_id: stepId,
        access_enabled: true,
        access_source: 'step_delivery',
        timer_start_at: deliveredAt,
        timer_end_at: timerEndAt,
        first_access_at: null,
        updated_at: updateTimestamp,
      }
      console.log('[line-webhook syncStepDeliveryTimers] upserting access', payload)

      const { error: upsertError } = await supabase
        .from('friend_page_access')
        .upsert(
          payload,
          { onConflict: 'friend_id,page_share_code' }
        )

      if (upsertError) {
        console.error('[line-webhook syncStepDeliveryTimers] upsert error', upsertError)
      } else {
        console.log('[line-webhook syncStepDeliveryTimers] upsert success', {
          friend_id: friendId,
          page_share_code: page.share_code,
        })
      }
    }
  } catch (error) {
    console.error('[line-webhook syncStepDeliveryTimers] unexpected error', error)
  }
}

async function markStepAsDelivered(
  supabase: any,
  trackingId: string,
  scenarioId: string,
  friendId: string,
  currentStepId: string,
  currentStepOrder: number,
  appUserId: string
) {
  try {
    const deliveredAt = new Date().toISOString()

    // 現在のステップを配信完了に更新
    const { error: updateError } = await supabase
      .from('step_delivery_tracking')
      .update({
        status: 'delivered',
        delivered_at: deliveredAt,
        updated_at: deliveredAt
      })
      .eq('id', trackingId)

    if (updateError) {
      console.error('配信ステータス更新エラー:', updateError)
      return
    }

    console.log('ステップを配信完了としてマーク:', currentStepOrder)

    await syncStepDeliveryTimers(supabase, {
      scenarioId,
      stepId: currentStepId,
      friendId,
      deliveredAt,
    })

    // 次のステップを取得（現在+1）
    const { data: nextStep, error: nextStepErr } = await supabase
      .from('steps')
      .select('id, delivery_type, delivery_days, delivery_hours, delivery_minutes, delivery_seconds, delivery_time_of_day, specific_time')
      .eq('scenario_id', scenarioId)
      .eq('step_order', currentStepOrder + 1)
      .maybeSingle()

    if (nextStepErr) {
      console.error('次ステップ取得エラー:', nextStepErr)
      return
    }

    // シナリオが完了した場合は遷移を処理
    if (!nextStep) {
      console.log('このシナリオの全ステップが完了しました')
      const { data: transition, error: transErr } = await supabase
        .from('scenario_transitions')
        .select('to_scenario_id')
        .eq('from_scenario_id', scenarioId)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()

      if (transErr) {
        console.warn('遷移設定の取得エラー:', transErr)
        return
      }
      if (!transition?.to_scenario_id) return

      // 現在のシナリオを離脱にする
      await supabase
        .from('step_delivery_tracking')
        .update({ status: 'exited', updated_at: new Date().toISOString() })
        .eq('scenario_id', scenarioId)
        .eq('friend_id', friendId)
        .neq('status', 'exited')

      // 遷移先の最初のステップを開始
      const { data: firstStep, error: firstErr } = await supabase
        .from('steps')
        .select('id')
        .eq('scenario_id', transition.to_scenario_id)
        .order('step_order', { ascending: true })
        .limit(1)
        .maybeSingle()

      if (firstErr || !firstStep) {
        console.warn('遷移先シナリオに最初のステップがありません:', transition.to_scenario_id, firstErr)
        return
      }

      const now = new Date()
      const { data: existing, error: exErr } = await supabase
        .from('step_delivery_tracking')
        .select('id')
        .eq('scenario_id', transition.to_scenario_id)
        .eq('friend_id', friendId)
        .eq('step_id', firstStep.id)
        .maybeSingle()

      if (exErr) console.warn('遷移先トラッキング確認エラー:', exErr)

      if (!existing) {
        await supabase
          .from('step_delivery_tracking')
          .insert({
            scenario_id: transition.to_scenario_id,
            step_id: firstStep.id,
            friend_id: friendId,
            status: 'ready',
            scheduled_delivery_at: now.toISOString(),
            next_check_at: new Date(now.getTime() - 5000).toISOString(),
            created_at: now.toISOString(),
            updated_at: now.toISOString(),
          })
      } else {
        await supabase
          .from('step_delivery_tracking')
          .update({
            status: 'ready',
            scheduled_delivery_at: now.toISOString(),
            next_check_at: new Date(now.getTime() - 5000).toISOString(),
            updated_at: now.toISOString(),
          })
          .eq('id', existing.id)
      }
      return
    }

    // 次ステップのトラッキングを用意
    const { data: nextTracking } = await supabase
      .from('step_delivery_tracking')
      .select('id')
      .eq('scenario_id', scenarioId)
      .eq('friend_id', friendId)
      .eq('step_id', nextStep.id)
      .maybeSingle()

    let nextId = nextTracking?.id as string | undefined
    if (!nextId) {
      const { data: prevTracking } = await supabase
        .from('step_delivery_tracking')
        .select('campaign_id, registration_source')
        .eq('id', trackingId)
        .maybeSingle()

      const baseNow = new Date().toISOString()
      const { data: inserted } = await supabase
        .from('step_delivery_tracking')
        .insert({
          scenario_id: scenarioId,
          step_id: nextStep.id,
          friend_id: friendId,
          status: 'waiting',
          campaign_id: prevTracking?.campaign_id || null,
          registration_source: prevTracking?.registration_source || null,
          created_at: baseNow,
          updated_at: baseNow,
        })
        .select('id')
        .maybeSingle()

      nextId = inserted?.id
    }

    // スケジュール時間を計算
    let updates: any = { updated_at: new Date().toISOString() }
    try {
      const { data: friend, error: friendErr } = await supabase
        .from('line_friends')
        .select('added_at')
        .eq('id', friendId)
        .eq('user_id', appUserId) // RLS-like security
        .maybeSingle()

      if (friendErr) {
        console.warn('スケジュール計算用の友達取得に失敗。即時配信にフォールバック', friendErr)
        const now = new Date()
        updates.status = 'ready'
        updates.scheduled_delivery_at = now.toISOString()
        updates.next_check_at = new Date(now.getTime() - 5000).toISOString()
      } else {
        const { data: newScheduledTime, error: calcError } = await supabase.rpc('calculate_scheduled_delivery_time', {
          p_friend_added_at: friend?.added_at || null,
          p_delivery_type: nextStep.delivery_type,
          p_delivery_seconds: nextStep.delivery_seconds || 0,
          p_delivery_minutes: nextStep.delivery_minutes || 0,
          p_delivery_hours: nextStep.delivery_hours || 0,
          p_delivery_days: nextStep.delivery_days || 0,
          p_specific_time: nextStep.specific_time || null,
          p_previous_step_delivered_at: deliveredAt,
          p_delivery_time_of_day: nextStep.delivery_time_of_day || null
        })

        if (!calcError && newScheduledTime) {
          const scheduled = new Date(newScheduledTime)
          const now = new Date()
          if (scheduled <= now) {
            updates.status = 'ready'
            updates.scheduled_delivery_at = now.toISOString()
            updates.next_check_at = new Date(now.getTime() - 5000).toISOString()
          } else {
            updates.status = 'waiting'
            updates.scheduled_delivery_at = scheduled.toISOString()
            updates.next_check_at = new Date(scheduled.getTime() - 5000).toISOString()
          }
        } else {
          console.warn('次回スケジュールの計算に失敗。即時配信にフォールバック', calcError)
          const now = new Date()
          updates.status = 'ready'
          updates.scheduled_delivery_at = now.toISOString()
          updates.next_check_at = new Date(now.getTime() - 5000).toISOString()
        }
      }
    } catch (calcCatch) {
      console.warn('スケジュール計算処理でエラー。即時配信にフォールバック', calcCatch)
      const now = new Date()
      updates.status = 'ready'
      updates.scheduled_delivery_at = now.toISOString()
      updates.next_check_at = new Date(now.getTime() - 5000).toISOString()
    }

    const { error: prepErr } = await supabase
      .from('step_delivery_tracking')
      .update(updates)
      .eq('id', nextId as string)

    if (prepErr) {
      console.error('次ステップ準備エラー:', prepErr)
    } else {
      console.log('次のステップを準備:', currentStepOrder + 1, updates)
    }

  } catch (error) {
    console.error('ステップ完了処理エラー:', error)
  }
}

async function handleUnfollow(event: LineEvent, supabase: any, req: Request, appUserId: string) {
  try {
    const { source } = event
    console.log(`User ${source.userId} unfollowed the bot`)

    // Mark friend as blocked instead of deleting
    const { error: updateError } = await supabase
      .from('line_friends')
      .update({ 
        is_blocked: true,
        updated_at: new Date().toISOString() 
      })
      .eq('user_id', appUserId) // RLS-like security
      .eq('line_user_id', source.userId)

    if (updateError) {
      console.error('Error marking friend as blocked:', updateError)
    } else {
      console.log('Friend marked as blocked:', source.userId)
    }

  } catch (error) {
    console.error('Error handling unfollow:', error)
  }
}

async function ensureFriendExists(userId: string, supabase: any, appUserId: string) {
  try {
    // Check if friend already exists for the specific user
    const { data: existingFriend, error: friendError } = await supabase
      .from('line_friends')
      .select('id')
      .eq('user_id', appUserId) // RLS-like security
      .eq('line_user_id', userId)
      .single()

    if (existingFriend) {
      console.log('Friend already exists for this user:', userId)
      return
    }

    // If friend doesn't exist, get profile and add them
    const userProfile = await getLineUserProfile(userId, supabase, appUserId)
    
    if (userProfile) {
      console.log('Got user profile:', userProfile)
      
      // Get the app user's profile to update friend count
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('friends_count')
        .eq('user_id', appUserId)
        .single()

      if (profileError) {
        console.error('Could not get owner profile to update friend count', profileError)
        // Continue anyway, friend count will be off but core logic proceeds
      }

      // Insert friend data
      const insertData = {
        user_id: appUserId,
        line_user_id: userId,
        display_name: userProfile.displayName,
        picture_url: userProfile.pictureUrl,
        added_at: new Date().toISOString()
      }
      
      console.log('Inserting friend data:', insertData)
      
      const { error: insertError } = await supabase
        .from('line_friends')
        .insert(insertData)

      if (insertError) {
        console.error('Error inserting friend:', insertError)
      } else {
        console.log('Friend inserted successfully')
        
        // Update friends count if profile was found
        if (profile) {
          const { error: updateError } = await supabase
            .from('profiles')
            .update({ 
              friends_count: (profile.friends_count || 0) + 1 
            })
            .eq('user_id', appUserId)

          if (updateError) {
            console.error('Error updating friends count:', updateError)
          } else {
            console.log('Friends count updated successfully')
          }
        }

        console.log('Friend added successfully:', userProfile.displayName)
      }
    } else {
      console.error('Could not get user profile from LINE API, cannot create friend record.')
    }

  } catch (error) {
    console.error('Error ensuring friend exists:', error)
  }
}

async function getLineUserProfile(userId: string, supabase: any, appUserId: string) {
  try {
    // Get the access token for the specific user
    const { data: secureCredentials, error: secureError } = await supabase
      .from('secure_line_credentials')
      .select('encrypted_value')
      .eq('user_id', appUserId) // RLS-like security
      .eq('credential_type', 'channel_access_token')
      .single()

    if (secureError || !secureCredentials?.encrypted_value) {
      console.warn('⚠ LINE アクセストークンが見つかりません for user:', appUserId, secureError)
      return null
    }

    const accessToken = secureCredentials.encrypted_value
    console.log('✓ secure_line_credentials からトークンを取得しました for user:', appUserId)

    const response = await fetch(`https://api.line.me/v2/bot/profile/${userId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    })

    if (!response.ok) {
      console.warn(`⚠ LINE API プロフィール取得エラー: ${response.status} - ただし処理は継続します`)
      return null
    }

    const profile = await response.json()
    console.log('✓ LINE プロフィール取得成功:', profile.displayName)
    return profile

  } catch (error) {
    console.warn('⚠ プロフィール取得エラー（処理は継続）:', error)
    return null
  }
}


// Find recent invite code for a user based on timing and other factors
async function findRecentInviteCode(lineUserId: string, supabase: any) {
  try {
    // Get recent invite clicks (within last 10 minutes)
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()
    
    const { data: recentClicks, error } = await supabase
      .from('invite_clicks')
      .select(`
        scenario_invite_codes!inner (
          invite_code,
          is_active
        )
      `)
      .gte('clicked_at', tenMinutesAgo)
      .eq('scenario_invite_codes.is_active', true)
      .order('clicked_at', { ascending: false })
      .limit(5)
    
    if (error || !recentClicks || recentClicks.length === 0) {
      console.log('最近の招待クリックが見つかりません')
      return null
    }
    
    // Return the most recent invite code
    const mostRecentClick = recentClicks[0]
    return mostRecentClick.scenario_invite_codes.invite_code
    
  } catch (error) {
    console.error('招待コード検索エラー:', error)
    return null
  }
}

// Function to download LINE media content and store in Supabase Storage
async function downloadLineMedia(messageId: string, lineUserId: string, supabase: any, appUserId: string) {
  try {
    // Get access token from secure credentials for the specific user
    const { data: credentials } = await supabase
      .from('secure_line_credentials')
      .select('encrypted_value')
      .eq('user_id', appUserId) // RLS-like security
      .eq('credential_type', 'channel_access_token')
      .single()

    if (!credentials?.encrypted_value) {
      console.error('No access token found for media download for user:', appUserId)
      return { success: false, error: 'No access token found' }
    }

    const accessToken = credentials.encrypted_value

    // Download content from LINE
    const contentResponse = await fetch(`https://api-data.line.me/v2/bot/message/${messageId}/content`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    })

    if (!contentResponse.ok) {
      console.error('Failed to download content from LINE:', contentResponse.status)
      return { success: false, error: 'Failed to download from LINE' }
    }

    const contentType = contentResponse.headers.get('content-type') || 'application/octet-stream'
    const contentBuffer = await contentResponse.arrayBuffer()
    
    // Determine file extension based on content type
    let extension = 'bin'
    if (contentType.includes('image/jpeg')) extension = 'jpg'
    else if (contentType.includes('image/png')) extension = 'png'
    else if (contentType.includes('image/gif')) extension = 'gif'
    else if (contentType.includes('video/mp4')) extension = 'mp4'
    else if (contentType.includes('audio/m4a')) extension = 'm4a'
    else if (contentType.includes('audio/ogg')) extension = 'ogg'

    // Create file path: user_id/message_id.extension
    const filePath = `${friendData.user_id}/${messageId}.${extension}`

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('chat-media')
      .upload(filePath, contentBuffer, {
        contentType: contentType,
        upsert: true
      })

    if (uploadError) {
      console.error('Failed to upload to storage:', uploadError)
      return { success: false, error: 'Failed to upload to storage' }
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('chat-media')
      .getPublicUrl(filePath)

    console.log('Media uploaded successfully:', filePath)
    
    return {
      success: true,
      storage_path: filePath,
      public_url: urlData.publicUrl,
      content_type: contentType
    }

  } catch (error) {
    console.error('Error downloading LINE media:', error)
    return { success: false, error: (error as Error)?.message || 'Unknown error' }
  }
}

// Function to get sticker image URL
async function getStickerImageUrl(packageId: string, stickerId: string) {
  try {
    // LINE stickers follow a predictable URL pattern
    const stickerUrl = `https://stickershop.line-scdn.net/stickershop/v1/sticker/${stickerId}/android/sticker.png`
    
    // Verify the sticker exists by attempting to fetch it
    const response = await fetch(stickerUrl, { method: 'HEAD' })
    
    if (response.ok) {
      return {
        success: true,
        image_url: stickerUrl
      }
    } else {
      // Fallback URL pattern for some stickers
      const fallbackUrl = `https://stickershop.line-scdn.net/stickershop/v1/product/${packageId}/android/stickers/${stickerId}.png`
      const fallbackResponse = await fetch(fallbackUrl, { method: 'HEAD' })
      
      if (fallbackResponse.ok) {
        return {
          success: true,
          image_url: fallbackUrl
        }
      }
    }
    
    console.log('Sticker image not found, using placeholder')
    return {
      success: false,
      error: 'Sticker image not found'
    }

  } catch (error) {
    console.error('Error getting sticker URL:', error)
    return { success: false, error: (error as Error)?.message || 'Unknown error' }
  }
}

/**
 * ポストバックイベントを処理（アクセス解除＆シナリオ再登録）
 */
async function handlePostback(event: any, supabase: any, req: Request, appUserId: string) {
  try {
    const { postback, replyToken, source } = event
    
    console.log('📨 Postback Event Received')
    console.log('  User:', source.userId)
    console.log('  Data:', postback.data)
    
    // ポストバックデータのパース
    let postbackData: any
    try {
      postbackData = JSON.parse(postback.data)
    } catch (e) {
      postbackData = { raw: postback.data }
    }
    if (!postbackData || typeof postbackData !== 'object') {
      postbackData = { raw: postback.data }
    }
    if (!postbackData.action && typeof postbackData.raw === 'string') {
      const rawString = postbackData.raw.trim()
      if (rawString.startsWith('{') || rawString.startsWith('[')) {
        try {
          postbackData = JSON.parse(rawString)
        } catch {
          postbackData = { raw: rawString }
        }
      } else if (rawString.includes('=')) {
        const params = new URLSearchParams(rawString)
        const queryPayload: Record<string, string> = {}
        params.forEach((value, key) => {
          queryPayload[key] = value
        })
        postbackData = {
          ...queryPayload,
          action: queryPayload['action'] ?? postbackData.action ?? undefined
        }
      }
    }

    const action = typeof postbackData?.action === 'string'
      ? postbackData.action
      : undefined

    if (action === 'trigger_scenario') {
      const scenarioId =
        postbackData.scenario_id ||
        postbackData.scenario ||
        postbackData.target_scenario_id ||
        postbackData.scenarioId

      if (!scenarioId || typeof scenarioId !== 'string') {
        console.error('trigger_scenario missing scenario_id in postback data')
        await sendReplyMessage(
          replyToken,
          postbackData?.error_message ?? 'シナリオが設定されていません。',
          supabase,
          appUserId
        )
        return
      }

      await ensureFriendExists(source.userId, supabase, appUserId)

      const { data: friendData, error: friendError } = await supabase
        .from('line_friends')
        .select('id, display_name, picture_url')
        .eq('line_user_id', source.userId)
        .eq('user_id', appUserId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (friendError || !friendData) {
        console.error('trigger_scenario friend lookup failed:', friendError)
        await sendReplyMessage(
          replyToken,
          postbackData?.error_message ?? '処理に失敗しました。時間をおいて再度お試しください。',
          supabase,
          appUserId
        )
        return
      }

      const onceRaw = postbackData?.once
      const allowOnlyOnce =
        onceRaw === undefined ||
        onceRaw === null ||
        onceRaw === true ||
        onceRaw === 'true' ||
        onceRaw === '1'

      const logAction =
        typeof postbackData?.log_action === 'string' && postbackData.log_action.trim().length > 0
          ? postbackData.log_action.trim()
          : 'trigger_scenario'

      if (allowOnlyOnce) {
        const { data: existingTrigger } = await supabase
          .from('postback_logs')
          .select('id')
          .eq('friend_id', friendData.id)
          .eq('scenario_id', scenarioId)
          .eq('action', logAction)
          .maybeSingle()

        if (existingTrigger) {
          console.log('trigger_scenario already processed for this friend/scenario/action')
          await sendReplyMessage(
            replyToken,
            postbackData?.already_message ?? 'この操作は既に完了しています。',
            supabase,
            appUserId
          )
          return
        }
      }

      try {
        const registrationSource =
          typeof postbackData?.source === 'string' && postbackData.source.trim().length > 0
            ? postbackData.source.trim()
            : 'greeting_postback'

        const { data: reg, error: regErr } = await supabase.rpc('register_friend_to_scenario', {
          p_line_user_id: source.userId,
          p_invite_code: postbackData?.invite_code ?? 'DIRECT_SCENARIO',
          p_display_name: friendData.display_name ?? null,
          p_picture_url: friendData.picture_url ?? null,
          p_registration_source: registrationSource,
          p_scenario_id: scenarioId,
          p_user_id: appUserId
        })

        if (regErr || !reg?.success) {
          console.error('trigger_scenario register_friend_to_scenario failed:', regErr, reg)
          await sendReplyMessage(
            replyToken,
            postbackData?.error_message ?? 'シナリオの開始に失敗しました。時間をおいて再度お試しください。',
            supabase,
            appUserId
          )
          return
        }

        if (allowOnlyOnce) {
          const { error: logError } = await supabase
            .from('postback_logs')
            .insert({
              friend_id: friendData.id,
              scenario_id: scenarioId,
              action: logAction,
              line_user_id: source.userId
            })

          if (logError) {
            console.error('trigger_scenario failed to log postback:', logError)
          }
        }

        await sendReplyMessage(
          replyToken,
          postbackData?.success_message ?? 'シナリオを開始しました。',
          supabase,
          appUserId
        )

        const scenarioForDelivery = reg?.scenario_id ?? scenarioId
        const friendForDelivery = reg?.friend_id ?? friendData.id

        await startStepDelivery(supabase, scenarioForDelivery, friendForDelivery, appUserId)
        return
      } catch (error) {
        console.error('trigger_scenario processing error:', error)
        await sendReplyMessage(
          replyToken,
          postbackData?.error_message ?? '処理に失敗しました。時間をおいて再度お試しください。',
          supabase,
          appUserId
        )
        return
      }
    }
    // restore_access 以外は無視（他のポストバックに影響しない）
    if (action !== 'restore_access') {
      console.log('ℹ️ Not a restore_access action, skipping')
      return
    }

    const scenarioId = postbackData.scenario_id || postbackData.scenario || postbackData.scenarioId
    if (!scenarioId) {
      console.error('❌ scenario_id missing in postback data')
      return
    }
    
    // 友だち情報の取得（最新のレコードを優先）
    const { data: friendData, error: friendError } = await supabase
      .from('line_friends')
      .select('id, user_id, display_name, picture_url')
      .eq('line_user_id', source.userId)
      .eq('user_id', appUserId) // RLS-like security
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
    
    if (friendError || !friendData) {
      console.error('❌ Friend not found:', friendError)
      await sendReplyMessage(replyToken, 'エラーが発生しました。', supabase, appUserId)
      return
    }
    
    console.log('✓ Friend found:', friendData.id)
    
    // 既に押されているかチェック
    const { data: existingLog } = await supabase
      .from('postback_logs')
      .select('id')
      .eq('friend_id', friendData.id)
      .eq('scenario_id', scenarioId)
      .eq('action', 'restore_access')
      .maybeSingle()
    
    if (existingLog) {
      console.log('⚠️ Already pressed by this friend')
      await sendReplyMessage(replyToken, '既に押されています。', supabase, appUserId)
      return
    }
    
    // 1回目の処理開始
    console.log('🔄 Starting restore_access process...')
    
    // ログに記録
    const { error: logError } = await supabase
      .from('postback_logs')
      .insert({
        friend_id: friendData.id,
        scenario_id: scenarioId,
        action: 'restore_access',
        line_user_id: source.userId
      })
    
    if (logError) {
      console.error('❌ Failed to log postback:', logError)
      await sendReplyMessage(replyToken, 'エラーが発生しました。', supabase, appUserId)
      return
    }
    
    // 応答メッセージ送信
    await sendReplyMessage(replyToken, '期間延長/再開', supabase, appUserId)
    console.log('✓ Reply sent: 期間延長/再開')
    
    // page_share_code を cms_pages から取得
    const { data: cmsPage } = await supabase
      .from('cms_pages')
      .select('share_code')
      .eq('timer_scenario_id', scenarioId)
      .eq('user_id', appUserId) // RLS-like security
      .maybeSingle()
    
    const pageShareCode = cmsPage?.share_code || null
    
    // Edge Function経由でシナリオリセット実行
    const { data: restoreResult, error: restoreError } = await supabase.functions.invoke(
      'scenario-restore',
      {
        body: {
          line_user_id: source.userId,
          target_scenario_id: scenarioId,
          page_share_code: pageShareCode,
          user_id: appUserId // Pass the user ID to the function
        }
      }
    )
    
    if (restoreError || !restoreResult?.success) {
      console.error('❌ Restore failed:', restoreError || restoreResult)
      return
    }
    
    console.log('✅ Restore completed:', restoreResult)
    console.log('  - Steps registered:', restoreResult.steps_registered)
    console.log('  - Friend ID:', restoreResult.friend_id)
    
  } catch (error) {
    console.error('💥 Error in handlePostback:', error)
  }
}
