package com.zhipian.notes;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;

import androidx.core.app.NotificationCompat;
import androidx.core.app.ServiceCompat;
import androidx.core.content.ContextCompat;

import org.json.JSONObject;

/**
 * 同步前台服务：同步期间显示常驻通知，即使用户切到后台或锁屏，
 * 同步线程也以前台服务优先级继续运行，系统不会轻易回收。
 */
public class SyncService extends Service {
    static final String CHANNEL = "zhipian_sync";
    static final int NOTIF_ID = 42;

    interface Callback {
        void onOk(JSONObject r);
        void onErr(String msg);
        void onProgress(int pct, String msg);
    }
    /** 由 MainActivity 注册，用于把结果/进度回传给网页；Activity 销毁时清空。 */
    static volatile Callback callback;

    private NotificationManager nm;

    @Override
    public void onCreate() {
        super.onCreate();
        nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel ch = new NotificationChannel(
                    CHANNEL, "纸片云同步", NotificationManager.IMPORTANCE_LOW);
            ch.setDescription("便签同步到百度网盘时的进度通知");
            nm.createNotificationChannel(ch);
        }
    }

    @Override
    public int onStartCommand(final Intent intent, int flags, int startId) {
        final String token = intent.getStringExtra("token");
        final String mode = intent.getStringExtra("mode"); // merge/push/pull
        final boolean push = intent.getBooleanExtra("push", true);
        final String verb = "pull".equals(mode) || (mode == null && !push) ? "恢复"
                : "push".equals(mode) ? "同步" : "双向同步";

        Notification n = build("正在" + verb + "纸片", "准备中…", 0);
        if (Build.VERSION.SDK_INT >= 34) {
            ServiceCompat.startForeground(this, NOTIF_ID, n,
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC);
        } else {
            startForeground(NOTIF_ID, n);
        }

        new Thread(() -> {
            try {
                Baidu.Listener L = (pct, msg) -> {
                    update(pct, msg);
                    Callback cb = callback;
                    if (cb != null) cb.onProgress(pct, msg);
                };
                final boolean doPull = "pull".equals(mode) || (mode == null && !push);
                JSONObject r = doPull ? Baidu.pull(SyncService.this, token, L)
                        : "push".equals(mode) ? Baidu.push(SyncService.this, token, L)
                        : Baidu.mergeSync(SyncService.this, token, L);
                Callback cb = callback;
                if (cb != null) cb.onOk(r);
                nm.notify(NOTIF_ID, build(verb + "完成", "点击返回纸片查看", 100));
            } catch (Exception e) {
                String m = e.getMessage() == null ? "同步失败" : e.getMessage();
                Callback cb = callback;
                if (cb != null) cb.onErr(m);
                nm.notify(NOTIF_ID, build(verb + "失败", m, 0));
            } finally {
                try { Thread.sleep(1300); } catch (InterruptedException ignored) {}
                stopSelf();
            }
        }).start();
        return START_NOT_STICKY;
    }

    private void update(int pct, String msg) {
        nm.notify(NOTIF_ID, build("正在同步纸片", msg, pct));
    }

    private Notification build(String title, String text, int pct) {
        return new NotificationCompat.Builder(this, CHANNEL)
                .setSmallIcon(android.R.drawable.stat_sys_upload)
                .setContentTitle(title)
                .setContentText(text)
                .setOnlyAlertOnce(true)
                .setOngoing(pct < 100)
                .setProgress(100, pct, pct <= 0)
                .build();
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }
}
