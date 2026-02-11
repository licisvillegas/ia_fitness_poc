from celery import Celery
from config import Config

def make_celery(app_name=__name__):
    celery_app = Celery(
        app_name,
        broker=Config.REDIS_URL,
        backend=Config.REDIS_URL,
        include=['celery_app.tasks.ai_tasks']
    )
    
    celery_app.conf.update(
        task_serializer='json',
        accept_content=['json'],
        result_serializer='json',
        timezone='UTC',
        enable_utc=True,
        task_track_started=True,
        task_time_limit=300,  # 5 minutes
        worker_prefetch_multiplier=1 # Fair dispatch
    )
    
    return celery_app

celery_app = make_celery('synapse_fit')
