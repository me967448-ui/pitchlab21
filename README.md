# PitchLab 21 — PES 2021 Database Toolkit

PitchLab 21 is a responsive, working browser application inspired by the dense player-search and database tools found on PES database sites. It uses an original project name and brand. Mapped PES 2021 club badges and league/competition emblems load from PESMASTER's public graphics directories; the images are not bundled locally and remain third-party assets.

## Start it locally

**No build step or package install is required.** Run the included local server rather than opening `index.html` directly; that enables the official team-catalog sync endpoint.

**Windows (recommended):** double-click `START-PITCHLAB.bat` and keep its console window open. If the browser does not open automatically, use the exact URL printed in the console; the server may choose a port other than 8000 if that port is already in use. It runs the included `server.py` (Python standard library only).

The home page opens with a small sample and does not download the full player list. The 28,755-entry PESMASTER Advanced Search catalogue loads the first time you open Players, Compare, Teams, Leagues, a team/player profile, or Squad Builder, then stays saved in this browser. The official team index loads only when you open Teams, Leagues, or Master League; official coach and tactic records load when you open those sections or start a Master League career. When a team or a Master League career is opened, PitchLab fetches that team's official PESMASTER squad on demand; when a player is clicked, it fetches that player's full PES 2021 profile inside PitchLab. The site needs the local server (`START-PITCHLAB.bat`) for local catalogue data and an internet connection for remote images and full profiles.

The ZIP includes a verified catalogue snapshot for all 39 PESMASTER PES 2021 competitions. Team membership comes from each official competition page's linked PES 2021 team profiles. A competition page that explicitly has no team links (currently Classic Teams) remains visible with an empty team list; it is not treated as a failed sync. The catalogue count reflects unique team profile IDs linked by the competition pages and can differ from PESMASTER's overall database headline count.

The site still attempts to download a larger PES 2021 community player dataset separately and saves successful imports in IndexedDB. These are distinct steps: a complete team catalogue does not mean every player/manager has been imported.

**Club badge correctness:** official team profile IDs are collected from actual PESMASTER PES 2021 competition links; the app does not use unrelated generic IDs from imported player rows. It uses PESMASTER's `/pes-2021/graphics/teamlogos/e_<team-profile-id>.png` image path and tries the `_w.png` variant as a fallback (two manually verified profile IDs prefer `_w` first). If the official graphics server does not supply either variant, the app shows initials rather than assigning a different real-world logo. Images are loaded remotely, so Internet access is required. No third-party images are bundled into the ZIP.

## Features included

- Responsive dark navy/purple navigation and compact player-database layout.
- Home page, searchable player database, advanced filters, multiple positions, player skills, sort-by-column, pagination and adjustable page size.
- Table/card toggle, multi-select compare (up to four players), and filtered-results CSV export.
- Player profiles with all available attribute groups, playing style, skills, COM styles, and missing-value handling.
- Attribute-by-attribute comparison with top-value highlights.
- Club and league pages with on-demand PESMASTER PES 2021 squads, exact player portrait URLs, and in-site player profiles; league emblems appear on the homepage, league cards, and league detail heading.
- Dedicated Coaches and Team Tactics pages with 685 PESMASTER-linked PES 2021 coach profiles from 686 team pages, including both attacking and defensive tactical presets where linked.
- Formation board for each coach/team preset, direct source links, tactical-style filtering, and clear handling of tactical values that the source does not publish.
- Squad builder with six formations, interactive pitch slots, player replacement/removal, average rating, and local save/load.
- Master League local season mode: choose a PESMASTER competition and team, view the club's official roster and formation, play a full double round-robin schedule, skip each matchday, see every result, and track a saved league table. It simulates scores and is not a 3D match engine or a full transfer/contract system.
- CSV/JSON import workflow, JSON backup export, and reset to sample records.
- English/Arabic toggle with right-to-left layout support for major navigation and controls.
- `supabase/schema.sql`: normalized PostgreSQL/Supabase schema with dataset versions, clubs, leagues, players, all 25 attributes, managers, team tactics, secondary positions, skills, COM styles, indexes, and read-only row-level policies.

