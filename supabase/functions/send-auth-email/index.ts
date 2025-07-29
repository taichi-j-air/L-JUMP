import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const hookSecret = Deno.env.get("SEND_AUTH_EMAIL_HOOK_SECRET") || "your-webhook-secret";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload = await req.text();
    const headers = Object.fromEntries(req.headers);
    
    let emailData: AuthEmailData;
    
    // Try to parse as webhook first, fallback to direct JSON
    try {
      const wh = new Webhook(hookSecret);
      emailData = wh.verify(payload, headers) as AuthEmailData;
    } catch {
      // Fallback to direct JSON parsing for testing
      emailData = JSON.parse(payload) as AuthEmailData;
    }

    const { user, email_data } = emailData;
    const { token_hash, redirect_to, email_action_type, site_url } = email_data;

    // Generate the verification URL
    const verificationUrl = `${site_url}/auth/v1/verify?token=${token_hash}&type=${email_action_type}&redirect_to=${redirect_to}`;

    // Determine email content based on action type
    let subject = "";
    let htmlContent = "";

    switch (email_action_type) {
      case "signup":
        subject = "FlexMaster - アカウント確認";
        htmlContent = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #333; text-align: center;">FlexMaster</h1>
            <h2 style="color: #666;">アカウント確認</h2>
            <p>FlexMasterへようこそ！</p>
            <p>以下のボタンをクリックしてアカウントを確認してください：</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${verificationUrl}" 
                 style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
                アカウントを確認
              </a>
            </div>
            <p style="color: #666; font-size: 14px;">
              ボタンが機能しない場合は、以下のURLをブラウザにコピー＆ペーストしてください：<br>
              <a href="${verificationUrl}">${verificationUrl}</a>
            </p>
            <p style="color: #999; font-size: 12px; margin-top: 40px;">
              このメールに心当たりがない場合は、無視していただいて構いません。
            </p>
          </div>
        `;
        break;
      
      case "recovery":
        subject = "FlexMaster - パスワードリセット";
        htmlContent = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #333; text-align: center;">FlexMaster</h1>
            <h2 style="color: #666;">パスワードリセット</h2>
            <p>パスワードリセットのリクエストを受け付けました。</p>
            <p>以下のボタンをクリックして新しいパスワードを設定してください：</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${verificationUrl}" 
                 style="background-color: #dc3545; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
                パスワードをリセット
              </a>
            </div>
            <p style="color: #666; font-size: 14px;">
              ボタンが機能しない場合は、以下のURLをブラウザにコピー＆ペーストしてください：<br>
              <a href="${verificationUrl}">${verificationUrl}</a>
            </p>
            <p style="color: #999; font-size: 12px; margin-top: 40px;">
              このリクエストに心当たりがない場合は、無視していただいて構いません。
            </p>
          </div>
        `;
        break;
      
      default:
        subject = "FlexMaster - 認証メール";
        htmlContent = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #333; text-align: center;">FlexMaster</h1>
            <p>以下のリンクをクリックして認証を完了してください：</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${verificationUrl}" 
                 style="background-color: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
                認証を完了
              </a>
            </div>
          </div>
        `;
    }

    const emailResponse = await resend.emails.send({
      from: "FlexMaster <onboarding@resend.dev>",
      to: [user.email],
      subject: subject,
      html: htmlContent,
    });

    console.log("認証メール送信成功:", emailResponse);

    return new Response(JSON.stringify({ success: true, id: emailResponse.data?.id }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("認証メール送信エラー:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);