package com.zhipian.notes;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;

import androidx.core.content.ContextCompat;
import androidx.core.app.NotificationCompat;
import androidx.core.app.ServiceCompat;

/**
 * 通用任务保活服务：同步 / 切片 / 文档解析仍由网页 JS 执行，本服务提升为前台
 * 优先级并显示常驻通知（进度条 + X/Y + 预计剩余），使用户切后台 / 锁屏时继续。
 * JS 每次上报都 startService，onStartCommand 里 startForeground 刷新通知，避免实例时序问题。
 */
public class TaskService extends Service {
    static final String CHANNEL = "zhipian_task";
    static final int NID = 44;

    static void post(Context c, String title, int pct, String text) {
        Intent i = new Intent(c, TaskService.class);
        i.putExtra("title", title);
        i.putExtra("pct", pct);
        i.putExtra("text", text);
        ContextCompat.startForegroundService(c, i);
    }
    static void end(Context c) {
        c.stopService(new Intent(c, TaskService.class));
    }

    @Override
    public void onCreate() {
        super.onCreate();
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel ch = new NotificationChannel(
                    CHANNEL, "纸片任务", NotificationManager.IMPORTANCE_LOW);
            ch.setDescription("同步 / 切片 / 文档解析的后台进度");
            nm.createNotificationChannel(ch);
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int sid) {
        String title = "纸片 · 后台任务";
        int pct = 0;
        String text = "处理中…";
        if (intent != null) {
            String t = intent.getStringExtra("title");
            if (t != null) title = t;
            pct = intent.getIntExtra("pct", 0);
            String x = intent.getStringExtra("text");
            if (x != null) text = x;
        }
        Notification n = build(title, text, pct);
        if (Build.VERSION.SDK_INT >= 34) {
            ServiceCompat.startForeground(this, NID, n,
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC);
        } else {
            startForeground(NID, n);
        }
        return START_NOT_STICKY;
    }

    private Notification build(String title, String text, int pct) {
        return new NotificationCompat.Builder(this, CHANNEL)
                .setSmallIcon(android.R.drawable.stat_sys_upload)
                .setContentTitle(title)
                .setContentText(text)
                .setOnlyAlertOnce(true)
                .setOngoing(true)
                .setProgress(100, pct, pct <= 0)
                .build();
    }

    @Override
    public IBinder onBind(Intent i) { return null; }
}
