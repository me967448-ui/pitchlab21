#!/usr/bin/env python3
"""PitchLab 21 local server with cached PESMASTER league and on-demand squad data.

Uses Python standard library only. League/team links are synced from PESMASTER;
each official squad page is fetched only when the user opens that team.
"""
from __future__ import annotations
import json, os, re, threading, time, webbrowser
from html import unescape
from datetime import datetime, timezone
from html.parser import HTMLParser
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import urljoin, urlparse, parse_qs
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parent
DATA = ROOT / 'data'
CACHE = DATA / 'pesmaster-team-catalog.json'
BASE = 'https://www.pesmaster.com'
INDEX_URL = BASE + '/pes-2021/'
USER_AGENT = 'Mozilla/5.0 (compatible; PitchLab21CatalogSync/1.0; +local-app)'
TIMEOUT = 18
EXPECTED_COMPETITION_COUNT = 39
API_VERSION = 'pitchlab-roster-profile-4'
ROSTER_CACHE = {}
ROSTER_LOCK = threading.Lock()
PLAYER_PROFILE_CACHE = {}
PLAYER_PROFILE_LOCK = threading.Lock()
EMPTY_COMPETITION_IDS = {202}  # PESMASTER's Classic Teams 2021 page currently publishes no team links.
# Known competition IDs from the PESMASTER PES 2021 index included with this project.
# A different set of 39 IDs must not be accepted as the PES 2021 catalogue.
EXPECTED_LEAGUE_IDS = {33, 9, 10, 11, 12, 34, 120, 66, 21, 13, 204, 36, 22, 14, 114,
                       111, 8, 202, 68, 139, 125, 137, 35, 23, 122, 128, 117, 41, 39,
                       212, 40, 214, 90, 69, 67, 51, 206, 50, 37}
LOCK = threading.RLock()
SYNC = {'status': 'idle', 'phase': 'Not started', 'leagueCount': 0, 'leaguesProcessed': 0,
         'teamCount': 0, 'emptyLeagueIds': [], 'startedAt': None, 'updatedAt': None, 'error': '', 'teams': [], 'leagues': []}
WORKER = None

# PESMASTER's display names for the unlicensed club names in the PES 2021 database.
DISPLAY_BY_SLUG = {
    'liverpool-r': 'Liverpool R', 'manchester-b': 'Manchester B',
    'madrid-chamartin-b': 'Madrid Chamartin B', 'tottenham-wb': 'Tottenham WB',
    'chelsea-b': 'Chelsea B', 'madrid-rosas-rb': 'Madrid Rosas RB',
    'lombardia-na': 'Lombardia NA', 'milano-rn': 'Milano RN',
    'fc-bayern-munchen': 'FC Bayern München', 'barcelona': 'FC Barcelona',
    'real-madrid': 'Madrid Chamartin B', 'atletico-madrid': 'Madrid Rosas RB',
    'manchester-city': 'Manchester B', 'manchester-united': 'Manchester United',
    'inter': 'Lombardia NA', 'ac-milan': 'Milano RN', 'juventus': 'Juventus',
    'psg': 'PSG', 'paris-saint-germain': 'PSG', 'roma': 'Roma', 'as-roma': 'Roma',
}
# Real-world aliases let imported player squads map to PESMASTER's in-game licensed name
# without creating a second club card or assigning a club to a guessed league.
REAL_NAME_ALIASES_BY_SLUG = {
    'liverpool-r': ['Liverpool', 'Liverpool FC'],
    'manchester-b': ['Manchester City', 'Man City', 'Manchester City FC'],
    'madrid-chamartin-b': ['Real Madrid', 'Real Madrid CF'],
    'tottenham-wb': ['Tottenham', 'Tottenham Hotspur'],
    'chelsea-b': ['Chelsea', 'Chelsea FC'],
    'madrid-rosas-rb': ['Atletico Madrid', 'Atlético Madrid', 'Atletico de Madrid'],
    'lombardia-na': ['Inter', 'Inter Milan', 'Internazionale'],
    'milano-rn': ['AC Milan', 'Milan', 'A.C. Milan'],
    'fc-bayern-munchen': ['Bayern Munich', 'Bayern München', 'Bayern Munchen'],
    'barcelona': ['Barcelona', 'FC Barcelona'],
    'paris-saint-germain': ['Paris Saint-Germain', 'Paris Saint Germain', 'PSG'],
    'psg': ['Paris Saint-Germain', 'Paris Saint Germain', 'Paris SG'],
    'manchester-united': ['Manchester United FC', 'Man United', 'Man Utd'],
    'juventus': ['Juventus FC'],
    'roma': ['AS Roma'], 'as-roma': ['AS Roma'],
}

class AnchorParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.links = []
        self.current = None
        self.h1 = False
        self.h1_text = []
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'a' and attrs.get('href'):
            if self.current:
                self._finish_anchor()
            self.current = {'href': attrs['href'], 'text': [], 'title': attrs.get('title', ''), 'img_alt': [], 'img_src': []}
        elif tag == 'img' and self.current:
            if attrs.get('alt'): self.current['img_alt'].append(attrs['alt'])
            # PESMASTER pages may lazy-load the exact crest URL instead of putting it in src.
            for attr in ('src', 'data-src', 'data-original', 'data-lazy-src'):
                if attrs.get(attr): self.current['img_src'].append(attrs[attr])
            if attrs.get('srcset'):
                first = attrs['srcset'].split(',')[0].strip().split(' ')[0]
                if first: self.current['img_src'].append(first)
        if tag == 'h1':
            self.h1 = True
            self.h1_text = []
    def handle_data(self, data):
        if self.current is not None:
            self.current['text'].append(data)
        if self.h1:
            self.h1_text.append(data)
    def handle_endtag(self, tag):
        if tag == 'a' and self.current:
            self._finish_anchor()
        if tag == 'h1':
            self.h1 = False
    def _finish_anchor(self):
        item = self.current
        item['text'] = re.sub(r'\s+', ' ', ''.join(item['text'])).strip()
        item['img_alt'] = ' '.join(item['img_alt']).strip()
        item['img_src'] = list(item['img_src'])
        self.links.append(item)
        self.current = None
    @property
    def heading(self):
        return re.sub(r'\s+', ' ', ''.join(self.h1_text)).strip()


def fetch(url: str) -> str:
    req = Request(url, headers={'User-Agent': USER_AGENT, 'Accept': 'text/html,application/xhtml+xml'})
    with urlopen(req, timeout=TIMEOUT) as response:
        if response.status != 200:
            raise RuntimeError(f'HTTP {response.status} for {url}')
        charset = response.headers.get_content_charset() or 'utf-8'
        raw = response.read()
        decoded = raw.decode(charset, errors='replace')
        return raw.decode('utf-8', errors='replace') if '\ufffd' in decoded else decoded


def clean_team_name(label: str) -> str:
    label = re.sub(r'^\s*\d{1,3}\s+', '', label or '').strip()
    label = re.sub(r'\s+', ' ', label)
    return label


def league_candidates(html: str):
    parser = AnchorParser(); parser.feed(html)
    out = {}
    for a in parser.links:
        href = urljoin(BASE, a['href'])
        m = re.search(r'/([^/]+)/pes-2021/league/(\d+)/?$', urlparse(href).path, re.I)
        if not m: continue
        slug, raw_id = m.group(1), m.group(2)
        # only keep the PES 2021 competition directory links, ignore old/other versions
        league_id = int(raw_id)
        label = clean_team_name(a.get('text') or a.get('title') or slug.replace('-', ' ').title())
        out.setdefault(league_id, {'leagueId': league_id, 'slug': slug, 'url': href, 'label': label})
    return sorted(out.values(), key=lambda x: x['leagueId'])


def team_candidates(html: str, league):
    parser = AnchorParser(); parser.feed(html)
    out = []
    seen = set()
    for a in parser.links:
        href = urljoin(BASE, a['href'])
        path = urlparse(href).path
        m = re.search(r'/([^/]+)/pes-2021/team/(\d+)/?$', path, re.I)
        if not m: continue
        slug, raw_id = m.group(1), m.group(2)
        team_id = int(raw_id)
        if team_id in seen: continue
        seen.add(team_id)
        source_name = clean_team_name(a['text'] or a.get('title') or a.get('img_alt'))
        slug_name = re.sub(r'-+', ' ', slug).strip().title()
        name = DISPLAY_BY_SLUG.get(slug, source_name or slug_name)
        # These aliases are only labels from the official team's own PESMASTER URL/page.
        aliases = sorted(set(x for x in [name, source_name, slug, slug.replace('-', ' '), a.get('title', ''), *REAL_NAME_ALIASES_BY_SLUG.get(slug, [])] if x))
        generated = [f'{BASE}/pes-2021/graphics/teamlogos/e_{team_id:06d}.png',
                     f'{BASE}/pes-2021/graphics/teamlogos/e_{team_id:06d}_w.png']
        # If the official competition list embeds the crest image in its team link,
        # preserve that exact URL ahead of conventional ID-based candidates.
        exact_embedded = []
        for src in a.get('img_src', []):
            candidate = urljoin(BASE, src)
            if re.match(r'^https://www\.pesmaster\.com/pes-2021/graphics/teamlogos/e_\d{3,6}(?:_w)?\.png$', candidate, re.I):
                exact_embedded.append(candidate)
        # Keep an exact logo URL embedded by the official league page first. Do not assign
        # team-specific suffix variants based on guesses; try the standard file then _w fallback.
        logo_candidates = list(dict.fromkeys(exact_embedded + generated))
        team = {'teamId': str(team_id), 'slug': slug, 'name': name, 'sourceName': source_name or name,
                'aliases': aliases, 'sourceUrl': href,
                'logoUrl': logo_candidates[0], 'logoCandidates': logo_candidates,
                'leagues': [{'leagueId': league['leagueId'], 'name': league['name'], 'slug': league['slug'], 'url': league['url']} ]}
        out.append(team)
    return out


def parse_competition_page(html, comp):
    """Return one competition record and its teams, or reject an unreadable/empty page."""
    label = normalize_league_label(comp.get('label', ''), comp.get('slug', ''))
    league = {'leagueId': int(comp['leagueId']), 'name': label, 'slug': comp['slug'], 'url': comp['url'],
              'logoUrl': f'{BASE}/pes-2021/graphics/leaguelogos/emb_{int(comp["leagueId"]):04d}.png'}
    rows = team_candidates(html, {**comp, 'name': label})
    if not rows:
        parser = AnchorParser(); parser.feed(html)
        if (int(comp['leagueId']) in EMPTY_COMPETITION_IDS
                and re.sub(r'\s+', ' ', parser.heading).strip().casefold() == 'classic teams'):
            return league, []
        raise ValueError('No official team profile links were recognized; page was not accepted')
    return league, rows


