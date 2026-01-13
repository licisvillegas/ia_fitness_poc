import requests
import json
import codecs

try:
    print("Fetching exercises...")
    res = requests.get("http://localhost:5000/workout/api/exercises")
    if res.status_code != 200:
        print(f"Failed to fetch: {res.status_code}")
        exit()
        
    exercises = res.json()
    
    # Filter for cardio or 'Correr'
    cardio = []
    for e in exercises:
        e_type = e.get('type') or e.get('exercise_type')
        name = e.get('name') or e.get('exercise_name') or ''
        
        if e_type == 'cardio' or 'Correr' in name or 'Caminar' in name or 'Bici' in name:
            cardio.append(e)

    print(f"Found {len(cardio)} cardio-related exercises.")
    
    output = []
    output.append(f"Found {len(cardio)} cardio-related exercises.")
    
    for c in cardio:
        name = c.get('name') or c.get('exercise_name') or 'Unknown'
        _id = c.get('_id') or c.get('id')
        subs = c.get('substitutes', [])
        equivs = c.get('equivalents', [])
        eq_exercises = c.get('equivalent_exercises', [])
        
        output.append(f"ID: {_id} | Name: {name}")
        
        all_subs = subs + equivs + eq_exercises
        output.append(f"  - Total Subs/Equivs: {len(all_subs)}")
        
        if all_subs:
            names = []
            for s in all_subs:
                if isinstance(s, dict):
                    names.append(s.get('name') or s.get('exercise_name') or 'Unknown')
                else:
                    names.append(f"ID:{s}")
            output.append(f"  - Data: {names}")
        else:
            output.append("  - NO SUBSTITUTES FOUND")
            
    with codecs.open('subs_clean.txt', 'w', 'utf-8') as f:
        f.write('\n'.join(output))
        
    print("Done writing to subs_clean.txt")
            
except Exception as e:
    print(f"Error: {e}")
