package com.rakeb.mobile;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/**
 * Widget de l'écran d'accueil : prochaine prière (ou iftar pendant le Ramadan) et temps restant.
 * Il lit seulement la liste d'alarmes déjà mémorisée par AdhanScheduler : aucune alarme n'est ajoutée ni modifiée.
 */
public class RakebWidgetProvider extends AppWidgetProvider {
    static final String ACTION_TICK = "com.rakeb.mobile.WIDGET_TICK";
    private static final long MAX_TICK_MS = 10 * 60 * 1000L;

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        refresh(context);
    }

    @Override
    public void onEnabled(Context context) {
        refresh(context);
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        if (intent != null && ACTION_TICK.equals(intent.getAction())) refresh(context);
    }

    @Override
    public void onDisabled(Context context) {
        AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (am != null) am.cancel(tickIntent(context));
    }

    private static PendingIntent tickIntent(Context c) {
        Intent i = new Intent(c, RakebWidgetProvider.class);
        i.setAction(ACTION_TICK);
        return PendingIntent.getBroadcast(c, 8, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    /** Prochaine alarme mémorisée : {ts, nom} ou null. */
    private static Object[] nextEvent(Context c) {
        try {
            JSONArray events = new JSONArray(AdhanScheduler.prefs(c).getString(AdhanScheduler.KEY_EVENTS, "[]"));
            long now = System.currentTimeMillis(), best = Long.MAX_VALUE;
            String name = null;
            for (int i = 0; i < events.length(); i++) {
                JSONObject e = events.optJSONObject(i);
                if (e == null) continue;
                long ts = e.optLong("ts");
                if (ts > now && ts < best) {
                    best = ts;
                    name = e.optString("title", "").replaceFirst("^Heure de ", "");
                }
            }
            return name == null ? null : new Object[] { Long.valueOf(best), name };
        } catch (Exception ex) {
            return null;
        }
    }

    private static boolean isRamadan() {
        if (Build.VERSION.SDK_INT < 26) return false;
        try {
            return java.time.chrono.HijrahDate.now().get(java.time.temporal.ChronoField.MONTH_OF_YEAR) == 9;
        } catch (Throwable t) {
            return false;
        }
    }

    private static String remaining(long ms) {
        long min = Math.max(0, (ms + 59999) / 60000);
        long h = min / 60, m = min % 60;
        return h > 0 ? "dans " + h + " h " + (m < 10 ? "0" : "") + m : "dans " + m + " min";
    }

    /** Met à jour tous les widgets Rakeb de l'écran d'accueil et programme la prochaine mise à jour. */
    static void refresh(Context c) {
        try {
            AppWidgetManager manager = AppWidgetManager.getInstance(c);
            int[] ids = manager.getAppWidgetIds(new ComponentName(c, RakebWidgetProvider.class));
            if (ids == null || ids.length == 0) return;
            Object[] next = nextEvent(c);
            RemoteViews rv = new RemoteViews(c.getPackageName(), R.layout.rakeb_widget);
            long now = System.currentTimeMillis();
            if (next == null) {
                rv.setTextViewText(R.id.widget_label, "Rakeb");
                rv.setTextViewText(R.id.widget_name, "Ouvrir Rakeb");
                rv.setTextViewText(R.id.widget_time, "--:--");
                rv.setTextViewText(R.id.widget_left, "Activez les alertes de prière");
            } else {
                long ts = ((Long) next[0]).longValue();
                String name = (String) next[1];
                boolean iftar = "Maghrib".equals(name) && isRamadan();
                rv.setTextViewText(R.id.widget_label, iftar ? "Iftar" : "Prochaine prière");
                rv.setTextViewText(R.id.widget_name, iftar ? "Iftar (Maghrib)" : name);
                rv.setTextViewText(R.id.widget_time, new SimpleDateFormat("HH:mm", Locale.FRANCE).format(new Date(ts)));
                rv.setTextViewText(R.id.widget_left, remaining(ts - now));
            }
            Intent launch = c.getPackageManager().getLaunchIntentForPackage(c.getPackageName());
            if (launch != null) {
                rv.setOnClickPendingIntent(R.id.widget_root,
                        PendingIntent.getActivity(c, 7, launch, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
            }
            manager.updateAppWidget(ids, rv);
            AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
            if (am != null) {
                long at = next == null ? now + MAX_TICK_MS : Math.min(((Long) next[0]).longValue() + 1500L, now + MAX_TICK_MS);
                am.set(AlarmManager.RTC, at, tickIntent(c)); // inexact : ne réveille pas le téléphone et ne demande aucun droit
            }
        } catch (Throwable ignored) {
            // le widget ne doit jamais faire planter l'application
        }
    }
}
