# Testdaten

Zwei erfundene Klassen zum Testen. Alle Namen sind erfunden, die E-Mail-Adressen
enden auf `@students.example.org` (eine für Tests reservierte Domain, es geht
keine Mail an echte Personen).

| Datei | Studierende | Gruppen |
|---|---|---|
| `klasse-a-47-studierende.csv` | 47 | 12 (11 × 4, 1 × 3) |
| `klasse-b-34-studierende.csv` | 34 | 8 (6 × 4, 2 × 5) |

Gruppengrösse 4 ist der Standard; Gruppen mit 3 oder 5 gleichen die Klassengrösse aus.

## Variante 1: CSV im Tool importieren

„Kampagne erstellen“ → Teilnehmende → CSV hochladen. Das Format entspricht der
Vorlage `frontend/src/assets/template.csv`:

```
Nachname;Vorname;E-Mail;Gruppennummer;Matrikel-Nr. (optional)
```

Damit gibt es Studierende und Gruppen, aber noch keine Bewertungen.

## Variante 2: fertige Kampagnen mit Bewertungen

Für Dashboard, Auswertungen, PDF und Excel. Das Script legt beide Klassen als
Kampagnen an (Schweizer Notenskala 1–6, halbe Noten, 3 Kriterien):

- **Klasse A** – laufend, 39 von 47 haben bewertet
- **Klasse B** – abgeschlossen, alle haben bewertet

Eingebaute Auffälligkeiten: einige überschätzen sich selbst, je zwei geben allen
dieselbe Punktzahl, in einer Gruppe bewertet eine Person viel strenger.

```sh
cd backend
# Kampagnen einer bestehenden Lehrperson zuordnen
TESTDATA_ADMIN_EMAIL=your.mail@example.com npm run seed:testdata

# ohne Datenbank: nur Zusammenfassung anzeigen
npx ts-node prisma/seed-testdata.ts --dry-run
```

Das Script **fügt nur hinzu**, es löscht nichts. Bei jedem Aufruf entstehen zwei
neue Kampagnen (die Studierenden werden wiederverwendet). Die Bewertungen sind
bei jedem Aufruf gleich (fester Zufalls-Startwert).

Die Datenbank muss die Migration `20261113190000_half_grades` haben
(`npx prisma migrate deploy`), sonst können keine halben Noten gespeichert werden.
