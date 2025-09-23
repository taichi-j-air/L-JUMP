import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    console.log("=== CREATE CHECKOUT SESSION START ===");
    const body = await req.json();
    console.log("Request body:", JSON.stringify(body));

    const { product_id, uid, utm_source, utm_medium, utm_campaign } = body;

    if (!product_id) {
      return new Response(
        JSON.stringify({ error: '商品IDが必要です' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 商品情報を取得
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('*')
      .eq('id', product_id)
      .eq('is_active', true)
      .single();

    if (productError || !product) {
      console.error('Product fetch error:', productError);
      return new Response(
        JSON.stringify({ error: '商品が見つかりません' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log("Product found:", product.name);

    // Stripe認証情報を取得
    const { data: stripeCredentials, error: stripeError } = await supabase
      .from('stripe_credentials')
      .select('*')
      .eq('user_id', product.user_id)
      .single();

    if (stripeError || !stripeCredentials) {
      console.error('Stripe credentials error:', stripeError);
      return new Response(
        JSON.stringify({ error: 'Stripe設定が見つかりません' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Stripe環境の適切な判定とキー選択
    console.log("Determining Stripe environment for price ID:", product.stripe_price_id);
    
    let stripeSecretKey: string;
    let isTestMode: boolean;
    
    // まずテストキーが利用可能かチェック
    if (stripeCredentials.test_secret_key) {
      try {
        // テスト環境でprice IDを確認
        const testStripe = new Stripe(stripeCredentials.test_secret_key, {
          apiVersion: "2023-10-16",
        });
        
        await testStripe.prices.retrieve(product.stripe_price_id);
        // テスト環境でprice IDが見つかった場合
        stripeSecretKey = stripeCredentials.test_secret_key;
        isTestMode = true;
        console.log("Price ID found in test environment, using test mode");
      } catch (testError: any) {
        console.log("Price ID not found in test environment:", testError.message);
        
        // テスト環境で見つからない場合、ライブ環境を試す
        if (stripeCredentials.live_secret_key) {
          try {
            const liveStripe = new Stripe(stripeCredentials.live_secret_key, {
              apiVersion: "2023-10-16",
            });
            
            await liveStripe.prices.retrieve(product.stripe_price_id);
            // ライブ環境でprice IDが見つかった場合
            stripeSecretKey = stripeCredentials.live_secret_key;
            isTestMode = false;
            console.log("Price ID found in live environment, using live mode");
          } catch (liveError: any) {
            console.error("Price ID not found in either environment:", liveError.message);
            return new Response(
              JSON.stringify({ 
                error: 'Stripe価格IDが見つかりません',
                details: `Price ID ${product.stripe_price_id} が見つかりません`
              }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        } else {
          return new Response(
            JSON.stringify({ error: 'Stripeライブ環境の設定が必要です' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    } else if (stripeCredentials.live_secret_key) {
      // テストキーがない場合、ライブキーのみ使用
      stripeSecretKey = stripeCredentials.live_secret_key;
      isTestMode = false;
      console.log("Only live key available, using live mode");
    } else {
      return new Response(
        JSON.stringify({ error: 'Stripe設定が不完全です' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2023-10-16",
    });

    console.log(`Using Stripe ${isTestMode ? 'test' : 'live'} mode with price ID: ${product.stripe_price_id}`);

    // チェックアウトセッションの設定
    const mode = product.product_type === 'subscription' ? 'subscription' : 'payment';
    
    const sessionConfig: any = {
      line_items: [
        {
          price: product.stripe_price_id,
          quantity: 1,
        },
      ],
      mode,
      success_url: product.success_redirect_url || `${req.headers.get('origin')}/payment-success`,
      cancel_url: product.cancel_redirect_url || `${req.headers.get('origin')}/payment-canceled`,
      metadata: {
        product_id: product.id,
        user_id: product.user_id,
        uid: uid || '',
        utm_source: utm_source || '',
        utm_medium: utm_medium || '',
        utm_campaign: utm_campaign || '',
      },
    };

    // サブスクリプション商品の場合、トライアル期間を設定
    if (mode === 'subscription' && product.trial_period_days) {
      sessionConfig.subscription_data = {
        trial_period_days: product.trial_period_days,
      };
    }

    console.log("Creating Stripe checkout session...");
    const session = await stripe.checkout.sessions.create(sessionConfig);

    // 注文記録をデータベースに保存
    const { error: orderError } = await supabase
      .from('orders')
      .insert({
        user_id: null, // ゲスト注文として処理
        product_id: product.id,
        stripe_session_id: session.id,
        amount: product.price,
        currency: product.currency,
        status: 'pending',
        metadata: {
          uid,
          utm_source,
          utm_medium,
          utm_campaign,
        },
      });

    if (orderError) {
      console.error('Order insert error:', orderError);
      // エラーでも処理を続行（注文記録は必須ではない）
    }

    console.log("Checkout session created successfully:", session.id);

    return new Response(
      JSON.stringify({
        url: session.url,
        session_id: session.id,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Checkout session creation error:', error);
    return new Response(
      JSON.stringify({ 
        error: '決済セッションの作成に失敗しました',
        details: error.message 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});