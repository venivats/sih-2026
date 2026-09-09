"""Private training events reuse the ingestion/rule engine in one transaction."""
from datetime import datetime, timedelta
from fastapi import HTTPException
from ..models import Asset, Rule, Source, Measurement, Audit
from ..common import scoped, audit
from .telemetry import ingest

def run_exercise(db, workspace, station, actor, preset, key):
    if not workspace.startswith('session-'):
        raise HTTPException(403, 'Exercises require a private demonstration session')
    asset = db.scalar(scoped(db, Asset, workspace, station).where(Asset.code == 'GEN-A').with_for_update())
    if not asset:
        raise HTTPException(409, 'Primary generator is not registered')
    # Lock the asset before reading the idempotency audit or evaluating rules.
    previous = db.scalar(scoped(db, Audit, workspace, station).where(Audit.action == 'exercise_completed', Audit.entity_id == key))
    if previous:
        if previous.details['preset'] != preset:
            raise HTTPException(409, 'Idempotency key reused for another exercise')
        return previous.details
    rule = db.scalar(scoped(db, Rule, workspace, station).where(Rule.asset_id == asset.id, Rule.metric == 'coolant_temperature'))
    source = db.scalar(scoped(db, Source, workspace, station).where(Source.origin == 'simulation'))
    last = db.scalar(scoped(db, Measurement, workspace, station).where(Measurement.asset_id == asset.id, Measurement.metric == 'coolant_temperature').order_by(Measurement.observed_at.desc()))
    if not rule or not source or not last:
        raise HTTPException(409, 'Exercise requires a configured rule, simulation source and baseline reading')
    # Do not manufacture a recovery to force another incident. Active incidents deduplicate.
    values = [94.0] * rule.debounce if preset == 'overheat' else [rule.recovery_threshold - 1]
    if preset == 'overheat' and rule.threshold >= 94:
        raise HTTPException(409, 'The 94 °C preset does not breach this configured rule')
    observed = datetime.fromisoformat(last.observed_at.replace('Z', '+00:00'))
    ids = []
    for i, value in enumerate(values):
        m = ingest(db, workspace, station, dict(asset_id=asset.id, source_id=source.id,
            metric='coolant_temperature', value=value, unit='degC',
            observed_at=(observed + timedelta(minutes=i+1)).isoformat(), quality='synthetic'), actor)
        ids.append(m.id)
    result = dict(preset=preset, model_version='exercise-v1', measurement_ids=ids,
                  alert_id=rule.active_alert, asset_id=asset.id,
                  assumption='Synthetic training readings advance the historical record; no real equipment control.')
    audit(db, workspace, station, actor, 'exercise_completed', key, result)
    return result