## Data accuracy — please read

The bundled records are **real PES 2021 player entries**, not fictional players. The curated starter dataset currently contains 20 individually source-linked players, including Lionel Messi, Cristiano Ronaldo, Neymar, Robert Lewandowski, Mohamed Salah, Kylian Mbappé, Virgil van Dijk, Kevin De Bruyne, Alisson, Sergio Ramos, Son Heung-Min, Sadio Mané, Bruno Fernandes, Manuel Neuer, Diego Maradona, Johan Cruyff, Karim Benzema, Jan Oblak, Luka Modrić, and Harry Kane. Each bundled profile stores a source URL in `sourceUrl` and is marked `dataStatus: \"AUTHENTIC\"`.

**This is not the complete PES 2021 database.** Overall ratings, basic details, attributes and skills are included where verified on the linked PES 2021 profile. `potential` is deliberately `null` because the cited PES 2021 profiles do not provide a reliable potential rating for these records; missing values stay missing rather than being fabricated. Player portraits, mapped club crests, and mapped league/competition emblems load from PESMASTER public PES 2021 image URLs when the browser has internet access; if an image URL is unavailable or offline, an initials fallback appears. Badges are mapped to known PES 2021 team IDs, including renamed/unlicensed in-game teams such as Manchester B and Madrid Chamartin B. These third-party badges remain the property of their respective rights holders.

