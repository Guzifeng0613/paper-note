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

/**
 * 知识切片保活服务：切片运算仍由网页 JS 执行，本服务只负责把进程提升为
 * 前台优先级并显示常驻通知，使用户切到后台 / 锁屏时切片继续、不被回收。
 * 切片进度（含断点）持久化在网页 KB，中断后再次「构建」即从断点续切。
 */
public class ChunkService extends Service {
    static final String CHANNEL = "zhipian_chunk";
    static final int NOTIF_ID = 43;
    static volatile ChunkService instance;

    @Override
    public void onCreate() {
        super.onCreate();
        instance = this;
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel ch = new NotificationChannel(
                    CHANNEL, "纸片知识切片", NotificationManager.IMPORTANCE_LOW);
            ch.setDescription("本地构建知识库切片时的进度通知");
            nm.createNotificationChannel(ch);
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        Notification n = build("正在构建知识库", "准备中…", 0);
        if (Build.VERSION.SDK_INT >= 34) {
            ServiceCompat.startForeground(this, NOTIF_ID, n,
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC);
        } else {
            startForeground(NOTIF_ID, n);
        }
        return START_NOT_STICKY;
    }

    void update(int pct, String msg) {
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        nm.notify(NOTIF_ID, build("正在构建知识库",
                msg == null ? "处理中…" : msg, pct));
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
    public void onDestroy() {
        instance = null;
        super.onDestroy();
    }
    @Override
    public IBinder onBind(Intent intent) { return null; }
}
