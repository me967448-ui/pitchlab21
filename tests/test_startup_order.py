from pathlib import Path
import json
import re
import unittest

ROOT = Path(__file__).resolve().parents[1]

class StartupInitializationOrderTest(unittest.TestCase):
    def test_lookup_is_var_initialized_before_any_player_normalization(self):
        app = (ROOT / "app.js").read_text(encoding="utf-8")
        declaration = app.index("var LEAGUE_CANONICAL_BY_KEY = new Map();")
        population = app.index("LEAGUE_CANONICAL_BY_KEY.clear();")
        initial_normalization = app.index("normalizePlayer(p,i)")
        self.assertLess(declaration, population)
        self.assertLess(population, initial_normalization,
                        "The lookup must be populated before saved players are normalized")
        self.assertNotIn("const LEAGUE_CANONICAL_BY_KEY=", app,
                         "Do not reintroduce a lexical TDZ declaration for the lookup")

    def test_league_catalog_script_loads_before_app_script(self):
        html = (ROOT / "index.html").read_text(encoding="utf-8")
        scripts = re.findall(r'<script\s+src="([^"]+)', html)
        normalized = [src.split('?', 1)[0] for src in scripts]
        self.assertLess(normalized.index("data/league-catalog.js"), normalized.index("app.js"))

    def test_app_script_has_cache_busting_version(self):
        html = (ROOT / "index.html").read_text(encoding="utf-8")
        self.assertIn('app.js?v=2026-10-17-master-league-3', html)
        self.assertIn('styles.css?v=2026-10-17-master-league-2', html)
        self.assertIn("PITCHLAB_BUILD_ID = '2026-10-17-pesmaster-player-catalog-3'", html)

    def test_large_catalog_scripts_are_not_loaded_on_the_home_page(self):
        html = (ROOT / "index.html").read_text(encoding="utf-8")
        self.assertNotIn('<script src="data/pesmaster-team-catalog.js', html)
        self.assertNotIn('<script src="data/pesmaster-coaches-tactics.js', html)
        app = (ROOT / "app.js").read_text(encoding="utf-8")
        self.assertIn("data/pesmaster-team-catalog.js?v=2026-10-17-lazy-catalog-1", app)
        self.assertIn("data/pesmaster-coaches-tactics.js?v=2026-10-17-team-tactic-links-2", app)

    def test_player_cache_is_loaded_only_when_a_player_section_is_opened(self):
        app = (ROOT / "app.js").read_text(encoding="utf-8")
        self.assertIn("PLAYER_CATALOG_ROUTES.has(state.route.page)", app)
        self.assertIn("let saved=null;try{saved=await readLargePlayers();}", app)
        self.assertNotIn("readLargePlayers().then(async saved=>", app)

    def test_large_player_indexing_yields_to_keep_navigation_responsive(self):
        app = (ROOT / "app.js").read_text(encoding="utf-8")
        indexer = app[app.index("async function rebuildDataIndexes()"):app.index("function canonicalizePlayer")]
        self.assertIn("await yieldToBrowser()", indexer)
        self.assertIn("state.players.length>1500", indexer)

    def test_squad_navigation_renders_without_waiting_for_hashchange(self):
        app = (ROOT / "app.js").read_text(encoding="utf-8")
        self.assertIn("location.hash=next;render();", app)

    def test_squad_formations_exist_and_have_eleven_positions(self):
        app = (ROOT / "app.js").read_text(encoding="utf-8")
        self.assertIn("const FORMATIONS={", app)
        formation_source = app[app.index("const FORMATIONS={"):app.index("  };", app.index("const FORMATIONS={"))]
        entries = re.findall(r"'([^']+)':\[(.*?)\](?=,\s*'[^']+':|$)", formation_source, re.S)
        self.assertGreaterEqual(len(entries), 5)
        for formation, slots in entries:
            with self.subTest(formation=formation):
                self.assertEqual(len(re.findall(r"\['(?:GK|CB|LB|RB|DMF|CMF|LMF|RMF|AMF|LWF|RWF|SS|CF)',\s*\d+,\s*\d+\]", slots)), 11)

    def test_player_portraits_hide_initials_and_country_flags_are_small(self):
        app = (ROOT / "app.js").read_text(encoding="utf-8")
        css = (ROOT / "styles.css").read_text(encoding="utf-8")
        self.assertIn("${src?'has-portrait':''}", app)
        self.assertIn('class="player-avatar-initials"', app)
        self.assertIn("classList.remove('has-portrait')", app)
        self.assertIn(".player-avatar.has-portrait .player-avatar-initials{display:none}", css)
        self.assertIn(".flag-image{display:inline-flex", css)
        self.assertIn("width:14px;height:10px", css)

    def test_squad_pitch_uses_shared_player_portrait_fallback(self):
        app = (ROOT / "app.js").read_text(encoding="utf-8")
        css = (ROOT / "styles.css").read_text(encoding="utf-8")
        self.assertIn("avatar(p,false,'pitch-player-avatar')", app)
        self.assertIn("data-fallback=", app)
        self.assertIn(".pitch-slot .slot-photo>.player-avatar.pitch-player-avatar{width:100%;height:100%;border-radius:50%", css)
        self.assertNotIn('onerror="this.remove()">`:esc(initials(p.displayName||p.name))', app)
        self.assertIn("const pesmasterMobile=safeUrl.match", app)
        self.assertIn("desktopImagePath=imagePath.replace('/pes-2021-mobile/','/pes-2021/')", app)
        self.assertIn("new URL(desktopImagePath,base).href", app)
        self.assertIn("return id?`https://www.pesmaster.com/pes-2021/graphics/players/player_${id}.png`", app)
        self.assertIn("pesmaster-player-catalog-3", app)

    def test_squad_average_ignores_missing_or_invalid_ratings(self):
        app = (ROOT / "app.js").read_text(encoding="utf-8")
        self.assertIn("function squadAverageOverall(players)", app)
        self.assertIn("const avg=squadAverageOverall(players)", app)
        self.assertIn("value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value))", app)

    def test_team_tactics_are_bound_to_team_ids_and_cover_available_links(self):
        app = (ROOT / "app.js").read_text(encoding="utf-8")
        self.assertIn("function coachTactics(){return coaches().flatMap", app)
        self.assertIn("link.teamId||''", app)
        self.assertIn("link.teamId||'')===teamId", app)
        self.assertIn("map(link=>({id:c.id,coachId:c.id,team:link.team||c.team", app)
        self.assertIn('data-route="tactic/${esc(t.id)}/${encodeURIComponent(t.teamId)}"', app)
        self.assertIn("function renderTacticDetail(id,teamId)", app)
        self.assertIn("String(item.teamId||'')===String(teamId||'')", app)
        self.assertIn("const COACH_DATA_ROUTES=new Set(['coaches','coach','tactics','tactic','team'])", app)
        self.assertIn("${renderTeamsWithoutCoach()}", app)
        self.assertIn("const player=choices[0]||familyChoices[0]||available[0]", app)
        self.assertIn("used.add(String(player.playerId))", app)

    def test_bundled_official_tactics_have_eleven_positions_and_complete_settings(self):
        payload = json.loads((ROOT / "data" / "pesmaster-coaches-tactics.json").read_text(encoding="utf-8"))
        coaches = payload["coaches"]
        self.assertGreaterEqual(len(coaches), 680)
        for coach in coaches:
            with self.subTest(team=coach["team"]):
                self.assertEqual(11, sum(len(row) for row in coach["lineup"]))
                self.assertEqual({"attacking", "defensive"}, set(coach["officialTacticalPresets"]))
                for field in ("style", "buildUp", "area", "positioning", "supportRange"):
                    self.assertNotIn(coach["attack"].get(field), (None, ""))
                for field in ("style", "containment", "pressuring", "defensiveLine", "compactness"):
                    self.assertNotIn(coach["defense"].get(field), (None, ""))

    def test_official_tactics_cover_linked_team_ids_and_mark_teams_without_coaches(self):
        tactics = json.loads((ROOT / "data" / "pesmaster-coaches-tactics.json").read_text(encoding="utf-8"))
        teams = json.loads((ROOT / "data" / "pesmaster-team-catalog.json").read_text(encoding="utf-8"))["teams"]
        linked_ids = [str(link["teamId"]) for coach in tactics["coaches"] for link in coach.get("teamLinks", [])]
        missing_ids = [str(team["teamId"]) for team in tactics["teamsWithoutCoachLinks"]]
        all_ids = {str(team["teamId"]) for team in teams}
        self.assertEqual(len(linked_ids), len(set(linked_ids)))
        self.assertFalse(set(linked_ids) & set(missing_ids))
        self.assertEqual(all_ids, set(linked_ids) | set(missing_ids))
        self.assertEqual(686, len(linked_ids))
        self.assertEqual(39, len(missing_ids))

    def test_all_official_player_catalog_entries_have_exact_portrait_paths(self):
        catalog = json.loads((ROOT / "data" / "pesmaster-players.json").read_text(encoding="utf-8"))
        players = catalog["players"]
        self.assertEqual(28755, len(players))
        self.assertTrue(all(re.fullmatch(r"/pes-2021(?:-mobile)?/graphics/players/player_\d+\.png", p.get("image", "")) for p in players))
        image_ids = [re.search(r"player_(\d+)\.png$", p["image"]).group(1) for p in players]
        self.assertGreater(sum(str(p["id"]) != image_id for p, image_id in zip(players, image_ids)), 0)
        app = (ROOT / "app.js").read_text(encoding="utf-8")
        self.assertIn("String(raw.image||'')", app)
        self.assertIn("imageId=imagePath.match", app)
        self.assertIn("portraitId:imageId", app)
        self.assertIn("playerByPesmasterId:new Map()", app)
        self.assertIn("pesmaster-player-catalog-3", app)

    def test_squad_picker_searches_full_catalog_in_lightweight_pages(self):
        app = (ROOT / "app.js").read_text(encoding="utf-8")
        self.assertIn("const total=matches.length,pageSize=100,pageCount=Math.max(1,Math.ceil(total/pageSize))", app)
        self.assertIn("data-action=\"picker-page-next\"", app)
        self.assertIn("data-action=\"picker-page-prev\"", app)
        self.assertIn("search covers the full list", app)
        self.assertIn("pickerOpen?renderPickerOptions():''", app)
        self.assertIn("pickerOpen?'open':''", app)

    def test_official_profile_uses_player_id_as_portrait_fallback(self):
        app = (ROOT / "app.js").read_text(encoding="utf-8")
        self.assertIn("p.pesmasterPlayerId)?", app)
        self.assertIn("pes-2021/graphics/players/player_${id}.png", app)
        self.assertIn("portraitSource:'pesmaster',pesmasterPlayerId:pid", app)

if __name__ == "__main__":
    unittest.main()
