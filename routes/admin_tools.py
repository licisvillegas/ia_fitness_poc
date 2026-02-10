from flask import Blueprint, request, jsonify, render_template, current_app, send_from_directory, url_for
import os
import shutil
import uuid
import glob
from werkzeug.utils import secure_filename
import platform
import time
import psutil
from datetime import datetime
from utils.auth_helpers import check_admin_access
from utils.gif_master import GifMaster
from extensions import db, logger, openai_key
import requests


admin_tools_bp = Blueprint('admin_tools', __name__)

ALLOWED_EXTENSIONS = {'gif', 'png', 'jpg', 'jpeg'}
UPLOAD_FOLDER = 'static/tmp/gif_master'

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def get_upload_folder():
    folder = os.path.join(current_app.root_path, UPLOAD_FOLDER)
    if not os.path.exists(folder):
        os.makedirs(folder)
    return folder

@admin_tools_bp.route("/admin/tools/gif-master")
def gif_master_page():
    ok, err = check_admin_access()
    if not ok: return err
    return render_template("admin_gif_master.html")

@admin_tools_bp.route("/api/admin/tools/gif-master/decompose", methods=['POST'])
def decompose_gif():
    ok, err = check_admin_access()
    if not ok: return err

    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400

    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        unique_id = str(uuid.uuid4())
        session_folder = os.path.join(get_upload_folder(), unique_id)
        os.makedirs(session_folder, exist_ok=True)
        
        filepath = os.path.join(session_folder, filename)
        file.save(filepath)

        # Decompose
        GifMaster.descomponer_gif(filepath, session_folder)
        
        # List frames
        frames = sorted(glob.glob(os.path.join(session_folder, "frame_*.png")))
        frame_urls = []
        for frame in frames:
            frame_name = os.path.basename(frame)
            frame_urls.append(url_for('admin_tools.serve_frame', session_id=unique_id, filename=frame_name))

        return jsonify({
            "success": True, 
            "session_id": unique_id, 
            "frames": frame_urls,
            "original_filename": filename
        })

    return jsonify({"error": "File type not allowed"}), 400

@admin_tools_bp.route("/api/admin/tools/gif-master/create", methods=['POST'])
def create_gif():
    ok, err = check_admin_access()
    if not ok: return err

    data = request.get_json()
    session_id = data.get('session_id')
    selected_frames = data.get('frames', []) # List of filenames or indices? Let's expect filenames for safety or full URLs and parse
    duration = int(data.get('duration', 100))
    loop = int(data.get('loop', 0)) # 0 = infinite

    if not session_id or not selected_frames:
        return jsonify({"error": "Missing data"}), 400

    session_folder = os.path.join(get_upload_folder(), session_id)
    if not os.path.exists(session_folder):
        return jsonify({"error": "Session expired or invalid"}), 404

    # Validate and build full paths
    image_paths = []
    for frame_url_or_name in selected_frames:
        # Extract filename if it's a URL, or use as is
        filename = os.path.basename(frame_url_or_name)
        # Security check: ensure file exists in session folder
        path = os.path.join(session_folder, filename)
        if os.path.exists(path):
            image_paths.append(path)
    
    if not image_paths:
         return jsonify({"error": "No valid frames selected"}), 400

    output_filename = f"result_{str(uuid.uuid4())[:8]}.gif"
    output_path = os.path.join(session_folder, output_filename)

    width = data.get('width')
    height = data.get('height')
    target_size = None
    if width and height:
        try:
            target_size = (int(width), int(height))
        except ValueError:
             pass

    success = GifMaster.crear_gif_personalizado(image_paths, output_path, duracion=duration, loop=loop, target_size=target_size)
    
    if success:
        return jsonify({
            "success": True,
            "gif_url": url_for('admin_tools.serve_frame', session_id=session_id, filename=output_filename)
        })
    else:
        return jsonify({"error": "Failed to create GIF"}), 500

@admin_tools_bp.route("/admin/tools/gif-master/files/<session_id>/<filename>")
def serve_frame(session_id, filename):
    # Public or admin? Let's restrict to admin for now, or just public if it's in static
    # Since it is serving from a specific upload folder, let's use send_from_directory
    # Note: check_admin_access() might act as middleware if we want strictness
    # But for <img> tags it might be annoying if no cookie. 
    # Let's rely on obscure URLs (UUIDs) + maybe check logic if sensitive.
    # For now, open access given UUID knowledge is "okay" for a tool.
    
    folder = os.path.join(get_upload_folder(), session_id)
    return send_from_directory(folder, filename)