Use **Import Data** to import a complete CSV or JSON dataset that you obtained and are permitted to use. Imported records become the common source for searching, profiles, comparison, clubs/leagues, and squad building in this browser. Use **Export current data backup** before clearing browser storage or moving to another device. A public dataset listing titled “eFootball PES 2021 All Players CSV” is indexed on [OpenML](https://www.openml.org/search?type=data&sort=runs&id=43649) and [Kaggle](https://www.kaggle.com/datasets/homerkommrad/efootball-pes2021-all-players-csv); check the license and contents on the host before reuse. The complete player dataset is not bundled here. The linked PESMASTER site is provided as a reference; this project does not assume that it offers an unrestricted one-click bulk export of every portrait ID or logo ID. The bundled coach/tactics catalog is built from team-linked PESMASTER coach pages. Tactical values encoded in PESMASTER slider bars are decoded; advanced instructions remain blank when the profile does not publish them.

## JSON import example

```json
[
  {
    "id": "source-id-001",
    "name": "Player Name",
    "displayName": "Player Name",
    "position": "CMF",
    "secondaryPositions": ["DMF"],
    "overall": 82,
    "potential": 88,
    "age": 21,
    "height": 178,
    "weight": 73,
    "nationality": "Country",
    "club": "Club Name",
    "league": "League Name",
    "foot": "Right",
    "playingStyle": "Box-to-Box",
    "attributes": { "lowPass": 84, "speed": 79 },
    "skills": ["Through Passing", "One-touch Pass"],
    "comPlayingStyles": ["Long Ranger"]
  }
]
```

For CSV, use equivalent columns (`id,name,displayName,position,overall,potential,age,height,weight,nationality,club,league,foot,playingStyle,lowPass,speed,...`). Skill and style fields can be semicolon-separated. For duplicate handling, provide a stable source `id`; if you do not have one, the importer can only deduplicate records sharing the generated identifier logic. A source/version field is recommended when importing multiple versions of the same player.

## Supabase / production notes

This downloadable version is a **browser-first application with local persistence**, not a deployed Supabase service. The SQL file provides the normalized schema and indexing starting point for a multi-user version. To deploy for a large database, put search/filter/sort/pagination behind server-side PostgreSQL queries (rather than downloading the full dataset), validate imports server-side, and keep the Supabase service-role key off the client. The included static app does not pretend a database backend has already been configured.

Suggested production query indexes are included in the schema. Keep user-created squads in a separate user-owned table keyed by Supabase Auth user ID if you want squads to sync across devices. Add write policies only after defining an authenticated admin/import workflow.

## Project files

```text
pitchlab21/
├── index.html
├── styles.css
├── app.js
├── server.py          # local API + PESMASTER catalogue, squad, and player-profile fetches
├── START-PITCHLAB.bat # launches server.py on Windows
├── data.js
├── data/
│   ├── managers-tactics.js
│   ├── league-catalog.js
│   ├── pes2021-authentic-sample.json
│   └── pesmaster-team-catalog.json  # created by the server's first successful sync
│   └── pesmaster-players.json       # PESMASTER Advanced Search snapshot, 28,755 entries
├── supabase/
│   └── schema.sql
└── README.md
```

## Limitations of the sample build

- The 20 records in `data.js` are the small home-page sample. The app loads the 28,755-entry PESMASTER Advanced Search snapshot in `data/pesmaster-players.json` only after you open a player-data section.
- Imported data and saved squads are local to the current browser; there is no cross-device sync or server-side authentication in this build.
- Player portraits and club crests load from PESMASTER public image URLs when online; they are not bundled locally. An initials-based fallback remains if a photo fails to load. These third-party images are controlled by their respective rights holders.
- Potential and indexed stats are shown when supplied by PESMASTER's search results; opening a player loads the full official profile in-site.


### PESMASTER-style player portraits

Player list rows, cards, profiles, comparison cards, squad-picker lists and roster lists display player portraits from `https://www.pesmaster.com/pes-2021/graphics/players/player_<id>.png`. The sample data includes a `portraitId` for every sourced record. Online access is required; the images are linked remotely rather than copied into the project. Imported records may provide a numeric `portraitId` or an allowed `portraitUrl` using the same PESMASTER image path.

### League naming fix
- The French competition is normalized to a single label: **Ligue 1 Conforama**. Legacy values such as `Ligue 1 Uber Eats` and `Ligue 1 Conforama` are merged during data loading/import, so the league list does not show duplicates.

## Navigation: League → Club → Players

The Leagues section follows a three-level browsing flow:

1. Open **Leagues** and select a competition.
2. The competition page lists clubs represented in the currently loaded dataset, with team badges and available player-record counts. Select a club to open its squad page.
3. The club page shows its available player records with portraits, positions, playing styles and overall ratings. Click a player's name to open that player's profile. The team page includes a link back to the league.

**Dataset loading:** the ZIP bundles the full PESMASTER snapshot, but the app reads it only when you open a player-data section. The home page keeps using the 20-player sample. If the local catalogue cannot be read, the app keeps the sample and displays a retry option. Team lists reflect the active player dataset, and a player-stat file may not include official league mappings for every club.

### Liverpool custom tactical presets
The Liverpool page includes two custom tactical presets supplied by the user: attacking (support range 6, defensive line 9, compactness 2) and defensive (support range 7, defensive line 8, compactness 3). Both show Attacking Fullbacks and Gegenpress as the two selected advanced instructions. These values are labeled as user-provided choices, not as verified original PESMASTER defaults.

### Liverpool tactical presets (user-configured)

Liverpool / Jürgen Klopp has two custom PES 2021 presets shown in both the **Team Tactics** detail page and the **Coach** detail page. Attacking preset: support range 6, defensive line 9, compactness 2. Defensive preset: support range 7, defensive line 8, compactness 3. Both presets use the advanced instructions **Attacking Fullbacks** and **Gegenpress**. These are the user's selected values, not claims about hidden official PESMASTER values.

## Full PES 2021 database loading

On first launch, if fewer than 1,000 players are present, PitchLab automatically tries the public PESXplorer/VirtuaRED-based JSON database. If that fails, it tries the public OpenML PES 2021 base table. Both attempts preserve the existing curated player records and custom tactics. The top status banner shows whether a large catalog is actually loaded and how many records are active.

For a manual retry, open **Import Data** and use **Load and merge full player database** or **Fetch and merge**. If browser CORS/network policy blocks a download, use the corresponding source link to download the file and import it with the file picker. The parser accepts dense ARFF, CSV, and JSON, normalizes player-stat column names, validates records, and stores large imports in IndexedDB.

The OpenML record `efootball-pes2021-all-players-csv` lists **14,693 records and 120 features** and declares a GPL 2 licence; metadata and the source file are linked in the Import Data page. See [OpenML dataset #43649](https://www.openml.org/d/43649) and [its download](https://www.openml.org/data/v1/download/22102474/efootball-pes2021-all-players-csv.arff). This is a PES 2021 base dataset, not the complete set of every separately rated Featured/duplicate entry from PESMASTER.

**Merge safety:** “Merge with current data” is checked by default. New records are appended and deduplicated; existing bundled records are kept unchanged rather than replaced with imported ratings. To preserve alternate cards and versions, the importer only removes exact ID/signature duplicates. Large imports are saved in IndexedDB to avoid localStorage's size limits.

**Important visual-data limitation:** this OpenML player-stat file is not a complete PESMASTER asset manifest. It does not guarantee a verified PESMASTER portrait ID for every player or an exact team/league logo ID. The 20 existing portrait mappings and known PESMASTER badge/emblem mappings remain as-is. For extra exact PESMASTER portraits/logos, an import source must also provide `portraitId` / `portraitUrl`, `teamLogoId`, and `leagueLogoId` that correspond to PESMASTER's PES 2021 graphics; the app will not invent IDs or assign a modern/wrong image by name. The actual portraits and emblems continue to be loaded remotely, so online access is required.

### Optional exact asset-map import

The **Attach exact PESMASTER images & badges** section accepts a separate CSV/JSON manifest. It fills only missing `portraitId` / verified `portraitUrl`, `teamLogoId`, and `leagueLogoId` values and does not alter any player ratings or attributes. A downloadable template is provided in that section. This is useful when the asset manifest is available separately from the player-stat data; the OpenML stats dataset alone cannot supply verified exact PESMASTER image IDs for every entry.

## PES 2021 Player Database download progress

A visible progress panel appears when a player-data section requests the PESMASTER catalogue. It reports downloaded bytes when available, switches to an indeterminate animation when the server does not expose a content length, and shows parsing and local-save stages. A completed status means player records were parsed and saved; **it does not mean every player portrait, club badge or historical transfer was downloaded**. These assets appear only where source records already include verified mappings. The panel provides a retry button on failure and does not overwrite custom Liverpool tactics.

## Data-integrity audit — October 16, 2026

The current packaged installation is **not a complete copy of PESMASTER PES 2021**. The bundled local dataset still contains 20 curated player records. It includes 685 unique coach/tactics profiles linked from 686 of the 725 indexed team profiles; 39 team pages do not publish a coach link. The external download is optional/subject to network availability and its patch version does not necessarily match PESMASTER. The competition index now lists 39 PES 2021 competitions sourced from the public PESMASTER database index, but does not imply every team and its full squad are included. An empty league clearly says its roster has not been imported.

**Correctness fixes**: team and league numeric IDs imported from unrelated datasets are no longer used to guess PESMASTER image files; these IDs are not reliably interchangeable. When a verified image URL or an existing curated mapping is available, the site uses it; otherwise a text fallback is intentional. Existing curated player records and the custom Liverpool manager/tactics presets were not changed.

**Player-data limitation**: the home page starts with a 20-player sample; the complete 28,755-record PESMASTER Advanced Search snapshot is bundled and loads on demand. The coach list covers teams with manager links in the official team pages; 39 indexed teams have no linked coach record in that source. The separate team catalogue contains the PESMASTER-linked team profile IDs and league memberships described below. Full third-party copyrighted imagery is not bundled.

## Diagnostic assistant / manager imports (October 2026)

The Import Data page now includes **PitchLab Diagnostic Assistant**. It counts actual loaded players, indexed leagues, indexed teams, imported coaches, and records without verified image references. Its Repair action retries the database download if the available database is small. It is a deterministic on-device troubleshooter, **not** a remote generative AI model and cannot alter source code by itself.

The Coaches page accepts licensed JSON coach datasets (an array or `{ "coaches": [...] }`). Every coach needs a unique string `id`, `realName`, `team`, `formation` and `attack` and `defense` objects. Add `lineup` as a nested array of position strings and full tactical details when sourced. Imported coaches are stored in browser localStorage. Bundled PESMASTER profiles remain available, including custom Liverpool attack/defense instructions.

Player database imports now show a descriptive error if browser storage fails or times out; a stuck 94% is not to be interpreted as success. Community data and image downloads still depend on the external hosts and license/permission. The 39 league catalog entries are a navigation index rather than a verified complete PESMASTER roster. The full player roster is not embedded in this release.

## Performance and browser-freeze fixes

The performance-stability build improves handling of larger imported player pools:

- The streamed downloader collects response chunks and joins them once instead of repeatedly appending to one large string; the download timeout remains active while the body is being read.
- Player normalization yields to the browser between batches, so the page can repaint during import.
- Large databases are stored in 500-record IndexedDB chunks instead of building one very large JSON string on the main thread. Older `active-players` IndexedDB records remain readable and are migrated the next time the data is saved.
- Club, league, player-ID, image-asset, and dropdown-option indexes are built once per dataset update and reused across pages.
- The Teams page displays 48 clubs per page. The comparison picker has a searchable list limited to 60 options instead of creating a DOM option for every player.
- Successful download progress clears itself after completion; errors remain visible so users can retry.

For best results on Windows, double-click `START-PITCHLAB.bat` rather than opening `index.html` directly. The launcher starts the included Python server, and the server automatically chooses an available port starting at 8000 (up through 8010 and then an ephemeral port), so a stale server on port 8000 will not silently break the launch. The server prints the exact URL and opens it in your browser. Keep the server console open while using the app. If the browser does not open, copy the exact URL printed in that window. If Python 3 is missing, the launcher displays installation guidance. A slow external source or limited browser storage can still prevent the full community dataset from downloading or saving; existing sample data is preserved when an import fails.

### Additional responsiveness fixes (October 2026)

The current performance build now parses the large community JSON response inside a temporary Web Worker and transfers rows back in batches, rather than running `JSON.parse` on the visible UI thread. The ARFF parser scans line-by-line and yields on a fixed interval instead of allocating a second array of every line. Raw imported row objects are released as they are normalized to reduce peak memory use. Competition pages and team rosters also render no more than 48 clubs / 50 players at once, with pagination controls; this avoids trying to create thousands of image-heavy DOM nodes for a large imported dataset. Static JavaScript checks and a small ARFF parser fixture passed in the build environment. A live browser test against the third-party dataset host was not available, so connectivity and storage capacity can still affect first-time imports.

## Logo and competition catalog repair (2026-10-16)

- The official PESMASTER PES 2021 competition catalog is represented as exactly 39 entries with unique competition IDs. `Other European Teams` is retained as an import alias for the single display label `Other European Leagues` (ID 204).
- League logos use PESMASTER's `graphics/leaguelogos/emb_####.png` naming pattern by verified league page ID. Ligue 1 tries the `_w` graphic variant and then the standard variant. The PAS League ID is 41 and the logo URL is `https://www.pesmaster.com/pes-2021/graphics/leaguelogos/emb_0041.png`.
- Badge rendering now tries the official mapped image, explicit imported badge URL/ID, and alternate filename before falling back to initials. This fixes the earlier behaviour where a failed first URL suppressed all alternatives.
- The PAS League catalogue contains 20 verified PESMASTER team names, profile IDs and URLs. Team badge URLs are derived from each verified PESMASTER team page ID; local player rosters are not fabricated when they have not been imported.
- Images are still fetched from PESMASTER over the internet at runtime; they are linked by exact PES 2021 asset paths rather than bundled into this ZIP. A text fallback remains when the remote server or network is unavailable.


## Official team badge catalogue sync

The catalogue is based on official PESMASTER competition-page team links, not an assumed conversion from a community dataset team ID. The included snapshot has all 39 competition pages and 725 distinct official team profile IDs linked from them. Each team stores its official team page URL and ID, visible name, slug aliases, and the competition membership from the page that linked it. The Classic Teams competition is included with zero teams because its official PES 2021 page has no team links. PESMASTER's overview page separately states 632 teams; that headline differs from the 725 unique profiles linked across competition pages, so the app reports the page-link count and does not use 632 as a completeness gate. Refresh the snapshot with **Sync PESMASTER teams** on the Leagues page. Exact team badges still load from PESMASTER over the Internet.

If any source pages are blocked during a later refresh, the status panel shows partial coverage and the last saved catalogue is retained. The bundled snapshot lets league lists display immediately without waiting for the first network sync.

## Verified league assignment hardening (October 16, 2026)

- The catalogue importer now uses each official PESMASTER PES 2021 competition page as the source of team membership. A team is assigned to the competition whose page actually lists its official team-profile ID; player-dataset club names are never used to guess a league.
- A sync is marked **complete** when all 39 expected competition pages are read, every linked team has a valid PESMASTER profile ID, and each competition is either assigned linked teams or explicitly listed as empty. The team count is derived from those links, not a hard-coded global total.
- An empty response is rejected except for the official Classic Teams page, whose heading is checked before its empty list is accepted.
- Refreshes retain previous memberships for pages that failed and replace memberships only for pages successfully parsed. If all pages respond but the new totals fail the completeness check, a previous complete catalogue is preserved instead of being overwritten by a potentially broken scrape.
- Official image URLs embedded in league-page links are preferred. When a page does not embed a logo URL, the app derives the PESMASTER PES 2021 team-logo path only from the official team profile ID; guessed per-team `_w` overrides were removed. Missing images use the initials fallback.
- The local fixtures verify 39-page coverage, acceptance of a changing profile-link count, explicit handling of the empty Classic Teams page, correct league assignment, logo IDs, duplicate-ID handling, and preservation of teams from a league that could not be refreshed.
- The bundled cache is verified as 39/39 competitions and 725 distinct profile links. PESMASTER's public overview currently says 632 teams, so the per-league official page links are the source of membership truth.


## Startup repair (October 16, 2026)

The launcher no longer opens a hard-coded `http://localhost:8000` regardless of whether the server actually bound that port. The server tries an available local port, writes the selected port to `data/last-port.txt`, prints the exact URL, and opens that URL. A bind failure now displays a visible diagnostic instead of silently opening an unrelated or unavailable page.


## Updated reliable launcher (Windows)

Run `START-PITCHLAB.bat` from inside this extracted `pitchlab21` folder. The launcher removes stale port info, starts the server, waits for `/api/health` to return HTTP 200, reads the actual active port, then opens that exact address. It no longer assumes port 8000 or relies on Python's browser auto-open feature.

If Python 3 is installed, the full `server.py` runs and live PESMASTER catalogue sync is available. If Python is not installed, the launcher uses `server-fallback.ps1` so the local site can still open; in fallback mode it can serve an existing saved catalogue, but live PESMASTER synchronization is unavailable until Python 3 is installed. Keep the separate server window open while using the site.


## Windows startup troubleshooting (latest launcher)

1. Extract the ZIP fully using **Extract All**. Do not run a `.bat` file from inside the compressed ZIP preview.
2. Double-click `START-PITCHLAB.bat`. The launcher runs the server in the same terminal window; keep that window open. The Python server opens the browser after binding a free local port and prints the exact address.
3. If the server exits, the launcher tries the standard Python command and then the Windows PowerShell compatibility server. If all server methods fail, it opens `index.html` directly as a limited fallback.
4. If the page cannot start JavaScript, the page now displays the exact error message and script path instead of remaining blank.
5. `OPEN-LOCAL-FILE.bat` is a fallback only; live local catalogue sync requires the server.


## Startup fix — `LEAGUE_CANONICAL_BY_KEY` initialization order

The league canonical-name lookup is now created before startup loads and normalizes saved or bundled player records. This fixes the temporal-dead-zone `ReferenceError` reported on `app.js` line 122. Regression tests cover both initialization order and script load order.
