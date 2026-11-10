package com.rakeb.mobile;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;

import java.io.File;

/**
 * Joue l'adhan à l'heure de la prière, sur le volume des ALARMES (indépendant des réglages
 * de notification du téléphone). Source du son : fichier choisi dans l'application, sinon
 * fichier intégré « adhan », sinon son de notification du téléphone.
 */
public class AdhanService extends Service {
    static final String CHANNEL_PLAYING = "rakeb_adhan_playing";
    static final String CHANNEL_FALLBACK = "rakeb_adhan_fallback";
    static final String USER_FILE = "adhan_user.audio";
    static final int NOTIF_ID = 7101;
    private static final long MAX_PLAY_MS = 6L * 60L * 1000L;

    private MediaPlayer player;
    private PowerManager.WakeLock wakeLock;
    private AudioManager audioManager;
    private AudioFocusRequest focusRequest;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Runnable safetyStop = new Runnable() {
        @Override public void run() { stopSelf(); }
    };

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && "com.rakeb.mobile.ADHAN_STOP".equals(intent.getAction())) {
            stopSelf();
            return START_NOT_STICKY;
        }
        String title = intent != null ? intent.getStringExtra("title") : null;
        String body = intent != null ? intent.getStringExtra("body") : null;
        if (title == null) title = "Rakeb";
        if (body == null) body = "";

        ensureChannel(this, CHANNEL_PLAYING, "Adhan en cours", NotificationManager.IMPORTANCE_LOW);
        Notification notification = buildNotification(title, body);
        if (Build.VERSION.SDK_INT >= 29) {
            startForeground(NOTIF_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
        } else {
            startForeground(NOTIF_ID, notification);
        }
        startPlayback();
        return START_NOT_STICKY;
    }

    private Notification buildNotification(String title, String body) {
        Intent launch = getPackageManager().getLaunchIntentForPackage(getPackageName());
        PendingIntent open = launch == null ? null
                : PendingIntent.getActivity(this, 0, launch, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification.Builder b;
        if (Build.VERSION.SDK_INT >= 26) {
            b = new Notification.Builder(this, CHANNEL_PLAYING);
        } else {
            b = new Notification.Builder(this);
        }
        b.setContentTitle(title).setContentText(body)
         .setSmallIcon(getApplicationInfo().icon)
         .setOngoing(true)
         .setCategory(Notification.CATEGORY_ALARM);
        if (open != null) b.setContentIntent(open);
        Intent stopIntent = new Intent(this, AdhanService.class);
        stopIntent.setAction("com.rakeb.mobile.ADHAN_STOP");
        PendingIntent stop = PendingIntent.getService(this, 1, stopIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        b.addAction(android.R.drawable.ic_media_pause, "Arrêter l'adhan", stop);
        return b.build();
    }

    private Uri pickSource() {
        File user = new File(getFilesDir(), USER_FILE);
        if (user.exists() && user.length() > 0) return Uri.fromFile(user);
        int raw = getResources().getIdentifier("adhan", "raw", getPackageName());
        if (raw != 0) return Uri.parse("android.resource://" + getPackageName() + "/" + raw);
        Uri def = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
        return def != null ? def : RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
    }

    private void startPlayback() {
        releasePlayer();
        try {
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (pm != null) {
                wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "rakeb:adhan");
                wakeLock.acquire(MAX_PLAY_MS + 30000L);
            }
            AudioAttributes attrs = new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ALARM)
                    .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                    .build();
            audioManager = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
            if (audioManager != null) {
                if (Build.VERSION.SDK_INT >= 26) {
                    focusRequest = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT).setAudioAttributes(attrs).build();
                    audioManager.requestAudioFocus(focusRequest);
                }
            }
            player = new MediaPlayer();
            player.setAudioAttributes(attrs);
            player.setDataSource(this, pickSource());
            player.setOnPreparedListener(new MediaPlayer.OnPreparedListener() {
                @Override public void onPrepared(MediaPlayer mp) { mp.start(); }
            });
            player.setOnCompletionListener(new MediaPlayer.OnCompletionListener() {
                @Override public void onCompletion(MediaPlayer mp) { stopSelf(); }
            });
            player.setOnErrorListener(new MediaPlayer.OnErrorListener() {
                @Override public boolean onError(MediaPlayer mp, int what, int extra) { stopSelf(); return true; }
            });
            player.prepareAsync();
            handler.postDelayed(safetyStop, MAX_PLAY_MS);
        } catch (Exception e) {
            stopSelf();
        }
    }

    private void releasePlayer() {
        handler.removeCallbacks(safetyStop);
        if (player != null) {
            try { player.stop(); } catch (Exception ignored) { }
            try { player.release(); } catch (Exception ignored) { }
            player = null;
        }
        if (audioManager != null && focusRequest != null && Build.VERSION.SDK_INT >= 26) {
            audioManager.abandonAudioFocusRequest(focusRequest);
            focusRequest = null;
        }
        if (wakeLock != null && wakeLock.isHeld()) {
            wakeLock.release();
        }
        wakeLock = null;
    }

    @Override
    public void onDestroy() {
        releasePlayer();
        stopForeground(true);
        super.onDestroy();
    }

    static void ensureChannel(Context c, String id, String name, int importance) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null && nm.getNotificationChannel(id) == null) {
            NotificationChannel ch = new NotificationChannel(id, name, importance);
            nm.createNotificationChannel(ch);
        }
    }

    /** Si Android refuse de lancer le service : notification classique avec le son par défaut. */
    static void postFallback(Context c, String title, String body) {
        try {
            ensureChannel(c, CHANNEL_FALLBACK, "Heure de prière (secours)", NotificationManager.IMPORTANCE_HIGH);
            NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
            Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(c, CHANNEL_FALLBACK) : new Notification.Builder(c);
            b.setContentTitle(title == null ? "Rakeb" : title).setContentText(body == null ? "" : body)
             .setSmallIcon(c.getApplicationInfo().icon).setAutoCancel(true);
            if (nm != null) nm.notify(NOTIF_ID + 1, b.build());
        } catch (Exception ignored) { }
    }
}
