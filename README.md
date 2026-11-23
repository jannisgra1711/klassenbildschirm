# Klassenbildschirm

Ein kostenloser Bildschirm für den Unterricht – zum Projizieren am Beamer oder Smartboard.
Läuft komplett im Browser, ohne Konto, ohne Server, ohne Werbung.

## Werkzeuge

| Werkzeug | Was es kann |
|---|---|
| **Timer** | Countdown mit Fortschrittsring, Schnellwahl (1–20 min), Zeit per Klick auf die Ziffern eintippen (`5` = 5 Minuten, `2:30`), Gong am Ende |
| **Stoppuhr** | Zählt hoch mit Zehntelsekunden |
| **Uhr** | Digital oder analog, optional mit Sekunden und Datum |
| **Agenda** | Stundenablauf – **zum Abhaken** (nächster offener Punkt wird hervorgehoben), als **Liste** oder **nummeriert**; jeder Punkt mit Emoji/Symbol. Im Bearbeiten-Modus: Enter = neuer Punkt, Alt+↑/↓ = verschieben |
| **Text** | Editor mit Leiste (erscheint nur beim Schreiben): 7 Schriften, Überschriften, **fett**/*kursiv*/unterstrichen/durchgestrichen, Textfarbe, Textmarker, Aufzählung & Nummerierung (auch per `- ` bzw. `1. ` am Zeilenanfang), Einzug mit Tab, Ausrichtung, Emojis/Symbole, Zettelfarbe (Weiß, Gelb, Blau, Grün, Rosa, Tafel) |
| **Bild** | Bild auswählen, hineinziehen oder einfach **Strg+V** auf der Fläche |
| **QR-Code** | Link eingeben (optional mit Überschrift) → Schüler*innen scannen mit dem Tablet |

**Mehrere Bildschirme (wie Folien):** Unten links ◀ 2 / 5 ▶. Ein Klick auf die Zahl öffnet die Übersicht
(neu, duplizieren, umbenennen, sortieren, löschen). Blättern mit ◀ ▶, Pfeiltasten oder Bild↑/Bild↓ –
funktioniert also auch mit einem Präsentations-Presenter. Werkzeuge auf anderen Bildschirmen laufen weiter
(ein Timer gongt auch, wenn gerade ein anderer Bildschirm gezeigt wird).

**Formen & Symbole:** Box, abgerundete Box, Kreis, Pfeil (4 Richtungen), Sprechblase, Stern, Schild;
Kästen „Merke“, „Tipp“, „Achtung“, „Aufgabe“; Arbeitsform-Symbole (Einzel-, Partner-, Gruppenarbeit, Plenum,
Leise arbeiten …) und beliebige Emojis. Direkt am Objekt ziehen, **Doppelklick** (oder ✎) bearbeitet den Text,
die Palette 🎨 ändert Füllung, Rand, Textfarbe/-größe, Pfeilrichtung und Ebene (nach vorne/hinten).
Text, Bild, QR-Code, Agenda und Formen lassen sich mit ⧉ duplizieren.

**Menü „Gemeinsam“:** Sammlung bewährter Werkzeuge für Zusammenarbeit (Dokumente, Pinnwände,
Whiteboards, Brainstorming, Umfragen, Quiz), eigene Links (z. B. Schul-Cloud, Moodle) und
„Für die Klasse anzeigen“: Teilen-Link einfügen → großer QR-Code mit Überschrift.
Bitte vor dem Einsatz externer Angebote die Datenschutzvorgaben der Schule prüfen.

**Hintergründe** (alle selbst gezeichnet, laden nichts aus dem Internet):
- **Automatisch nach Jahreszeit** (Standard): Frühling (ab 20.3.), Ostern (Palmsonntag bis eine Woche nach Ostern),
  Sommer (ab 21.6.), Herbst (ab 23.9.), Advent & Weihnachten (1. Advent bis 6.1.), Winter (ab 7.1.)
- **Schule:** Kreidetafel, Karopapier, Heftlinien, Pinnwand, Schulsachen (hell/dunkel)
- Farben & Verläufe, eigene Farbe, eigenes Foto
- Optional **bewegte Effekte**: Schnee, fallende Blätter, Blüten – je nach Hintergrund

**Vollbild:** Die Leiste blendet sich nach 3 s aus und erscheint wieder, wenn du die Maus bewegst.

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
css/fonts.css         Einbindung der lokalen Schriften
fonts/                Schriftdateien (woff2) und Lizenzen
js/core.js            Helfer: Symbole, Speicher, Ton, Bilder-Speicher
js/backgrounds.js     Hintergrund-Illustrationen, Jahreszeit-Automatik, Effekte
js/app.js             Arbeitsfläche, Werkzeugleiste, Hintergrund
js/collab.js          Menü „Gemeinsam“ (Werkzeugliste hier anpassbar)
js/widgets/*.js       Ein Werkzeug pro Datei
```

Ein neues Werkzeug = eine neue Datei in `js/widgets/`, die `registerWidget(...)` aufruft,
plus eine Zeile in `index.html` und der Name in `ORDER` in `js/app.js`.

## Schriften

Lokal eingebunden (`fonts/`, Lizenz SIL Open Font License, Texte in `fonts/licenses/`) – es wird nichts von Google geladen:

| Schrift | Wofür |
|---|---|
| Andika | Leseanfänger: einstöckiges „a“, eindeutige I/l/1 |
| Lexend | entwickelt für flüssiges Lesen |
| Atkinson Hyperlegible | besonders gut unterscheidbare Zeichen (Sehbeeinträchtigung) |
| Playpen Sans | Handschrift-Stil |
| Source Serif 4 | Serifenschrift für längere Texte |
| JetBrains Mono | Informatik & Code |

## Datenschutz

Es werden keine Daten an einen Server geschickt. Texte, Bilder und Einstellungen liegen ausschließlich
im Browser-Speicher des jeweiligen Geräts. Einzige externe Anfrage: die QR-Code-Bibliothek
(`qrcode-generator`, MIT-Lizenz) wird von cdnjs.cloudflare.com geladen.
