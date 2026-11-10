package com.rakeb.mobile;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Programme les alarmes Android (AlarmManager) qui déclenchent la lecture de l'adhan.
 * Les alarmes sont mémorisées pour être reprogrammées après un redémarrage du téléphone.
 */
final class AdhanScheduler {
    static final String PREFS = "rakeb_adhan";
    static final String KEY_EVENTS = "events";
    static final String ACTION_ALARM = "com.rakeb.mobile.ADHAN_ALARM";

    private AdhanScheduler() { }

    static SharedPreferences prefs(Context c) {
        return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private static PendingIntent alarmIntent(Context c, int id, String title, String body) {
        Intent intent = new Intent(c, AdhanReceiver.class);
        intent.setAction(ACTION_ALARM);
        intent.putExtra("title", title);
        intent.putExtra("body", body);
        return PendingIntent.getBroadcast(c, id, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static PendingIntent showIntent(Context c) {
        Intent launch = c.getPackageManager().getLaunchIntentForPackage(c.getPackageName());
        if (launch == null) launch = new Intent();
        return PendingIntent.getActivity(c, 0, launch, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    static boolean canExact(Context c) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return false;
        return Build.VERSION.SDK_INT < 31 || am.canScheduleExactAlarms();
    }

    /** Annule toutes les alarmes mémorisées. */
    static void cancelAll(Context c) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        String stored = prefs(c).getString(KEY_EVENTS, "[]");
        try {
            JSONArray old = new JSONArray(stored);
            for (int i = 0; i < old.length(); i++) {
                JSONObject e = old.optJSONObject(i);
                if (e == null || am == null) continue;
                am.cancel(alarmIntent(c, e.optInt("id"), e.optString("title"), e.optString("body")));
            }
        } catch (Exception ignored) { }
        prefs(c).edit().remove(KEY_EVENTS).apply();
    }

    /** Remplace toutes les alarmes par la liste donnée : [{id, ts (ms), title, body}]. */
    static int schedule(Context c, JSONArray events) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        cancelAll(c);
        if (am == null || events == null) return 0;
        JSONArray kept = new JSONArray();
        long now = System.currentTimeMillis();
        boolean exact = canExact(c);
        for (int i = 0; i < events.length(); i++) {
            JSONObject e = events.optJSONObject(i);
            if (e == null) continue;
            long ts = e.optLong("ts");
            if (ts <= now) continue;
            PendingIntent pi = alarmIntent(c, e.optInt("id"), e.optString("title"), e.optString("body"));
            if (exact) {
                am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, ts, pi);
            } else {
                // Sans droit « alarmes exactes » : alarme-réveil, qui reste autorisée par Android
                am.setAlarmClock(new AlarmManager.AlarmClockInfo(ts, showIntent(c)), pi);
            }
            kept.put(e);
        }
        prefs(c).edit().putString(KEY_EVENTS, kept.toString()).apply();
        return kept.length();
    }

    /** Après un redémarrage : reprogramme les alarmes futures mémorisées. */
    static void restore(Context c) {
        try {
            schedule(c, new JSONArray(prefs(c).getString(KEY_EVENTS, "[]")));
        } catch (Exception ignored) { }
    }
}