class SquadTableParser(HTMLParser):
    """Read the official PES 2021 roster table, including its exact portrait URLs."""
    def __init__(self):
        super().__init__(); self.in_table = False; self.in_row = False; self.cells = []; self.cell = None; self.rows = []
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'table' and 'squad-table' in (attrs.get('class') or '').split(): self.in_table = True
        elif self.in_table and tag == 'tr': self.in_row = True; self.cells = []
        elif self.in_table and self.in_row and tag == 'td':
            self.cell = {'text': [], 'class': attrs.get('class', ''), 'image': '', 'fallback': '', 'profile': '', 'title': ''}
        elif self.cell is not None:
            if tag == 'a' and re.search(r'/pes-2021/player/\d+/?$', attrs.get('href', '')): self.cell['profile'] = attrs['href']
            elif tag == 'img':
                self.cell['image'] = attrs.get('data-src') or attrs.get('src') or ''
                self.cell['fallback'] = attrs.get('data-fallback') or ''
                self.cell['title'] = attrs.get('title', '')
    def handle_data(self, data):
        if self.cell is not None: self.cell['text'].append(data)
    def handle_endtag(self, tag):
        if tag == 'td' and self.cell is not None:
            self.cell['text'] = re.sub(r'\s+', ' ', ''.join(self.cell['text'])).strip(); self.cells.append(self.cell); self.cell = None
        elif tag == 'tr' and self.in_table and self.in_row:
            if len(self.cells) >= 7 and self.cells[0].get('profile'):
                self.rows.append(self.cells)
            self.in_row = False
        elif tag == 'table' and self.in_table: self.in_table = False


def fetch_team_roster(team_id):
    """Fetch one requested team's roster only when a user opens that team's page."""
    tid = str(team_id)
    with ROSTER_LOCK:
        if tid in ROSTER_CACHE: return ROSTER_CACHE[tid]
        catalog = read_cached_any() or {}
        team = next((item for item in catalog.get('teams', []) if str(item.get('teamId')) == tid), None)
        if not team or not re.fullmatch(r'\d{1,6}', tid): raise KeyError('Unknown PESMASTER team ID')
        source = team.get('sourceUrl', '')
        match = re.fullmatch(r'https://www\.pesmaster\.com/[^/]+/pes-2021/team/' + re.escape(tid) + r'/?', source)
        if not match: raise ValueError('The saved team source URL did not match its official team ID')
        parser = SquadTableParser(); parser.feed(fetch(source))
        players = []
        for cells in parser.rows:
            href = cells[0]['profile']; player_match = re.search(r'/pes-2021/player/(\d+)/?$', href)
            if not player_match: continue
            def value(index): return cells[index]['text'] if index < len(cells) else ''
            position = re.sub(r'\s+', '', value(5)).upper()
            rating_match = re.search(r'\d{1,2}', value(6))
            image = urljoin(BASE, cells[0].get('image') or '')
            if not re.fullmatch(r'https://www\.pesmaster\.com/pes-2021/graphics/players/player_\d+(?:_l)?\.png', image): image = ''
            fallback = urljoin(BASE, cells[0].get('fallback') or '')
            if not re.fullmatch(r'https://www\.pesmaster\.com/pes-2021/graphics/players/player_0\.png', fallback): fallback = ''
            if image.endswith('_l.png'):
                fallback = image[:-6] + '.png'
            players.append({'playerId': player_match.group(1), 'name': value(0), 'number': value(1),
                            'teamId': tid,
                            'nationality': cells[2].get('title', ''), 'age': value(3), 'height': value(4),
                            'position': position, 'overall': int(rating_match.group()) if rating_match else None,
                            'portraitUrl': image, 'portraitFallbackUrl': fallback,
                            'sourceUrl': urljoin(BASE, href)})
        if not players: raise ValueError('PESMASTER did not return a readable PES 2021 squad table')
        payload = {'teamId': tid, 'teamName': team.get('name', ''), 'sourceUrl': source,
                   'players': players, 'playerCount': len(players), 'source': 'PESMASTER PES 2021 official team page'}
        ROSTER_CACHE[tid] = payload
        return payload


PLAYER_ATTRIBUTE_CLASSES = {
    'offensive_awareness':'offensiveAwareness','finishing':'finishing','kicking_power':'kickingPower',
    'ball_control':'ballControl','dribbling':'dribbling','tight_possession':'tightPossession',
    'heading':'heading','balance':'balance','form':'form','injury_resistance':'injuryResistance',
    'low_pass':'lowPass','lofted_pass':'loftedPass','place_kicking':'placeKicking','curl':'curl',
    'speed':'speed','acceleration':'acceleration','physical_contact':'physicalContact','jump':'jump',
    'stamina':'stamina','defensive_awareness':'defensiveAwareness','ball_winning':'ballWinning',
    'aggression':'aggression','gk_awareness':'gkAwareness','gk_catching':'gkCatching',
    'gk_clearing':'gkClearing','gk_reflexes':'gkReflexes','gk_reach':'gkReach',
    'weak_foot_usage':'weakFootUsage','weak_foot_acc':'weakFootAccuracy'
}


def _strip_markup(value):
    return re.sub(r'\s+', ' ', unescape(re.sub(r'<[^>]*>', ' ', value or ''))).strip()


