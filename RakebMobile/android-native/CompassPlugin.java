package com.rakeb.mobile;

import android.content.Context;
import android.hardware.GeomagneticField;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Boussole native pour Rakeb : lit directement les capteurs d'Android (plus fiable que les
 * événements d'orientation de la WebView) et envoie le cap en degrés par rapport au NORD GÉOGRAPHIQUE.
 */
@CapacitorPlugin(name = "Compass")
public class CompassPlugin extends Plugin implements SensorEventListener {
    private SensorManager manager;
    private Sensor rotation, accel, magnet;
    private boolean wanted = false;
    private boolean registered = false;
    private boolean haveG = false;
    private boolean haveM = false;
    private final float[] gravity = new float[3];
    private final float[] geomagnetic = new float[3];
    private final float[] matrix = new float[9];
    private float declination = 0f;
    private long lastEmit = 0L;

    @PluginMethod
    public void start(PluginCall call) {
        manager = (SensorManager) getContext().getSystemService(Context.SENSOR_SERVICE);
        if (manager == null) {
            call.reject("Capteurs indisponibles");
            return;
        }
        rotation = manager.getDefaultSensor(Sensor.TYPE_ROTATION_VECTOR);
        accel = manager.getDefaultSensor(Sensor.TYPE_ACCELEROMETER);
        magnet = manager.getDefaultSensor(Sensor.TYPE_MAGNETIC_FIELD);
        if (rotation == null && (accel == null || magnet == null)) {
            call.reject("Aucun capteur de boussole sur cet appareil");
            return;
        }
        // Déclinaison magnétique : convertit le nord magnétique du capteur en nord géographique
        Double lat = call.getDouble("lat");
        Double lon = call.getDouble("lon");
        declination = 0f;
        if (lat != null && lon != null) {
            GeomagneticField field = new GeomagneticField((float) lat.doubleValue(), (float) lon.doubleValue(), 0f, System.currentTimeMillis());
            declination = field.getDeclination();
        }
        wanted = true;
        register();
        JSObject res = new JSObject();
        res.put("source", rotation != null ? "rotation_vector" : "accel_magnet");
        res.put("declination", declination);
        call.resolve(res);
    }

    @PluginMethod
    public void stop(PluginCall call) {
        wanted = false;
        unregister();
        call.resolve();
    }

    private void register() {
        if (registered || manager == null) return;
        if (rotation != null) {
            manager.registerListener(this, rotation, SensorManager.SENSOR_DELAY_UI);
        } else {
            manager.registerListener(this, accel, SensorManager.SENSOR_DELAY_UI);
            manager.registerListener(this, magnet, SensorManager.SENSOR_DELAY_UI);
        }
        registered = true;
    }

    private void unregister() {
        if (registered && manager != null) manager.unregisterListener(this);
        registered = false;
        haveG = false;
        haveM = false;
    }

    @Override
    protected void handleOnPause() {
        unregister();
    }

    @Override
    protected void handleOnResume() {
        if (wanted) register();
    }

    @Override
    protected void handleOnDestroy() {
        unregister();
    }

    @Override
    public void onAccuracyChanged(Sensor sensor, int accuracy) {
    }

    @Override
    public void onSensorChanged(SensorEvent event) {
        boolean ok = false;
        int type = event.sensor.getType();
        if (type == Sensor.TYPE_ROTATION_VECTOR) {
            SensorManager.getRotationMatrixFromVector(matrix, event.values);
            ok = true;
        } else if (type == Sensor.TYPE_ACCELEROMETER) {
            System.arraycopy(event.values, 0, gravity, 0, 3);
            haveG = true;
        } else if (type == Sensor.TYPE_MAGNETIC_FIELD) {
            System.arraycopy(event.values, 0, geomagnetic, 0, 3);
            haveM = true;
        }
        if (!ok && haveG && haveM) {
            ok = SensorManager.getRotationMatrix(matrix, null, gravity, geomagnetic);
        }
        if (!ok) return;

        long now = System.currentTimeMillis();
        if (now - lastEmit < 60L) return;
        lastEmit = now;

        // À plat : direction du haut du téléphone. Debout : direction de l'arrière (caméra).
        double heading;
        if (Math.abs(matrix[8]) > 0.5) {
            heading = Math.toDegrees(Math.atan2(matrix[1], matrix[4]));
        } else {
            heading = Math.toDegrees(Math.atan2(-matrix[2], -matrix[5]));
        }
        heading = (heading + declination + 720.0) % 360.0;

        JSObject data = new JSObject();
        data.put("heading", heading);
        data.put("accuracy", (double) event.accuracy);
        notifyListeners("heading", data);
    }
}
