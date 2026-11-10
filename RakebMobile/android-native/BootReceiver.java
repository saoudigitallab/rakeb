package com.rakeb.mobile;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Après un redémarrage du téléphone, les alarmes Android sont effacées : on les reprogramme. */
public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent != null && Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())) {
            AdhanScheduler.restore(context);
        }
    }
}
