# Klassenbildschirm

Ein kostenloser Bildschirm für den Unterricht – zum Projizieren am Beamer oder Smartboard.
Läuft komplett im Browser, ohne Konto, ohne Server, ohne Werbung.

## Werkzeuge

| Werkzeug | Was es kann |
|---|---|
| **Timer** | Countdown mit Fortschrittsring, Schnellwahl (1–20 min), Zeit per Klick auf die Ziffern eintippen (`5` = 5 Minuten, `2:30`), Gong am Ende |
| **Stoppuhr** | Zählt hoch mit Zehntelsekunden |
| **Uhr** | Digital oder analog, optional mit Sekunden und Datum |
| **Text** | Arbeitsaufträge, Hausaufgaben, Notizen; Schriftgröße A−/A+, zentrieren |
| **Bild** | Bild auswählen, hineinziehen oder einfach **Strg+V** auf der Fläche |
| **QR-Code** | Link eingeben → Schüler*innen scannen mit dem Tablet |

Außerdem: Hintergründe (Verläufe, eigene Farbe, eigenes Foto), **Vollbild** (die Leiste blendet sich nach 3 s aus und erscheint wieder, wenn du die Maus bewegst).

Alle Werkzeuge lassen sich an der Kopfzeile verschieben und an der unteren rechten Ecke vergrößern.
Alles wird automatisch im Browser gespeichert – nach dem Neuladen ist der Bildschirm wieder genau so da, auch ein laufender Timer.

> Hinweis: Gespeichert wird **pro Browser und Gerät**. Am Schul-PC und zu Hause sind es also zwei getrennte Bildschirme.

## Lokal ausprobieren

Einfach `index.html` doppelklicken. Oder mit einem kleinen Server (empfohlen, weil sich manche Browser bei `file://` beim Speichern zickig verhalten):

```powershell
python -m http.server 5173
```

Dann im Browser `http://localhost:5173` öffnen.

## Kostenlos online stellen (GitHub Pages)

1. Auf [github.com](https://github.com) ein kostenloses Konto anlegen.
2. Neues Repository erstellen, z. B. `klassenbildschirm` (öffentlich).
3. Diesen Ordner hochladen (per „Add file → Upload files“ oder mit `git push`).
4. Im Repository: **Settings → Pages → Source: „Deploy from a branch“**, Branch `main`, Ordner `/ (root)` → Save.
5. Nach ca. einer Minute ist die Seite erreichbar unter
   `https://<dein-name>.github.io/klassenbildschirm/`

Diese Adresse kannst du am Schul-PC als Lesezeichen oder Startseite speichern.

## Aufbau

```
index.html            Seite
css/style.css         Gestaltung
js/core.js            Helfer: Symbole, Speicher, Ton, Bilder-Speicher
js/app.js             Arbeitsfläche, Werkzeugleiste, Hintergrund
js/widgets/*.js       Ein Werkzeug pro Datei
```

Ein neues Werkzeug = eine neue Datei in `js/widgets/`, die `registerWidget(...)` aufruft,
plus eine Zeile in `index.html` und der Name in `ORDER` in `js/app.js`.

## Datenschutz

Es werden keine Daten an einen Server geschickt. Texte, Bilder und Einstellungen liegen ausschließlich
im Browser-Speicher des jeweiligen Geräts. Einzige externe Anfrage: die QR-Code-Bibliothek
(`qrcode-generator`, MIT-Lizenz) wird von cdnjs.cloudflare.com geladen.