def parse_player_profile(html, player_id, source_url):
    attrs = {}
    for css, raw in re.findall(r'<span\s+class=["\']([a-z_]+)["\']\s*>(\d{1,3})</span>', html, re.I):
        key = PLAYER_ATTRIBUTE_CLASSES.get(css.lower())
        if key: attrs[key] = int(raw)
    info = {}
    table_match = re.search(r'<table\s+class=["\']player-info["\'][^>]*>(.*?)</table>', html, re.I | re.S)
    if table_match:
        for row in re.findall(r'<tr\b[^>]*>(.*?)</tr>', table_match.group(1), re.I | re.S):
            cells = re.findall(r'<td\b[^>]*>(.*?)</td>', row, re.I | re.S)
            if len(cells) >= 2: info[_strip_markup(cells[0]).casefold()] = _strip_markup(cells[1])
    def text_match(pattern, default=''):
        match = re.search(pattern, html, re.I | re.S)
        return _strip_markup(match.group(1)) if match else default
    name = text_match(r'<div\s+class=["\']player-card-name["\'][^>]*>(.*?)</div>')
    pos = text_match(r'<div\s+class=["\']player-card-position["\'][^>]*>.*?<abbr[^>]*>(.*?)</abbr>')
    rating = text_match(r'<div\s+class=["\']player-card-ovr["\'][^>]*>(\d{1,2})')
    photo_tag = re.search(r'<img\b(?=[^>]*data-src=["\'](/pes-2021/graphics/players/player_' + re.escape(str(player_id)) + r'(?:_l)?\.png)["\'])[^>]*>', html, re.I | re.S)
    photo = photo_tag.group(1) if photo_tag else ''
    fallback = re.search(r'data-fallback=["\'](/pes-2021/graphics/players/player_0\.png)["\']', photo_tag.group(0), re.I) if photo_tag else None
    portrait_fallback = urljoin(BASE, photo[:-6] + '.png') if photo.endswith('_l.png') else (urljoin(BASE, fallback.group(1)) if fallback else '')
    if not name or not rating: raise ValueError('The official PESMASTER player profile was not readable')
    position_ratings = {position: int(value) for position, value in re.findall(
        r'<div\s+class=["\']player-positions-item[^"\']*["\'][^>]*>\s*<span\s+class=["\']pos["\'][^>]*>([A-Z]{2,3})</span>\s*<span\s+class=["\']stat\s+ovr_[^"\']*["\'][^>]*>(\d{1,2})</span>',
        html, re.I | re.S)}
    secondary = list(position_ratings)
    def list_for(title):
        match = re.search(r'<h3>\s*' + re.escape(title) + r'\s*</h3>\s*<ul\s+class=["\']player-index-list["\']>(.*?)</ul>', html, re.I | re.S)
        if not match: return []
        return [value for item in re.findall(r'<li\b[^>]*>(.*?)</li>', match.group(1), re.I | re.S)
                if (value := _strip_markup(item)) and value != '-']
    return {'playerId': str(player_id), 'name': info.get('full name') or name, 'displayName': name,
            'overall': int(rating), 'position': pos or info.get('position', '').split(' ')[0],
            'secondaryPositions': secondary, 'positionRatings': position_ratings,
            'nationality': info.get('nationality', ''),
            'club': info.get('team', ''), 'league': info.get('league', ''),
            'age': int(info['age']) if info.get('age', '').isdigit() else None,
            'height': int(info['height (cm)']) if info.get('height (cm)', '').isdigit() else None,
            'weight': int(info['weight']) if info.get('weight', '').isdigit() else None,
            'foot': info.get('stronger foot', ''), 'portraitUrl': urljoin(BASE, photo) if photo else '',
            'portraitFallbackUrl': portrait_fallback,
            'marketValue': info.get('market value', ''), 'contractDuration': info.get('contract dur.', ''),
            'faceAvailable': info.get('face', ''), 'myClubAvailable': info.get('myclub', ''),
            'playerType': info.get('type', ''), 'condition': info.get('condition', ''),
            'details': info,
            'attributes': attrs, 'weakFootUsage': attrs.get('weakFootUsage'),
            'weakFootAccuracy': attrs.get('weakFootAccuracy'), 'playingStyle': (list_for('Playing Style') or [''])[0],
            'skills': list_for('Player Skills'), 'comPlayingStyles': list_for('COM Playing Styles'),
            'sourceUrl': source_url, 'sourceName': 'PESMASTER PES 2021'}


def fetch_player_profile(player_id, source_url):
    pid = str(player_id)
    parsed = urlparse(source_url or '')
    if (parsed.scheme != 'https' or parsed.hostname != 'www.pesmaster.com'
            or not re.fullmatch(r'/[a-z0-9-]+/pes-2021/player/' + re.escape(pid) + r'/?', parsed.path, re.I)):
        raise ValueError('Player profile URL does not match an official PESMASTER PES 2021 record')
    with PLAYER_PROFILE_LOCK:
        if pid in PLAYER_PROFILE_CACHE: return PLAYER_PROFILE_CACHE[pid]
        profile = parse_player_profile(fetch(source_url), pid, source_url)
        PLAYER_PROFILE_CACHE[pid] = profile
        return profile


def normalize_league_label(label, slug):
    text = re.sub(r'\s+', ' ', (label or '').strip())
    mapping = {
        'Other European Teams': 'Other European Leagues',
        'Ligue 1 Uber Eats': 'Ligue 1 Conforama',
        '(1) Ligue 1 Conforama': 'Ligue 1 Conforama',
        'Ligue 1 Conforama': 'Ligue 1 Conforama',
    }
    if text in mapping: return mapping[text]
    if text: return text
    return re.sub(r'\s+', ' ', slug.replace('-', ' ').title()).strip()


