import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";

// 環境変数の取得
const resendApiKey = Deno.env.get("RESEND_API_KEY");
const hookSecret = Deno.env.get("SEND_AUTH_EMAIL_HOOK_SECRET") || "your-webhook-secret";
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

// CORS設定
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// 型定義
interface AuthEmailData {
  user: {
    email: string;
  };
  email_data: {
    token: string;
    token_hash: string;
    redirect_to: string;
    email_action_type: string;
    site_url: string;
  };
}

// メインハンドラー
const handler = async (req: Request): Promise<Response> => {
  const startTime = Date.now();
  console.log("=".repeat(50));
  console.log("🚀 AUTH EMAIL FUNCTION STARTED");
  console.log("Time:", new Date().toISOString());
  console.log("Method:", req.method);
  console.log("URL:", req.url);
  console.log("=".repeat(50));

  // CORS プリフライトリクエストの処理
  if (req.method === "OPTIONS") {
    console.log("📤 Handling CORS preflight request");
    return new Response(null, { 
      status: 200,
      headers: corsHeaders 
    });
  }

  // POSTリクエスト以外は拒否
  if (req.method !== "POST") {
    console.log("❌ Invalid method:", req.method);
    return new Response(JSON.stringify({ 
      error: "Method not allowed. Use POST.",
      method: req.method 
    }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }

  try {
    // ステップ1: 環境変数の確認
    console.log("🔍 STEP 1: Environment Variables Check");
    console.log("  - RESEND_API_KEY:", resendApiKey ? "✅ Set" : "❌ Missing");
    console.log("  - SUPABASE_ANON_KEY:", supabaseAnonKey ? "✅ Set" : "❌ Missing");
    console.log("  - HOOK_SECRET:", hookSecret ? "✅ Set" : "❌ Missing");

    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY environment variable is not configured");
    }
    if (!supabaseAnonKey) {
      throw new Error("SUPABASE_ANON_KEY environment variable is not configured");
    }

    // Resendインスタンスの初期化
    const resend = new Resend(resendApiKey);

    // ステップ2: リクエストボディの解析
    console.log("🔍 STEP 2: Request Body Analysis");
    const payload = await req.text();
    const headers = Object.fromEntries(req.headers);
    
    console.log("  - Payload length:", payload.length);
    console.log("  - Content-Type:", headers["content-type"] || "not specified");
    console.log("  - Payload preview:", payload.substring(0, 100) + "...");

    if (!payload) {
      throw new Error("Request body is empty");
    }

    // ステップ3: データの解析（Webhook検証またはJSON解析）
    console.log("🔍 STEP 3: Data Parsing");
    let emailData: AuthEmailData;
    
    try {
      // Webhook検証を試行
      console.log("  - Attempting webhook verification...");
      const wh = new Webhook(hookSecret);
      emailData = wh.verify(payload, headers) as AuthEmailData;
      console.log("  - ✅ Webhook verification successful");
    } catch (webhookError) {
      console.log("  - ⚠️ Webhook verification failed, trying direct JSON parse");
      console.log("  - Webhook error:", webhookError);
      
      try {
        emailData = JSON.parse(payload) as AuthEmailData;
        console.log("  - ✅ Direct JSON parsing successful");
      } catch (jsonError) {
        console.log("  - ❌ JSON parsing failed:", jsonError);
        throw new Error(`Failed to parse request data: ${jsonError.message}`);
      }
    }

    // ステップ4: データ検証
    console.log("🔍 STEP 4: Data Validation");
    const { user, email_data } = emailData;
    
    if (!user || !user.email) {
      throw new Error("User email is missing from request data");
    }
    if (!email_data) {
      throw new Error("Email data is missing from request data");
    }

    const { token_hash, redirect_to, email_action_type, site_url } = email_data;
    
    console.log("  - User email:", user.email);
    console.log("  - Action type:", email_action_type);
    console.log("  - Site URL:", site_url);
    console.log("  - Redirect to:", redirect_to);
    console.log("  - Token hash length:", token_hash?.length || 0);

    // 必須フィールドの検証
    const requiredFields = [
      { field: 'token_hash', value: token_hash },
      { field: 'email_action_type', value: email_action_type },
      { field: 'site_url', value: site_url }
    ];

    for (const { field, value } of requiredFields) {
      if (!value) {
        throw new Error(`Required field '${field}' is missing`);
      }
    }

    // ステップ5: 認証URLの生成
    console.log("🔍 STEP 5: Verification URL Generation");
    const redirectUrl = redirect_to || `${site_url}/dashboard`;
    const verificationUrl = `${site_url}/verify?token=${token_hash}&type=${email_action_type}&redirect_to=${encodeURIComponent(redirectUrl)}&apikey=${supabaseAnonKey}`;
    
    console.log("  - Generated URL:", verificationUrl);

    // ステップ6: メール内容の決定
    console.log("🔍 STEP 6: Email Content Generation");
    let subject = "";
    let htmlContent = "";

    switch (email_action_type) {
      case "signup":
        subject = "FlexMaster - アカウント確認が必要です";
        htmlContent = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>FlexMaster - アカウント確認</title>
          </head>
          <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
            <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 20px;">
              <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: #333; font-size: 28px; margin: 0;">FlexMaster</h1>
                <p style="color: #666; margin: 10px 0 0 0;">フレキシブルワーク管理システム</p>
              </div>
              
              <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 30px;">
                <h2 style="color: #333; font-size: 20px; margin: 0 0 15px 0;">アカウント確認</h2>
                <p style="color: #555; line-height: 1.6; margin: 0;">
                  FlexMasterへのご登録ありがとうございます！<br>
                  アカウントを有効化するため、以下のボタンをクリックしてください。
                </p>
              </div>

              <div style="text-align: center; margin: 30px 0;">
                <a href="${verificationUrl}" 
                   style="background-color: #007bff; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold; font-size: 16px;">
                  アカウントを確認する
                </a>
              </div>

              <div style="background-color: #e9ecef; padding: 15px; border-radius: 5px; margin: 30px 0;">
                <p style="color: #666; font-size: 14px; margin: 0; line-height: 1.5;">
                  <strong>ボタンがクリックできない場合：</strong><br>
                  以下のURLをコピーしてブラウザのアドレスバーに貼り付けてください：<br>
                  <a href="${verificationUrl}" style="color: #007bff; word-break: break-all;">${verificationUrl}</a>
                </p>
              </div>

              <hr style="border: none; border-top: 1px solid #dee2e6; margin: 30px 0;">
              
              <p style="color: #999; font-size: 12px; text-align: center; margin: 0;">
                このメールに心当たりがない場合は、無視してください。<br>
                FlexMaster サポートチーム
              </p>
            </div>
          </body>
          </html>
        `;
        break;
      
      case "recovery":
        subject = "FlexMaster - パスワードリセットのご依頼";
        htmlContent = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>FlexMaster - パスワードリセット</title>
          </head>
          <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
            <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 20px;">
              <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: #333; font-size: 28px; margin: 0;">FlexMaster</h1>
                <p style="color: #666; margin: 10px 0 0 0;">フレキシブルワーク管理システム</p>
              </div>
              
              <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; margin-bottom: 30px; border-left: 4px solid #ffc107;">
                <h2 style="color: #333; font-size: 20px; margin: 0 0 15px 0;">パスワードリセット</h2>
                <p style="color: #555; line-height: 1.6; margin: 0;">
                  パスワードリセットのリクエストを受け付けました。<br>
                  新しいパスワードを設定するため、以下のボタンをクリックしてください。
                </p>
              </div>

              <div style="text-align: center; margin: 30px 0;">
                <a href="${verificationUrl}" 
                   style="background-color: #dc3545; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold; font-size: 16px;">
                  パスワードをリセット
                </a>
              </div>

              <div style="background-color: #f8d7da; padding: 15px; border-radius: 5px; margin: 30px 0; border-left: 4px solid #dc3545;">
                <p style="color: #721c24; font-size: 14px; margin: 0; line-height: 1.5;">
                  <strong>セキュリティのため：</strong><br>
                  このリンクは24時間で有効期限切れになります。<br>
                  心当たりがない場合は、このメールを無視してください。
                </p>
              </div>

              <div style="background-color: #e9ecef; padding: 15px; border-radius: 5px; margin: 30px 0;">
                <p style="color: #666; font-size: 14px; margin: 0; line-height: 1.5;">
                  <strong>ボタンがクリックできない場合：</strong><br>
                  以下のURLをコピーしてブラウザのアドレスバーに貼り付けてください：<br>
                  <a href="${verificationUrl}" style="color: #dc3545; word-break: break-all;">${verificationUrl}</a>
                </p>
              </div>

              <hr style="border: none; border-top: 1px solid #dee2e6; margin: 30px 0;">
              
              <p style="color: #999; font-size: 12px; text-align: center; margin: 0;">
                FlexMaster サポートチーム
              </p>
            </div>
          </body>
          </html>
        `;
        break;
      
      default:
        subject = "FlexMaster - 認証が必要です";
        htmlContent = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>FlexMaster - 認証</title>
          </head>
          <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
            <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 20px;">
              <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: #333; font-size: 28px; margin: 0;">FlexMaster</h1>
                <p style="color: #666; margin: 10px 0 0 0;">フレキシブルワーク管理システム</p>
              </div>
              
              <div style="background-color: #d1ecf1; padding: 20px; border-radius: 8px; margin-bottom: 30px; border-left: 4px solid #17a2b8;">
                <h2 style="color: #333; font-size: 20px; margin: 0 0 15px 0;">認証が必要です</h2>
                <p style="color: #555; line-height: 1.6; margin: 0;">
                  以下のボタンをクリックして認証を完了してください。
                </p>
              </div>

              <div style="text-align: center; margin: 30px 0;">
                <a href="${verificationUrl}" 
                   style="background-color: #28a745; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold; font-size: 16px;">
                  認証を完了
                </a>
              </div>

              <div style="background-color: #e9ecef; padding: 15px; border-radius: 5px; margin: 30px 0;">
                <p style="color: #666; font-size: 14px; margin: 0; line-height: 1.5;">
                  <strong>ボタンがクリックできない場合：</strong><br>
                  以下のURLをコピーしてブラウザのアドレスバーに貼り付けてください：<br>
                  <a href="${verificationUrl}" style="color: #28a745; word-break: break-all;">${verificationUrl}</a>
                </p>
              </div>

              <hr style="border: none; border-top: 1px solid #dee2e6; margin: 30px 0;">
              
              <p style="color: #999; font-size: 12px; text-align: center; margin: 0;">
                FlexMaster サポートチーム
              </p>
            </div>
          </body>
          </html>
        `;
    }

    console.log("  - Subject:", subject);
    console.log("  - HTML content length:", htmlContent.length);

    // ステップ7: メール送信
    console.log("🔍 STEP 7: Email Sending");
    console.log("  - Sending to:", user.email);
    
    const emailResponse = await resend.emails.send({
      from: "FlexMaster <onboarding@resend.dev>",
      to: [user.email],
      subject: subject,
      html: htmlContent,
    });

    console.log("  - Email API response:", JSON.stringify(emailResponse, null, 2));

    // レスポンスの確認
    if (emailResponse.error) {
      console.log("❌ Resend API error detected:", emailResponse.error);
      throw new Error(`Resend API error: ${JSON.stringify(emailResponse.error)}`);
    }

    if (!emailResponse.data?.id) {
      console.log("❌ Email response missing ID:", emailResponse);
      throw new Error("Email response is missing ID - send may have failed");
    }

    // 成功ログ
    const endTime = Date.now();
    const executionTime = endTime - startTime;
    
    console.log("=".repeat(50));
    console.log("✅ EMAIL SENT SUCCESSFULLY!");
    console.log("  - Email ID:", emailResponse.data.id);
    console.log("  - Recipient:", user.email);
    console.log("  - Action type:", email_action_type);
    console.log("  - Execution time:", executionTime + "ms");
    console.log("  - Timestamp:", new Date().toISOString());
    console.log("=".repeat(50));

    return new Response(JSON.stringify({ 
      success: true,
      message: "Authentication email sent successfully",
      data: {
        emailId: emailResponse.data.id,
        recipient: user.email,
        actionType: email_action_type,
        executionTime: executionTime + "ms",
        timestamp: new Date().toISOString()
      }
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });

  } catch (error: any) {
    // エラーハンドリング
    const endTime = Date.now();
    const executionTime = endTime - startTime;
    
    console.log("=".repeat(50));
    console.log("❌ FUNCTION ERROR OCCURRED");
    console.log("  - Error message:", error.message);
    console.log("  - Error stack:", error.stack);
    console.log("  - Execution time:", executionTime + "ms");
    console.log("  - Timestamp:", new Date().toISOString());
    console.log("=".repeat(50));
    
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message,
      details: {
        stack: error.stack,
        executionTime: executionTime + "ms",
        timestamp: new Date().toISOString(),
        function: "send-auth-email"
      }
    }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
};

// サーバー起動
serve(handler);