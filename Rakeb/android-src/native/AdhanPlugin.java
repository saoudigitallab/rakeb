package com.rakeb.mobile;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.util.Base64;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;

/** Pont JavaScript → alarmes et lecture native de l'adhan. */
@CapacitorPlugin(name = "RakebAdhan")
public class AdhanPlugin extends Plugin {

    /** events : [{id, ts, title, body}] — remplace toutes les alarmes précédentes. */
    @PluginMethod
    public void schedule(PluginCall call) {
        JSArray events = call.getArray("events");
        int n = AdhanScheduler.schedule(getContext(), events);
        JSObject res = new JSObject();
        res.put("scheduled", (double) n);
        res.put("exact", AdhanScheduler.canExact(getContext()));
        call.resolve(res);
    }

    @PluginMethod
    public void cancelAll(PluginCall call) {
        AdhanScheduler.cancelAll(getContext());
        call.resolve();
    }

    /** Reçoit le fichier audio choisi par l'utilisateur, en morceaux (index / total) en base64. */
    @PluginMethod
    public void setAudio(PluginCall call) {
        String data = call.getString("data");
        Integer index = call.getInt("index");
        Integer total = call.getInt("total");
        String sig = call.getString("sig");
        if (data == null || index == null || total == null) {
            call.reject("Paramètres manquants");
            return;
        }
        try {
            File dir = getContext().getFilesDir();
            File part = new File(dir, "adhan_user.part");
            FileOutputStream out = new FileOutputStream(part, index > 0);
            out.write(Base64.decode(data, Base64.DEFAULT));
            out.close();
            if (index == total - 1) {
                File dest = new File(dir, AdhanService.USER_FILE);
                if (dest.exists()) dest.delete();
                if (!part.renameTo(dest)) {
                    call.reject("Impossible d'enregistrer le fichier");
                    return;
                }
                AdhanScheduler.prefs(getContext()).edit().putString("audio_sig", sig == null ? "" : sig).apply();
            }
            call.resolve();
        } catch (Exception e) {
            call.reject("Échec de l'enregistrement du son : " + e.getMessage());
        }
    }

    @PluginMethod
    public void clearAudio(PluginCall call) {
        new File(getContext().getFilesDir(), AdhanService.USER_FILE).delete();
        new File(getContext().getFilesDir(), "adhan_user.part").delete();
        AdhanScheduler.prefs(getContext()).edit().remove("audio_sig").apply();
        call.resolve();
    }

    @PluginMethod
    public void audioInfo(PluginCall call) {
        Context c = getContext();
        File user = new File(c.getFilesDir(), AdhanService.USER_FILE);
        JSObject res = new JSObject();
        res.put("hasUser", user.exists() && user.length() > 0);
        res.put("sig", AdhanScheduler.prefs(c).getString("audio_sig", ""));
        res.put("hasBundled", c.getResources().getIdentifier("adhan", "raw", c.getPackageName()) != 0);
        res.put("exact", AdhanScheduler.canExact(c));
        res.put("sdk", (double) Build.VERSION.SDK_INT);
        call.resolve(res);
    }

    /** Joue l'adhan tout de suite (test du son et du volume des alarmes). */
    @PluginMethod
    public void playNow(PluginCall call) {
        try {
            Intent service = new Intent(getContext(), AdhanService.class);
            service.putExtra("title", "Test de l'adhan");
            service.putExtra("body", "Réglez le volume des alarmes si le son est trop faible");
            if (Build.VERSION.SDK_INT >= 26) {
                getContext().startForegroundService(service);
            } else {
                getContext().startService(service);
            }
            call.resolve();
        } catch (Exception e) {
            call.reject("Impossible de lancer la lecture : " + e.getMessage());
        }
    }

    @PluginMethod
    public void stop(PluginCall call) {
        getContext().stopService(new Intent(getContext(), AdhanService.class));
        call.resolve();
    }

    /** Android 12+ : ouvre l'écran « Alarmes et rappels » pour autoriser les alarmes exactes. */
    @PluginMethod
    public void openExactAlarmSettings(PluginCall call) {
        try {
            Intent intent = new Intent("android.settings.REQUEST_SCHEDULE_EXACT_ALARM");
            intent.setData(Uri.parse("package:" + getContext().getPackageName()));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("Réglage indisponible sur cet appareil");
        }
    }
}
