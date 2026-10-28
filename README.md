# Wiederholungstracker

Web-App (PWA) fürs Fitnessstudio: Sätze, Gewicht und Wiederholungen tracken, dazu Körpergewicht, Protein, Kalorien und Schlaf. Läuft offline, die Daten bleiben lokal auf dem Handy.

## Dateien

| Datei | Zweck |
|---|---|
| `index.html` | Grundgerüst, iOS-Meta-Tags |
| `styles.css` | Design (dunkel/hell automatisch) |
| `app.js` | Die gesamte App-Logik |
| `sw.js` | Service Worker für den Offline-Modus |
| `manifest.webmanifest`, `icons/` | App-Name und Icons für den Home-Bildschirm |

Es gibt keinen Build-Schritt und keine Abhängigkeiten. Der Ordner wird so, wie er ist, hochgeladen.

## Online stellen (kostenlos)

Für Offline-Modus und Home-Bildschirm muss die App über **HTTPS** erreichbar sein.

**Netlify Drop (am einfachsten):**
1. Auf https://app.netlify.com/drop gehen und ein kostenloses Konto anlegen.
2. Den Ordner `wiederholungstracker` ins Browserfenster ziehen.
3. Du bekommst eine Adresse wie `https://irgendwas.netlify.app`. Unter „Site settings“ kannst du den Namen ändern.

**Alternative GitHub Pages:** Repository anlegen, Dateien hochladen, unter Settings → Pages den `main`-Branch aktivieren. Danach ist die App unter `https://<name>.github.io/<repo>/` erreichbar.

## Aufs iPhone

1. Die Adresse in **Safari** öffnen.
2. Teilen-Symbol → **„Zum Home-Bildschirm“** → Hinzufügen.
3. Ab jetzt nur noch über das Icon starten.

## Wichtig zu den Daten

- Die Daten liegen im Speicher des Browsers **auf dem Handy**, nicht auf einem Server.
- Die Home-Bildschirm-App hat **eigenen Speicher**, getrennt von Safari. Trainiere also immer über das Icon.
- Die Daten hängen an der Adresse. Ändert sich die URL, ist die App leer. Dann über Mehr → „Backup laden“ wiederherstellen.
- Regelmäßig unter **Mehr → Backup exportieren** sichern (z. B. in iCloud Drive). Die App erinnert dich alle 14 Tage daran.

## Updates

Geänderte Dateien einfach neu hochladen. Die App lädt das Update im Hintergrund und nutzt es ab dem nächsten Start. Also einmal öffnen, schließen und wieder öffnen.

## Lokal testen

```
npx serve .
```
Dann `http://localhost:3000` im Browser öffnen. Übers WLAN geht es auch vom iPhone aus (`http://<PC-IP>:3000`), allerdings ohne Offline-Modus, weil dafür HTTPS nötig ist.
