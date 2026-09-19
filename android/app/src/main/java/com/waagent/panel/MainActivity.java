package com.waagent.panel;

import android.app.Activity;
import android.os.Bundle;
import android.view.View;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebChromeClient;
import android.webkit.WebViewClient;
import android.widget.LinearLayout;
import android.widget.Button;
import android.widget.TextView;
import android.graphics.Color;
import android.view.Gravity;

/**
 * لوحة التحكم كتطبيق أندرويد — WebView يعرض واجهة البوت المحلية.
 * البوت نفسه يعمل في Termux (Node.js) على نفس الجهاز.
 */
public class MainActivity extends Activity {

    private WebView web;
    private LinearLayout offline;
    private static final String URL = "http://127.0.0.1:3000";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(Color.parseColor("#075E54"));

        // شاشة عدم التشغيل (تظهر إذا كان البوت متوقفاً)
        offline = new LinearLayout(this);
        offline.setOrientation(LinearLayout.VERTICAL);
        offline.setGravity(Gravity.CENTER);
        offline.setPadding(48, 48, 48, 48);

        TextView title = new TextView(this);
        title.setText("🤖 وكيل خدمة العملاء");
        title.setTextSize(22);
        title.setTextColor(Color.WHITE);
        title.setGravity(Gravity.CENTER);
        offline.addView(title);

        TextView msg = new TextView(this);
        msg.setText("\nلتشغيل البوت افتح تطبيق Termux واكتب:\n\nwa-agent\n\nثم عُد إلى هذا التطبيق واضغط تحديث.\n\nستظهر هنا لوحة التحكم: رمز الربط QR،\nرسالة الرد الخاص، الكلمات المفتاحية،\nوسجل الطلبات المرصودة مباشرة.");
        msg.setTextSize(15);
        msg.setTextColor(Color.parseColor("#B8E6DB"));
        msg.setGravity(Gravity.CENTER);
        msg.setLineSpacing(6, 1.3f);
        offline.addView(msg);

        Button retry = new Button(this);
        retry.setText("🔄 تحديث");
        retry.setOnClickListener(new View.OnClickListener() {
            public void onClick(View v) { web.loadUrl(URL); }
        });
        LinearLayout wrap = new LinearLayout(this);
        wrap.setGravity(Gravity.CENTER);
        wrap.addView(retry);
        offline.addView(wrap, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT));

        root.addView(offline, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.MATCH_PARENT));

        web = new WebView(this);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setCacheMode(WebSettings.LOAD_NO_CACHE);
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest request) {
                v.loadUrl(request.getUrl().toString());
                return true;
            }

            @Override
            public void onPageFinished(WebView v, String url) {
                // تم التحميل — أظهر اللوحة
                offline.setVisibility(View.GONE);
                web.setVisibility(View.VISIBLE);
            }

            @Override
            public void onReceivedError(WebView v, WebResourceRequest req, WebResourceError err) {
                // البوت غير مشغّل — أظهر شاشة التعليمات
                if (req.isForMainFrame()) {
                    offline.setVisibility(View.VISIBLE);
                    web.setVisibility(View.GONE);
                }
            }
        });
        web.setWebChromeClient(new WebChromeClient());
        root.addView(web, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.MATCH_PARENT));

        setContentView(root);
        web.loadUrl(URL);
    }

    @Override
    public void onBackPressed() {
        if (web.canGoBack()) web.goBack(); else super.onBackPressed();
    }
}
