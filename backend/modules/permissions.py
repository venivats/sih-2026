"""Project-defined permissions, not a claimed NCPOR staffing hierarchy."""
ALL={'maintenance','logistics','operations','research','handover','telemetry','settings'}
ROLE_AREAS={
    'public':set(), 'viewer':set(), 'scientist':{'research','handover'},
    'maintenance_engineer':{'maintenance','handover'},
    'logistics_coordinator':{'logistics','operations','handover'},
    'station_lead':{'maintenance','logistics','operations','research','handover'},
    'operator':ALL-{'settings'}, 'administrator':ALL, 'demo_operator':ALL-{'settings'},
}
def can_write(role,area):return area in ROLE_AREAS.get(role,set())
def operation_area(kind):return kind if kind in ('research','handover') else 'operations'
