"""One bounded, cached NASA POWER connector. It never claims station observations."""
import json,math
from datetime import datetime,timedelta,timezone
from urllib.request import urlopen,Request
from urllib.parse import urlencode
from ..models import Acquisition,Source,Asset,Measurement
from ..common import scoped,audit
from .storage import put_bytes
from .telemetry import ingest

PARAMS={'parameters':'T2M,WS10M','community':'RE','start':'20240101','end':'20240107','format':'JSON','time-standard':'UTC'}
COORDS={'maitri':(-70.764,11.734),'bharati':(-69.408,76.188)}
def provider_url(s):
    lat,lon=COORDS[s]
    return 'https://power.larc.nasa.gov/api/temporal/daily/point?'+urlencode({**PARAMS,'latitude':lat,'longitude':lon})

def acquire(db,w,s,actor):
    from .logistics import workspace_lock
    workspace_lock(db,w)
    url=provider_url(s)
    recent=db.scalar(scoped(db,Acquisition,w,s).where(Acquisition.reference==url).order_by(Acquisition.acquired_at.desc()).limit(1))
    if recent and datetime.fromisoformat(recent.acquired_at)>datetime.now(timezone.utc)-timedelta(days=1): return recent
    entry=Acquisition(workspace=w,station=s,provider='NASA POWER',reference=url,status='pending',detail='')
    db.add(entry);db.flush()
    raw=None
    try:
        with urlopen(Request(url,headers={'User-Agent':'POLARIS-SIH-prototype/0.1'}),timeout=20) as response: raw=response.read(2_000_001)
        if len(raw)>2_000_000: raise ValueError('Provider response exceeded size limit')
        key,checksum=put_bytes(w,raw);payload=json.loads(raw)
        parameters=payload['properties']['parameter'];units=payload['parameters']
        if units['T2M']['units']!='C' or units['WS10M']['units']!='m/s': raise ValueError('Provider units differ from parser contract')
        if payload['header'].get('time_standard')!='UTC': raise ValueError('Provider time standard is not UTC')
        # Validate entire response before inserting telemetry.
        parsed=[]
        for code,metric,unit in [('T2M','temperature','degC'),('WS10M','wind_speed','m/s')]:
            for date,value in parameters[code].items():
                t=datetime.strptime(date,'%Y%m%d').replace(tzinfo=timezone.utc).isoformat()
                if not '20240101'<=date<='20240107': raise ValueError('Date outside requested period')
                v=None if value==payload['header']['fill_value'] else float(value)
                if v is not None and not math.isfinite(v): raise ValueError('Nonfinite provider value')
                parsed.append((metric,unit,t,v))
        if not parsed: raise ValueError('Provider returned no values')
        source=Source(workspace=w,station=s,title='NASA POWER daily point meteorology, 1–7 January 2024',provider='NASA POWER / MERRA-2',reference=url,origin='reanalysis',verification='provider_retrieved',checksum=checksum,parser_version='nasa-power-daily-v1',transformations=['Daily UTC grid means; timestamp denotes start of aggregation day','T2M C mapped to degC; WS10M m/s retained','Provider fill values retained as null','Approximate query coordinate; not a surveyed station position'],storage_key=key,uploader=actor,licence='NASA-managed AWS registry lists CC BY 4.0 and requests attribution; NASA catalog does not specify a licence. See https://registry.opendata.aws/nasa-power/')
        db.add(source);db.flush()
        asset=db.scalar(scoped(db,Asset,w,s).where(Asset.code=='ENV-GRID'))
        if not asset:
            asset=Asset(workspace=w,station=s,code='ENV-GRID',name='NASA POWER grid estimate',kind='environment',critical=False,position={},documentation=[]);db.add(asset);db.flush()
        for metric,unit,t,value in parsed:
            if db.scalar(scoped(db,Measurement,w,s).where(Measurement.asset_id==asset.id,Measurement.metric==metric,Measurement.observed_at==t)):continue
            ingest(db,w,s,{'asset_id':asset.id,'source_id':source.id,'metric':metric,'unit':unit,'observed_at':t,'value':value,'quality':'provider_grid_estimate'},actor,evaluate=False)
        entry.status='succeeded';entry.source_id=source.id;entry.detail=f'{len(parsed)} daily grid values parsed. Not station observations.'
    except Exception as e:
        entry.status='failed';entry.detail=type(e).__name__+': provider retrieval or validation failed. No substitute data generated.'
        if raw:
            key,checksum=put_bytes(w,raw);entry.detail+=' Original response retained: '+checksum
    audit(db,w,s,actor,'provider_'+entry.status,entry.id,{'url':url,'detail':entry.detail})
    return entry
