import sys
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import server


class PESMasterCatalogParserTests(unittest.TestCase):
    def test_unique_league_ids(self):
        snippets = []
        for i in range(1, 40):
            snippets.append(f'<a href="/competition-{i}/pes-2021/league/{i}/">Competition {i}</a>')
        snippets.append('<a href="/competition-9/pes-2021/league/9/">Duplicate English League alias</a>')
        leagues = server.league_candidates('<html>' + ''.join(snippets) + '</html>')
        self.assertEqual(39, len(leagues))
        self.assertEqual(39, len({x['leagueId'] for x in leagues}))

    def test_team_profile_id_drives_logo_and_aliases(self):
        html = ('<h1>English League</h1>'
                '<a href="/arsenal/pes-2021/team/101/">82 Arsenal</a>'
                '<a href="/liverpool-r/pes-2021/team/103/">85 Liverpool</a>')
        items = server.team_candidates(html, {
            'leagueId': 9, 'name': 'English League', 'slug': 'english-league',
            'url': 'https://www.pesmaster.com/english-league/pes-2021/league/9/'})
        self.assertEqual({'101', '103'}, {x['teamId'] for x in items})
        liverpool = next(x for x in items if x['teamId'] == '103')
        self.assertEqual('Liverpool R', liverpool['name'])
        self.assertIn('Liverpool', liverpool['aliases'])
        self.assertEqual('https://www.pesmaster.com/pes-2021/graphics/teamlogos/e_000103.png', liverpool['logoCandidates'][0])

    def test_page_embedded_badge_url_is_first(self):
        html = ('<a href="/arsenal/pes-2021/team/101/">'
                '<img src="/pes-2021/graphics/teamlogos/e_000101.png" alt="Arsenal badge">82 Arsenal</a>')
        items = server.team_candidates(html, {
            'leagueId': 9, 'name': 'English League', 'slug': 'english-league',
            'url': 'https://www.pesmaster.com/english-league/pes-2021/league/9/'})
        self.assertEqual('https://www.pesmaster.com/pes-2021/graphics/teamlogos/e_000101.png', items[0]['logoCandidates'][0])

    def test_league_names_are_normalized(self):
        self.assertEqual('Other European Leagues', server.normalize_league_label('Other European Teams', 'other-european-teams'))
        self.assertEqual('Ligue 1 Conforama', server.normalize_league_label('Ligue 1 Uber Eats', 'ligue-1-conforama'))

    def test_team_is_assigned_to_the_competition_page_that_contains_its_official_link(self):
        html = '<h1>Generic page heading</h1><a href="/arsenal/pes-2021/team/101/"><img src="/pes-2021/graphics/teamlogos/e_000101.png" alt="Arsenal crest">82 Arsenal</a>'
        league, rows = server.parse_competition_page(html, {
            'leagueId': 9, 'label': 'English League', 'slug': 'english-league',
            'url': 'https://www.pesmaster.com/english-league/pes-2021/league/9/'})
        self.assertEqual('English League', league['name'])
        self.assertEqual(9, league['leagueId'])
        self.assertEqual(1, len(rows))
        self.assertEqual('101', rows[0]['teamId'])
        self.assertEqual(9, rows[0]['leagues'][0]['leagueId'])
        self.assertIn('e_000101.png', rows[0]['logoUrl'])

    def test_page_with_no_official_team_links_is_rejected(self):
        with self.assertRaisesRegex(ValueError, 'No official team profile links'):
            server.parse_competition_page('<html><h1>English League</h1><p>Temporary source error</p></html>', {
                'leagueId': 9, 'label': 'English League', 'slug': 'english-league',
                'url': 'https://www.pesmaster.com/english-league/pes-2021/league/9/'})

    def test_official_classic_teams_page_is_kept_as_an_empty_competition(self):
        league, teams = server.parse_competition_page('<html><h1>Classic Teams</h1></html>', {
            'leagueId': 202, 'label': 'Classic Teams', 'slug': 'classic-teams',
            'url': 'https://www.pesmaster.com/classic-teams/pes-2021/league/202/'})
        self.assertEqual('Classic Teams', league['name'])
        self.assertEqual([], teams)
        with self.assertRaisesRegex(ValueError, 'No official team profile links'):
            server.parse_competition_page('<html><h1>English League</h1></html>', {
                'leagueId': 202, 'label': 'Classic Teams', 'slug': 'classic-teams',
                'url': 'https://www.pesmaster.com/classic-teams/pes-2021/league/202/'})

    def test_partial_refresh_keeps_teams_from_unavailable_leagues(self):
        previous = {
            'leagues': [
                {'leagueId': 9, 'name': 'English League', 'url': 'https://example.test/english'},
                {'leagueId': 10, 'name': 'Serie A TIM', 'url': 'https://example.test/serie-a'}],
            'teams': [
                {'teamId': '101', 'name': 'Arsenal', 'aliases': ['Arsenal'], 'leagues': [{'leagueId': 9, 'name': 'English League'}]},
                {'teamId': '201', 'name': 'Inter', 'aliases': ['Inter'], 'leagues': [{'leagueId': 10, 'name': 'Serie A TIM'}]}]}
        fresh_leagues = [{'leagueId': 9, 'name': 'English League', 'url': 'https://example.test/english-new'}]
        fresh_teams = [{'teamId': '101', 'name': 'Arsenal', 'sourceName': 'Arsenal', 'aliases': ['Arsenal'],
                        'logoUrl': 'https://www.pesmaster.com/pes-2021/graphics/teamlogos/e_000101.png',
                        'leagues': [{'leagueId': 9, 'name': 'English League'}]}]
        teams, leagues = server.merge_catalog_snapshots(previous, fresh_teams, fresh_leagues, {'9'})
        by_id = {x['teamId']: x for x in teams}
        self.assertEqual({'101', '201'}, set(by_id))
        self.assertEqual(['9'], [str(x['leagueId']) for x in by_id['101']['leagues']])
        self.assertEqual(['10'], [str(x['leagueId']) for x in by_id['201']['leagues']])
        self.assertEqual({'9', '10'}, {str(x['leagueId']) for x in leagues})

    def test_official_duplicate_team_id_merges_league_memberships(self):
        previous = {'leagues': [], 'teams': [{'teamId': '101', 'name': 'Arsenal', 'aliases': ['Arsenal'],
                    'leagues': [{'leagueId': 9, 'name': 'English League'}]}]}
        fresh = [{'teamId': '101', 'name': 'Arsenal', 'aliases': ['Arsenal FC'],
                  'leagues': [{'leagueId': 10, 'name': 'Other European Leagues'}]}]
        teams, _ = server.merge_catalog_snapshots(previous, fresh, [], set())
        self.assertEqual(1, len(teams))
        self.assertEqual({'9', '10'}, {str(x['leagueId']) for x in teams[0]['leagues']})

    def test_full_sync_uses_official_links_without_a_fixed_global_team_count(self):
        # A deterministic offline integration fixture tests the full scraper pipeline without
        # depending on PESMASTER availability during tests.
        competition_links = []
        pages = {}
        team_id = 1
        fixture_team_count = 725
        expected_ids = sorted(server.EXPECTED_LEAGUE_IDS)
        team_leagues = [league_id for league_id in expected_ids if league_id not in server.EMPTY_COMPETITION_IDS]
        for league_number, league_id in enumerate(expected_ids, 1):
            slug = f'competition-{league_id}'
            url = f'https://www.pesmaster.com/{slug}/pes-2021/league/{league_id}/'
            competition_links.append(f'<a href="/{slug}/pes-2021/league/{league_id}/">Competition {league_id}</a>')
            # Evenly distribute linked team profiles across all populated competitions.
            populated_number = team_leagues.index(league_id) + 1 if league_id in team_leagues else 0
            remaining_teams = fixture_team_count - (populated_number - 1) * fixture_team_count // len(team_leagues) if populated_number else 0
            prior_teams = fixture_team_count - populated_number * fixture_team_count // len(team_leagues) if populated_number else 0
            count_for_league = remaining_teams - prior_teams
            team_links = []
            for _ in range(count_for_league):
                team_links.append(f'<a href="/club-{team_id}/pes-2021/team/{team_id}/">72 Club {team_id}</a>')
                team_id += 1
            page_heading = 'Classic Teams' if league_id in server.EMPTY_COMPETITION_IDS else 'Generic title'
            pages[url] = '<html><h1>' + page_heading + '</h1>' + ''.join(team_links) + '</html>'
        homepage = '<html>' + ''.join(competition_links) + '</html>'

        def mocked_fetch(url):
            if url == server.INDEX_URL:
                return homepage
            if url in pages:
                return pages[url]
            raise AssertionError(f'Unexpected URL requested by catalogue worker: {url}')

        with TemporaryDirectory() as tmp:
            original_data, original_cache, original_sync = server.DATA, server.CACHE, dict(server.SYNC)
            try:
                server.DATA = Path(tmp)
                server.CACHE = Path(tmp) / 'pesmaster-team-catalog.json'
                server.SYNC.update(status='idle', phase='Test', leagueCount=0, leaguesProcessed=0,
                                   teamCount=0, startedAt=None, updatedAt=None, error='', teams=[], leagues=[])
                with patch.object(server, 'fetch', side_effect=mocked_fetch), patch.object(server.time, 'sleep', return_value=None):
                    server.catalog_sync_worker(force=True)
                saved = server.read_cached_any()
                self.assertIsNotNone(saved)
                self.assertEqual('complete', server.SYNC['status'])
                self.assertEqual(39, saved['leagueCount'])
                self.assertEqual(fixture_team_count, saved['teamCount'])
                self.assertEqual(fixture_team_count, len({x['teamId'] for x in saved['teams']}))
                self.assertEqual(39, len({x['leagueId'] for x in saved['leagues']}))
                self.assertEqual([202], saved['emptyLeagueIds'])
                for team in saved['teams']:
                    self.assertEqual(1, len(team['leagues']))
                    self.assertEqual(team['leagues'][0]['url'], server.BASE + f"/{team['leagues'][0]['slug']}/pes-2021/league/{team['leagues'][0]['leagueId']}/")
                    self.assertIn(f"e_{int(team['teamId']):06d}.png", team['logoUrl'])
            finally:
                server.DATA, server.CACHE = original_data, original_cache
                server.SYNC.clear(); server.SYNC.update(original_sync)

    def test_catalog_cannot_be_marked_complete_without_assignments_for_every_league(self):
        expected_ids = sorted(server.EXPECTED_LEAGUE_IDS)
        leagues = [{'leagueId': i, 'name': f'Competition {i}', 'slug': f'competition-{i}',
                    'url': f'https://www.pesmaster.com/competition-{i}/pes-2021/league/{i}/',
                    'logoUrl': f'https://www.pesmaster.com/pes-2021/graphics/leaguelogos/emb_{i:04d}.png'} for i in expected_ids]
        teams = [{'teamId': str(i), 'name': f'Club {i}', 'sourceName': f'Club {i}', 'slug': f'club-{i}',
                  'sourceUrl': f'https://www.pesmaster.com/club-{i}/pes-2021/team/{i}/',
                  'logoUrl': f'https://www.pesmaster.com/pes-2021/graphics/teamlogos/e_{i:06d}.png',
                  'logoCandidates': [f'https://www.pesmaster.com/pes-2021/graphics/teamlogos/e_{i:06d}.png'],
                  'leagues': [{'leagueId': expected_ids[(i - 1) % 39], 'name': f'Competition {expected_ids[(i - 1) % 39]}',
                               'url': f'https://www.pesmaster.com/competition-{expected_ids[(i - 1) % 39]}/pes-2021/league/{expected_ids[(i - 1) % 39]}/'}]}
                 for i in range(1, 633)]
        payload = {'partial': False, 'leagues': leagues, 'teams': teams}
        self.assertTrue(server.is_complete_catalog(payload))
        teams_without_assignment = [dict(t) for t in teams]
        teams_without_assignment[0] = {**teams_without_assignment[0], 'leagues': []}
        self.assertFalse(server.is_complete_catalog({**payload, 'teams': teams_without_assignment}))
        teams_missing_competition = [{**t, 'leagues': [{'leagueId': expected_ids[0], 'name': f'Competition {expected_ids[0]}'}]} for t in teams]
        self.assertFalse(server.is_complete_catalog({**payload, 'teams': teams_missing_competition}))

    def test_complete_catalog_requires_an_explicit_empty_league_entry(self):
        leagues = [{'leagueId': i, 'name': f'Competition {i}', 'slug': f'competition-{i}',
                    'url': f'https://www.pesmaster.com/competition-{i}/pes-2021/league/{i}/',
                    'logoUrl': f'https://www.pesmaster.com/pes-2021/graphics/leaguelogos/emb_{i:04d}.png'}
                   for i in sorted(server.EXPECTED_LEAGUE_IDS)]
        populated_ids = server.EXPECTED_LEAGUE_IDS - server.EMPTY_COMPETITION_IDS
        teams = []
        for index, i in enumerate(sorted(populated_ids), 1):
            teams.append({'teamId': str(index), 'name': f'Club {index}', 'sourceName': f'Club {index}',
                          'slug': f'club-{index}',
                          'sourceUrl': f'https://www.pesmaster.com/club-{index}/pes-2021/team/{index}/',
                          'logoUrl': f'https://www.pesmaster.com/pes-2021/graphics/teamlogos/e_{index:06d}.png',
                          'logoCandidates': [f'https://www.pesmaster.com/pes-2021/graphics/teamlogos/e_{index:06d}.png'],
                          'leagues': [{'leagueId': i, 'name': f'Competition {i}',
                                       'url': f'https://www.pesmaster.com/competition-{i}/pes-2021/league/{i}/'}]})
        payload = {'partial': False, 'leagues': leagues, 'teams': teams, 'emptyLeagueIds': [202]}
        self.assertTrue(server.is_complete_catalog(payload))
        self.assertFalse(server.is_complete_catalog({**payload, 'emptyLeagueIds': []}))

    def test_server_expected_competition_ids_match_bundled_index(self):
        catalog = (ROOT / 'data' / 'league-catalog.js').read_text(encoding='utf-8')
        block = catalog.split('window.PITCHLAB_LEAGUE_PESMASTER_IDS = {', 1)[1].split('};', 1)[0]
        ids = {int(value) for value in __import__('re').findall(r':\s*(\d+)', block)}
        self.assertEqual(server.EXPECTED_LEAGUE_IDS, ids)

    def test_bundled_pesmaster_catalog_is_complete_and_includes_empty_classic_league(self):
        payload = server.read_cached_any()
        self.assertTrue(server.is_complete_catalog(payload))
        self.assertEqual(39, len(payload['leagues']))
        self.assertEqual([202], payload['emptyLeagueIds'])
        self.assertEqual(len(payload['teams']), len({team['teamId'] for team in payload['teams']}))


if __name__ == '__main__':
    unittest.main()
