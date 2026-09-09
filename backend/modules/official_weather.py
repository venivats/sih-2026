"""Bounded intake of an official published weather page, never fabricated telemetry.

Page reports remain outside Measurement until timestamp/measurement semantics and
reuse terms are established. Fetch originals are retained; a fresh fetch is not
proof of a fresh observation. No caller-selected URLs or redirects are accepted.
"""
import re
from datetime import datetime, timedelta, timezone
from html.parser import HTMLParser
from urllib.request import Request, build_opener, HTTPRedirectHandler
from urllib.error import HTTPError
from sqlalchemy import select
from ..models import OfficialWeatherReport, now
from ..common import audit
from .storage import put_bytes
from .logistics import workspace_lock

URL = 'https://data.ncpor.res.in/'
POLICY = 'https://npdc.ncpor.res.in/npdc/mainmenu_home.action?main_menu_id=55&main_menu_name=Data+Policy+%26amp%3B+Guidelines&ref_id=REF14329'
PARSER = 'ncpor-published-weather-v1'
LIMIT = 2_000_000

class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None

class PageText(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts = []
        self.hidden = 0
    def handle_starttag(self, tag, attrs):
        if tag in ('script', 'style', 'noscript'): self.hidden += 1
    def handle_endtag(self, tag):
        if tag in ('script', 'style', 'noscript'): self.hidden = max(0, self.hidden - 1)
    def handle_data(self, data):
        if not self.hidden: self.parts.append(data)

def parse_page(raw):
    page = PageText(); page.feed(raw.decode('utf-8-sig'))
    text = re.sub(r'\s+', ' ', ' '.join(page.parts)).replace('−', '-')
    result = {}
    for station in ('maitri', 'bharati'):
        labels = list(re.finditer(r'Antarctica\s*[-–—:]\s*'+station+r'\s*:', text, re.I))
        if len(labels) != 1: raise ValueError('Station heading missing or ambiguous')
        tail = text[labels[0].end():]
        tail = re.split(r'(?:Antarctica|Himalaya|Arctic)\s*[-–—:]', tail, maxsplit=1, flags=re.I)[0]
        match = re.match(r'\s*([-+]?\d+(?:\.\d+)?)\s*°\s*C\s+(\d{2}\s+[A-Za-z]{3}\s+\d{4}\s+\d{1,2}:\d{2}\s+[AP]M)(?:\s+(UTC|GMT))?', tail, re.I)
        if not match: raise ValueError('Temperature/time format differs from parser contract')
        value = float(match[1])
        if not -100 <= value <= 60: raise ValueError('Temperature outside intake screening range')
        stamp = datetime.strptime(match[2], '%d %b %Y %I:%M %p')
        # Never infer UTC, IST or a station timezone from a naive timestamp.
        observed = stamp.replace(tzinfo=timezone.utc).isoformat() if match[3] else None
        result[station] = {'temperature_c':value, 'published_time_label':match[2],
            'observed_at':observed, 'timezone_status':'explicit_utc' if match[3] else 'unspecified',
            'classification':'provider_published_report', 'scientific_verification':'unverified',
            'detail':'Published page value; measurement method and reuse terms need confirmation. Not admitted to operational telemetry.'}
    return result

def download():
    req = Request(URL, headers={'User-Agent':'POLARIS-independent-SIH-prototype/0.2', 'Accept':'text/html'})
    with build_opener(NoRedirect()).open(req, timeout=20) as response:
        if response.status != 200: raise ValueError('Unexpected provider response')
        raw = response.read(LIMIT + 1)
        if len(raw) > LIMIT: raise ValueError('Provider response exceeds limit')
        return raw

def latest(db, station):
    return db.scalar(select(OfficialWeatherReport).where(OfficialWeatherReport.workspace=='operational',OfficialWeatherReport.station==station).order_by(OfficialWeatherReport.acquired_at.desc(),OfficialWeatherReport.id.desc()).limit(1))

def refresh(db, actor):
    # One page contains both stations. Serialize requests, including cooldown check.
    workspace_lock(db, 'operational')
    previous = latest(db, 'maitri')
    if previous and datetime.fromisoformat(previous.acquired_at) > datetime.now(timezone.utc)-timedelta(hours=1):
        return [latest(db, station) for station in ('maitri','bharati')]
    acquired = now(); raw = None; key = None; checksum = None; parsed = {}
    status = 'failed'; detail = ''
    try:
        raw = download()
        key, checksum = put_bytes('operational', raw)
        parsed = parse_page(raw)
        status = 'review_required'
        detail = 'Original provider page retrieved. Reports await timestamp, measurement and reuse review; no telemetry inserted.'
    except HTTPError as exc:
        detail = f'Provider HTTP {exc.code}. No substitute data generated.'
    except Exception as exc:
        detail = f'{type(exc).__name__}: provider retrieval or validation failed. No substitute data generated.'
    rows = []
    for station in ('maitri','bharati'):
        row = OfficialWeatherReport(workspace='operational',station=station,status=status,reference=URL,
            acquired_at=acquired,parser_version=PARSER,checksum=checksum,storage_key=key,
            payload=parsed.get(station,{}),detail=detail)
        db.add(row);db.flush();rows.append(row)
        audit(db,'operational',station,actor,'official_weather_'+status,row.id,{'reference':URL,'checksum':checksum,'detail':detail})
    return rows

def summary(db, station):
    current = latest(db, station)
    accepted = db.scalar(select(OfficialWeatherReport).where(OfficialWeatherReport.workspace=='operational',OfficialWeatherReport.station==station,OfficialWeatherReport.status=='review_required').order_by(OfficialWeatherReport.acquired_at.desc()).limit(1))
    def public(row):
        if not row:return None
        return {k:getattr(row,k) for k in ('id','station','status','reference','acquired_at','parser_version','checksum','payload','detail')}
    return {'provider':'NCPOR','reference':URL,'policy_reference':POLICY,'status':current.status if current else 'not_requested',
        'latest_attempt':public(current),'last_retrieved_report':public(accepted),
        'terms_status':'Dataset-specific automated access/reuse permission and timestamp semantics not confirmed',
        'refresh_interval_seconds':3600,'telemetry_admitted':False}