@admin_tools_bp.route("/api/admin/tools/gif-master/cleanup", methods=['POST'])
def cleanup_session():
    # Optional endpoint to clear tmp files
    ok, err = check_admin_access()
    if not ok: return err
    data = request.get_json()
    session_id = data.get('session_id')
    if session_id:
        folder = os.path.join(get_upload_folder(), session_id)
        if os.path.exists(folder):
            try:
                shutil.rmtree(folder)
            except: pass
    return jsonify({"success": True})
@admin_tools_bp.route("/api/admin/tools/gif-master/upload-images", methods=['POST'])
def upload_images():
    ok, err = check_admin_access()
    if not ok: return err

    if 'files[]' not in request.files:
        return jsonify({"error": "No files part"}), 400
    
    files = request.files.getlist('files[]')
    if not files or files[0].filename == '':
        return jsonify({"error": "No selected files"}), 400

    session_id = request.form.get('session_id')
    if not session_id:
        unique_id = str(uuid.uuid4())
    else:
        unique_id = session_id

    session_folder = os.path.join(get_upload_folder(), unique_id)
    os.makedirs(session_folder, exist_ok=True)
    
    saved_frames = []

    for i, file in enumerate(files):
        if file and allowed_file(file.filename):
            # Preserve original filename order if possible, or rename to sortable
            # Use timestamp to avoid collisions in append mode
            import time
            timestamp = int(time.time() * 1000)
            ext = file.filename.rsplit('.', 1)[1].lower()
            filename = f"img_{timestamp}_{i:03d}_{secure_filename(file.filename)}"
            filepath = os.path.join(session_folder, filename)
            file.save(filepath)
            saved_frames.append(filename)

    if not saved_frames:
        return jsonify({"error": "No valid images saved"}), 400

    # List frames
    # frames = sorted(glob.glob(os.path.join(session_folder, "img_*.png"))) 
    # Can't rely on glob if extensions vary. Let's just use the saved list since we know the order.
    
    frame_urls = []
    for filename in saved_frames:
         frame_urls.append(url_for('admin_tools.serve_frame', session_id=unique_id, filename=filename))

    return jsonify({
        "success": True, 
        "session_id": unique_id, 
        "frames": frame_urls
    })


# ======================================================
# SYSTEM HEALTH DASHBOARD
# ======================================================

@admin_tools_bp.route("/admin/system-health")
def system_health_page():
    ok, err = check_admin_access()
    if not ok: return err
    return render_template("admin_system_health.html")

@admin_tools_bp.route("/api/admin/system-health/status")
def system_health_status():
    ok, err = check_admin_access()
    if not ok: return err

    status = {
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "services": {},
        "server": {}
    }

    # 1. MongoDB Check
    mongo_status = {"status": "unknown", "ping_ms": 0}
    try:
        if db is not None:
            start_time = time.time()
            # Execute a lightweight command
            db.command('ping')
            latency = (time.time() - start_time) * 1000
            mongo_status = {
                "status": "connected", 
                "ping_ms": round(latency, 2),
                "message": "Conexión estable"
            }
        else:
             mongo_status = {"status": "disconnected", "message": "DB instance is None"}
    except Exception as e:
        mongo_status = {"status": "error", "message": str(e)}
    status["services"]["mongodb"] = mongo_status

    # 2. Redis Check
    from utils.cache import _get_redis_client
    redis_status = {"status": "unknown"}
    try:
        r_client = _get_redis_client()
        if r_client:
            if r_client.ping():
                redis_status = {"status": "connected", "message": "Redis activo"}
            else:
                redis_status = {"status": "error", "message": "Ping fallido"}
        else:
            redis_status = {"status": "disabled", "message": "No configurado (Memoria local)"}
    except Exception as e:
        redis_status = {"status": "error", "message": str(e)}
    status["services"]["redis"] = redis_status

    # 3. OpenAI Check
    openai_status = {"status": "unknown"}
    if openai_key:
        openai_status = {"status": "configured", "message": "API Key cargada"}
        # Optional: Make a tiny request to verify validity
    else:
        openai_status = {"status": "missing", "message": "API Key no encontrada"}
    status["services"]["openai"] = openai_status

    # 4. Server Metrics (psutil)
    try:
        cpu_usage = psutil.cpu_percent(interval=None)
        memory = psutil.virtual_memory()
        disk = psutil.disk_usage('/')
        
        status["server"] = {
            "cpu_percent": cpu_usage,
            "memory_percent": memory.percent,
            "memory_used_gb": round(memory.used / (1024**3), 2),
            "memory_total_gb": round(memory.total / (1024**3), 2),
            "disk_percent": disk.percent,
            "platform": platform.system(),
            "uptime_seconds": int(time.time() - psutil.boot_time())
        }
    except Exception as e:
        status["server"] = {"error": str(e)}

    return jsonify(status)
