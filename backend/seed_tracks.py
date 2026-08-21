"""
填充公共基因组 track 数据
运行: python manage.py shell < seed_tracks.py
"""
import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from accounts.models import GenomicTrack

tracks = [
    {
        "name": "HG00103 (1000 Genomes)",
        "description": "1000 Genomes 样本 HG00103 (GBR 英国人群) 低覆盖度比对数据",
        "track_type": "alignment",
        "genome": "hg38",
        "url": "https://s3.amazonaws.com/1000genomes/data/HG00103/alignment/HG00103.alt_bwamem_GRCh38DH.20150718.GBR.low_coverage.cram",
        "index_url": "https://s3.amazonaws.com/1000genomes/data/HG00103/alignment/HG00103.alt_bwamem_GRCh38DH.20150718.GBR.low_coverage.cram.crai",
        "file_format": "cram",
        "is_public": True,
    },
    {
        "name": "HG00105 (1000 Genomes)",
        "description": "1000 Genomes 样本 HG00105 (GBR 英国人群) 低覆盖度比对数据",
        "track_type": "alignment",
        "genome": "hg38",
        "url": "https://s3.amazonaws.com/1000genomes/data/HG00105/alignment/HG00105.alt_bwamem_GRCh38DH.20150718.GBR.low_coverage.cram",
        "index_url": "https://s3.amazonaws.com/1000genomes/data/HG00105/alignment/HG00105.alt_bwamem_GRCh38DH.20150718.GBR.low_coverage.cram.crai",
        "file_format": "cram",
        "is_public": True,
    },
]

for track_data in tracks:
    obj, created = GenomicTrack.objects.get_or_create(
        name=track_data["name"],
        defaults=track_data,
    )
    if created:
        print(f"Created: {obj.name}")
    else:
        print(f"Already exists: {obj.name}")

print(f"\nTotal tracks: {GenomicTrack.objects.count()}")
