package com.rakeb.mobile;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

/** Reçoit l'alarme de l'heure de prière et lance le service qui joue l'adhan. */
public class AdhanReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        String title = intent.getStringExtra("title");
        String body = intent.getStringExtra("body");
        Intent service = new Intent(context, AdhanService.class);
        service.putExtra("title", title);
        service.putExtra("body", body);
        try {
            if (Build.VERSION.SDK_INT >= 26) {
                context.startForegroundService(service);
            } else {
                context.startService(service);
            }
        } catch (Exception e) {
            // Démarrage du service refusé par le système : on affiche au moins une notification sonore
            AdhanService.postFallback(context, title, body);
        }
    }
}
