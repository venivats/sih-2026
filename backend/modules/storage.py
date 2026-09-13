import os,hashlib
from pathlib import Path

def put_bytes(workspace,data):
    digest=hashlib.sha256(data).hexdigest();key=workspace+'/'+digest
    if os.getenv('S3_BUCKET'):
        import boto3
        boto3.client('s3',endpoint_url=os.getenv('S3_ENDPOINT_URL')).put_object(Bucket=os.environ['S3_BUCKET'],Key=key,Body=data,ContentType='application/octet-stream')
    else:
        if os.getenv('VERCEL'): raise RuntimeError('Durable S3 storage is required on Vercel')
        path=Path(os.getenv('STORAGE_PATH','storage'))/key;path.parent.mkdir(parents=True,exist_ok=True)
        if not path.exists():
            try:
                with path.open('xb') as f: f.write(data);f.flush();os.fsync(f.fileno())
            except FileExistsError: pass
    return key,digest

def get_bytes(key):
    if '..' in key or key.startswith('/'): raise ValueError('Invalid key')
    if os.getenv('S3_BUCKET'):
        import boto3
        return boto3.client('s3',endpoint_url=os.getenv('S3_ENDPOINT_URL')).get_object(Bucket=os.environ['S3_BUCKET'],Key=key)['Body'].read()
    return (Path(os.getenv('STORAGE_PATH','storage'))/key).read_bytes()