def read_cached_any():
    """Read the on-disk catalogue even when stale/partial so an outage never erases known data."""
    if not CACHE.exists():
        return None
    try:
        payload = json.loads(CACHE.read_text(encoding='utf-8'))
        if isinstance(payload, dict) and isinstance(payload.get('teams'), list) and isinstance(payload.get('leagues'), list):
            return payload
    except Exception:
        return None
    return None


def load_cached():
    payload = read_cached_any()
    if not payload or not payload.get('teams'):
        return None
    try:
        stamp = payload.get('generatedAt', '')
        when = datetime.fromisoformat(stamp.replace('Z', '+00:00')) if stamp else None
        recent = bool(when and (datetime.now(timezone.utc) - when).total_seconds() < 30 * 86400)
        if recent:
            return payload
    except Exception:
        return None
    return None


def is_complete_catalog(payload):
    if not isinstance(payload, dict) or payload.get('partial'):
        return False
    leagues = payload.get('leagues') or []
    teams = payload.get('teams') or []
    league_ids = {str(x.get('leagueId')) for x in leagues if x.get('leagueId') is not None}
    team_ids = {str(x.get('teamId')) for x in teams if x.get('teamId')}
    if len(leagues) != EXPECTED_COMPETITION_COUNT or league_ids != {str(x) for x in EXPECTED_LEAGUE_IDS}:
        return False
    if len(team_ids) != len(teams):
        return False
    league_by_id = {}
    for league in leagues:
        lid = str(league.get('leagueId') or '')
        source = urlparse(str(league.get('url') or ''))
        page_match = re.search(r'/pes-2021/league/(\d+)/?$', source.path)
        logo = str(league.get('logoUrl') or '')
        if (not source.hostname or not source.hostname.endswith('pesmaster.com') or not page_match or page_match.group(1) != lid
                or not re.match(r'^https://www\.pesmaster\.com/pes-2021/graphics/leaguelogos/emb_\d{4}(?:_w)?\.png$', logo, re.I)):
            return False
        league_by_id[lid] = league
    assigned_leagues = set()
    for team in teams:
        tid = str(team.get('teamId') or '').strip()
        if not tid.isdigit() or not team.get('leagues'):
            return False
        source = urlparse(str(team.get('sourceUrl') or ''))
        profile_match = re.search(r'/pes-2021/team/(\d+)/?$', source.path)
        if not source.hostname or not source.hostname.endswith('pesmaster.com') or not profile_match or profile_match.group(1) != tid:
            return False
        logo_urls = team.get('logoCandidates') or ([team.get('logoUrl')] if team.get('logoUrl') else [])
        if not logo_urls or any(not re.match(r'^https://www\.pesmaster\.com/pes-2021/graphics/teamlogos/e_\d{3,6}(?:_w)?\.png$', str(u), re.I) for u in logo_urls):
            return False
        for membership in team.get('leagues') or []:
            lid = str(membership.get('leagueId') or '')
            if lid not in league_ids or not membership.get('name') or not membership.get('url'):
                return False
            if membership.get('name') != league_by_id[lid].get('name') or membership.get('url') != league_by_id[lid].get('url'):
                return False
            assigned_leagues.add(lid)
    # A successfully fetched official competition may legitimately publish no team links.
    # Record that explicitly; never mistake a failed/empty response for a valid empty league.
    empty_ids = {str(x) for x in payload.get('emptyLeagueIds', [])}
    if empty_ids != league_ids - assigned_leagues or empty_ids - {str(x) for x in EMPTY_COMPETITION_IDS}:
        return False
    return assigned_leagues | empty_ids == league_ids


def merge_catalog_snapshots(previous, fresh_teams, fresh_leagues, successful_league_ids):
    """Replace only competition memberships from pages read successfully; preserve failed pages."""
    successful = {str(x) for x in successful_league_ids}
    by_id = {}
    for raw in (previous or {}).get('teams', []):
        if not raw or not raw.get('teamId'):
            continue
        keep_leagues = [dict(x) for x in (raw.get('leagues') or []) if str(x.get('leagueId')) not in successful]
        if keep_leagues:
            row = dict(raw)
            row['leagues'] = keep_leagues
            row['aliases'] = list(dict.fromkeys(x for x in [*(row.get('aliases') or []), row.get('name'), row.get('sourceName'), row.get('slug')] if x))
            tid = str(row['teamId'])
            if tid not in by_id:
                by_id[tid] = row
            else:
                prior = by_id[tid]
                prior['aliases'] = list(dict.fromkeys([*(prior.get('aliases') or []), *(row.get('aliases') or [])]))
                prior['leagues'] = list({(str(x.get('leagueId')), str(x.get('name'))): x for x in [*(prior.get('leagues') or []), *(row.get('leagues') or [])]}.values())
                prior['logoCandidates'] = list(dict.fromkeys([*(prior.get('logoCandidates') or []), *(row.get('logoCandidates') or [])]))
    def merge_team(raw):
        tid = str(raw.get('teamId', '')).strip()
        if not tid:
            return
        incoming = dict(raw)
        incoming['teamId'] = tid
        incoming['aliases'] = list(dict.fromkeys(x for x in [*(incoming.get('aliases') or []), incoming.get('name'), incoming.get('sourceName'), incoming.get('slug')] if x))
        existing = by_id.get(tid)
        if not existing:
            by_id[tid] = incoming
            return
        existing['aliases'] = list(dict.fromkeys([*(existing.get('aliases') or []), *(incoming.get('aliases') or [])]))
        memberships = {(str(x.get('leagueId')), str(x.get('name'))): x for x in [*(existing.get('leagues') or []), *(incoming.get('leagues') or [])]}
        existing['leagues'] = list(memberships.values())
        for field in ('name', 'sourceName', 'slug', 'sourceUrl', 'logoUrl'):
            if incoming.get(field): existing[field] = incoming[field]
        existing['logoCandidates'] = list(dict.fromkeys([*(existing.get('logoCandidates') or []), *(incoming.get('logoCandidates') or [])]))
    for raw in fresh_teams:
        merge_team(raw)
    previous_leagues = {(str(x.get('leagueId'))): dict(x) for x in (previous or {}).get('leagues', []) if str(x.get('leagueId')) not in successful}
    for league in fresh_leagues:
        previous_leagues[str(league.get('leagueId'))] = dict(league)
    teams = sorted(by_id.values(), key=lambda t: (str(t.get('name', '')).casefold(), int(t.get('teamId') or 0)))
    leagues = sorted(previous_leagues.values(), key=lambda l: int(l.get('leagueId') or 0))
    return teams, leagues


