"""Build a linked PES 2021 coach/tactics catalog from the bundled team index."""
from concurrent.futures import ThreadPoolExecutor, as_completed
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin
import json, re, sys

import server

ROOT = Path(__file__).resolve().parent
TEAM_FILE = ROOT / 'data' / 'pesmaster-team-catalog.json'
OUT_FILE = ROOT / 'data' / 'pesmaster-coaches-tactics.js'
BASE = 'https://www.pesmaster.com'


class TeamCoachParser(HTMLParser):
    def __init__(self):
        super().__init__(); self.links = []
    def handle_starttag(self, tag, attrs):
        if tag != 'a': return
        href = dict(attrs).get('href', '')
        if re.search(r'/pes-2021/coach/\d+/?$', href): self.links.append(urljoin(BASE, href))


def fetch_team_coach(team):
    try:
        parser = TeamCoachParser(); parser.feed(server.fetch(team['sourceUrl']))
        return team, parser.links[0] if parser.links else '', ''
    except Exception as exc:
        return team, '', str(exc)


def clean(s):
    return re.sub(r'\s+', ' ', server._strip_markup(s)).strip()


def cells_in_table(html):
    rows = []
    for row in re.findall(r'<tr\b[^>]*>(.*?)</tr>', html, re.I | re.S):
        cells = re.findall(r'<td\b([^>]*)>(.*?)</td>', row, re.I | re.S)
        if cells: rows.append(cells)
    return rows


def coach_info(html):
    match = re.search(r'<table\s+class=["\']player-info["\'][^>]*>(.*?)</table>', html, re.I | re.S)
    info = {}
    if match:
        for row in cells_in_table(match.group(1)):
            if len(row) >= 2: info[clean(row[0][1]).casefold()] = clean(row[1][1])
    return info


TACTIC_KEYS = {
    'attacking style': ('attack', 'style'), 'build up': ('attack', 'buildUp'),
    'attacking area': ('attack', 'area'), 'positioning': ('attack', 'positioning'),
    'support range': ('attack', 'supportRange'), 'defensive style': ('defense', 'style'),
    'containment area': ('defense', 'containment'), 'pressuring': ('defense', 'pressuring'),
    'defensive line': ('defense', 'defensiveLine'), 'compactness': ('defense', 'compactness'),
}


def tactic_data(html):
    all_presets = []
    for table in re.findall(r'<table\s+class=["\'][^"\']*coach-tactics[^"\']*["\'][^>]*>(.*?)</table>', html, re.I | re.S):
        out = {'attack': {'style': '', 'buildUp': '', 'area': '', 'positioning': '', 'supportRange': None},
               'defense': {'style': '', 'containment': '', 'pressuring': '', 'defensiveLine': None, 'compactness': None}}
        for row in cells_in_table(table):
            if len(row) < 2: continue
            label, value_attrs, value_html = clean(row[0][1]).casefold(), row[1][0], row[1][1]
            target = TACTIC_KEYS.get(label)
            if not target: continue
            group, key = target
            value = clean(value_html)
            if key in ('supportRange', 'defensiveLine', 'compactness'):
                bar = re.search(r'background-position\s*:\s*(-?\d+(?:\.\d+)?)%', value_attrs + ' ' + value_html, re.I)
                # The PESMASTER bar sprite uses 10%-step positions for 1-10 tactical settings.
                if bar: out[group][key] = int(round(abs(float(bar.group(1))) / 10))
            elif value and value != '-': out[group][key] = value
        all_presets.append(out)
    primary = all_presets[0] if all_presets else {'attack': {}, 'defense': {}}
    secondary = all_presets[1] if len(all_presets) > 1 else None
    presets = {'attacking': primary, 'defensive': secondary} if secondary else None
    return primary, presets


def lineup_data(html):
    start = html.find('<div class="game-plan-container gp-container-new">')
    if start < 0: return [['GK']]
    end = html.find('<div class="game-plan-container', start + 20)
    section = html[start:end if end > 0 else start + 100000]
    matches = list(re.finditer(r'<div\s+class=["\'](gp-player(?:\s+[^"\']*)?)["\']([^>]*)>(.*?)(?=<div\s+class=["\']gp-player(?:\s|["\'])|$)', section, re.I | re.S))
    rows = {}
    for m in matches:
        pos = re.search(r'class=["\']gp-player-pos\s+gp-pos-[^"\']+["\'][^>]*>\s*([A-Z]{2,3})\s*</div>', m.group(3), re.I | re.S)
        if not pos: continue
        y = re.search(r'\btop\s*:\s*([\d.]+)%', m.group(2), re.I)
        is_gk = 'gp-player-gk' in m.group(1)
        row_key = 101.0 if is_gk or not y else float(y.group(1))
        x = re.search(r'\bleft\s*:\s*([\d.]+)%', m.group(2), re.I)
        rows.setdefault(row_key, []).append((float(x.group(1)) if x else 50, pos.group(1).upper()))
    return [[pos for _, pos in sorted(items)] for _, items in sorted(rows.items(), reverse=True)] or [['GK']]


