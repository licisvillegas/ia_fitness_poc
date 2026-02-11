from celery_app import celery_app
from app import create_app

flask_app = create_app()
flask_app.app_context().push()
