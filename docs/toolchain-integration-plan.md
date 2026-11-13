# Integration PGT ↔ DocPouch / Toolchain Family

**Status:** Umgesetzt (Phase 1 + 2), siehe [`toolchain-oidc-setup.md`](./toolchain-oidc-setup.md)  
**Branch:** `feature/toolchain-oidc`  
**Ziel:** Das Peer Grading Tool (PGT) mit DocPouch als Identity Provider und als Teil der Toolchain Family betreiben – insbesondere die Authentifizierung.

> **Umsetzungshinweis:** Dieses Dokument beschreibt den ursprünglichen Plan und
> die abgewogenen Alternativen. Die tatsächlich getroffenen Entscheidungen stehen
> in [§10](#10-getroffene-entscheidungen); die konkrete Konfiguration und die
> Betriebsanleitung in [`toolchain-oidc-setup.md`](./toolchain-oidc-setup.md).

---

## 1. Zielbild

Empfohlene Zielarchitektur:

```
┌─────────────────────────────┐
│  Browser                    │
│  Angular PGT Frontend       │
│  - DocPouch OIDC Login      │
│  - PGT API mit PGT-JWT      │
└──────────┬──────────────────┘
           │
           │ 1. OIDC Redirect / Token
           ▼
┌─────────────────────────────┐        ┌─────────────────────────────┐
│  PGT Backend (NestJS)       │───────▶│  DocPouch                   │
│  - Token-Exchange           │ whoami │  - OIDC Provider            │
│  - PGT-JWT (eigenes Secret) │        │  - Users / Rollen           │
│  - Prisma / SQLite          │        │  - Dokumente / Strukturen   │
│  - Campaigns / Gradings     │        │  - Tool-Details (TDD)       │
└─────────────────────────────┘        └─────────────────────────────┘
           │
           │ 2. Ergebnisse publizieren (optional)
           └──────────────────────────────────▶ DocPouch-Dokument
```

**Kernentscheidung:** DocPouch wird **Identity Provider** und optionaler **Datenaustausch-Kanal**. Das PGT-Backend bleibt **System of Record** für Kampagnen, Gruppen, Peers, Gradings und Kommentare.

**Warum keine vollständige Migration der Fachdaten nach DocPouch?**

- Peers arbeiten heute **ohne Login** über einen eindeutigen Link. DocPouch-Dokumente setzen einen authentifizierten Benutzer voraus; „public“ heißt dort „für alle angemeldeten Benutzer lesbar“.
- Die anonyme Dokumenterstellung von DocPouch ist für diesen Flow nicht geeignet: Der Ersteller kann das Dokument danach nicht mehr bearbeiten, und es gehört dem Admin.
- Das PGT hat relationale Auswertungen, PDF-/Excel-Export und E-Mail-Versand. Das lässt sich mit DocPouch-Dokumenten nur mit deutlich mehr Aufwand abbilden.
- DocPouch beschreibt sich selbst als leichtgewichtige Lösung für Entwicklung/Test/interne Umgebungen, **nicht** als hochsichere Produktionsdatenbank. Peer-Grading-Daten sind sensibel.

Deshalb: **Auth + Ergebnis-Publikation über DocPouch, Fachdaten weiterhin in SQLite.** Eine spätere Vollmigration bleibt möglich, ist aber ein eigenes Projekt (siehe §9).

---

## 2. Ausgangslage im PGT

### Backend

- NestJS 9, Prisma 4, SQLite.
- Auth: `POST /api/auth/login` (E-Mail + Passwort, MD5-Hash), danach
  - Access-Token (JWT, 10 min, `JWT_SECRET`)
  - Refresh-Token (JWT, 2 Tage, `JWT_REFRESH_SECRET`, gehasht in `User.refreshToken`)
- `GET /api/auth/profile`, `POST /api/auth/logout`, `GET /api/auth/refresh`.
- Guards: `JwtAuthGuard`, `RolesGuard`, `CampaignGuard`.
- Benutzerrollen: `ADMIN`, `SUPER`, `PEER` (Prisma `Role`).
- Nur Admins melden sich an. Peers nutzen öffentliche Links:
  - `GET /api/group/:url`
  - `GET /api/group/review/:url`
  - `POST /api/group`

### Frontend

- Angular 17, Login-Formular für Admins.
- `TokenService` speichert Access-/Refresh-Token in `localStorage`.
- `MainInterceptor` hängt das Token an alle API-Requests.
- `ErrorInterceptor` versucht bei 401 einen Refresh über `/api/auth/refresh`.
- `authGuard` schützt Admin-Routen; Peer-Link-Routen sind öffentlich.
- Lokalisierte Builds: `/en/` und `/de/`, Fallback auf Englisch.

### DocPouch / Toolchain Family

- DocPouch bietet OIDC (Authorization Code + PKCE), JWT-Login und API-Keys.
- OIDC-Access-Tokens sind **opak**, nicht JWT-signiert. DocPouch validiert sie intern.
- `GET /users/whoami` akzeptiert sowohl JWT- als auch OIDC-Tokens und liefert:
  `{ _id, name, email, isAdmin, role }` mit `role ∈ {member, manager, admin, superadmin}`.
- Die Toolchain Family nutzt DocPouch als zentrales Backend, OIDC als Login und
  **Tool-Details-Dokumente (TDD)** vom Typ `0/0` zur Registrierung von Tools.
- Tools liefern zusätzlich ein `manifest.json` mit stabilen Rollen-Keys.

---

## 3. Phase 1 – Authentifizierung über DocPouch (Kern)

### 3.1 Empfohlener Flow: OIDC + Token-Exchange

Warum Token-Exchange und nicht „bei jedem Request whoami“?

- DocPouch hat ein Rate-Limit von 100 GET-Requests pro 15 Minuten **pro IP**. Das PGT-Backend würde mit vielen Benutzern schnell in dieses Limit laufen.
- Das PGT bleibt unabhängig von der DocPouch-Verfügbarkeit, sobald ein Benutzer eingeloggt ist.
- Die bestehenden Guards (`RolesGuard`, `CampaignGuard`) und die lokale Benutzerverwaltung funktionieren unverändert weiter.

Ablauf:

1. Frontend startet den OIDC-Login über `docpouch-client` (Redirect zu DocPouch).
2. Nach dem Callback hat das Frontend ein DocPouch-Access-Token.
3. Frontend ruft einmalig `POST /api/auth/oidc/exchange` mit
   `Authorization: Bearer <docpouch-access-token>` auf.
4. Backend ruft `GET <DOCPOUCH_URL>/users/whoami` mit diesem Token auf.
5. Backend findet oder erstellt den lokalen PGT-Benutzer und prüft die Berechtigung.
6. Backend stellt ein **PGT-eigenes JWT-Paar** aus (Access z. B. 8 h, Refresh 2 Tage)
   – gleiche Antwortform wie beim bisherigen Login.
7. Alle weiteren PGT-API-Requests nutzen das PGT-JWT. DocPouch wird nicht mehr pro Request benötigt.
8. Bei einem 401 im Frontend:
   - zuerst `docpouchClient.ensureValidOidcToken()` (DocPouch-Token erneuern),
   - dann erneut `/api/auth/oidc/exchange`,
   - schlägt das fehl: OIDC-Login starten.
9. Logout: PGT-Refresh-Token serverseitig löschen, danach `docpouchClient.logout()` →
   DocPouch `/end_session` → registrierte `post_logout_redirect_uri`.

Vorteile:

- Ein DocPouch-Aufruf pro Login, nicht pro API-Request.
- Keine DocPouch-Abhängigkeit im normalen Betrieb.
- Bestehende PGT-Autorisierung bleibt erhalten.
- Rollen-/Mitgliedschaftsänderungen werden beim nächsten Exchange (spätestens nach Token-Ablauf) wirksam.

### 3.2 Autorisierungsmodell (Empfehlung)

**Identität:** DocPouch (`sub`, `email`, `name`).  
**Autorisierung:** weiterhin PGT-lokal (`User.roles`, `Campaign.users`).

Grund: PGT-Admins sind Kursverantwortliche, nicht automatisch alle DocPouch-Admins. Eine pauschale Übernahme der DocPouch-Rolle würde zu weitreichenden Rechten führen.

Vorschlag:

- Bestehende PGT-Benutzer werden per **E-Mail** mit der DocPouch-Identität verknüpft.
- Neue Benutzer erhalten **keinen** Zugriff, außer:
  - ihre E-Mail steht in `PGT_BOOTSTRAP_SUPER_ADMINS`, oder
  - `PGT_ALLOW_DOCPOUCH_ADMINS=true` und die DocPouch-Rolle ist `admin`/`superadmin`.
- Optional: DocPouch-`superadmin` → PGT-`SUPER`, wenn explizit gewünscht.
- Peers bleiben unverändert Link-basiert und benötigen kein DocPouch-Konto.

Alternativ (einfacher, aber grober): DocPouch `admin`/`superadmin` → PGT `ADMIN`/`SUPER`, alle anderen abweisen. Das sollte nur gewählt werden, wenn die Rollen in DocPouch sauber gepflegt sind.

> **Entscheid (umgesetzt):** Es wird die **direkte Übernahme der DocPouch-Rollen**
> gewählt. `superadmin`/`isAdmin` → `SUPER` + `ADMIN`, `admin` → `ADMIN`,
> `manager`/`member` → `403 PGT_ACCESS_DENIED`. Die PGT-lokale Rollenverwaltung
> wird im OIDC-Modus nicht mehr als Autorisierungsquelle verwendet
> (`mapDocPouchRoles` in `backend/src/user/user.service.ts`).

### 3.3 Backend-Änderungen

#### Datenmodell / Migration

`backend/prisma/schema.prisma`:

```prisma
model User {
  userId        Int      @id @default(autoincrement())
  lastName      String
  firstName     String
  email         String   @unique
  password      String?          // war: String (Pflicht)
  docPouchId    String?  @unique  // DocPouch `sub` / `_id`
  authSource    String   @default("local") // "local" | "oidc"
  // ... bestehende Felder
}
```

Migration:

```bash
cd backend
npx prisma migrate dev --name add_docpouch_identity
```

Hinweise:

- `password` wird nullable, damit OIDC-Benutzer kein Passwort brauchen.
- Bestehende Benutzer behalten Passwort und Rollen.
- `docPouchId` verhindert, dass eine geänderte E-Mail die Identität verliert.
- Beim ersten OIDC-Login wird ein bestehender Benutzer mit gleicher E-Mail verknüpft.

#### Neue/geänderte Dateien

| Datei | Änderung |
|---|---|
| `backend/src/config.ts` | Auth-Modus, DocPouch-URL, Client-ID, Redirect-URI, Allowlists |
| `backend/src/auth/oidc.service.ts` (neu) | `whoami`-Aufruf, Timeout, Fehlerbehandlung, optional Discovery |
| `backend/src/auth/auth.service.ts` | `exchangeOidcToken()`, User-Provisioning, PGT-Token-Ausgabe |
| `backend/src/auth/auth.controller.ts` | `POST /auth/oidc/exchange`, `GET /auth/config`; lokale Endpunkte im OIDC-Modus deaktivieren |
| `backend/src/auth/auth.module.ts` | neue Provider |
| `backend/src/guards/jwt-auth.guard.ts` | unverändert für PGT-JWT; ggf. umbenennen zu `AuthGuard` |
| `backend/src/strategies/jwt.strategy.ts` | bleibt für PGT-JWT |
| `backend/src/user/user.service.ts` | `upsertOidcUser()`, Passwort optional |
| `backend/.env.example` | neue Variablen dokumentieren |
| `backend/src/main.ts` | CORS auf erlaubte Origins einschränken; `/manifest.json` vom `/api`-Prefix ausnehmen |
| `backend/src/app.module.ts` | ggf. ServeStatic-Basis für Deployment anpassen |

Pseudo-Code für den Exchange:

```ts
async exchangeOidcToken(docPouchToken: string) {
  const identity = await this.oidcService.whoami(docPouchToken);
  // identity = { _id, email, name, isAdmin, role }

  if (!identity.email) {
    throw new UnauthorizedException('DOCPOUCH_EMAIL_SCOPE_REQUIRED');
  }

  const user = await this.userService.upsertOidcUser(identity, {
    allowDocPouchAdmins: config.allowDocPouchAdmins,
    bootstrapSuperAdmins: config.bootstrapSuperAdmins,
  });

  if (!user.roles.some((r) => r.role === 'ADMIN' || r.role === 'SUPER')) {
    throw new ForbiddenException('PGT_ACCESS_DENIED');
  }

  const tokens = await this.getTokens(user); // bestehende Logik
  await this.updateRefreshToken(user.email, tokens.refreshToken);
  return tokens;
}
```

Fehlerbehandlung:

- DocPouch antwortet 401 → `401` an Frontend („DocPouch-Session ungültig“).
- DocPouch nicht erreichbar / Timeout → `503` („Identity Provider nicht erreichbar“), **nicht** 401, damit der Benutzer nicht ausgeloggt wird.
- Rate-Limit 429 → `503` mit Retry-Hinweis, Exchange nur einmal pro Login.

#### Öffentliche Auth-Konfiguration

`GET /api/auth/config` (ohne Auth):

```json
{
  "mode": "oidc",
  "issuer": "https://docpouch.example.com/oidc",
  "clientId": "…",
  "redirectUri": "https://pgt.example.com/auth/callback",
  "postLogoutRedirectUri": "https://pgt.example.com/",
  "scope": "openid profile email offline_access"
}
```

Damit muss das Frontend keine Client-ID hartkodieren und kann pro Umgebung konfiguriert werden.
Im Modus `local` liefert der Endpunkt `{ "mode": "local" }`.

#### Lokale Endpunkte im OIDC-Modus

- `POST /api/auth/login`, `/auth/register`, `/auth/confirm-email`, `/auth/refresh`
  werden mit `410 Gone` oder `404` beantwortet.
- Der bestehende Refresh-Mechanismus bleibt für den lokalen Fallback erhalten.
- SendGrid-Registrierungsmails werden im OIDC-Modus nicht mehr ausgelöst.
  (SendGrid wird noch für Ergebnis-/Erinnerungsmails benötigt – nicht entfernen.)

### 3.4 Frontend-Änderungen

| Datei | Änderung |
|---|---|
| `frontend/package.json` | `docpouch-client` hinzufügen |
| `frontend/src/app/services/auth.service.ts` (neu) | OIDC-Init, Callback, Exchange, Logout, Session-Restore |
| `frontend/src/app/services/token.service.ts` | PGT-Token speichern; DocPouch-Token über den Client beziehen |
| `frontend/src/app/app.module.ts` | `APP_INITIALIZER` für Auth-Init |
| `frontend/src/app/app-routing.module.ts` | Route `auth/callback` (öffentlich), Login-Route verhalten sich je nach Modus |
| `frontend/src/app/login/login.component.*` | OIDC-Button statt Formular im OIDC-Modus; Formular nur im lokalen Modus |
| `frontend/src/app/interceptors/main.interceptor.ts` | PGT-JWT anhängen |
| `frontend/src/app/interceptors/error.interceptor.ts` | 401 → DocPouch-Token erneuern → Exchange → Retry; sonst OIDC-Login |
| `frontend/src/app/guards/auth.guard.ts` | auf abgeschlossene Auth-Initialisierung warten |
| `frontend/src/app/header/*` | Benutzer-Pill mit Name + Logout |
| `frontend/src/app/register/*`, `confirm-email/*` | im OIDC-Modus ausblenden/deaktivieren |
| `frontend/src/assets/manifest.json` (neu) | Toolchain-Manifest (Phase 2) |
| `frontend/angular.json` | Manifest als Asset; ggf. `baseHref` anpassen |

Wichtige Details:

- **Callback-Route:** `/auth/callback` muss ohne `authGuard` erreichbar sein.
  Nach dem Callback zurück zur gemerkten `returnUrl` navigieren.
- **Return-URL:** vor dem OIDC-Redirect in `sessionStorage` speichern.
- **Peer-Links:** `/peer-grading/:url` und `/peer-grading-review/:url` bleiben öffentlich.
  Die Auth-Initialisierung darf dort **nicht** automatisch einen Login erzwingen.
- **Token-Trennung:** DocPouch-Token (für DocPouch/Identity) und PGT-Token (für PGT-API)
  getrennt halten. Der `TokenService` verwaltet nur PGT-Token.
- **Logout:** erst PGT-Logout, dann `docpouchClient.logout()`. Die registrierte
  `post_logout_redirect_uri` muss exakt passen.
- **Lokalisierte Builds:** `/en/` und `/de/` haben unterschiedliche `baseHref`.
  Umgesetzt: Das Frontend leitet `redirect_uri` und `post_logout_redirect_uri`
  aus dem eigenen `<base href>` ab (`frontend/src/app/services/auth.service.ts`),
  d.h. sprachspezifisch (`/en/auth/callback`, `/de/auth/callback`). Entsprechend
  wird für jede Sprache eine Callback-URI beim DocPouch-Client registriert
  (`PGT_LOCALES` in `docpouch-dev/setup-local.mjs`). Die Backend-Variablen
  `PGT_OIDC_REDIRECT_URI` / `PGT_POST_LOGOUT_REDIRECT_URI` sind nur noch
  Fallbacks.

### 3.5 DocPouch-Konfiguration

#### OIDC-Client registrieren

```http
POST https://docpouch.example.com/oidc/reg
Authorization: Bearer <OIDC_REGISTRATION_TOKEN>
Content-Type: application/json

{
  "client_name": "Peer Grading Tool",
  "redirect_uris": [
    "https://pgt.example.com/de/auth/callback",
    "https://pgt.example.com/en/auth/callback"
  ],
  "post_logout_redirect_uris": [
    "https://pgt.example.com/de/",
    "https://pgt.example.com/en/"
  ],
  "grant_types": ["authorization_code", "refresh_token"],
  "response_types": ["code"],
  "token_endpoint_auth_method": "none",
  "application_type": "web"
}
```

- `token_endpoint_auth_method: "none"` + PKCE = öffentlicher SPA-Client, **kein Secret im Frontend**.
- Falls DocPouch für den Token-Endpunkt zwingend ein Secret verlangt, muss der Code-Exchange
  über das PGT-Backend (BFF) laufen; das Secret darf nie im Browser landen.
- `offline_access`: dynamisch registrierte Clients erhalten Refresh-Tokens nur, wenn der
  Admin die erlaubten Scopes erweitert. Falls das nicht möglich ist, mit 8–24 h
  Access-Token arbeiten und bei Ablauf neu einloggen.

#### DocPouch-Umgebungsvariablen

```env
OIDC_ISSUER=https://docpouch.example.com/oidc
ALLOWED_ORIGINS=https://pgt.example.com
OIDC_REGISTRATION_TOKEN=<starkes Secret>
OIDC_AUTO_CONSENT_CLIENTS=docpouch-admin-ui,<pgt-client-id>
SESSION_TIMEOUT=8h
JWT_SECRET=<starkes Secret>
OIDC_COOKIE_KEY=<starkes Secret>
TRUST_PROXY=<Proxy-Konfiguration>
NODE_ENV=production
```

### 3.6 Lokale Entwicklung

- DocPouch per Docker Compose starten (Port z. B. 3031, siehe `systemic-consensing/docpouch-dev`).
- Registrierungsskript für den OIDC-Client und die PGT-Struktur (Phase 2) anlegen.
- `AUTH_MODE=local` als Standard in der Entwicklung, damit bestehende Logins weiter funktionieren.
- `AUTH_MODE=oidc` in einer zweiten Compose-Konfiguration testen.
- Testbenutzer in DocPouch: `superadmin`, `admin`, `member` – damit alle Berechtigungsfälle abgedeckt sind.

### 3.7 Abnahmekriterien Phase 1

- Admin meldet sich über DocPouch an und landet auf dem PGT-Dashboard.
- Ein DocPouch-`member` erhält eine verständliche 403-Meldung.
- Ein bestehender PGT-Admin mit gleicher E-Mail behält Rollen und Kampagnen.
- Peer-Link funktioniert weiterhin ohne Login.
- Logout beendet PGT- und DocPouch-Session.
- Bei DocPouch-Ausfall funktionieren bereits ausgestellte PGT-Tokens weiter;
  neue Logins erhalten eine klare Fehlermeldung.
- Kein DocPouch-Aufruf pro API-Request (nur beim Exchange).

---

## 4. Phase 2 – Toolchain-Family-Integration

### 4.1 Manifest

> **Umsetzung:** Das Manifest wird vom Backend ausgeliefert
> (`backend/src/toolchain/manifest.ts`, Route `<base>/manifest.json` mit
> `Access-Control-Allow-Origin: *`), nicht als Frontend-Asset. Dadurch gilt für
> Entwicklung und Produktion dieselbe URL.

`backend/src/toolchain/manifest.ts` (Beispiel):

```json
{
  "tool": "Peer Grading",
  "version": "1.0.0",
  "matchBy": "content.assignments",
  "description": "Peer-Grading für Gruppenarbeiten: Kriterien, Gewichtung, anonyme Bewertung und Auswertung.",
  "icon": "data:image/png;base64,...",
  "roles": [
    {
      "key": "peerGradingResult",
      "name": "Peer Grading Result",
      "direction": "provides",
      "description": "Aggregiertes, anonymisiertes Ergebnis einer Peer-Grading-Kampagne pro Gruppe/Peer.",
      "structure": [
        { "key": "campaignName", "display": "Campaign", "type": "string" },
        { "key": "groupNumber", "display": "Group", "type": "number" },
        { "key": "peer", "display": "Peer", "type": "string" },
        { "key": "criteriaScores", "display": "Criteria scores", "type": "array", "items": "object" },
        { "key": "weightedScore", "display": "Weighted score", "type": "number" },
        { "key": "publishedAt", "display": "Published at", "type": "string" }
      ]
    }
  ]
}
```

Regeln:

- Rolle-Keys (`peerGradingResult`) müssen über Versionen stabil bleiben.
- Manifest muss unter `<tool-url>/manifest.json` erreichbar sein und
  `Access-Control-Allow-Origin: *` liefern.
- Validierung gegen das Schema aus `Toolchain-Family/toolchain-manifest`.

Optional zweite Rolle `peerGradingCampaign` (`direction: "both"`), falls Kampagnen
später aus DocPouch importiert werden sollen.

### 4.2 Tool-Details-Dokument (TDD) in DocPouch

Die Toolchain-Dashboard liest TDDs vom Typ `0/0`. Benötigt werden:

1. DocPouch-Struktur z. B. `Peer Grading Result` (`type: 100`, `subType: 0`).
2. TDD-Dokument:

```json
{
  "type": 0,
  "subType": 0,
  "title": "Tool details — Peer Grading",
  "public": true,
  "content": {
    "name": "Peer Grading",
    "description": "Peer-Grading für Gruppenarbeiten.",
    "url": "https://pgt.example.com/",
    "responsible": "",
    "icon": "<base64>",
    "incomingDataStructureIDs": [],
    "outgoingDataStructureIDs": ["<result-structure-id>"],
    "assignments": {
      "peerGradingResult": {
        "structureId": "<result-structure-id>",
        "type": 100,
        "subType": 0
      }
    }
  }
}
```

Ein Setup-Skript (analog `systemic-consensing/docpouch-dev/setup-local.py`) legt
Struktur + TDD idempotent an.

### 4.3 Ergebnisse nach DocPouch publizieren

Empfohlen: **Frontend** erstellt das Ergebnis-Dokument mit `docpouch-client`.

- Button „In Toolchain veröffentlichen“ auf der Kampagnen-Auswertung.
- Frontend holt die aggregierten Ergebnisse vom PGT-Backend
  (z. B. `GET /api/campaign/:id/results-export`).
- Frontend erstellt ein DocPouch-Dokument mit
  `content: { structureID, structuredData }`.
- Owner ist der angemeldete Admin; Sichtbarkeit bewusst wählen
  (`public` nur für aggregierte, anonymisierte Daten).

> **Entscheid (umgesetzt):** Das Ergebnis-Dokument wird als **privat**
> (`public: false`) angelegt und ist damit nur für den Owner und
> DocPouch-Administratoren sichtbar. Es wird mit dem DocPouch-Client des
> angemeldeten Administrators erstellt (kein Service-Account). Publiziert werden
> nur Aggregate mit laufender Peer-Nummer – keine Namen, E-Mails oder
> Freitext-Kommentare.

Vorteile: kein DocPouch-Token im PGT-Backend, keine Service-Account-Verwaltung,
konsistent mit den anderen Toolchain-Tools.

Datenschutz:

- **Keine** Freitext-Kommentare und keine E-Mail-Adressen publizieren.
- Peers pseudonymisieren (z. B. `peerId` oder laufende Nummer).
- Nur aggregierte, für die Auswertung notwendige Felder.
- Aufbewahrung/Löschung mit den Verantwortlichen klären.

### 4.4 UI-Harmonisierung

Die Toolchain Family nutzt einen einheitlichen Rahmen:

- 3-zeiliger Header (Icon/Titel, Tagline, Live-Metriken)
- Standard-Menüleiste (Save/Load/Clear/Demo – soweit für PGT sinnvoll)
- Benutzer-Pill mit Logout
- Dunkler Footer „Peer Grading + Toolchain“
- Einheitliches `SignInModal`
- Toolchain-Dashboard-Link (konfigurierbar, z. B. `TOOLCHAIN_DASHBOARD_URL`)
- Gemeinsames Favicon, `version.json`, Titel/Logo führt zur Startansicht
- Optional Hash-Routing, falls statisch ohne Rewrite deployt wird

Das ist reine Frontend-Arbeit und kann unabhängig von der Auth-Integration umgesetzt werden.

### 4.5 Deployment

> **Entscheid (umgesetzt):** Das PGT wird als **Unterpfad** auf dem
> Toolchain-Host betrieben: `https://tapassio.pantek.ch/tc/PeerGrading/`. Die
> dafür nötigen Einstellungen sind in
> [`toolchain-oidc-setup.md`](./toolchain-oidc-setup.md) §4 beschrieben
> (`APP_BASE_PATH=/tc/PeerGrading`, Sprach-`baseHref`s, SPA-Fallback,
> Redirect-URIs).

**Empfehlung: eigene Origin** `https://pgt.example.com` für Frontend + API.

- Keine Konflikte mit `baseHref`, Sprachpfaden oder dem `/api`-Prefix.
- Toolchain-Dashboard verlinkt auf diese URL; TDD und Manifest werden von dort geladen.
- DocPouch bleibt unter `https://docpouch.example.com`.
- CORS: PGT-Origin in DocPouch `ALLOWED_ORIGINS`; PGT-Backend nur PGT-Origin erlauben.

**Alternative: Unterpfad** `https://toolchain-host/Tools/PeerGrading/`.

Dann zusätzlich nötig:

- Angular `baseHref`/`deployUrl` auf `/Tools/PeerGrading/`.
- NestJS Global Prefix auf `/Tools/PeerGrading/api`.
- ServeStatic-Roots anpassen.
- OIDC-Redirect-URI auf `/Tools/PeerGrading/auth/callback`.
- SPA-Fallback für den Callback testen.
- Ggf. Reverse-Proxy-Regeln.

Diese Variante ist deutlich invasiver und sollte nur gewählt werden, wenn der Unterpfad
zwingend vorgegeben ist.

---

## 5. Konfigurationsmatrix

### PGT Backend

```env
AUTH_MODE=oidc                 # "local" | "oidc"
DOCPOUCH_URL=https://docpouch.example.com
DOCPOUCH_OIDC_ISSUER=https://docpouch.example.com/oidc
DOCPOUCH_CLIENT_ID=<client-id>
DOCPOUCH_TIMEOUT_MS=5000
PGT_PUBLIC_URL=https://pgt.example.com
# Fallback; das Frontend leitet die sprachspezifische URI selbst ab.
PGT_OIDC_REDIRECT_URI=https://pgt.example.com/auth/callback
PGT_BOOTSTRAP_SUPER_ADMINS=admin1@example.com,admin2@example.com
PGT_ALLOW_DOCPOUCH_ADMINS=false
PGT_TOKEN_TTL=8h
JWT_SECRET=<starkes Secret>
JWT_REFRESH_SECRET=<starkes Secret>
DATABASE_URL=file:./dev.db
```

### PGT Frontend

- API-Basis-URL (`environment.api`).
- Toolchain-Dashboard-URL.
- Keine Client-Secrets.
- OIDC-Konfiguration kommt von `GET /api/auth/config`.

### DocPouch

```env
OIDC_ISSUER=https://docpouch.example.com/oidc
ALLOWED_ORIGINS=https://pgt.example.com
OIDC_REGISTRATION_TOKEN=<starkes Secret>
OIDC_AUTO_CONSENT_CLIENTS=docpouch-admin-ui,<pgt-client-id>
SESSION_TIMEOUT=8h
JWT_SECRET=<starkes Secret>
OIDC_COOKIE_KEY=<starkes Secret>
TRUST_PROXY=<Proxy-Konfiguration>
NODE_ENV=production
```

---

## 6. Sicherheit und Risiken

| Risiko | Auswirkung | Gegenmaßnahme |
|---|---|---|
| DocPouch-Tokens im `localStorage` | XSS kann Tokens stehlen | Strikte CSP, keine Inline-Skripte/Fremdskripte, kurze Token-Laufzeiten; langfristig BFF mit HttpOnly-Cookies |
| DocPouch ist Single Point of Failure für Login | Neue Logins scheitern bei Ausfall | Token-Exchange + PGT-JWT; 503 statt 401; Monitoring |
| Rate-Limit von DocPouch | Exchange schlägt fehl | Exchange nur bei Login/Refresh, nicht pro Request; Cache/Retry |
| Rollen-Mapping zu grob | Zu viele Admins | PGT-lokale Rollen + Allowlist (Empfehlung) |
| MD5-Passwort-Hashes im Altbestand | Schwache Passwortspeicherung | OIDC-Modus: lokale Passwörter deaktivieren; bei Fallback Migration auf Argon2/bcrypt |
| Sensible Daten in DocPouch | Datenschutzverletzung | Nur aggregierte, anonymisierte Ergebnisse publizieren; keine Kommentare/E-Mails |
| Falsche Redirect-URI | Login schlägt fehl | URIs exakt registrieren; pro Sprache/Deployment testen |
| `offline_access` fehlt | Kein Refresh-Token | Access-Token-Laufzeit erhöhen oder Scope durch Admin freigeben |
| DocPouch-Sicherheitsmodell | Kein Hochsicherheits-Produktionssystem | PGT bleibt System of Record; DocPouch nur Identity + Export |

Weitere Punkte:

- `JWT_SECRET`, `JWT_REFRESH_SECRET`, `OIDC_COOKIE_KEY` und `OIDC_REGISTRATION_TOKEN`
  müssen starke, zufällige Werte sein. Die Werte aus `.env.example` sind nur für lokal.
- CORS im Backend derzeit `enableCors()` (alle Origins). Auf die PGT-Origin einschränken.
- Keine Tokens oder personenbezogenen Daten loggen.
- Bestehende Refresh-Tokens beim Wechsel auf OIDC invalidieren.

---

## 7. Testplan

### Backend (Unit/Integration)

- Exchange mit gültigem, abgelaufenem und ungültigem DocPouch-Token.
- DocPouch antwortet 401 / 429 / 503 / Timeout.
- User-Provisioning: bestehende E-Mail, neue E-Mail mit/ohne Allowlist, fehlende E-Mail.
- Rollen-Mapping (`member`, `manager`, `admin`, `superadmin`).
- `RolesGuard` und `CampaignGuard` mit OIDC-Benutzern.
- Lokaler Modus funktioniert unverändert.
- Peer-Link-Endpunkte bleiben ohne Auth erreichbar.

### Frontend

- OIDC-Init, Callback, Return-URL.
- Session-Restore nach Reload.
- 401 → `ensureValidOidcToken()` → Exchange → Retry.
- Logout-Redirect.
- Peer-Link-Seite erzwingt keinen Login.
- Lokalisierte Builds (`/en/`, `/de/`).

### End-to-End

1. DocPouch + PGT per Docker Compose starten.
2. OIDC-Client registrieren, Struktur + TDD anlegen.
3. Admin-Login über DocPouch.
4. Kampagne erstellen, Peers importieren, Links öffnen, Gradings erfassen.
5. Auswertung als PDF/Excel exportieren.
6. Ergebnis nach DocPouch publizieren und im Dashboard prüfen.
7. Logout und erneuter Login.

### CI

- Backend- und Frontend-Build.
- Manifest gegen `toolchain-manifest`-Schema validieren.
- Optional: E2E-Job mit DocPouch-Container.

---

## 8. Aufwand (grobe Schätzung)

| Paket | Aufwand |
|---|---|
| Phase 1 Backend (Exchange, Provisioning, Tests) | 3–4 Personentage |
| Phase 1 Frontend (OIDC, Callback, Interceptor, UI) | 3–4 Personentage |
| Phase 1 Infrastruktur (DocPouch, Client-Registrierung, Deployment) | 1–2 Personentage |
| Phase 1 Tests/E2E | 2–3 Personentage |
| Phase 2 Manifest + TDD + Publish | 3–5 Personentage |
| Phase 2 UI-Harmonisierung | 2–4 Personentage |
| **Summe Phase 1 + 2** | **ca. 14–22 Personentage** |
| Phase 3 Vollmigration nach DocPouch | 15–25 Personentage (nicht empfohlen) |

---

## 9. Optionale Phase 3 – Vollmigration der Fachdaten

Falls DocPouch wirklich alle PGT-Daten halten soll, müssten u. a. folgende
Dokumentstrukturen abgebildet werden:

- `campaign` (Name, Zeitraum, Sprache, max. Punkte, Kriterien)
- `group` (Nummer, Kampagne, Status)
- `peer` (Name, E-Mail, Matrikelnummer, Gruppenzuordnung)
- `grading` (von, an, Kriterium, Punkte)
- `comment` (von, an, Text)
- `peerLink` (Gruppe, Peer, geheimer Link)

Blocker:

- **Peer-Links ohne Login:** DocPouch-Dokumente benötigen einen authentifizierten Benutzer.
  Entweder bekommen alle Peers DocPouch-Konten (großer organisatorischer Aufwand)
  oder es braucht ein BFF mit Service-API-Key und signierten Links.
- **Anonymität:** „public“ in DocPouch bedeutet „für alle angemeldeten Benutzer lesbar“.
  Das ist für einzelne Gradings nicht akzeptabel.
- **Auswertungen:** Relationale Aggregationen, PDF-/Excel-Export und Kommentar-Anonymisierung
  müssten neu implementiert werden.
- **Sicherheit:** DocPouch ist laut eigener Dokumentation nicht für hochsichere
  Produktionsumgebungen gedacht.

**Empfehlung:** Phase 3 nicht jetzt umsetzen. Stattdessen Phase 1 + 2, und die
Ergebnis-Publikation als schlanke Brücke zur Toolchain nutzen.

---

## 10. Getroffene Entscheidungen

| # | Frage | Entscheid |
|---|---|---|
| 1 | **Auth-Modus** | OIDC-only in Produktion (`AUTH_MODE=oidc`); lokaler Login (`AUTH_MODE=local`, Standard) nur für Entwicklung. |
| 2 | **Autorisierung** | DocPouch-Rollen **direkt übernehmen** (`superadmin`/`isAdmin` → `SUPER`+`ADMIN`, `admin` → `ADMIN`, sonst `403`). Keine PGT-lokale Allowlist. |
| 3 | **Deployment** | **Unterpfad** auf dem Toolchain-Host: `https://tapassio.pantek.ch/tc/PeerGrading/`. |
| 4 | **Ergebnis-Publikation** | Ja, aggregierte/anonymisierte Ergebnisse nach DocPouch, als **privates** Dokument (Owner + DocPouch-Admins). Keine Kommentare/E-Mails. |
| 5 | **DocPouch-Instanz** | Produktion `https://docpouch.pantek.app/`; lokal per `docpouch-dev/docker-compose.yml` auf `:3033`. |
| 6 | **Refresh-Tokens** | `offline_access` wird angefragt; PGT-Access-Token 8 h, Refresh 2 Tage. Falls DocPouch den Scope nicht freigibt, Re-Login nach Ablauf. |
| 7 | **Fachdaten** | Keine Vollmigration nach DocPouch (Phase 3 nicht umgesetzt). PGT-Backend bleibt System of Record. |

---

## 11. Umsetzungsstand

1. ✅ DocPouch lokal per Docker Compose + idempotentes Setup-Skript
   (`docpouch-dev/`) inkl. OIDC-Client-Registrierung.
2. ✅ Backend: `whoami`-basiertes Token-Exchange, PGT-JWT, Rollen-Mapping,
   `GET /api/auth/config`, lokale Endpunkte im OIDC-Modus deaktiviert.
3. ✅ Frontend: OIDC-Login, Callback-Route, Session-Restore, 401-Erneuerung,
   Logout über DocPouch `end_session`.
4. ✅ Unterpfad-Deployment (`APP_BASE_PATH`, Sprach-`baseHref`s, SPA-Fallback,
   CORS-Allowlist).
5. ✅ Phase 2: Manifest-Endpunkt, TDD/Struktur-Setup, Publish-Button (privat).
6. ⬜ Produktions-Client registrieren und produktive Struktur/TDD anlegen.
7. ⬜ Monitoring und End-to-End-Test in der Produktionsumgebung.

Details: [`toolchain-oidc-setup.md`](./toolchain-oidc-setup.md).