def parse_coach(url, team_hint, listing=None):
    html = server.fetch(url)
    info = coach_info(html)
    listing = listing or {}
    match = re.search(r'/coach/(\d+)/?$', urlparse_path(url))
    coach_id = match.group(1) if match else re.sub(r'\D', '', url)
    name_match = re.search(r'<h1\b[^>]*>(.*?)</h1>', html, re.I | re.S)
    listed = info.get('name') or (clean(name_match.group(1)) if name_match else '')
    game_name = listing.get('name_brackets') or listed
    real_name = info.get('full name') or info.get('real name') or listed
    if real_name in ('-', '—'): real_name = game_name
    team = info.get('team') or team_hint.get('name', '')
    league = info.get('league') or (team_hint.get('leagues') or [{}])[0].get('name', '')
    primary, presets = tactic_data(html)
    return {
        'id': 'pesmaster-coach-' + coach_id, 'pesmasterCoachId': coach_id,
        'realName': real_name, 'gameName': game_name, 'rating': to_num(listing.get('rating')),
        'team': team, 'league': league, 'nationality': info.get('nationality', ''),
        'formation': info.get('formation') or '—', 'adaptability': to_num(info.get('adaptability')),
        'managementSkills': to_num(info.get('management skills')),
        'sourceUrl': url, 'sourceLabel': 'PESMASTER · ' + listed,
        'lineup': lineup_data(html), 'attack': primary['attack'], 'defense': primary['defense'],
        'officialTacticalPresets': presets,
        'advancedInstructions': [], 'dataSource': 'PESMASTER PES 2021 coach profile',
    }


def urlparse_path(url):
    from urllib.parse import urlparse
    return urlparse(url).path


def to_num(value):
    m = re.search(r'\d+', value or '')
    return int(m.group()) if m else None


def main():
    catalog = json.loads(TEAM_FILE.read_text(encoding='utf-8'))
    teams = catalog.get('teams', [])
    team_links, errors = [], []
    with ThreadPoolExecutor(max_workers=10) as pool:
        futures = [pool.submit(fetch_team_coach, team) for team in teams]
        for n, future in enumerate(as_completed(futures), 1):
            team, url, error = future.result()
            if url: team_links.append((team, url))
            elif error: errors.append({'team': team.get('name'), 'error': error})
            if n % 100 == 0: print(f'Team pages checked: {n}/{len(teams)}; coach links: {len(team_links)}', flush=True)
    unique = {}
    for team, url in team_links:
        linked = unique.setdefault(url, {'team': team, 'teamLinks': []})
        linked['teamLinks'].append({
            'teamId': str(team.get('teamId') or ''),
            'team': team.get('name') or '',
            'league': (team.get('leagues') or [{}])[0].get('name', ''),
            'teamUrl': team.get('sourceUrl') or '',
        })
    print(f'Unique linked coaches: {len(unique)}; team profiles without coach links: {len(teams)-len(team_links)}', flush=True)
    api_records = {}
    page = 0
    while True:
        payload = json.loads(server.fetch(f'https://www.pesmaster.com/api/coach.php?game=pes-2021&page={page}'))
        for item in payload.get('data', []): api_records[str(item.get('id'))] = item
        if not payload.get('more_available'): break
        page += 1
    print(f'PESMASTER coach index records: {len(api_records)}', flush=True)
    rows, failures = [], []
    with ThreadPoolExecutor(max_workers=8) as pool:
        futures = {pool.submit(parse_coach, url, linked['team'], api_records.get(re.search(r'/coach/(\d+)/?$', urlparse_path(url)).group(1), {})): (url, linked) for url, linked in unique.items()}
        for n, future in enumerate(as_completed(futures), 1):
            url, linked = futures[future]
            try:
                coach = future.result()
                coach['teamLinks'] = linked['teamLinks']
                rows.append(coach)
            except Exception as exc: failures.append({'url': url, 'team': linked['team'].get('name'), 'error': str(exc)})
            if n % 100 == 0: print(f'Coach profiles parsed: {n}/{len(unique)}; successful: {len(rows)}', flush=True)
    rows.sort(key=lambda c: (c['league'], c['team'], c['realName']))
    linked_team_urls = {team.get('sourceUrl') for team, _ in team_links}
    missing_teams = [{'teamId': team.get('teamId'), 'name': team.get('name'), 'sourceUrl': team.get('sourceUrl')}
                     for team in teams if team.get('sourceUrl') not in linked_team_urls]
    payload = {'source': 'PESMASTER PES 2021 team pages and linked coach profiles',
               'teamCount': len(teams), 'teamsWithCoachLinks': len(team_links),
               'uniqueCoaches': len(rows), 'missingTeams': len(teams)-len(team_links),
               'teamsWithoutCoachLinks': missing_teams,
               'failedProfiles': failures, 'teamFetchErrors': errors, 'coaches': rows}
    data_path = ROOT / 'data' / 'pesmaster-coaches-tactics.json'
    data_path.write_text(json.dumps(payload, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    OUT_FILE.write_text('/* PESMASTER PES 2021 coach/tactics data; generated from linked official profiles. */\nwindow.PITCHLAB_PESMASTER_COACHES = ' + json.dumps(rows, ensure_ascii=False, separators=(',', ':')) + ';\nwindow.PITCHLAB_TEAMS_WITHOUT_COACH = ' + json.dumps(missing_teams, ensure_ascii=False, separators=(',', ':')) + ';\n', encoding='utf-8')
    print(f'Wrote {len(rows)} coach/tactics records. Missing team coach links: {payload["missingTeams"]}; failed profiles: {len(failures)}', flush=True)
    if failures: print('Failed:', json.dumps(failures[:15], ensure_ascii=False), flush=True)


if __name__ == '__main__': main()
