from ..models import Asset,Edge
from ..common import scoped,serialize,record

def impact(db,w,s,asset_id):
    record(db,Asset,asset_id,w,s)
    edges=list(db.scalars(scoped(db,Edge,w,s)));assets=list(db.scalars(scoped(db,Asset,w,s)))
    def walk(direction):
        found=set();frontier=[asset_id]
        while frontier:
            current=frontier.pop()
            for e in edges:
                a,b=(e.upstream,e.downstream) if direction=='down' else (e.downstream,e.upstream)
                if a==current and b!=asset_id and b not in found: found.add(b);frontier.append(b)
        return found
    down=walk('down');up=walk('up')
    return {'asset_id':asset_id,'downstream':[serialize(a) for a in assets if a.id in down],'upstream':[serialize(a) for a in assets if a.id in up],'alternate_paths':[serialize(e) for e in edges if e.backup and e.downstream in down and e.upstream not in down and e.upstream!=asset_id],'topology_verified':False,'uncertainty':'Illustrative and incomplete topology. Reachability does not establish actual failure propagation or successful failover.'}
