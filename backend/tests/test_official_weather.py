"""Fabricated HTML fixtures test intake logic; they are NOT provider acquisitions."""
import hashlib
from datetime import datetime,timedelta,timezone
from urllib.error import HTTPError
from sqlalchemy import select,func
import pytest
from backend.tests.test_workflow import client,private
from backend.tests.test_acceptance import admin
from backend.models import OfficialWeatherReport,Measurement
from backend.modules import official_weather as feed
from backend.modules.storage import get_bytes

FIXTURE=b'<h1>Weather at Indian Polar Stations</h1><h5>Antarctica - Maitri:</h5><p>-21.5&deg; C</p><time>08 Sep 2026 11:00 PM</time><h5>Antarctica - Bharati:</h5><p>-19.2&deg; C</p><time>08 Sep 2026 11:00 PM</time>'

def test_parser_preserves_unknown_timezone_and_rejects_changed_page():
    result=feed.parse_page(FIXTURE)
    assert result['maitri']['temperature_c']==-21.5
    assert result['maitri']['observed_at'] is None
    assert result['bharati']['timezone_status']=='unspecified'
    utc=feed.parse_page(FIXTURE.replace(b'PM',b'PM UTC'))
    assert utc['maitri']['observed_at']=='2026-09-08T23:00:00+00:00'
    for raw in [b'<h1>Login required</h1>',FIXTURE.replace(b'-21.5',b'NaN'),FIXTURE.replace(b'-21.5',b'900'),FIXTURE+FIXTURE]:
        with pytest.raises(ValueError):feed.parse_page(raw)
    assert feed.parse_page(b'<script>Antarctica - Maitri: 999 C</script>'+FIXTURE)==result

def test_official_intake_is_admin_only_preserves_original_and_never_seeds_telemetry(client,monkeypatch,tmp_path):
    c,Session=client;h=admin(Session);a,guest=private(c)
    monkeypatch.setenv('STORAGE_PATH',str(tmp_path/'originals'))
    calls=[]
    def retrieve():calls.append(True);return FIXTURE
    monkeypatch.setattr(feed,'download',retrieve)
    path='/api/w/operational/maitri/official-weather'
    assert c.get(path).status_code==403
    assert c.post(path+'/refresh',headers=guest,json={}).status_code==403
    assert c.get(path,headers=h).json()['status']=='not_requested'
    first=c.post(path+'/refresh',headers=h,json={});assert first.status_code==200,first.text
    data=first.json();assert data['status']=='review_required' and not data['telemetry_admitted']
    assert data['last_retrieved_report']['payload']['observed_at'] is None
    assert c.post(path+'/refresh',headers=h,json={}).json()==data
    assert len(calls)==1
    with Session() as db:
        rows=list(db.scalars(select(OfficialWeatherReport)));assert len(rows)==2
        assert get_bytes(rows[0].storage_key)==FIXTURE
        assert rows[0].checksum==hashlib.sha256(FIXTURE).hexdigest()
        assert db.scalar(select(func.count()).select_from(Measurement).where(Measurement.workspace=='operational'))==0
    assert c.get('/api/w/operational/maitri/snapshot',headers=h).json()['measurements']==[]
    assert c.get('/api/w/operational/bharati/official-weather',headers=h).json()['last_retrieved_report']['payload']['temperature_c']==-19.2

def test_failed_refresh_retains_prior_report_and_records_failure(client,monkeypatch,tmp_path):
    c,Session=client;h=admin(Session);monkeypatch.setenv('STORAGE_PATH',str(tmp_path/'originals'))
    monkeypatch.setattr(feed,'download',lambda:FIXTURE)
    path='/api/w/operational/maitri/official-weather'
    before=c.post(path+'/refresh',headers=h,json={}).json()
    with Session() as db:
        for row in db.scalars(select(OfficialWeatherReport)):row.acquired_at=(datetime.now(timezone.utc)-timedelta(hours=2)).isoformat()
        db.commit()
    def fail():raise HTTPError(feed.URL,502,'Bad Gateway',{},None)
    monkeypatch.setattr(feed,'download',fail)
    after=c.post(path+'/refresh',headers=h,json={}).json()
    assert after['status']=='failed' and '502' in after['latest_attempt']['detail']
    assert after['latest_attempt']['payload']=={}
    assert after['last_retrieved_report']['id']==before['last_retrieved_report']['id']


def test_acquired_official_original_matches_manifest_and_unzoned_report():
    from pathlib import Path
    import json
    manifest=json.loads(Path('data/acquisitions/ncpor/2026-09-10.json').read_text())
    raw=Path(manifest['original_path']).read_bytes()
    assert hashlib.sha256(raw).hexdigest()==manifest['checksum']
    reports=feed.parse_page(raw)
    assert reports['maitri']['temperature_c']==-17.2
    assert reports['bharati']['temperature_c']==-17.1
    assert all(r['observed_at'] is None for r in reports.values())
