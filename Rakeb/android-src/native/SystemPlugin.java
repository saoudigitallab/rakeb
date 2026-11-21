package com.rakeb.mobile;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Raccourcis vers les réglages Android utiles aux alertes de prière :
 * réglages du canal de notification (son, importance), optimisation de la batterie, fiche de l'application.
 */
@CapacitorPlugin(name = "RakebSystem")
public class SystemPlugin extends Plugin {

    private void launch(Intent intent, PluginCall call) {
        try {
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("Impossible d'ouvrir ces réglages sur cet appareil");
        }
    }

    private Intent appDetails() {
        Intent intent = new Intent("android.settings.APPLICATION_DETAILS_SETTINGS");
        intent.setData(Uri.parse("package:" + getContext().getPackageName()));
        return intent;
    }

    @PluginMethod
    public void openChannelSettings(PluginCall call) {
        if (Build.VERSION.SDK_INT >= 26) {
            Intent intent = new Intent("android.settings.CHANNEL_NOTIFICATION_SETTINGS");
            intent.putExtra("android.provider.extra.APP_PACKAGE", getContext().getPackageName());
            String channel = call.getString("channel");
            if (channel != null) intent.putExtra("android.provider.extra.CHANNEL_ID", channel);
            launch(intent, call);
        } else {
            launch(appDetails(), call);
        }
    }

    @PluginMethod
    public void openBatterySettings(PluginCall call) {
        launch(new Intent("android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS"), call);
    }

    @PluginMethod
    public void openAppSettings(PluginCall call) {
        launch(appDetails(), call);
    }
}
