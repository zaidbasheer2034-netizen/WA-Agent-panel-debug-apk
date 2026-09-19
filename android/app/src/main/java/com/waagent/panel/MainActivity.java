package com.waagent.panel;

import android.app.Activity;
import android.graphics.Color;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.Socket;

/**
 * لوحة التحكم كتطبيق أندرويد.
 *
 * الإصلاح الجذري ضد Err_Connection_Refused: التطبيق يفحص مقبس TCP على
 * 127.0.0.1:3000 بخيط منفصل كل ثانيتين قبل أن يسمح لـ WebView بالتحميل.
 * إذا كان البوت متوقفاً يُعرض دائماً شاشة الإرشاد العربية ولا تُستدعى
 * WebView.loadUrl أبداً، فلا تظهر صفحة خطأ Chromium القبيحة على الإطلاق.
 * متى انفتح المقبس، يُعرض المحتوى الحقيقي.
 */
public class MainActivity extends Activity {

    private static final String TAG = "WAAgent";
    private static final String URL = "http://127.0.0.1:3000";
    private static final String HOST = "127.0.0.1";
    private static final int   PORT = 3000;
    private static final long  CHECK_INTERVAL_MS = 2000L;

    private WebView web;
    private View offline;
    private TextView statusText;

    private final Handler ui = new Handler(Looper.getMainLooper());
    private volatile boolean botReachable = false;
    private volatile boolean webLoaded = false;
    private volatile boolean loadingWeb = false;
    private Thread checker;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        web = buildWebView();
        offline = buildOfflineView();

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.parseColor("#075E54"));
        // الترتيب مهم: يُضاف offline أولاً ثم web فوقه، فيظهر web فقط حين يعمل البوت.
        root.addView(offline, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        root.addView(web, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        web.setVisibility(View.GONE);

        setContentView(root);

        statusText.post(new Runnable() { public void run() { statusText.setText("…"); }});
        startChecker();
    }

    private WebView buildWebView() {
        WebView v = new WebView(this);
        WebSettings s = v.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setCacheMode(WebSettings.LOAD_NO_CACHE);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        v.setBackgroundColor(Color.parseColor("#075E54"));
        v.setWebChromeClient(new WebChromeClient());
        v.setWebViewClient(new WebViewClient());
        return v;
    }

    private View buildOfflineView() {
        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setGravity(Gravity.CENTER);
        box.setPadding(60, 60, 60, 60);
        box.setBackgroundColor(Color.parseColor("#0B7C68"));

        TextView title = new TextView(this);
        title.setText("🤖 وكيل خدمة العملاء");
        title.setTextSize(22);
        title.setTextColor(Color.WHITE);
        title.setGravity(Gravity.CENTER);
        box.addView(title);

        TextView body = new TextView(this);
        body.setText(
            "\nلوحة التحكم تنتظر تشغيل البوت.\n\n" +
            "افتح تطبيق Termux على نفس الجهاز ثم اكتب:\n\n" +
            "    wa-agent\n\n" +
            "ثم عُد إلى هذا التطبيق — سيتصل تلقائياً كل ثانيتين."
        );
        body.setTextSize(15);
        body.setTextColor(Color.parseColor("#D8F5EC"));
        body.setGravity(Gravity.CENTER);
        body.setLineSpacing(6, 1.3f);
        box.addView(body);

        statusText = new TextView(this);
        statusText.setText("…");
        statusText.setTextSize(12);
        statusText.setTextColor(Color.parseColor("#B8E6DB"));
        statusText.setGravity(Gravity.CENTER);
        statusText.setPadding(0, 24, 0, 0);
        box.addView(statusText);

        Button retry = new Button(this);
        retry.setText("🔄 تحقق الآن");
        retry.setOnClickListener(new View.OnClickListener() {
            public void onClick(View v) { checkOnce(); }
        });
        LinearLayout wrap = new LinearLayout(this);
        wrap.setGravity(Gravity.CENTER);
        wrap.addView(retry);
        box.addView(wrap);

        return box;
    }

    /** يفحص المقبس على الفور (بدون انتظار الخيط الدوري). */
    private void checkOnce() {
        new Thread(new Runnable() { public void run() { probe(); }}, "probe-once").start();
    }

    /** خيط فحص دوري لمقبس البوت — قرار التحميل يعتمد عليه وحده. */
    private void startChecker() {
        checker = new Thread(new Runnable() {
            public void run() {
                while (!Thread.currentThread().isInterrupted()) {
                    probe();
                    try { Thread.sleep(CHECK_INTERVAL_MS); }
                    catch (InterruptedException ie) { return; }
                }
            }
        }, "bot-checker");
        checker.setDaemon(true);
        checker.start();
    }

    private void probe() {
        boolean ok = false;
        Socket s = null;
        try {
            s = new Socket();
            s.connect(new InetSocketAddress(HOST, PORT), 800);
            ok = true;
        } catch (IOException e) {
            ok = false;
        } finally {
            if (s != null) { try { s.close(); } catch (IOException ignored) {} }
        }

        final boolean wasUp = botReachable;
        botReachable = ok;

        ui.post(new Runnable() { public void run() {
            if (ok) {
                statusText.setText("✅ البوت يستجيب — جارٍ التحميل…");
                if (!wasUp) {
                    Log.i(TAG, "البوت متاح، تحميل اللوحة.");
                    loadWeb();
                }
            } else {
                statusText.setText("⏳ في انتظار البوت على 127.0.0.1:" + PORT + "…");
                webLoaded = false;
                loadingWeb = false;
                web.setVisibility(View.GONE);
                offline.setVisibility(View.VISIBLE);
            }
        }});
    }

    private void loadWeb() {
        if (loadingWeb || webLoaded) return;
        loadingWeb = true;
        // حمّل من الويب فقط بعد التأكد من فتح المقبس — لا تظهر صفحة خطأ Chromium.
        ui.post(new Runnable() {
            public void run() {
                offline.setVisibility(View.GONE);
                web.setVisibility(View.VISIBLE);
                web.loadUrl(URL);
                loadingWeb = false;
                webLoaded = true;
            }
        });
    }

    @Override
    public void onBackPressed() {
        if (web != null && web.canGoBack()) web.goBack(); else super.onBackPressed();
    }

    @Override
    protected void onResume() {
        super.onResume();
        checkOnce();
    }

    @Override
    protected void onDestroy() {
        if (checker != null) checker.interrupt();
        if (web != null) web.destroy();
        super.onDestroy();
    }
}