def catalog_sync_worker(force=False):
    global SYNC
    previous = read_cached_any()
    try:
        with LOCK:
            SYNC.update(status='running', phase='Reading PESMASTER competition index', leagueCount=0,
                        leaguesProcessed=0, teamCount=len(SYNC.get('teams', [])), startedAt=datetime.now(timezone.utc).isoformat(),
                        updatedAt=datetime.now(timezone.utc).isoformat(), error='')
        homepage = fetch(INDEX_URL)
        competitions = league_candidates(homepage)
        if len(competitions) < 30:
            raise RuntimeError(f'PESMASTER competition index returned only {len(competitions)} recognized leagues; cache was not replaced.')
        if len(competitions) != EXPECTED_COMPETITION_COUNT:
            raise RuntimeError(f'Expected {EXPECTED_COMPETITION_COUNT} PESMASTER PES 2021 competitions, recognized {len(competitions)}. The old catalogue was retained.')
        actual_competition_ids = {int(x['leagueId']) for x in competitions}
        if actual_competition_ids != EXPECTED_LEAGUE_IDS:
            raise RuntimeError('The PESMASTER index returned an unexpected set of competition IDs. The old catalogue was retained.')
        fresh_teams_by_id = {}
        fresh_leagues = []
        successful_league_ids = set()
        errors = []
        with LOCK:
            SYNC.update(leagueCount=len(competitions), phase='Fetching official team lists')
        for i, comp in enumerate(competitions, 1):
            try:
                html = fetch(comp['url'])
                # The competition index link is the canonical identity. A page H1 may contain
                # generic or version-specific text, so it is not used to guess the league name.
                league, rows = parse_competition_page(html, comp)
                label = league['name']
                fresh_leagues.append(league)
                successful_league_ids.add(str(comp['leagueId']))
                for team in rows:
                    tid = team['teamId']
                    if tid in fresh_teams_by_id:
                        prior = fresh_teams_by_id[tid]
                        prior['aliases'] = sorted(set(prior['aliases'] + team['aliases']), key=str.casefold)
                        if not any(str(x['leagueId']) == str(league['leagueId']) for x in prior['leagues']):
                            prior['leagues'].append({'leagueId': league['leagueId'], 'name': label, 'slug': comp['slug'], 'url': comp['url']})
                        prior['logoCandidates'] = list(dict.fromkeys([*(prior.get('logoCandidates') or []), *(team.get('logoCandidates') or [])]))
                    else:
                        fresh_teams_by_id[tid] = team
                with LOCK:
                    SYNC.update(leaguesProcessed=i, teamCount=len(fresh_teams_by_id), phase=f'Processed {i}/{len(competitions)} competition pages',
                                updatedAt=datetime.now(timezone.utc).isoformat())
            except Exception as e:
                errors.append(f'{comp["label"]}: {str(e)[:160]}')
                with LOCK:
                    SYNC.update(leaguesProcessed=i, phase=f'Processed {i}/{len(competitions)} competition pages; retry needed',
                                updatedAt=datetime.now(timezone.utc).isoformat())
            time.sleep(0.12)

        fresh_teams = list(fresh_teams_by_id.values())
        # Page coverage and official profile links define completeness. PESMASTER's headline
        # team total is not the same as the sum of all team pages linked from its competitions.
        if len(fresh_leagues) != EXPECTED_COMPETITION_COUNT:
            errors.append(f'Coverage check: {len(fresh_leagues)}/{EXPECTED_COMPETITION_COUNT} competition pages parsed.')
        fresh_assigned_ids = {str(m.get('leagueId')) for team in fresh_teams for m in team.get('leagues', [])}
        empty_league_ids = sorted(int(x) for x in successful_league_ids if str(x) not in fresh_assigned_ids)
        candidate_payload = {'partial': False, 'leagues': fresh_leagues, 'teams': fresh_teams,
                             'emptyLeagueIds': empty_league_ids}
        if not is_complete_catalog(candidate_payload) and not any('completeness/assignment' in e for e in errors):
            errors.append('Coverage check: league membership, official team profile IDs, or badge URLs failed validation.')

        previous_complete = is_complete_catalog(previous)
        fresh_exact = is_complete_catalog(candidate_payload) and not errors
        if previous_complete and not fresh_exact and len(successful_league_ids) == EXPECTED_COMPETITION_COUNT:
            # If every page returned but the final count is inconsistent, the parser/site response
            # may have changed. Keep the last known full snapshot instead of replacing it with a bad one.
            message = '; '.join(errors[:6]) or 'Fresh scrape failed completeness checks.'
            with LOCK:
                SYNC.update(status='partial', phase='New scrape failed checks; retained previous complete catalogue',
                            leagueCount=len(previous.get('leagues', [])), leaguesProcessed=len(successful_league_ids),
                            teamCount=len(previous.get('teams', [])), emptyLeagueIds=previous.get('emptyLeagueIds', []), updatedAt=previous.get('generatedAt'),
                            teams=previous.get('teams', []), leagues=previous.get('leagues', []), error=message)
            return

        # Merge successful page refreshes into the previous cache, keeping memberships for pages that failed.
        teams, leagues = merge_catalog_snapshots(previous, fresh_teams, fresh_leagues, successful_league_ids)
        assigned_ids = {str(m.get('leagueId')) for team in teams for m in team.get('leagues', [])}
        all_empty_ids = sorted(int(x) for x in {str(l.get('leagueId')) for l in leagues} - assigned_ids)
        partial = bool(errors) or len(successful_league_ids) != EXPECTED_COMPETITION_COUNT or len(leagues) != EXPECTED_COMPETITION_COUNT
        payload = {'source': 'PESMASTER PES 2021 official competition pages and official team profile links',
                   'generatedAt': datetime.now(timezone.utc).isoformat(), 'leagueCount': len(leagues),
                   'teamCount': len(teams), 'leagues': leagues, 'teams': teams, 'emptyLeagueIds': all_empty_ids,
                   'errors': errors, 'partial': partial,
                   'coverage': {'expectedCompetitions': EXPECTED_COMPETITION_COUNT,
                                'parsedCompetitionsThisRun': len(successful_league_ids),
                                 'teamCountMeaning': 'unique official team profile links across parsed PESMASTER competition pages',
                                'parsedUniqueTeamsThisRun': len(fresh_teams)}}
        if not is_complete_catalog(payload):
            payload['partial'] = True
            payload['errors'].append('Coverage check: league memberships or official team profile IDs failed validation.')
            errors.append(payload['errors'][-1])
            partial = True
        DATA.mkdir(exist_ok=True)
        tmp = CACHE.with_suffix('.tmp')
        tmp.write_text(json.dumps(payload, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
        tmp.replace(CACHE)
        with LOCK:
            SYNC.update(status='partial' if partial else 'complete',
                        phase='Official catalogue ready' if not partial else 'Catalogue saved with missing-page coverage; previous entries preserved',
                        leagueCount=len(leagues), leaguesProcessed=len(successful_league_ids), teamCount=len(teams),
                        emptyLeagueIds=all_empty_ids, updatedAt=payload['generatedAt'], teams=teams, leagues=leagues, error='; '.join(errors[:6]))
    except Exception as e:
        # Keep whatever was previously loaded instead of replacing it with an empty error result.
        if previous and previous.get('teams'):
            with LOCK:
                SYNC.update(status='error', phase='Refresh failed; saved catalogue retained', error=str(e)[:500],
                            leagueCount=len(previous.get('leagues', [])), leaguesProcessed=0, teamCount=len(previous.get('teams', [])), emptyLeagueIds=previous.get('emptyLeagueIds', []),
                            updatedAt=previous.get('generatedAt'), teams=previous.get('teams', []), leagues=previous.get('leagues', []))
        else:
            with LOCK:
                SYNC.update(status='error', phase='Official catalogue sync failed', error=str(e)[:500],
                            updatedAt=datetime.now(timezone.utc).isoformat())


def maybe_start(force=False):
    global WORKER
    with LOCK:
        if WORKER is not None and WORKER.is_alive():
            return
        any_cache = read_cached_any()
        if any_cache:
            SYNC.update(status='partial' if any_cache.get('partial') else 'complete',
                        phase='Loaded saved PESMASTER catalogue; checking freshness' if not any_cache.get('partial') else 'Loaded saved partial catalogue while refreshing',
                        leagueCount=len(any_cache.get('leagues', [])), leaguesProcessed=len(any_cache.get('leagues', [])),
                        teamCount=len(any_cache.get('teams', [])), emptyLeagueIds=any_cache.get('emptyLeagueIds', []), updatedAt=any_cache.get('generatedAt'),
                        teams=any_cache.get('teams', []), leagues=any_cache.get('leagues', []), error='; '.join(any_cache.get('errors', [])[:5]))
        cached = load_cached()
        if not force and cached:
            age_hours = float('inf')
            try:
                stamp = datetime.fromisoformat((cached.get('generatedAt') or '').replace('Z', '+00:00'))
                age_hours = (datetime.now(timezone.utc) - stamp).total_seconds() / 3600
            except Exception:
                pass
            # Do not start a new 39-page crawl every time the UI polls a partial result.
            # Recent partial catalogues stay visible; users can click Refresh to retry immediately.
            if age_hours < 6:
                if is_complete_catalog(cached):
                    SYNC.update(status='complete', phase='Loaded cached official catalogue', error='')
                else:
                    SYNC.update(status='partial', phase='Loaded cached partial catalogue; click Refresh to retry',
                                error='; '.join(cached.get('errors', [])[:5]))
                return
        SYNC.update(status='running', phase='Starting official PESMASTER catalogue sync',
                    leagueCount=SYNC.get('leagueCount', 0), leaguesProcessed=0,
                    teamCount=SYNC.get('teamCount', 0), error='', updatedAt=datetime.now(timezone.utc).isoformat())
        WORKER = threading.Thread(target=catalog_sync_worker, args=(force,), daemon=True, name='PESMASTER-Catalog-Sync')
        WORKER.start()


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        super().end_headers()
    def send_json(self, obj, code=200):
        data = json.dumps(obj, ensure_ascii=False).encode('utf-8')
        self.send_response(code); self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(data))); self.send_header('Cache-Control', 'no-store')
        self.end_headers(); self.wfile.write(data)
    def do_GET(self):
        parsed = urlparse(self.path)
        profile_match = re.fullmatch(r'/api/player-profile/(\d+)', parsed.path)
        if profile_match:
            source_url = parse_qs(parsed.query).get('source', [''])[0]
            try:
                self.send_json(fetch_player_profile(profile_match.group(1), source_url)); return
            except Exception as exc:
                self.send_json({'error': str(exc)[:300]}, 502); return
        roster_match = re.fullmatch(r'/api/team-roster/(\d+)', parsed.path)
        if roster_match:
            try:
                self.send_json(fetch_team_roster(roster_match.group(1))); return
            except KeyError as exc:
                self.send_json({'error': str(exc)}, 404); return
            except Exception as exc:
                self.send_json({'error': str(exc)[:300]}, 502); return
        if parsed.path == '/api/team-catalog':
            query = parse_qs(parsed.query)
            force = query.get('refresh', ['0'])[0] == '1'
            include_cached = query.get('includeCached', ['0'])[0] == '1'
            maybe_start(force=force)
            with LOCK:
                payload = {k: SYNC.get(k) for k in ['status','phase','leagueCount','leaguesProcessed','teamCount','emptyLeagueIds','startedAt','updatedAt','error','teams','leagues']}
                # Send a saved snapshot once at page entry; lightweight polling requests only status
                # while a long refresh is running, avoiding repeated 600+ team JSON payloads.
                if payload.get('status') == 'running' and not include_cached:
                    payload['teams'], payload['leagues'] = [], []
            self.send_json(payload); return
        if parsed.path == '/api/team-catalog/refresh':
            maybe_start(force=True)
            with LOCK:
                payload = {k: SYNC.get(k) for k in ['status','phase','leagueCount','leaguesProcessed','teamCount','emptyLeagueIds','startedAt','updatedAt','error','teams','leagues']}
                if payload.get('status') == 'running':
                    payload['teams'], payload['leagues'] = [], []
            self.send_json(payload, 202); return
        if parsed.path == '/api/health':
            self.send_json({'ok': True, 'server': 'PitchLab 21', 'apiVersion': API_VERSION, 'catalogStatus': SYNC.get('status')}); return
        return super().do_GET()
    def log_message(self, fmt, *args):
        # Quiet static-file logging; keep API failures visible in console.
        if self.path.startswith('/api/'):
            super().log_message(fmt, *args)

