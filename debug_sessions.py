
from app import create_app
import extensions

app = create_app()

with app.app_context():
    print("Connecting to DB...")
    db = extensions.db
    if db is None:
        print("DB is None")
        exit()


    with open("debug_output.txt", "w", encoding="utf-8") as f:
        f.write("--- SESSIONS COLLECTION DEBUG ---\n")
        sessions = list(db.sessions.find().limit(5))
        f.write(f"Total 'sessions' found: {len(sessions)}\n")
        
        f.write("\n--- WORKOUT_SESSIONS COLLECTION DEBUG ---\n")
        w_sessions = list(db.workout_sessions.find().limit(5))
        f.write(f"Total 'workout_sessions' found: {len(w_sessions)}\n")
        
        # Use w_sessions if valid, else sessions
        scan_list = w_sessions if w_sessions else sessions
        
        for s in scan_list:
            uid = s.get("user_id")
            f.write(f"\nSession ID: {s.get('_id')}\n")
            f.write(f"User ID: {uid} (Type: {type(uid)})\n")
            f.write(f"Started At: {s.get('started_at')} (Type: {type(s.get('started_at'))})\n")
            f.write(f"Created At: {s.get('created_at')} (Type: {type(s.get('created_at'))})\n")
            
        f.write("\n--- PLAN DEBUG ---\n")
        plans = list(db.plans.find().limit(1))
        for p in plans:
            uid = p.get("user_id")
            f.write(f"\nPlan ID: {p.get('_id')}\n")
            f.write(f"User ID: {uid} (Type: {type(uid)})\n")
            
        f.write("\n--- ROUTINE ASSIGNMENTS DEBUG ---\n")
        assigns = list(db.routine_assignments.find().limit(1))
        for a in assigns:
            uid = a.get("user_id")
            f.write(f"\nAssignment ID: {a.get('_id')}\n")
            f.write(f"User ID: {uid} (Type: {type(uid)})\n")
            
    print("Debug written to debug_output.txt")