def start_server():
    # Render assigns PORT and requires binding to 0.0.0.0. Keep the loopback
    # listener and fallback ports for the Windows launcher when PORT is absent.
    assigned_port = os.environ.get('PORT')
    host = os.environ.get('PITCHLAB_HOST') or ('0.0.0.0' if assigned_port else '127.0.0.1')
    preferred = int(assigned_port or os.environ.get('PITCHLAB_PORT', '8000'))
    candidates = [preferred] if assigned_port else list(dict.fromkeys([preferred, *range(preferred + 1, preferred + 11), 0]))
    httpd = None
    last_error = None
    for candidate in candidates:
        try:
            httpd = ThreadingHTTPServer((host, candidate), Handler)
            break
        except OSError as exc:
            last_error = exc
    if httpd is None:
        raise RuntimeError(f'Could not bind {host}:{preferred}: {last_error}')

    port = int(httpd.server_address[1])
    hosted = bool(assigned_port) or os.environ.get('RENDER') == 'true'
    if not hosted:
        DATA.mkdir(exist_ok=True)
        (DATA / 'last-port.txt').write_text(str(port), encoding='utf-8')
    url = os.environ.get('RENDER_EXTERNAL_URL') or f'http://127.0.0.1:{port}/'
    print('', flush=True)
    print('PitchLab 21 is running at:', url, flush=True)
    if not hosted:
        print('If your browser does not open automatically, copy that exact URL into Chrome.', flush=True)
        print('Keep this server window open while using the website.', flush=True)
    print('The PESMASTER catalogue sync starts in the background when requested by the page.', flush=True)
    if not hosted and os.environ.get('PITCHLAB_NO_BROWSER') != '1':
        try:
            webbrowser.open_new_tab(url)
        except Exception as exc:
            print('Automatic browser launch failed:', exc, flush=True)
    try:
        httpd.serve_forever(poll_interval=0.25)
    except KeyboardInterrupt:
        print('\nPitchLab 21 server stopped.', flush=True)
    finally:
        httpd.server_close()


if __name__ == '__main__':
    try:
        start_server()
    except Exception as exc:
        print('\nERROR: PitchLab 21 could not start:', str(exc), flush=True)
        print('Check whether Python 3 is installed and whether local security software blocks localhost.', flush=True)
        raise
